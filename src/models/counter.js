// models/counter.model.js
const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema({
  tenantId: { type: String, required: true },
  name: { type: String, required: true }, // 'queue', etc.
  seq: { type: Number, default: 0 },
});

CounterSchema.index({ tenantId: 1, name: 1 }, { unique: true });

const Counter = mongoose.model('Counter', CounterSchema);

// Atomic increment-and-return — never reuses a number even if the record
// that had it gets deleted later (the counter only ever goes up).
async function getNextSequence(tenantId, name) {
  const counter = await Counter.findOneAndUpdate(
    { tenantId, name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

module.exports = { Counter, getNextSequence };
