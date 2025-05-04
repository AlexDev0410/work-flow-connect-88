
const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const authenticateToken = require('../middleware/auth');

// Rutas públicas
router.get('/', jobController.getAllJobs);
router.get('/:id', jobController.getJobById);

// Rutas protegidas
router.post('/', authenticateToken, jobController.createJob);
router.put('/:id', authenticateToken, jobController.updateJob);
router.delete('/:id', authenticateToken, jobController.deleteJob);

// Comentarios y Likes
router.post('/:id/comments', authenticateToken, jobController.addComment);
router.post('/:id/likes', authenticateToken, jobController.toggleLike);

module.exports = router;
