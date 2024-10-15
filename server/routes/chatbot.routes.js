const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbot.controller');

router.get('/webhook', chatbotController.verificarWebhook);
router.post('/webhook', chatbotController.handleWebhook);

module.exports = router;