// models/tag.model.js
const mongoose = require('mongoose');

const TagSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    color: { type: String, default: '#6f6a59' },
    description: { type: String, default: '', maxlength: 300 },
  },
  { timestamps: true }
);

// Same tag name can't be created twice within the same tenant.
TagSchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Tag', TagSchema);
