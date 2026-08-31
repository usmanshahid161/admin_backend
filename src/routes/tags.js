// routes/tags.js
const express = require('express');
const router = express.Router();
const tagsController = require('../controllers/tags');

router.get('/', tagsController.listTags);
router.get('/:id', tagsController.getTag);
router.post('/', tagsController.createTag);
router.put('/:id', tagsController.updateTag);
router.delete('/:id', tagsController.deleteTag);

module.exports = router;
