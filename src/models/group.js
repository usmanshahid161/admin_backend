// models/group.model.js
const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 300 },
    // Agent identity ids (UserIdentity._id from the auth service) — plain
    // strings rather than a formal ref, since agents live in a different
    // service/database entirely.
    agents: { type: [String], default: [] },
  },
  { timestamps: true }
);

GroupSchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Group', GroupSchema);
