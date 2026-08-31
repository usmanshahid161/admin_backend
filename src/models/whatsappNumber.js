// models/whatsappNumber.model.js
const mongoose = require('mongoose');

const WhatsappNumberSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    phoneNumber: { type: String, required: true, trim: true },
    displayName: { type: String, required: true, trim: true, maxlength: 100 },

    // One queue per number, per your call — this drives RabbitMQ routing
    // (see services/whatsappNumbers.js), so it can't be ambiguous the way
    // an array would be.
    queue: { type: mongoose.Schema.Types.ObjectId, ref: 'Queue', default: null },
    flow: { type: mongoose.Schema.Types.ObjectId, ref: 'Flow', default: null },

    // Meta only ever delivers this number's webhook to whichever
    // subscription is currently active — subscribing again elsewhere
    // silently takes delivery away from here (see whatsappNumbers service).
    subscribed: { type: Boolean, default: false },
    subscribedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

WhatsappNumberSchema.index({ tenantId: 1, phoneNumber: 1 }, { unique: true });

module.exports = mongoose.model('WhatsappNumber', WhatsappNumberSchema);
