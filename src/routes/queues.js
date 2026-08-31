// routes/queues.js
const express = require('express');
const router = express.Router();
const queuesController = require('../controllers/queues');

router.get('/', queuesController.listQueues);
router.get('/:id', queuesController.getQueue);
router.post('/', queuesController.createQueue);
router.put('/:id', queuesController.updateQueue);
router.delete('/:id', queuesController.deleteQueue);

module.exports = router;
