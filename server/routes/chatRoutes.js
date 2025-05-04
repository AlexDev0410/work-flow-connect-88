
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authenticateToken = require('../middleware/auth');

// Rutas de chat (todas requieren autenticación)
router.get('/', authenticateToken, chatController.getChats);
router.get('/:id', authenticateToken, chatController.getChatById);

module.exports = router;
