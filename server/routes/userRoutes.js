
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../middleware/auth');

// Rutas protegidas
router.get('/me', authenticateToken, userController.getCurrentUser);
router.put('/me', authenticateToken, userController.updateUserProfile);
router.post('/me/photo', authenticateToken, userController.uploadProfilePhoto);
router.get('/', authenticateToken, userController.getAllUsers);
router.get('/:id', authenticateToken, userController.getUserById);

// Rutas para guardar/quitar trabajos favoritos
router.post('/saved-jobs/:jobId', authenticateToken, userController.toggleSavedJob);
router.get('/saved-jobs', authenticateToken, userController.getSavedJobs);

module.exports = router;
