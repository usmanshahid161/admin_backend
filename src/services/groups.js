// services/groups.js
const Group = require('../models/group');

async function listGroups(tenantId, { search } = {}) {
  const query = { tenantId };
  if (search) query.name = { $regex: search, $options: 'i' };
  return Group.find(query).sort({ createdAt: -1 }).lean();
}

async function getGroupById(tenantId, id) {
  const group = await Group.findOne({ _id: id, tenantId }).lean();
  if (!group) {
    const err = new Error('Group not found');
    err.statusCode = 404;
    throw err;
  }
  return group;
}

async function createGroup(tenantId, payload) {
  if (!payload?.name) {
    const err = new Error('name is required');
    err.statusCode = 422;
    throw err;
  }

  try {
    const group = await Group.create({
      tenantId,
      name: payload.name.trim(),
      description: payload.description || '',
      agents: payload.agents || [],
    });
    return group.toObject();
  } catch (err) {
    if (err.code === 11000) {
      const dupErr = new Error(`A group named "${payload.name}" already exists.`);
      dupErr.statusCode = 409;
      throw dupErr;
    }
    throw err;
  }
}

async function updateGroup(tenantId, id, payload) {
  const group = await Group.findOne({ _id: id, tenantId });
  if (!group) {
    const err = new Error('Group not found');
    err.statusCode = 404;
    throw err;
  }

  if (payload.name !== undefined) group.name = payload.name.trim();
  if (payload.description !== undefined) group.description = payload.description;
  if (payload.agents !== undefined) group.agents = payload.agents;

  try {
    await group.save();
  } catch (err) {
    if (err.code === 11000) {
      const dupErr = new Error(`A group named "${payload.name}" already exists.`);
      dupErr.statusCode = 409;
      throw dupErr;
    }
    throw err;
  }

  return group.toObject();
}

async function deleteGroup(tenantId, id) {
  const group = await Group.findOneAndDelete({ _id: id, tenantId });
  if (!group) {
    const err = new Error('Group not found');
    err.statusCode = 404;
    throw err;
  }
  return { deleted: true, id };
}

module.exports = { listGroups, getGroupById, createGroup, updateGroup, deleteGroup };
