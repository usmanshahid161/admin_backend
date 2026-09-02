// services/templates.js
const axios = require('axios');
const Template = require('../models/template');
const { validateTemplatePayload } = require('../common/templateValidator');
const configs = require('../config');

// Converts our internal document shape into Meta's `components` array format
function buildMetaComponents(template) {
  // AUTHENTICATION templates have a structurally different shape — no
  // header, no free-form body/footer text (Meta generates it), and
  // exactly one OTP-type button. Not just a stricter version of the
  // normal shape, so this is a separate branch rather than reusing the
  // header/body/footer/buttons fields below.
  if (template.category === 'AUTHENTICATION') {
    return buildAuthenticationComponents(template);
  }

  const components = [];
  const { header, body, footer, buttons } = template.components || {};

  if (header?.type && header.type !== 'NONE') {
    const headerComponent = { type: 'HEADER', format: header.type };
    if (header.type === 'TEXT') {
      headerComponent.text = header.text;
      if (header.example) {
        headerComponent.example = { header_text: [header.example] };
      }
    } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(header.type)) {
      // exampleUrl here is expected to already be a Meta media handle
      // obtained via the Resumable Upload API before calling this service.
      headerComponent.example = { header_handle: [header.exampleUrl] };
    }
    components.push(headerComponent);
  }

  components.push({
    type: 'BODY',
    text: body.text,
    ...(body.examples?.length ? { example: { body_text: [body.examples] } } : {}),
  });

  if (footer?.text) {
    components.push({ type: 'FOOTER', text: footer.text });
  }

  if (buttons?.length) {
    components.push({
      type: 'BUTTONS',
      buttons: buttons.map((b) => {
        if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url };
        if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phoneNumber };
        if (b.type === 'COPY_CODE') return { type: 'COPY_CODE', text: b.text };
        return { type: 'QUICK_REPLY', text: b.text };
      }),
    });
  }

  return components;
}

// See: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates
function buildAuthenticationComponents(template) {
  const auth = template.components?.authentication || {};
  const otpButton = template.components?.buttons?.[0] || {};

  const components = [
    {
      type: 'BODY',
      ...(auth.addSecurityRecommendation ? { add_security_recommendation: true } : {}),
    },
  ];

  if (auth.codeExpirationMinutes) {
    components.push({ type: 'FOOTER', code_expiration_minutes: auth.codeExpirationMinutes });
  }

  const otp = { type: 'OTP', otp_type: (otpButton.otpType || 'COPY_CODE').toLowerCase() };
  if (['ONE_TAP', 'ZERO_TAP'].includes(otpButton.otpType) && otpButton.packageName && otpButton.signatureHash) {
    otp.supported_apps = [{ package_name: otpButton.packageName, signature_hash: otpButton.signatureHash }];
  }

  components.push({ type: 'BUTTONS', buttons: [otp] });

  return components;
}

async function listTemplates(tenantId, { status, category, search } = {}) {
  const query = { tenantId };
  if (status) query.status = status;
  if (category) query.category = category;
  if (search) query.name = { $regex: search, $options: 'i' };
  return Template.find(query).sort({ createdAt: -1 }).lean();
}

async function getTemplateById(tenantId, id) {
  const template = await Template.findOne({ _id: id, tenantId }).lean();
  if (!template) {
    const err = new Error('Template not found');
    err.statusCode = 404;
    throw err;
  }
  return template;
}

async function createTemplate(tenantId, phone, payload, userId) {
  const errors = validateTemplatePayload(payload);
  if (errors.length) {
    const err = new Error('Validation failed');
    err.statusCode = 422;
    err.details = errors;
    throw err;
  }

  const status = payload.status === 'PENDING' ? 'PENDING' : 'DRAFT';

  let template;
  try {
    template = await Template.create({ ...payload, tenantId, status, createdBy: userId });
  } catch (err) {
    if (err.code === 11000) {
      const dupErr = new Error(
        `A template named "${payload.name}" already exists for language "${payload.language}". Use a different name, or edit the existing one instead.`
      );
      dupErr.statusCode = 409;
      throw dupErr;
    }
    throw err;
  }

  if (status === 'PENDING') {
    await submitToMeta(tenantId, phone, template);
  }

  return Template.findById(template._id).lean();
}

async function updateTemplate(tenantId, phone, id, payload) {
  const existing = await Template.findOne({ _id: id, tenantId });
  if (!existing) {
    const err = new Error('Template not found');
    err.statusCode = 404;
    throw err;
  }
  if (!['DRAFT', 'REJECTED'].includes(existing.status)) {
    const err = new Error('Only DRAFT or REJECTED templates can be edited');
    err.statusCode = 409;
    throw err;
  }

  const errors = validateTemplatePayload(payload);
  if (errors.length) {
    const err = new Error('Validation failed');
    err.statusCode = 422;
    err.details = errors;
    throw err;
  }

  const status = payload.status === 'PENDING' ? 'PENDING' : 'DRAFT';
  Object.assign(existing, payload, { status, rejectionReason: null });
  await existing.save();

  if (status === 'PENDING') {
    await submitToMeta(tenantId, phone, existing);
  }

  return Template.findById(id).lean();
}

