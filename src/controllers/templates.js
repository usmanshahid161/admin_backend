// controllers/templates.controller.js
const templatesService = require('../services/templates');

// Small helper so every controller method doesn't repeat the same try/catch.
// If your project already has an asyncHandler/catchAsync util, use that instead.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

exports.listTemplates = asyncHandler(async (req, res) => {
  const { status, category, search } = req.query;
  const templates = await templatesService.listTemplates({ status, category, search });
  res.status(200).json({ success: true, data: templates });
});

exports.getTemplate = asyncHandler(async (req, res) => {
  const template = await templatesService.getTemplateById(req.params.id);
  res.status(200).json({ success: true, data: template });
});

exports.createTemplate = asyncHandler(async (req, res) => {
  const template = await templatesService.createTemplate(req.body, req.user?._id);
  res.status(201).json({ success: true, data: template });
});

exports.updateTemplate = asyncHandler(async (req, res) => {
  const template = await templatesService.updateTemplate(req.params.id, req.body);
  res.status(200).json({ success: true, data: template });
});

exports.deleteTemplate = asyncHandler(async (req, res) => {
  const result = await templatesService.deleteTemplate(req.params.id);
  res.status(200).json({ success: true, data: result });
});

exports.submitTemplate = asyncHandler(async (req, res) => {
  const template = await templatesService.submitTemplateForReview(req.params.id);
  res.status(200).json({ success: true, data: template });
});

exports.syncTemplates = asyncHandler(async (req, res) => {
  const templates = await templatesService.syncTemplateStatuses();
  res.status(200).json({ success: true, data: templates });
});

// Internal-only — cloud_service calls this the instant Meta sends a
// message_template_status_update webhook. Reached via x-internal-key,
// never by the UI.
exports.webhookStatusUpdate = asyncHandler(async (req, res) => {
  const template = await templatesService.updateStatusFromWebhook(req.body);
  res.status(200).json({ success: true, data: template });
});