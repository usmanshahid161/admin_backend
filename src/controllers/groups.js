// controllers/groups.js
const groupsService = require('../services/groups');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

exports.listGroups = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const groups = await groupsService.listGroups(req.user.tenantId, { search });
  res.status(200).json({ success: true, data: groups });
});

exports.getGroup = asyncHandler(async (req, res) => {
  const group = await groupsService.getGroupById(req.user.tenantId, req.params.id);
  res.status(200).json({ success: true, data: group });
});

exports.createGroup = asyncHandler(async (req, res) => {
  const group = await groupsService.createGroup(req.user.tenantId, req.body);
  res.status(201).json({ success: true, data: group });
});

exports.updateGroup = asyncHandler(async (req, res) => {
  const group = await groupsService.updateGroup(req.user.tenantId, req.params.id, req.body);
  res.status(200).json({ success: true, data: group });
});

exports.deleteGroup = asyncHandler(async (req, res) => {
  const result = await groupsService.deleteGroup(req.user.tenantId, req.params.id);
  res.status(200).json({ success: true, data: result });
});
