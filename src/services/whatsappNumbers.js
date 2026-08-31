// services/whatsappNumbers.js
const axios = require('axios');
const WhatsappNumber = require('../models/whatsappNumber');
const Queue = require('../models/queue');
const configs = require('../config');

async function listNumbers(tenantId) {
  return WhatsappNumber.find({ tenantId }).sort({ createdAt: -1 }).lean();
}

async function getNumberById(tenantId, id) {
  const number = await WhatsappNumber.findOne({ _id: id, tenantId }).lean();
  if (!number) {
    const err = new Error('Number not found');
    err.statusCode = 404;
    throw err;
  }
  return number;
}

// Not tenant-scoped — this is how the cloud service (Meta webhook
// receiver) and local service resolve "whose number is this, and which
// queue/flow does it carry" purely from the phone number Meta sends,
// before they have any other tenant context. Reached only via the
// internal x-internal-key auth (see middleware/middleware.js), same as
// message/interaction creation.
async function getNumberByPhone(phoneNumber) {
  const number = await WhatsappNumber.findOne({ phoneNumber }).lean();
  if (!number) {
    const err = new Error('No WhatsApp number configured with this phoneNumber');
    err.statusCode = 404;
    throw err;
  }

  const queue = number.queue ? await Queue.findById(number.queue).lean() : null;

  return {
    tenantId: number.tenantId,
    phoneNumber: number.phoneNumber,
    displayName: number.displayName,
    subscribed: number.subscribed,
    queue: queue ? { id: String(queue._id), slug: queue.slug, name: queue.name } : null,
    flow: number.flow ? String(number.flow) : null,
  };
}

async function createNumber(tenantId, payload) {
  if (!payload?.phoneNumber || !payload?.displayName) {
    const err = new Error('phoneNumber and displayName are required');
    err.statusCode = 422;
    throw err;
  }

  try {
    const number = await WhatsappNumber.create({
      tenantId,
      phoneNumber: payload.phoneNumber.trim(),
      displayName: payload.displayName.trim(),
    });
    return number.toObject();
  } catch (err) {
    if (err.code === 11000) {
      const dupErr = new Error(`"${payload.phoneNumber}" is already connected.`);
      dupErr.statusCode = 409;
      throw dupErr;
    }
    throw err;
  }
}

// One queue per number now (previously an array) — simpler, and it's what
// RabbitMQ routing below keys off, so it can't be ambiguous.
async function updateAssignment(tenantId, id, { queue, flow }) {
  if (!queue) {
    const err = new Error('A queue is required');
    err.statusCode = 422;
    throw err;
  }

  const number = await WhatsappNumber.findOne({ _id: id, tenantId });
  if (!number) {
    const err = new Error('Number not found');
    err.statusCode = 404;
    throw err;
  }

  const queueChanged = String(number.queue || '') !== String(queue);
  const previousQueueId = number.queue;

  number.queue = queue;
  number.flow = flow || null;

  // Changing queues after subscribing would otherwise leave the old
  // RabbitMQ queue bound and consuming with nobody routing messages there
  // correctly — actually tear it down instead of just flipping the flag,
  // then require a fresh Subscribe against the new queue.
  if (queueChanged && number.subscribed) {
    const previousQueue = previousQueueId ? await Queue.findOne({ _id: previousQueueId, tenantId }).lean() : null;

    if (previousQueue) {
      try {
        await axios.post(
          `${configs.WHATSAPP_LOCAL_URL}/numbers/unsubscribe`,
          { phoneNumber: number.phoneNumber, querySlug: previousQueue.slug },
          { headers: { 'x-internal-key': configs.INTERNAL_SERVICE_KEY } }
        );
      } catch (err) {
        console.error('Could not unsubscribe old queue binding on queue change:', err.response?.data || err.message);
      }
    }

    number.subscribed = false;
    number.subscribedAt = null;
  }

  await number.save();

  return number.toObject();
}

