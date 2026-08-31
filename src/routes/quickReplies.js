// routes/quickReplies.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/quickReplies');

router.get('/', controller.listQuickReplies);
router.get('/:id', controller.getQuickReply);
router.post('/', controller.createQuickReply);
router.put('/:id', controller.updateQuickReply);
router.delete('/:id', controller.deleteQuickReply);

module.exports = router;
