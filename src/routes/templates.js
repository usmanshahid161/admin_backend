// routes/templates.js
const express = require('express');
const router = express.Router();
const templatesController = require('../controllers/templates');

// If your app has auth/permission middleware, plug it in here, e.g.:
// const { requireAuth, requireRole } = require('../middlewares/auth');
// router.use(requireAuth);

router.get('/', templatesController.listTemplates);
router.get('/:id', templatesController.getTemplate);
router.post('/', templatesController.createTemplate);
router.put('/:id', templatesController.updateTemplate);
router.delete('/:id', templatesController.deleteTemplate);
router.post('/:id/submit', templatesController.submitTemplate);
router.post('/sync', templatesController.syncTemplates);

module.exports = router;
