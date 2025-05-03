
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getChats } from '@/lib/api';
import { getSocket, sendMessage as socketSendMessage, createChat as socketCreateChat, onReceiveMessage, onNewChat } from '@/lib/socket';
import { toast } from '@/components/ui/use-toast';

// Type definitions for messages and chats
export type MessageType = {
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
  chatId: string;
};

export type ChatType = {
  id: string;
  name: string; // For group chats
  participants: string[]; // User IDs
  participantsInfo?: any[]; // User information objects
  messages: MessageType[];
  isGroup: boolean;
  lastMessage?: MessageType;
};

// Chat context interface defining available functions and state
interface ChatContextType {
  chats: ChatType[];
  activeChat: ChatType | null;
  setActiveChat: (chat: ChatType | null) => void;
  sendMessage: (chatId: string, content: string) => void;
  createChat: (participantIds: string[], name?: string) => void;
  createPrivateChat: (participantId: string) => Promise<void>;
  getChat: (chatId: string) => ChatType | undefined;
  loadingChats: boolean;
  onlineUsers: string[]; // Online user IDs
  loadChats: () => Promise<void>;
  addParticipantToChat: (chatId: string, participantId: string) => Promise<boolean>;
  findExistingPrivateChat: (participantId: string) => ChatType | undefined;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

// Mock online users - en una aplicación real, esto vendría del servidor
const MOCK_ONLINE_USERS = ['1', '2', '3'];

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const { currentUser } = useAuth();
  const [chats, setChats] = useState<ChatType[]>([]);
  const [activeChat, setActiveChat] = useState<ChatType | null>(null);
  const [loadingChats, setLoadingChats] = useState(true);
  const [onlineUsers] = useState<string[]>(MOCK_ONLINE_USERS);

  /**
   * Function to find an existing private chat with a specific user
   * Used to prevent duplicate chat creation
   */
  const findExistingPrivateChat = (participantId: string): ChatType | undefined => {
    if (!currentUser) return undefined;
    
    return chats.find(
      chat => !chat.isGroup && 
      chat.participants.length === 2 && 
      chat.participants.includes(currentUser.id) && 
      chat.participants.includes(participantId)
    );
  };

  /**
   * Function to load all chats
   */
  const loadChats = async () => {
    if (!currentUser) {
      setChats([]);
      setLoadingChats(false);
      return;
    }
  
    setLoadingChats(true);
    try {
      console.log("Cargando chats para el usuario:", currentUser.id);
      const userChats = await getChats();
      setChats(userChats);
      console.log("Chats cargados:", userChats.length);
    } catch (error) {
      console.error("Error al cargar chats:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los chats. Por favor, inténtalo de nuevo."
      });
    } finally {
      setLoadingChats(false);
    }
  };

  /**
   * Set up socket listeners for real-time updates
   */
  useEffect(() => {
    if (!currentUser) return;
    
    console.log("Configurando listeners de socket.io...");
    
    // Listener para recibir mensajes en tiempo real
    const messageUnsubscribe = onReceiveMessage((message) => {
      console.log("Mensaje recibido:", message);
      
      setChats(prevChats => {
        const updatedChats = prevChats.map(chat => {
          if (chat.id === message.chatId) {
            // Añadir el nuevo mensaje al chat
            const updatedMessages = [...chat.messages, message];
            return {
              ...chat,
              messages: updatedMessages,
              lastMessage: message
            };
          }
          return chat;
        });
        
        // Si el chat activo es el que recibió el mensaje, también actualizarlo
        if (activeChat && activeChat.id === message.chatId) {
          const updatedChat = updatedChats.find(chat => chat.id === message.chatId);
          if (updatedChat) {
            setActiveChat(updatedChat);
          }
        }
        
        return updatedChats;
      });
    });
    
    // Listener para nuevos chats
    const chatUnsubscribe = onNewChat((newChat) => {
      console.log("Nuevo chat recibido:", newChat);
      
      setChats(prevChats => {
        // Verificar si el chat ya existe
        const chatExists = prevChats.some(chat => chat.id === newChat.id);
        if (chatExists) return prevChats;
        
        return [newChat, ...prevChats];
      });
    });
    
    // Función de limpieza para desuscribirse de los eventos
    return () => {
      messageUnsubscribe();
      chatUnsubscribe();
    };
  }, [currentUser, activeChat]);

  /**
   * Load chats when user changes
   */
  useEffect(() => {
    if (currentUser) {
      loadChats();
    } else {
      setChats([]);
    }
  }, [currentUser]);

  /**
   * Helper function to get a specific chat by ID
   */
  const getChat = (chatId: string) => {
    return chats.find(chat => chat.id === chatId);
  };

  /**
   * Function to send messages with real-time updates
   */
  const sendMessage = (chatId: string, content: string) => {
    if (!currentUser || !content.trim()) return;
    
    try {
      console.log("Enviando mensaje:", { chatId, content });
      const sent = socketSendMessage(chatId, content);
      
      if (!sent) {
        throw new Error("Error al enviar mensaje");
      }
    } catch (error) {
      console.error("Error al enviar mensaje:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo enviar el mensaje. Por favor, inténtalo de nuevo."
      });
    }
  };

  /**
   * Function to create a chat (can be group or 1:1)
   */
  const createChat = (participantIds: string[], name = '') => {
    if (!currentUser) return;
    
    // Ensure current user is included
    if (!participantIds.includes(currentUser.id)) {
      participantIds.push(currentUser.id);
    }
    
    try {
      const isGroup = participantIds.length > 2 || !!name;
      console.log("Creando chat:", { participants: participantIds, name, isGroup });
      
      socketCreateChat(participantIds, name, isGroup);
    } catch (error) {
      console.error("Error al crear chat:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo crear el chat. Por favor, inténtalo de nuevo."
      });
    }
  };

  /**
   * Enhanced function to create or navigate to an existing private chat
   */
  const createPrivateChat = async (participantId: string) => {
    if (!currentUser || participantId === currentUser.id) return;
    
    try {
      // Check if a private chat already exists with this user
      const existingChat = findExistingPrivateChat(participantId);
      
      if (existingChat) {
        // If the chat exists, set it as active
        console.log("Chat privado existente encontrado, navegando a él:", existingChat.id);
        setActiveChat(existingChat);
        return;
      }
      
      // If it doesn't exist, create a new private chat
      console.log("Creando nuevo chat privado con usuario:", participantId);
      const participants = [currentUser.id, participantId];
      
      socketCreateChat(participants);
      
      // El chat se añadirá a través del listener de socket.io
    } catch (error) {
      console.error("Error al crear chat privado:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo crear el chat privado. Por favor, inténtalo de nuevo."
      });
    }
  };

  /**
   * Function to add participants to an existing chat
   */
  const addParticipantToChat = async (chatId: string, participantId: string) => {
    try {
      // Implementar esta funcionalidad cuando se desarrolle en el backend
      console.error("Función addParticipantToChat no implementada");
      return false;
    } catch (error) {
      console.error("Error al añadir participante:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo añadir el participante. Por favor, inténtalo de nuevo."
      });
      return false;
    }
  };

  return (
    <ChatContext.Provider
      value={{
        chats,
        activeChat,
        setActiveChat,
        sendMessage,
        createChat,
        createPrivateChat,
        getChat,
        loadingChats,
        onlineUsers,
        loadChats,
        addParticipantToChat,
        findExistingPrivateChat
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
