
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { toast } from "@/components/ui/use-toast";
import { loginUser as apiLoginUser, registerUser as apiRegisterUser, getCurrentUser, updateUserProfile as apiUpdateUserProfile } from "@/lib/api";
import { initializeSocket, disconnectSocket } from '@/lib/socket';

export type UserType = {
  id: string;
  name: string;
  email: string;
  photoURL?: string;
  bio?: string;
  skills?: string[];
  role: 'freelancer' | 'client';
  savedJobs?: string[];
  hourlyRate?: number;
  joinedAt?: number;
};

interface AuthContextType {
  currentUser: UserType | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<UserType>) => Promise<void>;
  uploadProfilePhoto: (file: File) => Promise<string>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthStatus = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      try {
        // Iniciamos la conexión socket con el token
        initializeSocket(token);
        
        // Obtenemos los datos del usuario actual
        const userData = await getCurrentUser();
        setCurrentUser(userData);
      } catch (error) {
        console.error("Error al verificar estado de autenticación:", error);
        localStorage.removeItem('token');
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { token, user } = await apiLoginUser(email, password);
      
      // Guardar token en localStorage
      localStorage.setItem('token', token);
      
      // Inicializar la conexión Socket.io
      initializeSocket(token);
      
      setCurrentUser(user);
      
      toast({
        title: "Inicio de sesión exitoso",
        description: "Bienvenido a WorkFlowConnect",
      });
    } catch (error) {
      console.error("Error en login:", error);
      toast({
        variant: "destructive",
        title: "Error de inicio de sesión",
        description: "Credenciales incorrectas o servidor no disponible",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string) => {
    setLoading(true);
    try {
      const { token, user } = await apiRegisterUser(email, password, name);
      
      // Guardar token en localStorage
      localStorage.setItem('token', token);
      
      // Inicializar la conexión Socket.io
      initializeSocket(token);
      
      setCurrentUser(user);
      
      toast({
        title: "Registro exitoso",
        description: "¡Bienvenido a WorkFlowConnect!",
      });
    } catch (error) {
      console.error("Error en registro:", error);
      toast({
        variant: "destructive",
        title: "Error de registro",
        description: "No se pudo completar el registro. Inténtalo de nuevo.",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Desconectar socket
      disconnectSocket();
      
      // Eliminar token
      localStorage.removeItem('token');
      
      setCurrentUser(null);
      
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente",
      });
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al cerrar sesión"
      });
    }
  };

  const updateUserProfile = async (data: Partial<UserType>) => {
    if (!currentUser) throw new Error('No hay usuario autenticado');
    
    try {
      const updatedUser = await apiUpdateUserProfile(data);
      setCurrentUser(prev => prev ? { ...prev, ...updatedUser } : null);
      
      toast({
        title: "Perfil actualizado",
        description: "Tus cambios han sido guardados",
      });
    } catch (error) {
      console.error("Error al actualizar perfil:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al actualizar el perfil"
      });
      throw error;
    }
  };

  const uploadProfilePhoto = async (file: File) => {
    if (!currentUser) throw new Error('No hay usuario autenticado');
    
    try {
      // Crear un FormData para la subida del archivo
      const formData = new FormData();
      formData.append('photo', file);
      
      // Esta función debería implementarse en el backend
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/users/me/photo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Error al subir la foto');
      }
      
      const data = await response.json();
      const photoURL = data.photoURL;
      
      // Actualizar el usuario con la nueva foto
      setCurrentUser(prev => prev ? { ...prev, photoURL } : null);
      
      toast({
        title: "Foto actualizada",
        description: "Tu foto de perfil ha sido actualizada",
      });
      
      return photoURL;
    } catch (error) {
      console.error("Error en uploadProfilePhoto:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al subir la foto de perfil"
      });
      throw error;
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        currentUser, 
        loading, 
        login, 
        register, 
        logout,
        updateUserProfile,
        uploadProfilePhoto
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
