require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Redis = require('ioredis');
const { createAdapter } = require('@socket.io/redis-adapter');
const { Pool } = require('pg');

// Configuración inicial de la aplicación
const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;

// Configuración de PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Inicialización de Redis para Socket.io
const pubClient = new Redis(process.env.REDIS_URL);
const subClient = pubClient.duplicate();

// Configuración de Socket.io con adaptador Redis
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  adapter: createAdapter(pubClient, subClient)
});

// Middleware para parsear JSON
app.use(express.json());

// Configuración de CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// Middleware para verificar JWT en rutas protegidas
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
};

// Socket.io middleware para autenticación
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Token no proporcionado'));
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Token inválido'));
    socket.user = decoded;
    next();
  });
});

// Conexión de Socket.io
io.on('connection', (socket) => {
  console.log(`Usuario conectado: ${socket.user.id}`);
  
  // Unir al usuario a sus salas de chat
  socket.join(`user:${socket.user.id}`);
  
  // Buscar y unir a todas las salas de chat donde el usuario participa
  pool.query(
    'SELECT id FROM chats WHERE $1 = ANY(participants)', 
    [socket.user.id]
  ).then(result => {
    result.rows.forEach(chat => {
      socket.join(`chat:${chat.id}`);
    });
  });

  // Manejar envío de mensajes
  socket.on('send_message', async (data) => {
    try {
      const { chatId, content } = data;
      
      // Verificar que el usuario pertenece al chat
      const chatResult = await pool.query(
        'SELECT * FROM chats WHERE id = $1 AND $2 = ANY(participants)',
        [chatId, socket.user.id]
      );
      
      if (chatResult.rows.length === 0) {
        socket.emit('error', { message: 'No tienes permiso para enviar mensajes a este chat' });
        return;
      }
      
      // Guardar el mensaje en la base de datos
      const messageResult = await pool.query(
        'INSERT INTO messages (chat_id, sender_id, content) VALUES ($1, $2, $3) RETURNING id, chat_id, sender_id, content, created_at',
        [chatId, socket.user.id, content]
      );
      
      const message = messageResult.rows[0];
      
      // Emitir el mensaje a todos los participantes del chat
      io.to(`chat:${chatId}`).emit('receive_message', {
        id: message.id,
        chatId: message.chat_id,
        senderId: message.sender_id,
        content: message.content,
        timestamp: message.created_at.getTime()
      });
      
      // Actualizar el último mensaje del chat
      await pool.query(
        'UPDATE chats SET last_message = $1 WHERE id = $2',
        [message.id, chatId]
      );
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      socket.emit('error', { message: 'Error al enviar el mensaje' });
    }
  });

  // Crear un nuevo chat
  socket.on('create_chat', async (data) => {
    try {
      const { participants, name, isGroup } = data;
      
      // Asegurarse de que el creador esté incluido en los participantes
      if (!participants.includes(socket.user.id)) {
        participants.push(socket.user.id);
      }
      
      // Crear el chat en la base de datos
      const chatResult = await pool.query(
        'INSERT INTO chats (name, participants, is_group) VALUES ($1, $2, $3) RETURNING *',
        [name || '', participants, isGroup || participants.length > 2]
      );
      
      const newChat = chatResult.rows[0];
      
      // Notificar a todos los participantes sobre el nuevo chat
      participants.forEach(participantId => {
        io.to(`user:${participantId}`).emit('new_chat', {
          id: newChat.id,
          name: newChat.name,
          participants: newChat.participants,
          isGroup: newChat.is_group,
          messages: []
        });
      });
      
      // Unir al usuario a la sala del nuevo chat
      socket.join(`chat:${newChat.id}`);
    } catch (error) {
      console.error('Error al crear chat:', error);
      socket.emit('error', { message: 'Error al crear el chat' });
    }
  });

  // Manejar desconexión
  socket.on('disconnect', () => {
    console.log(`Usuario desconectado: ${socket.user.id}`);
  });
});

// Endpoint de verificación del estado del servidor
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Server is running', 
    timestamp: new Date().toISOString() 
  });
});

// ===== RUTAS DE AUTENTICACIÓN =====

