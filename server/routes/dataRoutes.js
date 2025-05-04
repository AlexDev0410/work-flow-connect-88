
const express = require('express');
const router = express.Router();
const dataController = require('../controllers/dataController');

// Rutas para datos generales
router.get('/job-categories', dataController.getJobCategories);
router.get('/skills', dataController.getSkillsList);
router.get('/categories/:categoryId/skills', dataController.getSkillsByCategory);

module.exports = router;
