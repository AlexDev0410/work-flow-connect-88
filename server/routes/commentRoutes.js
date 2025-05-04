
const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const authenticateToken = require('../middleware/auth');

// Rutas para respuestas a comentarios
router.post('/:id/replies', authenticateToken, jobController.addReply);

module.exports = router;
