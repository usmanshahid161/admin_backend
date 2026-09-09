// controllers/whatsappNumbers.js
const whatsappNumbersService = require('../services/whatsappNumbers');
const embeddedSignupService = require('../services/embeddedSignup');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

exports.listNumbers = asyncHandler(async (req, res) => {
  const numbers = await whatsappNumbersService.listNumbers(req.user.tenantId);
  res.status(200).json({ success: true, data: numbers });
});

// Completes Meta's Embedded Signup flow for the current admin's tenant —
// see services/embeddedSignup.js for the full OAuth-code-exchange +
// credential-saving flow.
exports.completeEmbeddedSignup = asyncHandler(async (req, res) => {
  const number = await embeddedSignupService.completeEmbeddedSignup(req.user.tenantId, req.body);
  res.status(200).json({ success: true, data: number });
});

// Cross-tenant lookup by phone number — used by the cloud service (Meta
// webhook receiver) and local service to resolve tenant/queue/flow for an
// inbound message, before they have any other tenant context. Reached only
// via x-internal-key (see middleware/middleware.js), never by the UI.
exports.getNumberByPhone = asyncHandler(async (req, res) => {
  const number = await whatsappNumbersService.getNumberByPhone(req.query.phoneNumber);
  res.status(200).json({ success: true, data: number });
});

// Also internal-only — the local service calls this once at boot to
// re-establish a consumer for every number that was already subscribed.
exports.listAllSubscribed = asyncHandler(async (req, res) => {
  const numbers = await whatsappNumbersService.listAllSubscribed();
  res.status(200).json({ success: true, data: numbers });
});

exports.getNumber = asyncHandler(async (req, res) => {
  const number = await whatsappNumbersService.getNumberById(req.user.tenantId, req.params.id);
  res.status(200).json({ success: true, data: number });
});

exports.createNumber = asyncHandler(async (req, res) => {
  const number = await whatsappNumbersService.createNumber(req.user.tenantId, req.body);
  res.status(201).json({ success: true, data: number });
});

exports.updateAssignment = asyncHandler(async (req, res) => {
  const number = await whatsappNumbersService.updateAssignment(req.user.tenantId, req.params.id, req.body);
  res.status(200).json({ success: true, data: number });
});

exports.subscribe = asyncHandler(async (req, res) => {
  const number = await whatsappNumbersService.subscribeNumber(req.user.tenantId, req.params.id);
  res.status(200).json({ success: true, data: number });
});

exports.unsubscribe = asyncHandler(async (req, res) => {
  const number = await whatsappNumbersService.unsubscribeNumber(req.user.tenantId, req.params.id);
  res.status(200).json({ success: true, data: number });
});

exports.deleteNumber = asyncHandler(async (req, res) => {
  const result = await whatsappNumbersService.deleteNumber(req.user.tenantId, req.params.id);
  res.status(200).json({ success: true, data: result });
});
