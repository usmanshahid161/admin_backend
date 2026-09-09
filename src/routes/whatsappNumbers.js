// routes/whatsappNumbers.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/whatsappNumbers');

router.get('/', controller.listNumbers);
router.get('/resolve', controller.getNumberByPhone);
router.get('/subscribed', controller.listAllSubscribed);
router.post('/embedded-signup', controller.completeEmbeddedSignup);
router.get('/:id', controller.getNumber);
router.post('/', controller.createNumber);
router.put('/:id/assignment', controller.updateAssignment);
router.post('/:id/subscribe', controller.subscribe);
router.post('/:id/unsubscribe', controller.unsubscribe);
router.delete('/:id', controller.deleteNumber);

module.exports = router;
