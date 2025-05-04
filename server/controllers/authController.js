
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
    
    // Verificar si existe la tabla users
    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'users'
        )`
      );
      
      if (!tableCheck.rows[0].exists) {
        console.error('La tabla users no existe. Verifique la inicialización de la base de datos.');
        return res.status(500).json({ error: 'Error en la base de datos. Contacte al administrador.' });
      }
    } catch (error) {
      console.error('Error al verificar la tabla users:', error);
      return res.status(500).json({ error: 'Error al verificar la estructura de la base de datos' });
    }
    
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
    // Proporcionar información más detallada sobre el error
    if (error.code === '42P01') {
      return res.status(500).json({ error: 'Error de base de datos: tabla no encontrada. Contacte al administrador.' });
    } else if (error.code === '23505') {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }
    res.status(500).json({ error: 'Error en el servidor al registrar usuario' });
  }
};

// Login de usuario
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'El correo electrónico y la contraseña son obligatorios' });
    }
    
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
    if (error.code === '42P01') {
      return res.status(500).json({ error: 'Error de base de datos: tabla no encontrada. Contacte al administrador.' });
    }
    res.status(500).json({ error: 'Error en el servidor' });
  }
};
