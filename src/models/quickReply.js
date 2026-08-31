// models/quickReply.model.js
const mongoose = require('mongoose');

const QuickReplySchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    // Typed after "/" in the composer to filter/find this reply quickly —
    // kept short and unique per tenant, e.g. "refund", "hours".
    shortcut: { type: String, required: true, trim: true, lowercase: true, maxlength: 40 },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    message: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: true }
);

QuickReplySchema.index({ tenantId: 1, shortcut: 1 }, { unique: true });

module.exports = mongoose.model('QuickReply', QuickReplySchema);
