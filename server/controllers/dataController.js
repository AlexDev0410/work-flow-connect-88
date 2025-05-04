
const { pool } = require('../config/db');

// Obtener categorías de trabajos
exports.getJobCategories = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Obtener lista de habilidades
exports.getSkillsList = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM skills ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener habilidades:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Obtener habilidades por categoría
exports.getSkillsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const result = await pool.query(
      'SELECT * FROM skills WHERE category_id = $1 ORDER BY name',
      [categoryId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener habilidades por categoría:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};
