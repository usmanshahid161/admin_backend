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
    // Each tenant submits templates against their own WABA now — this
    // scopes every query/mutation the same way Tags/Queues/etc already are.
    tenantId: { type: String, required: true, index: true },

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
        // Human-readable name for the header's single variable (e.g.
        // "customer_name") — shown instead of a bare "{{1}}" wherever a
        // campaign collects/maps values for this template (see
        // campaign-service's contact list creation flow). Purely local;
        // never sent to Meta, which only knows positional {{n}}.
        variableName: String,
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
        // Human-readable name per {{n}}, same order/indexing as
        // `examples` (variableNames[0] names {{1}}, etc.) — same purpose
        // as header.variableName above.
        variableNames: [String],
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

    // Present only when this template has a carousel — Meta's carousel
    // is a *sibling* of the main header/body/footer/buttons above, not a
    // replacement (the main body text is what shows above the cards,
    // same as the screenshot the carousel feature was scoped from).
    // Each card is structurally its own mini-template: its own media,
    // its own body text/variables, its own buttons — completely
    // independent numbering from the main body and from every other
    // card ({{1}} in card 2 has nothing to do with {{1}} in card 1).
    //
    // Meta's real constraints, enforced in common/templateValidator.js
    // rather than the schema itself (so a genuinely invalid draft can
    // still be *saved*, just not submitted):
    //   - 2 to 10 cards
    //   - every card's header must be the same media type (all IMAGE or
    //     all VIDEO — never mixed, never TEXT/DOCUMENT/NONE)
    //   - every card must have the same number of buttons, of the same
    //     types, in the same order (Meta requires this consistency
    //     across cards, not just within one)
    //   - card buttons are QUICK_REPLY or URL only — no PHONE_NUMBER,
    //     no OTP
    carousel: {
      cards: [
        {
          _id: false,
          header: {
            type: { type: String, enum: ['IMAGE', 'VIDEO'] },
            exampleUrl: String, // sample media for this specific card
          },
          body: {
            text: { type: String, maxlength: 160 },
            examples: [String],
            variableNames: [String],
          },
          buttons: [ButtonSchema],
        },
      ],
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true } // adds createdAt / updatedAt automatically
);

// Same template name can exist for different tenants (each has their own
// WABA now) or different languages, but not twice for the same tenant+language.
TemplateSchema.index({ tenantId: 1, name: 1, language: 1 }, { unique: true });

module.exports = mongoose.model('Template', TemplateSchema);