// controllers/queues.js
const queuesService = require('../services/queues');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

exports.listQueues = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const queues = await queuesService.listQueues(req.user.tenantId, { search });
  res.status(200).json({ success: true, data: queues });
});

exports.getQueue = asyncHandler(async (req, res) => {
  const queue = await queuesService.getQueueById(req.user.tenantId, req.params.id);
  res.status(200).json({ success: true, data: queue });
});

exports.createQueue = asyncHandler(async (req, res) => {
  const queue = await queuesService.createQueue(req.user.tenantId, req.body);
  res.status(201).json({ success: true, data: queue });
});

exports.updateQueue = asyncHandler(async (req, res) => {
  const queue = await queuesService.updateQueue(req.user.tenantId, req.params.id, req.body);
  res.status(200).json({ success: true, data: queue });
});

exports.deleteQueue = asyncHandler(async (req, res) => {
  const result = await queuesService.deleteQueue(req.user.tenantId, req.params.id);
  res.status(200).json({ success: true, data: result });
});
