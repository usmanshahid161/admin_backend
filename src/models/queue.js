// models/queue.model.js
const mongoose = require('mongoose');

const QueueSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    // Simple, permanent, tenant-scoped display id (1, 2, 3...) — assigned
    // once via Counter and never reused, even if the queue is later deleted.
    queueNumber: { type: Number, required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    // Machine-readable identifier derived from name (e.g. "Billing Information"
    // -> "billing_information") — this is what shows up in the RabbitMQ queue
    // name (`{phoneNumber}_{slug}`) and routing key, so it needs to stay
    // stable and unique even if the display name changes later.
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 300 },
  },
  { timestamps: true }
);

QueueSchema.index({ tenantId: 1, name: 1 }, { unique: true });
QueueSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
QueueSchema.index({ tenantId: 1, queueNumber: 1 }, { unique: true });

module.exports = mongoose.model('Queue', QueueSchema);
