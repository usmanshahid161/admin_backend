// controllers/tags.js
const tagsService = require('../services/tags');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

exports.listTags = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const tags = await tagsService.listTags(req.user.tenantId, { search });
  res.status(200).json({ success: true, data: tags });
});

exports.getTag = asyncHandler(async (req, res) => {
  const tag = await tagsService.getTagById(req.user.tenantId, req.params.id);
  res.status(200).json({ success: true, data: tag });
});

exports.createTag = asyncHandler(async (req, res) => {
  const tag = await tagsService.createTag(req.user.tenantId, req.body);
  res.status(201).json({ success: true, data: tag });
});

exports.updateTag = asyncHandler(async (req, res) => {
  const tag = await tagsService.updateTag(req.user.tenantId, req.params.id, req.body);
  res.status(200).json({ success: true, data: tag });
});

exports.deleteTag = asyncHandler(async (req, res) => {
  const result = await tagsService.deleteTag(req.user.tenantId, req.params.id);
  res.status(200).json({ success: true, data: result });
});