// Registro de usuario
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Verificar si el usuario ya existe
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }
    
    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Crear usuario
    const result = await pool.query(
      'INSERT INTO users (email, password, name, role, joined_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role',
      [email, hashedPassword, name, 'freelancer', new Date()]
    );
    
    const user = result.rows[0];
    
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
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Login de usuario
app.post('/api/auth/login', async (req, res) => {
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
});

// ===== RUTAS DE USUARIOS =====

// Obtener usuario actual
app.get('/api/users/me', authenticateToken, async (req, res) => {
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
});

// Actualizar perfil de usuario
app.put('/api/users/me', authenticateToken, async (req, res) => {
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
});

// Obtener todos los usuarios
app.get('/api/users', authenticateToken, async (req, res) => {
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
});

// Obtener usuario por ID
app.get('/api/users/:id', authenticateToken, async (req, res) => {
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
});

// ===== RUTAS DE TRABAJOS =====

// Crear trabajo
app.post('/api/jobs', authenticateToken, async (req, res) => {
  try {
    const { title, description, budget, category, skills, status } = req.body;
    
    const result = await pool.query(
      'INSERT INTO jobs (title, description, budget, category, skills, status, user_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [title, description, budget, category, skills, status || 'open', req.user.id, new Date()]
    );
    
    // Obtener información del usuario para incluirla en la respuesta
    const userResult = await pool.query(
      'SELECT name, photo_url FROM users WHERE id = $1',
      [req.user.id]
    );
    
    const job = result.rows[0];
    const user = userResult.rows[0];
    
    res.status(201).json({
      id: job.id,
      title: job.title,
      description: job.description,
      budget: job.budget,
      category: job.category,
      skills: job.skills,
      userId: job.user_id,
      userName: user.name,
      userPhoto: user.photo_url,
      status: job.status,
      timestamp: job.created_at.getTime(),
      comments: [],
      likes: []
    });
  } catch (error) {
    console.error('Error al crear trabajo:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Obtener todos los trabajos
app.get('/api/jobs', async (req, res) => {
  try {
    const jobsResult = await pool.query(`
      SELECT 
        j.*,
        u.name as user_name,
        u.photo_url as user_photo
      FROM 
        jobs j
      JOIN 
        users u ON j.user_id = u.id
      ORDER BY 
        j.created_at DESC
    `);
    
    // Obtener comentarios para cada trabajo
    const jobs = await Promise.all(jobsResult.rows.map(async (job) => {
      const commentsResult = await pool.query(`
        SELECT 
          c.*,
          u.name as user_name,
          u.photo_url as user_photo
        FROM 
          comments c
        JOIN 
          users u ON c.user_id = u.id
        WHERE 
          c.job_id = $1
        ORDER BY 
          c.created_at ASC
      `, [job.id]);
      
      // Obtener respuestas para cada comentario
      const comments = await Promise.all(commentsResult.rows.map(async (comment) => {
        const repliesResult = await pool.query(`
          SELECT 
            r.*,
            u.name as user_name,
            u.photo_url as user_photo
          FROM 
            replies r
          JOIN 
            users u ON r.user_id = u.id
          WHERE 
            r.comment_id = $1
          ORDER BY 
            r.created_at ASC
        `, [comment.id]);
        
        const replies = repliesResult.rows.map(reply => ({
          id: reply.id,
          commentId: reply.comment_id,
          userId: reply.user_id,
          userName: reply.user_name,
          userPhoto: reply.user_photo,
          content: reply.content,
          timestamp: reply.created_at.getTime()
        }));
        
        return {
          id: comment.id,
          jobId: comment.job_id,
          userId: comment.user_id,
          userName: comment.user_name,
          userPhoto: comment.user_photo,
          content: comment.content,
          timestamp: comment.created_at.getTime(),
          replies: replies
        };
      }));
      
      // Obtener likes para el trabajo
      const likesResult = await pool.query('SELECT user_id FROM job_likes WHERE job_id = $1', [job.id]);
      const likes = likesResult.rows.map(like => like.user_id);
      
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
        comments: comments,
        likes: likes
      };
    }));
    
    res.json(jobs);
  } catch (error) {
    console.error('Error al obtener trabajos:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Obtener trabajo por ID
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const jobResult = await pool.query(`
      SELECT 
        j.*,
        u.name as user_name,
        u.photo_url as user_photo
      FROM 
        jobs j
      JOIN 
        users u ON j.user_id = u.id
      WHERE 
        j.id = $1
    `, [id]);
    
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trabajo no encontrado' });
    }
    
    const job = jobResult.rows[0];
    
    // Obtener comentarios
    const commentsResult = await pool.query(`
      SELECT 
        c.*,
        u.name as user_name,
        u.photo_url as user_photo
      FROM 
        comments c
      JOIN 
        users u ON c.user_id = u.id
      WHERE 
        c.job_id = $1
      ORDER BY 
        c.created_at ASC
    `, [id]);
    
    // Obtener respuestas para cada comentario
    const comments = await Promise.all(commentsResult.rows.map(async (comment) => {
      const repliesResult = await pool.query(`
        SELECT 
          r.*,
          u.name as user_name,
          u.photo_url as user_photo
        FROM 
          replies r
        JOIN 
          users u ON r.user_id = u.id
        WHERE 
          r.comment_id = $1
        ORDER BY 
          r.created_at ASC
      `, [comment.id]);
      
      const replies = repliesResult.rows.map(reply => ({
        id: reply.id,
        commentId: reply.comment_id,
        userId: reply.user_id,
        userName: reply.user_name,
        userPhoto: reply.user_photo,
        content: reply.content,
        timestamp: reply.created_at.getTime()
      }));
      
      return {
        id: comment.id,
        jobId: comment.job_id,
        userId: comment.user_id,
        userName: comment.user_name,
        userPhoto: comment.user_photo,
        content: comment.content,
        timestamp: comment.created_at.getTime(),
        replies: replies
      };
    }));
    
    // Obtener likes
    const likesResult = await pool.query('SELECT user_id FROM job_likes WHERE job_id = $1', [id]);
    const likes = likesResult.rows.map(like => like.user_id);
    
    res.json({
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
      comments: comments,
      likes: likes
    });
  } catch (error) {
    console.error('Error al obtener trabajo:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Actualizar trabajo
app.put('/api/jobs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, budget, category, skills, status } = req.body;
    
    // Verificar si el usuario es dueño del trabajo
    const jobCheck = await pool.query(
      'SELECT user_id FROM jobs WHERE id = $1',
      [id]
    );
    
    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Trabajo no encontrado' });
    }
    
    if (jobCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para actualizar este trabajo' });
    }
    
    // Actualizar trabajo
    const result = await pool.query(
      `UPDATE jobs 
       SET title = COALESCE($1, title), 
           description = COALESCE($2, description), 
           budget = COALESCE($3, budget), 
           category = COALESCE($4, category), 
           skills = COALESCE($5, skills), 
           status = COALESCE($6, status)
       WHERE id = $7 
       RETURNING *`,
      [title, description, budget, category, skills, status, id]
    );
    
    // Obtener comentarios y likes
    // (Reutilizando el código de obtener trabajo por ID)
    return res.redirect(`/api/jobs/${id}`);
  } catch (error) {
    console.error('Error al actualizar trabajo:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Eliminar trabajo
app.delete('/api/jobs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si el usuario es dueño del trabajo
    const jobCheck = await pool.query(
      'SELECT user_id FROM jobs WHERE id = $1',
      [id]
    );
    
    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Trabajo no encontrado' });
    }
    
    if (jobCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este trabajo' });
    }
    
    // Eliminar trabajo (las restricciones de clave foránea deberían eliminar los comentarios y likes)
    await pool.query(
      'DELETE FROM jobs WHERE id = $1',
      [id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar trabajo:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Añadir comentario a un trabajo
app.post('/api/jobs/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    // Verificar si el trabajo existe
    const jobCheck = await pool.query(
      'SELECT id FROM jobs WHERE id = $1',
      [id]
    );
    
    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Trabajo no encontrado' });
    }
    
    // Crear comentario
    const result = await pool.query(
      'INSERT INTO comments (job_id, user_id, content, created_at) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, req.user.id, content, new Date()]
    );
    
    const comment = result.rows[0];
    
    // Obtener información del usuario
    const userResult = await pool.query(
      'SELECT name, photo_url FROM users WHERE id = $1',
      [req.user.id]
    );
    
    const user = userResult.rows[0];
    
    res.status(201).json({
      id: comment.id,
      jobId: comment.job_id,
      userId: comment.user_id,
      userName: user.name,
      userPhoto: user.photo_url,
      content: comment.content,
      timestamp: comment.created_at.getTime(),
      replies: []
    });
  } catch (error) {
    console.error('Error al añadir comentario:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Añadir respuesta a un comentario
app.post('/api/comments/:id/replies', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    // Verificar si el comentario existe
    const commentCheck = await pool.query(
      'SELECT id FROM comments WHERE id = $1',
      [id]
    );
    
    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Comentario no encontrado' });
    }
    
    // Crear respuesta
    const result = await pool.query(
      'INSERT INTO replies (comment_id, user_id, content, created_at) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, req.user.id, content, new Date()]
    );
    
    const reply = result.rows[0];
    
    // Obtener información del usuario
    const userResult = await pool.query(
      'SELECT name, photo_url FROM users WHERE id = $1',
      [req.user.id]
    );
    
    const user = userResult.rows[0];
    
    res.status(201).json({
      id: reply.id,
      commentId: reply.comment_id,
      userId: reply.user_id,
      userName: user.name,
      userPhoto: user.photo_url,
      content: reply.content,
      timestamp: reply.created_at.getTime()
    });
  } catch (error) {
    console.error('Error al añadir respuesta:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ===== RUTAS DE CHAT =====

// Obtener chats de un usuario
app.get('/api/chats', authenticateToken, async (req, res) => {
  try {
    // Obtener todos los chats donde participa el usuario
    const chatsResult = await pool.query(
      'SELECT * FROM chats WHERE $1 = ANY(participants) ORDER BY updated_at DESC',
      [req.user.id]
    );
    
    // Para cada chat, obtener los mensajes
    const chats = await Promise.all(chatsResult.rows.map(async chat => {
      const messagesResult = await pool.query(
        'SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at ASC',
        [chat.id]
      );
      
      const messages = messagesResult.rows.map(message => ({
        id: message.id,
        chatId: message.chat_id,
        senderId: message.sender_id,
        content: message.content,
        timestamp: message.created_at.getTime()
      }));
      
      // Obtener información de los participantes
      const participantsInfo = await Promise.all(chat.participants.map(async participantId => {
        const userResult = await pool.query(
          'SELECT id, name, photo_url FROM users WHERE id = $1',
          [participantId]
        );
        return userResult.rows[0];
      }));
      
      let lastMessage = null;
      if (messages.length > 0) {
        lastMessage = messages[messages.length - 1];
      }
      
      return {
        id: chat.id,
        name: chat.name || '',
        participants: chat.participants,
        participantsInfo: participantsInfo,
        messages: messages,
        isGroup: chat.is_group,
        lastMessage: lastMessage
      };
    }));
    
    res.json(chats);
  } catch (error) {
    console.error('Error al obtener chats:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Obtener categorías de trabajos
app.get('/api/job-categories', async (req, res) => {
  try {
    const categories = [
      "Desarrollo Web", 
      "Desarrollo Móvil", 
      "Diseño UX/UI", 
      "Marketing Digital",
      "Redacción", 
      "Traducción", 
      "Vídeo y Animación", 
      "Consultoría SEO", 
      "Administración de Sistemas",
      "Ciencia de Datos", 
      "Inteligencia Artificial"
    ];
    
    res.json(categories);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Obtener lista de habilidades
app.get('/api/skills', async (req, res) => {
  try {
    const skills = [
      "JavaScript", 
      "React", 
      "Node.js", 
      "TypeScript", 
      "Angular", 
      "Vue.js", 
      "Python",
      "Django", 
      "PHP", 
      "Laravel", 
      "WordPress", 
      "HTML", 
      "CSS", 
      "SASS",
      "Adobe Photoshop", 
      "Adobe Illustrator", 
      "Figma", 
      "Sketch", 
      "SEO",
      "Google Ads", 
      "Facebook Ads", 
      "Copywriting", 
      "Diseño Gráfico",
      "Motion Graphics", 
      "Animación 3D", 
      "MySQL", 
      "PostgreSQL", 
      "MongoDB",
      "AWS", 
      "Docker", 
      "Kubernetes", 
      "DevOps", 
      "Machine Learning"
    ];
    
    res.json(skills);
  } catch (error) {
    console.error('Error al obtener habilidades:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Iniciar el servidor
server.listen(port, () => {
  console.log(`Servidor ejecutándose en el puerto ${port}`);
});

module.exports = { app, server };