async function deleteTemplate(tenantId, id) {
  const template = await Template.findOne({ _id: id, tenantId });
  if (!template) {
    const err = new Error('Template not found');
    err.statusCode = 404;
    throw err;
  }

  // Also delete on Meta's side (via the local service) if it was ever submitted
  if (template.metaTemplateId) {
    try {
      await axios.delete(`${configs.WHATSAPP_LOCAL_URL}/templates`, {
        params: { name: template.name, tenantId },
      });
    } catch (err) {
      // Log but don't block local deletion if Meta's copy is already gone
      console.error('Failed to delete template via local service:', err.response?.data || err.message);
    }
  }

  await Template.findOneAndDelete({ _id: id, tenantId });
  return { deleted: true, id };
}

// Submits a DRAFT/REJECTED template to Meta via the WhatsApp local service.
// The interaction manager never talks to graph.facebook.com directly — the
// local service owns the Graph API calls and each tenant's own credentials
// (see local_service's services/tenantCredentials.js).
async function submitToMeta(tenantId, phone, template) {
  const components = buildMetaComponents(template);

  try {
    const response = await axios.post(`${configs.WHATSAPP_LOCAL_URL}/templates`, {
      phone,
      tenantId,
      name: template.name,
      language: template.language,
      category: template.category,
      components,
    });

    // Local service (on success) responds: { success: true, template }
    const result = response?.data?.template;
    if (!result) {
      throw new Error('Invalid response from WhatsApp local service');
    }

    // Mongoose document (template) stays as-is — only update its fields, never reassign it
    template.metaTemplateId = result.metaTemplateId;
    template.wabaId = result.wabaId;
    template.status = result.status || 'PENDING';
    await template.save();

    return template;
  } catch (err) {
    // Local service (on failure) responds: { success: false, message, data: template }
    // This is NOT Meta's raw { error: { message } } shape — the local service already unwraps that.
    const message = err.response?.data?.message || err.message;
    template.status = 'REJECTED';
    template.rejectionReason = message;
    await template.save();

    const wrapped = new Error(`Meta rejected the template: ${message}`);
    wrapped.statusCode = 422;
    throw wrapped;
  }
}

async function submitTemplateForReview(tenantId, phone, id) {
  const template = await Template.findOne({ _id: id, tenantId });
  if (!template) {
    const err = new Error('Template not found');
    err.statusCode = 404;
    throw err;
  }
  if (template.status !== 'DRAFT') {
    const err = new Error('Only DRAFT templates can be submitted for review');
    err.statusCode = 409;
    throw err;
  }
  await submitToMeta(tenantId, phone, template);
  return Template.findById(id).lean();
}

// Pulls current status + quality rating for every template from Meta (via
// the local service, using this tenant's own credentials) and syncs them
// into our own DB.
async function syncTemplateStatuses(tenantId) {
  const { data } = await axios.get(`${configs.WHATSAPP_LOCAL_URL}/templates`, { params: { tenantId } });
  const metaTemplates = data?.data || [];
  console.log(metaTemplates, "helooooooooo")
  await Promise.all(
    metaTemplates.map(async (mt) => {
      await Template.findOneAndUpdate(
        { tenantId, name: mt.name, language: mt.language },
        {
          status: mt.status,
          qualityRating: mt.quality_score?.score?.toUpperCase() || 'UNKNOWN',
          rejectionReason: mt.rejected_reason || null,
          metaTemplateId: mt.id,
        }
      );
    })
  );

  return Template.find({ tenantId }).sort({ createdAt: -1 }).lean();
}

// Real-time counterpart to syncTemplateStatuses() above — called by
// cloud_service the instant Meta sends a message_template_status_update
// webhook (approved/rejected/paused/disabled), instead of waiting for
// someone to manually hit "Sync". Payload shape per Meta's docs, plus
// `wabaId` (the WhatsApp Business Account the event happened on — from
// the webhook envelope's entry.id, not Meta's own value payload) which we
// need since name+language alone is no longer unique once every tenant
// has their own WABA.
async function updateStatusFromWebhook(payload) {
  const {
    message_template_id: metaTemplateId,
    message_template_name: name,
    message_template_language: language,
    event,
    reason,
    wabaId,
  } = payload || {};

  if (!name || !language || !event) {
    const err = new Error('message_template_name, message_template_language and event are required');
    err.statusCode = 422;
    throw err;
  }

  const filter = wabaId ? { wabaId, name, language } : { name, language };

  const template = await Template.findOneAndUpdate(
    filter,
    {
      status: event,
      rejectionReason: event === 'REJECTED' ? reason || null : null,
      ...(metaTemplateId ? { metaTemplateId: String(metaTemplateId) } : {}),
    },
    { new: true }
  ).lean();

  if (!template) {
    // Meta knows about a template we don't (e.g. created directly in
    // Meta's UI, or our DB got out of sync) — not an error worth failing
    // the webhook over, just nothing to update on our side.
    return null;
  }

  return template;
}

module.exports = {
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  submitTemplateForReview,
  syncTemplateStatuses,
  updateStatusFromWebhook,
};