
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
const { pool } = require('./db');

// Configuración de Socket.io
const configureSocketIO = (server) => {
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
          'UPDATE chats SET last_message = $1, updated_at = $2 WHERE id = $3',
          [message.id, new Date(), chatId]
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
          'INSERT INTO chats (name, participants, is_group, created_at, updated_at) VALUES ($1, $2, $3, $4, $4) RETURNING *',
          [name || '', participants, isGroup || participants.length > 2, new Date()]
        );
        
        const newChat = chatResult.rows[0];
        
        // Obtener información de los participantes
        const participantsInfo = await Promise.all(participants.map(async participantId => {
          const userResult = await pool.query(
            'SELECT id, name, photo_url FROM users WHERE id = $1',
            [participantId]
          );
          return userResult.rows[0];
        }));
        
        const chatData = {
          id: newChat.id,
          name: newChat.name,
          participants: newChat.participants,
          participantsInfo: participantsInfo,
          isGroup: newChat.is_group,
          messages: []
        };
        
        // Notificar a todos los participantes sobre el nuevo chat
        participants.forEach(participantId => {
          io.to(`user:${participantId}`).emit('new_chat', chatData);
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

  return io;
};

module.exports = configureSocketIO;
