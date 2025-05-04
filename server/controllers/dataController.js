
const { pool } = require('../config/db');

// Obtener categorías de trabajos
exports.getJobCategories = async (req, res) => {
  try {
    // Verificar si la tabla categories existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'categories'
      )`
    );
    
    if (!tableCheck.rows[0].exists) {
      console.error('La tabla categories no existe');
      return res.status(500).json({ 
        error: 'Error de base de datos',
        message: 'La tabla de categorías no está disponible'
      });
    }
    
    const result = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ 
      error: 'Error en el servidor',
      message: error.message 
    });
  }
};

// Obtener lista de habilidades
exports.getSkillsList = async (req, res) => {
  try {
    // Verificar si la tabla skills existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'skills'
      )`
    );
    
    if (!tableCheck.rows[0].exists) {
      console.error('La tabla skills no existe');
      return res.status(500).json({ 
        error: 'Error de base de datos',
        message: 'La tabla de habilidades no está disponible'
      });
    }
    
    const result = await pool.query('SELECT * FROM skills ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener habilidades:', error);
    res.status(500).json({ 
      error: 'Error en el servidor',
      message: error.message 
    });
  }
};

// Obtener habilidades por categoría
exports.getSkillsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    // Verificar si las tablas existen
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'skills'
      )`
    );
    
    if (!tableCheck.rows[0].exists) {
      console.error('La tabla skills no existe');
      return res.status(500).json({ 
        error: 'Error de base de datos',
        message: 'La tabla de habilidades no está disponible'
      });
    }
    
    const result = await pool.query(
      'SELECT * FROM skills WHERE category_id = $1 ORDER BY name',
      [categoryId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener habilidades por categoría:', error);
    res.status(500).json({ 
      error: 'Error en el servidor',
      message: error.message 
    });
  }
};
