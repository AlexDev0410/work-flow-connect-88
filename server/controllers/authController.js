
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

// Registro de usuario
exports.register = async (req, res) => {
  try {
    console.log('Solicitud de registro recibida:', req.body);
    
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      console.log('Error: Datos incompletos');
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }
    
    // Verificar si el usuario ya existe
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (userExists.rows.length > 0) {
      console.log('Error: Usuario ya existe');
      return res.status(400).json({ error: 'El usuario ya existe' });
    }
    
    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    console.log('Creando usuario con rol: user');
    
    // Crear usuario - establecer un único rol para todos
    const result = await pool.query(
      'INSERT INTO users (email, password, name, role, joined_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role',
      [email, hashedPassword, name, 'user', new Date()]
    );
    
    const user = result.rows[0];
    console.log('Usuario creado exitosamente:', user);
    
    // Generar token JWT
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });
    
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error en el servidor al registrar usuario' });
  }
};

// Login de usuario
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Buscar usuario
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Credenciales incorrectas' });
    }
    
    const user = result.rows[0];
    
    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(400).json({ error: 'Credenciales incorrectas' });
    }
    
    // Generar token JWT
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        bio: user.bio,
        skills: user.skills,
        photoURL: user.photo_url,
        hourlyRate: user.hourly_rate
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};
