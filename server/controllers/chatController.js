
const { pool } = require('../config/db');

// Obtener chats de un usuario
exports.getChats = async (req, res) => {
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
};

// Obtener un chat específico
exports.getChatById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si el chat existe y el usuario es participante
    const chatResult = await pool.query(
      'SELECT * FROM chats WHERE id = $1 AND $2 = ANY(participants)',
      [id, req.user.id]
    );
    
    if (chatResult.rows.length === 0) {
      return res.status(404).json({ error: 'Chat no encontrado o no tienes acceso' });
    }
    
    const chat = chatResult.rows[0];
    
    // Obtener mensajes
    const messagesResult = await pool.query(
      'SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at ASC',
      [id]
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
    
    res.json({
      id: chat.id,
      name: chat.name || '',
      participants: chat.participants,
      participantsInfo: participantsInfo,
      messages: messages,
      isGroup: chat.is_group,
      lastMessage: messages.length > 0 ? messages[messages.length - 1] : null
    });
  } catch (error) {
    console.error('Error al obtener chat:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};
