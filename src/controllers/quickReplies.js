// controllers/quickReplies.js
const quickRepliesService = require('../services/quickReplies');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

exports.listQuickReplies = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const replies = await quickRepliesService.listQuickReplies(req.user.tenantId, { search });
  res.status(200).json({ success: true, data: replies });
});

exports.getQuickReply = asyncHandler(async (req, res) => {
  const reply = await quickRepliesService.getQuickReplyById(req.user.tenantId, req.params.id);
  res.status(200).json({ success: true, data: reply });
});

exports.createQuickReply = asyncHandler(async (req, res) => {
  const reply = await quickRepliesService.createQuickReply(req.user.tenantId, req.body);
  res.status(201).json({ success: true, data: reply });
});

exports.updateQuickReply = asyncHandler(async (req, res) => {
  const reply = await quickRepliesService.updateQuickReply(req.user.tenantId, req.params.id, req.body);
  res.status(200).json({ success: true, data: reply });
});

exports.deleteQuickReply = asyncHandler(async (req, res) => {
  const result = await quickRepliesService.deleteQuickReply(req.user.tenantId, req.params.id);
  res.status(200).json({ success: true, data: result });
});