// Meta only ever delivers a number's webhook to whichever subscription is
// currently active for it. The local service owns the actual Graph API
// call/access token, and also sets up this number's dedicated RabbitMQ
// queue (`{phoneNumber}_{querySlug}`) so its messages arrive isolated
// from every other number/tenant — this just proxies to it.
async function subscribeNumber(tenantId, id) {
  const number = await WhatsappNumber.findOne({ _id: id, tenantId });
  if (!number) {
    const err = new Error('Number not found');
    err.statusCode = 404;
    throw err;
  }

  if (!number.queue) {
    const err = new Error('Assign a queue before subscribing');
    err.statusCode = 409;
    throw err;
  }

  const queue = await Queue.findOne({ _id: number.queue, tenantId }).lean();
  if (!queue) {
    const err = new Error('Assigned queue no longer exists');
    err.statusCode = 409;
    throw err;
  }

  try {
    await axios.post(
      `${configs.WHATSAPP_LOCAL_URL}/numbers/subscribe`,
      { phoneNumber: number.phoneNumber, querySlug: queue.slug },
      { headers: { 'x-internal-key': configs.INTERNAL_SERVICE_KEY } }
    );
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const wrapped = new Error(`Could not subscribe this number: ${message}`);
    wrapped.statusCode = 422;
    throw wrapped;
  }

  number.subscribed = true;
  number.subscribedAt = new Date();
  await number.save();

  return number.toObject();
}

// Tears down the RabbitMQ queue/consumer on the local service and marks
// this number as no longer subscribed. Doesn't touch the queue/flow
// assignment — re-subscribing later picks those back up unchanged.
async function unsubscribeNumber(tenantId, id) {
  const number = await WhatsappNumber.findOne({ _id: id, tenantId });
  if (!number) {
    const err = new Error('Number not found');
    err.statusCode = 404;
    throw err;
  }

  if (!number.subscribed) {
    const err = new Error('This number is not currently subscribed');
    err.statusCode = 409;
    throw err;
  }

  const queue = number.queue ? await Queue.findOne({ _id: number.queue, tenantId }).lean() : null;

  if (queue) {
    try {
      await axios.post(
        `${configs.WHATSAPP_LOCAL_URL}/numbers/unsubscribe`,
        { phoneNumber: number.phoneNumber, querySlug: queue.slug },
        { headers: { 'x-internal-key': configs.INTERNAL_SERVICE_KEY } }
      );
    } catch (err) {
      const message = err.response?.data?.message || err.message;
      const wrapped = new Error(`Could not unsubscribe this number: ${message}`);
      wrapped.statusCode = 422;
      throw wrapped;
    }
  }
  // If the assigned queue was since deleted, there's nothing meaningful
  // left to unbind on the local service's side — just clear the flag below.

  number.subscribed = false;
  number.subscribedAt = null;
  await number.save();

  return number.toObject();
}

async function deleteNumber(tenantId, id) {
  const number = await WhatsappNumber.findOneAndDelete({ _id: id, tenantId });
  if (!number) {
    const err = new Error('Number not found');
    err.statusCode = 404;
    throw err;
  }
  return { deleted: true, id };
}

// Not tenant-scoped — used only by the local service at boot, to
// re-establish RabbitMQ consumers for every number that was already
// subscribed before a restart. Reached only via x-internal-key.
async function listAllSubscribed() {
  const numbers = await WhatsappNumber.find({ subscribed: true }).lean();

  const withQueues = await Promise.all(
    numbers.map(async (number) => {
      const queue = number.queue ? await Queue.findById(number.queue).lean() : null;
      return {
        phoneNumber: number.phoneNumber,
        querySlug: queue?.slug || null,
      };
    })
  );

  return withQueues.filter((n) => n.querySlug);
}

module.exports = {
  listNumbers,
  getNumberById,
  getNumberByPhone,
  listAllSubscribed,
  createNumber,
  updateAssignment,
  subscribeNumber,
  unsubscribeNumber,
  deleteNumber,
};
