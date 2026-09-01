// models/template.model.js
const mongoose = require('mongoose');

const ButtonSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE', 'OTP'],
      required: true,
    },
    text: { type: String, required: true, maxlength: 25 },
    url: String, // for URL buttons
    phoneNumber: String, // for PHONE_NUMBER buttons
    // OTP buttons only (AUTHENTICATION category) — see components.authentication below
    otpType: { type: String, enum: ['COPY_CODE', 'ONE_TAP', 'ZERO_TAP'] },
    packageName: String, // ONE_TAP / ZERO_TAP only — Android app package
    signatureHash: String, // ONE_TAP / ZERO_TAP only — Android app signing hash
  },
  { _id: false }
);

const TemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 512,
      match: /^[a-z0-9_]+$/,
    },
    category: {
      type: String,
      enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'],
      required: true,
    },
    language: { type: String, required: true },

    status: {
      type: String,
      // Meta's message_template_status_update webhook can send any of
      // these as `event` — not just the common ones. An unlisted value
      // here means the webhook update silently fails Mongoose validation
      // (see services/templates.js updateStatusFromWebhook), so this
      // list is kept in sync with Meta's documented event values:
      // https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/message_template_status_update
      enum: [
        'DRAFT',
        'PENDING',
        'APPROVED',
        'REJECTED',
        'PAUSED',
        'DISABLED',
        'ARCHIVED',
        'UNARCHIVED',
        'DELETED',
        'FLAGGED',
        'IN_APPEAL',
        'LIMIT_EXCEEDED',
        'LOCKED',
      ],
      default: 'DRAFT',
    },
    qualityRating: {
      type: String,
      enum: ['GREEN', 'YELLOW', 'RED', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    rejectionReason: { type: String, default: null },

    // Meta's own identifiers, populated once submitted/approved
    metaTemplateId: { type: String, default: null },
    wabaId: { type: String, default: null },

    components: {
      header: {
        type: {
          type: String,
          enum: ['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'],
          default: 'NONE',
        },
        text: { type: String, maxlength: 60 },
        example: String, // example value for the header's single variable
        exampleUrl: String, // sample media URL/handle for IMAGE/VIDEO/DOCUMENT
      },
      body: {
        // Not required at the schema level — AUTHENTICATION templates
        // have no free-form body text at all (Meta generates it from
        // components.authentication.addSecurityRecommendation instead).
        // Enforced as required for MARKETING/UTILITY in
        // common/templateValidator.js, category-aware.
        text: { type: String, maxlength: 1024, default: '' },
        examples: [String], // example value per {{n}} variable, in order
      },
      footer: {
        text: { type: String, maxlength: 60 },
      },
      buttons: [ButtonSchema],

      // AUTHENTICATION category only — Meta generates the actual body/
      // footer/button text from these, not from the fields above. See
      // https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates
      // Authentication templates support no header, no custom body/footer
      // text, and exactly one OTP-type button — a structurally different
      // shape from every other category, not just a stricter version of it.
      authentication: {
        addSecurityRecommendation: { type: Boolean, default: false },
        codeExpirationMinutes: { type: Number, default: null },
      },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true } // adds createdAt / updatedAt automatically
);

// Same template name can exist for different languages, but not twice for the same language
TemplateSchema.index({ name: 1, language: 1 }, { unique: true });

module.exports = mongoose.model('Template', TemplateSchema);