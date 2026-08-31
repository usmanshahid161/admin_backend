// controllers/teams.js
const teamsService = require('../services/teams');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

exports.listTeams = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const teams = await teamsService.listTeams(req.user.tenantId, { search });
  res.status(200).json({ success: true, data: teams });
});

exports.getTeam = asyncHandler(async (req, res) => {
  const team = await teamsService.getTeamById(req.user.tenantId, req.params.id);
  res.status(200).json({ success: true, data: team });
});

exports.createTeam = asyncHandler(async (req, res) => {
  const team = await teamsService.createTeam(req.user.tenantId, req.body);
  res.status(201).json({ success: true, data: team });
});

exports.updateTeam = asyncHandler(async (req, res) => {
  const team = await teamsService.updateTeam(req.user.tenantId, req.params.id, req.body);
  res.status(200).json({ success: true, data: team });
});

exports.deleteTeam = asyncHandler(async (req, res) => {
  const result = await teamsService.deleteTeam(req.user.tenantId, req.params.id);
  res.status(200).json({ success: true, data: result });
});
