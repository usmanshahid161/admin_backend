// services/templates.js
const axios = require('axios');
const Template = require('../models/template');
const { validateTemplatePayload } = require('../common/templateValidator');
const configs = require('../config');

const WABA_ID = configs.WHATSAPP_BUSINESS_ACCOUNT_ID;

// Converts our internal document shape into Meta's `components` array format
function buildMetaComponents(template) {
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

async function listTemplates({ status, category, search } = {}) {
  const query = {};
  if (status) query.status = status;
  if (category) query.category = category;
  if (search) query.name = { $regex: search, $options: 'i' };
  return Template.find(query).sort({ createdAt: -1 }).lean();
}

async function getTemplateById(id) {
  const template = await Template.findById(id).lean();
  if (!template) {
    const err = new Error('Template not found');
    err.statusCode = 404;
    throw err;
  }
  return template;
}

async function createTemplate(payload, userId) {
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
    template = await Template.create({ ...payload, status, createdBy: userId });
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
    await submitToMeta(template);
  }

  return Template.findById(template._id).lean();
}

async function updateTemplate(id, payload) {
  const existing = await Template.findById(id);
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
    await submitToMeta(existing);
  }

  return Template.findById(id).lean();
}

async function deleteTemplate(id) {
  const template = await Template.findById(id);
  if (!template) {
    const err = new Error('Template not found');
    err.statusCode = 404;
    throw err;
  }

  // Also delete on Meta's side (via the local service) if it was ever submitted
  if (template.metaTemplateId) {
    try {
      await axios.delete(`${configs.WHATSAPP_LOCAL_URL}/templates`, {
        params: { name: template.name },
      });
    } catch (err) {
      // Log but don't block local deletion if Meta's copy is already gone
      console.error('Failed to delete template via local service:', err.response?.data || err.message);
    }
  }

  await Template.findByIdAndDelete(id);
  return { deleted: true, id };
}

// Submits a DRAFT/REJECTED template to Meta via the WhatsApp local service.
// The interaction manager never talks to graph.facebook.com directly —
// the local service owns the Graph API calls and the access token.
async function submitToMeta(template) {
  const components = buildMetaComponents(template);

  try {
    const response = await axios.post(`${configs.WHATSAPP_LOCAL_URL}/templates`, {
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

async function submitTemplateForReview(id) {
  const template = await Template.findById(id);
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
  await submitToMeta(template);
  return Template.findById(id).lean();
}

// Pulls current status + quality rating for every template from Meta (via the
// local service) and syncs them into our own DB.
async function syncTemplateStatuses() {
  const { data } = await axios.get(`${configs.WHATSAPP_LOCAL_URL}/templates`);
  const metaTemplates = data?.data || [];

  await Promise.all(
    metaTemplates.map(async (mt) => {
      await Template.findOneAndUpdate(
        { name: mt.name, language: mt.language },
        {
          status: mt.status,
          qualityRating: mt.quality_score?.score?.toUpperCase() || 'UNKNOWN',
          rejectionReason: mt.rejected_reason || null,
          metaTemplateId: mt.id,
          wabaId: WABA_ID,
        }
      );
    })
  );

  return Template.find().sort({ createdAt: -1 }).lean();
}

module.exports = {
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  submitTemplateForReview,
  syncTemplateStatuses,
};