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
      enum: ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED'],
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
        text: { type: String, required: true, maxlength: 1024 },
        examples: [String], // example value per {{n}} variable, in order
      },
      footer: {
        text: { type: String, maxlength: 60 },
      },
      buttons: [ButtonSchema],
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true } // adds createdAt / updatedAt automatically
);

// Same template name can exist for different languages, but not twice for the same language
TemplateSchema.index({ name: 1, language: 1 }, { unique: true });

module.exports = mongoose.model('Template', TemplateSchema);