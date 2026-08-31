// services/queues.js
const Queue = require('../models/queue');
const { getNextSequence } = require('../models/counter');

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function listQueues(tenantId, { search } = {}) {
  const query = { tenantId };
  if (search) query.name = { $regex: search, $options: 'i' };
  return Queue.find(query).sort({ createdAt: -1 }).lean();
}

async function getQueueById(tenantId, id) {
  const queue = await Queue.findOne({ _id: id, tenantId }).lean();
  if (!queue) {
    const err = new Error('Queue not found');
    err.statusCode = 404;
    throw err;
  }
  return queue;
}

async function createQueue(tenantId, payload) {
  if (!payload?.name) {
    const err = new Error('name is required');
    err.statusCode = 422;
    throw err;
  }

  // Slug can be given explicitly (e.g. "billing_information" typed by an
  // admin who wants a specific machine name), otherwise it's derived from
  // the display name.
  const slug = slugify(payload.slug || payload.name);
  if (!slug) {
    const err = new Error('Could not derive a valid slug from that name — try adding some letters/numbers.');
    err.statusCode = 422;
    throw err;
  }

  const queueNumber = await getNextSequence(tenantId, 'queue');

  try {
    const queue = await Queue.create({
      tenantId,
      queueNumber,
      name: payload.name.trim(),
      slug,
      description: payload.description || '',
    });
    return queue.toObject();
  } catch (err) {
    if (err.code === 11000) {
      const dupErr = new Error(
        Object.keys(err.keyPattern || {}).includes('slug')
          ? `A queue with the identifier "${slug}" already exists — try a different name or set a custom identifier.`
          : `A queue named "${payload.name}" already exists.`
      );
      dupErr.statusCode = 409;
      throw dupErr;
    }
    throw err;
  }
}

async function updateQueue(tenantId, id, payload) {
  const queue = await Queue.findOne({ _id: id, tenantId });
  if (!queue) {
    const err = new Error('Queue not found');
    err.statusCode = 404;
    throw err;
  }

  if (payload.name !== undefined) queue.name = payload.name.trim();
  if (payload.slug !== undefined) queue.slug = slugify(payload.slug);
  if (payload.description !== undefined) queue.description = payload.description;

  try {
    await queue.save();
  } catch (err) {
    if (err.code === 11000) {
      const dupErr = new Error(
        Object.keys(err.keyPattern || {}).includes('slug')
          ? `A queue with the identifier "${queue.slug}" already exists.`
          : `A queue named "${payload.name}" already exists.`
      );
      dupErr.statusCode = 409;
      throw dupErr;
    }
    throw err;
  }

  return queue.toObject();
}

async function deleteQueue(tenantId, id) {
  const queue = await Queue.findOneAndDelete({ _id: id, tenantId });
  if (!queue) {
    const err = new Error('Queue not found');
    err.statusCode = 404;
    throw err;
  }
  return { deleted: true, id };
}

module.exports = { listQueues, getQueueById, createQueue, updateQueue, deleteQueue, slugify };
