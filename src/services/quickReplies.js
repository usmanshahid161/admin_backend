// services/quickReplies.js
const QuickReply = require('../models/quickReply');

async function listQuickReplies(tenantId, { search } = {}) {
  const query = { tenantId };
  if (search) {
    const rx = { $regex: search, $options: 'i' };
    query.$or = [{ title: rx }, { shortcut: rx }, { message: rx }];
  }
  return QuickReply.find(query).sort({ title: 1 }).lean();
}

async function getQuickReplyById(tenantId, id) {
  const reply = await QuickReply.findOne({ _id: id, tenantId }).lean();
  if (!reply) {
    const err = new Error('Quick reply not found');
    err.statusCode = 404;
    throw err;
  }
  return reply;
}

async function createQuickReply(tenantId, payload) {
  if (!payload?.title || !payload?.message || !payload?.shortcut) {
    const err = new Error('shortcut, title and message are required');
    err.statusCode = 422;
    throw err;
  }

  try {
    const reply = await QuickReply.create({
      tenantId,
      shortcut: payload.shortcut.trim().toLowerCase(),
      title: payload.title.trim(),
      message: payload.message,
    });
    return reply.toObject();
  } catch (err) {
    if (err.code === 11000) {
      const dupErr = new Error(`A quick reply with shortcut "${payload.shortcut}" already exists.`);
      dupErr.statusCode = 409;
      throw dupErr;
    }
    throw err;
  }
}

async function updateQuickReply(tenantId, id, payload) {
  const reply = await QuickReply.findOne({ _id: id, tenantId });
  if (!reply) {
    const err = new Error('Quick reply not found');
    err.statusCode = 404;
    throw err;
  }

  if (payload.shortcut !== undefined) reply.shortcut = payload.shortcut.trim().toLowerCase();
  if (payload.title !== undefined) reply.title = payload.title.trim();
  if (payload.message !== undefined) reply.message = payload.message;

  try {
    await reply.save();
  } catch (err) {
    if (err.code === 11000) {
      const dupErr = new Error(`A quick reply with shortcut "${payload.shortcut}" already exists.`);
      dupErr.statusCode = 409;
      throw dupErr;
    }
    throw err;
  }

  return reply.toObject();
}

async function deleteQuickReply(tenantId, id) {
  const reply = await QuickReply.findOneAndDelete({ _id: id, tenantId });
  if (!reply) {
    const err = new Error('Quick reply not found');
    err.statusCode = 404;
    throw err;
  }
  return { deleted: true, id };
}

module.exports = {
  listQuickReplies,
  getQuickReplyById,
  createQuickReply,
  updateQuickReply,
  deleteQuickReply,
};
