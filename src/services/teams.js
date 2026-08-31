// services/teams.js
const Team = require('../models/team');

async function listTeams(tenantId, { search } = {}) {
  const query = { tenantId };
  if (search) query.name = { $regex: search, $options: 'i' };
  return Team.find(query).sort({ createdAt: -1 }).lean();
}

async function getTeamById(tenantId, id) {
  const team = await Team.findOne({ _id: id, tenantId }).lean();
  if (!team) {
    const err = new Error('Team not found');
    err.statusCode = 404;
    throw err;
  }
  return team;
}

async function createTeam(tenantId, payload) {
  if (!payload?.name) {
    const err = new Error('name is required');
    err.statusCode = 422;
    throw err;
  }

  try {
    const team = await Team.create({
      tenantId,
      name: payload.name.trim(),
      description: payload.description || '',
      agents: payload.agents || [],
      queues: payload.queues || [],
      groups: payload.groups || [],
    });
    return team.toObject();
  } catch (err) {
    if (err.code === 11000) {
      const dupErr = new Error(`A team named "${payload.name}" already exists.`);
      dupErr.statusCode = 409;
      throw dupErr;
    }
    throw err;
  }
}

async function updateTeam(tenantId, id, payload) {
  const team = await Team.findOne({ _id: id, tenantId });
  if (!team) {
    const err = new Error('Team not found');
    err.statusCode = 404;
    throw err;
  }

  if (payload.name !== undefined) team.name = payload.name.trim();
  if (payload.description !== undefined) team.description = payload.description;
  if (payload.agents !== undefined) team.agents = payload.agents;
  if (payload.queues !== undefined) team.queues = payload.queues;
  if (payload.groups !== undefined) team.groups = payload.groups;

  try {
    await team.save();
  } catch (err) {
    if (err.code === 11000) {
      const dupErr = new Error(`A team named "${payload.name}" already exists.`);
      dupErr.statusCode = 409;
      throw dupErr;
    }
    throw err;
  }

  return team.toObject();
}

async function deleteTeam(tenantId, id) {
  const team = await Team.findOneAndDelete({ _id: id, tenantId });
  if (!team) {
    const err = new Error('Team not found');
    err.statusCode = 404;
    throw err;
  }
  return { deleted: true, id };
}

module.exports = { listTeams, getTeamById, createTeam, updateTeam, deleteTeam };
