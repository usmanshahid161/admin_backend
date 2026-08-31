// services/tags.js
const Tag = require('../models/tag');

async function listTags(tenantId, { search } = {}) {
  const query = { tenantId };
  if (search) query.name = { $regex: search, $options: 'i' };
  return Tag.find(query).sort({ createdAt: -1 }).lean();
}

async function getTagById(tenantId, id) {
  const tag = await Tag.findOne({ _id: id, tenantId }).lean();
  if (!tag) {
    const err = new Error('Tag not found');
    err.statusCode = 404;
    throw err;
  }
  return tag;
}

async function createTag(tenantId, payload) {
  if (!payload?.name) {
    const err = new Error('name is required');
    err.statusCode = 422;
    throw err;
  }

  try {
    const tag = await Tag.create({
      tenantId,
      name: payload.name.trim(),
      color: payload.color,
      description: payload.description || '',
    });
    return tag.toObject();
  } catch (err) {
    if (err.code === 11000) {
      const dupErr = new Error(`A tag named "${payload.name}" already exists.`);
      dupErr.statusCode = 409;
      throw dupErr;
    }
    throw err;
  }
}

async function updateTag(tenantId, id, payload) {
  const tag = await Tag.findOne({ _id: id, tenantId });
  if (!tag) {
    const err = new Error('Tag not found');
    err.statusCode = 404;
    throw err;
  }

  if (payload.name !== undefined) tag.name = payload.name.trim();
  if (payload.color !== undefined) tag.color = payload.color;
  if (payload.description !== undefined) tag.description = payload.description;

  try {
    await tag.save();
  } catch (err) {
    if (err.code === 11000) {
      const dupErr = new Error(`A tag named "${payload.name}" already exists.`);
      dupErr.statusCode = 409;
      throw dupErr;
    }
    throw err;
  }

  return tag.toObject();
}

async function deleteTag(tenantId, id) {
  const tag = await Tag.findOneAndDelete({ _id: id, tenantId });
  if (!tag) {
    const err = new Error('Tag not found');
    err.statusCode = 404;
    throw err;
  }
  return { deleted: true, id };
}

module.exports = { listTags, getTagById, createTag, updateTag, deleteTag };
