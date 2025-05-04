import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Crear instancia de axios con configuración común
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para añadir el token de autenticación a las solicitudes
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores comunes
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log('API error:', error.response?.data || error.message);
    
    // Si el error es 401 (No autorizado), redireccionar al login
    if (error.response && error.response.status === 401) {
      // Limpiar token y redirigir a login
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    
    if (error.response && error.response.data && error.response.data.error) {
      // Usamos el mensaje de error del backend si está disponible
      return Promise.reject(new Error(error.response.data.error));
    }
    
    return Promise.reject(error);
  }
);

// Funciones de autenticación
export const loginUser = async (email: string, password: string) => {
  try {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  } catch (error) {
    console.error('Error en loginUser:', error);
    throw error;
  }
};

export const registerUser = async (email: string, password: string, name: string) => {
  try {
    console.log('Enviando datos de registro:', { email, name });
    const response = await api.post('/auth/register', { email, password, name });
    return response.data;
  } catch (error) {
    console.error('Error en registerUser:', error);
    throw error;
  }
};

export const getCurrentUser = async () => {
  const response = await api.get('/users/me');
  return response.data;
};

// Funciones de usuarios
export const updateUserProfile = async (userData: any) => {
  const response = await api.put('/users/me', userData);
  return response.data;
};

export const getAllUsers = async () => {
  const response = await api.get('/users');
  return response.data;
};

export const getUserById = async (userId: string) => {
  const response = await api.get(`/users/${userId}`);
  return response.data;
};

// Funciones de trabajos
export const createJob = async (jobData: any) => {
  const response = await api.post('/jobs', jobData);
  return response.data;
};

export const getAllJobs = async () => {
  const response = await api.get('/jobs');
  return response.data;
};

export const getJobById = async (jobId: string) => {
  const response = await api.get(`/jobs/${jobId}`);
  return response.data;
};

export const updateJob = async (jobId: string, jobData: any) => {
  const response = await api.put(`/jobs/${jobId}`, jobData);
  return response.data;
};

export const deleteJob = async (jobId: string) => {
  const response = await api.delete(`/jobs/${jobId}`);
  return response.data;
};

export const addCommentToJob = async (jobId: string, content: string) => {
  const response = await api.post(`/jobs/${jobId}/comments`, { content });
  return response.data;
};

export const addReplyToComment = async (commentId: string, content: string) => {
  const response = await api.post(`/comments/${commentId}/replies`, { content });
  return response.data;
};

export const toggleJobLike = async (jobId: string) => {
  const response = await api.post(`/jobs/${jobId}/likes`);
  return response.data;
};

// Funciones para categorías y habilidades
export const getJobCategories = async () => {
  const response = await api.get('/job-categories');
  return response.data;
};

export const getSkillsList = async () => {
  const response = await api.get('/skills');
  return response.data;
};

// Funciones para chats
export const getChats = async () => {
  const response = await api.get('/chats');
  return response.data;
};

export default api;
