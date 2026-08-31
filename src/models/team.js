// models/team.model.js
const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 300 },
    // Agent identity ids (UserIdentity._id from the auth service) — plain
    // strings, same reasoning as Group.agents above.
    agents: { type: [String], default: [] },
    queues: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Queue' }],
    groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  },
  { timestamps: true }
);

TeamSchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Team', TeamSchema);
