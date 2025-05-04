
const { pool } = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Obtener usuario actual
exports.getCurrentUser = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const user = result.rows[0];
    
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      bio: user.bio,
      skills: user.skills,
      photoURL: user.photo_url,
      hourlyRate: user.hourly_rate,
      joinedAt: user.joined_at
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Actualizar perfil de usuario
exports.updateUserProfile = async (req, res) => {
  try {
    const { name, bio, skills, role, hourlyRate } = req.body;
    
    const result = await pool.query(
      'UPDATE users SET name = COALESCE($1, name), bio = COALESCE($2, bio), skills = COALESCE($3, skills), role = COALESCE($4, role), hourly_rate = COALESCE($5, hourly_rate) WHERE id = $6 RETURNING *',
      [name, bio, skills, role, hourlyRate, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const user = result.rows[0];
    
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      bio: user.bio,
      skills: user.skills,
      photoURL: user.photo_url,
      hourlyRate: user.hourly_rate
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Configuración de almacenamiento para las fotos de perfil
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads/profiles');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + req.user.id + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('No es una imagen válida'));
    }
  }
}).single('photo');

// Subir foto de perfil
exports.uploadProfilePhoto = (req, res) => {
  upload(req, res, async function (err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }
    
    try {
      // Actualizar la URL de la foto en la base de datos
      const photoURL = `/uploads/profiles/${req.file.filename}`;
      
      await pool.query(
        'UPDATE users SET photo_url = $1 WHERE id = $2',
        [photoURL, req.user.id]
      );
      
      res.json({ 
        success: true, 
        photoURL: photoURL 
      });
    } catch (error) {
      console.error('Error al guardar la URL de la foto:', error);
      res.status(500).json({ error: 'Error en el servidor' });
    }
  });
};

// Obtener todos los usuarios
exports.getAllUsers = async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name, role, bio, skills, photo_url, hourly_rate, joined_at FROM users');
    
    const users = result.rows.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      bio: user.bio,
      skills: user.skills,
      photoURL: user.photo_url,
      hourlyRate: user.hourly_rate,
      joinedAt: user.joined_at
    }));
    
    res.json(users);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Obtener usuario por ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT id, email, name, role, bio, skills, photo_url, hourly_rate, joined_at FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const user = result.rows[0];
    
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      bio: user.bio,
      skills: user.skills,
      photoURL: user.photo_url,
      hourlyRate: user.hourly_rate,
      joinedAt: user.joined_at
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Guardar/Eliminar trabajo
exports.toggleSavedJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Verificar si el trabajo existe
    const jobCheck = await pool.query('SELECT id FROM jobs WHERE id = $1', [jobId]);
    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Trabajo no encontrado' });
    }
    
    // Verificar si ya está guardado
    const savedCheck = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND $2 = ANY(saved_jobs)',
      [req.user.id, jobId]
    );
    
    let saved = false;
    
    if (savedCheck.rows.length > 0) {
      // Eliminar de saved_jobs
      await pool.query(
        'UPDATE users SET saved_jobs = array_remove(saved_jobs, $1) WHERE id = $2',
        [jobId, req.user.id]
      );
    } else {
      // Añadir a saved_jobs
      await pool.query(
        'UPDATE users SET saved_jobs = array_append(saved_jobs, $1) WHERE id = $2',
        [jobId, req.user.id]
      );
      saved = true;
    }
    
    res.json({ saved });
  } catch (error) {
    console.error('Error al actualizar trabajo guardado:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Obtener trabajos guardados
exports.getSavedJobs = async (req, res) => {
  try {
    // Obtener array de IDs de trabajos guardados
    const userResult = await pool.query(
      'SELECT saved_jobs FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (userResult.rows.length === 0 || !userResult.rows[0].saved_jobs) {
      return res.json([]);
    }
    
    const savedJobIds = userResult.rows[0].saved_jobs;
    
    if (savedJobIds.length === 0) {
      return res.json([]);
    }
    
    // Obtener detalles de los trabajos guardados
    const jobsResult = await pool.query(
      `SELECT 
        j.*,
        u.name as user_name,
        u.photo_url as user_photo
      FROM 
        jobs j
      JOIN 
        users u ON j.user_id = u.id
      WHERE 
        j.id = ANY($1)`,
      [savedJobIds]
    );
    
    // Formatear resultados
    const jobs = await Promise.all(jobsResult.rows.map(async (job) => {
      // Obtener comentarios y likes similar a la función getAllJobs
      // ... (código similar al de jobController.getAllJobs)
      
      return {
        id: job.id,
        title: job.title,
        description: job.description,
        budget: job.budget,
        category: job.category,
        skills: job.skills,
        userId: job.user_id,
        userName: job.user_name,
        userPhoto: job.user_photo,
        status: job.status,
        timestamp: job.created_at.getTime(),
        comments: [], // Simplificado para este ejemplo
        likes: []    // Simplificado para este ejemplo
      };
    }));
    
    res.json(jobs);
  } catch (error) {
    console.error('Error al obtener trabajos guardados:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};
