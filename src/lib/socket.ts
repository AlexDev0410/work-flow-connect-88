
import { io, Socket } from 'socket.io-client';
import { MessageType } from '@/contexts/ChatContext';

// URL del servidor de Socket.IO
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket: Socket | null = null;

// Función para inicializar la conexión del socket
export const initializeSocket = (token: string) => {
  // Si ya hay una conexión socket, la cerramos
  if (socket) {
    socket.disconnect();
  }

  // Creamos una nueva conexión con autenticación
  socket = io(SOCKET_URL, {
    auth: {
      token
    },
    transports: ['websocket'],
    autoConnect: true
  });

  // Manejadores de eventos básicos
  socket.on('connect', () => {
    console.log('Conectado al servidor de socket.io');
  });

  socket.on('connect_error', (err) => {
    console.error('Error de conexión socket:', err.message);
  });

  socket.on('error', (error) => {
    console.error('Error en socket:', error);
  });

  socket.on('disconnect', (reason) => {
    console.log('Desconectado del servidor:', reason);
  });

  return socket;
};

// Función para obtener el socket actual
export const getSocket = (): Socket | null => {
  return socket;
};

// Función para enviar un mensaje a un chat
export const sendMessage = (chatId: string, content: string) => {
  if (!socket || !socket.connected) {
    console.error('Socket no conectado');
    return false;
  }

  socket.emit('send_message', { chatId, content });
  return true;
};

// Función para crear un nuevo chat
export const createChat = (participants: string[], name: string = '', isGroup: boolean = false) => {
  if (!socket || !socket.connected) {
    console.error('Socket no conectado');
    return false;
  }

  socket.emit('create_chat', { participants, name, isGroup });
  return true;
};

// Función para añadir un evento de escucha para mensajes entrantes
export const onReceiveMessage = (callback: (message: MessageType) => void) => {
  if (!socket) return () => {};

  socket.on('receive_message', callback);
  
  return () => {
    socket.off('receive_message', callback);
  };
};

// Función para añadir un evento de escucha para nuevos chats
export const onNewChat = (callback: (chat: any) => void) => {
  if (!socket) return () => {};

  socket.on('new_chat', callback);
  
  return () => {
    socket.off('new_chat', callback);
  };
};

// Función para cerrar la conexión socket
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export default {
  initializeSocket,
  getSocket,
  sendMessage,
  createChat,
  onReceiveMessage,
  onNewChat,
  disconnectSocket
};
