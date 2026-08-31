// routes/groups.js
const express = require('express');
const router = express.Router();
const groupsController = require('../controllers/groups');

router.get('/', groupsController.listGroups);
router.get('/:id', groupsController.getGroup);
router.post('/', groupsController.createGroup);
router.put('/:id', groupsController.updateGroup);
router.delete('/:id', groupsController.deleteGroup);

module.exports = router;
