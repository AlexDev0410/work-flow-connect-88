
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { pool } = require('./config/db');
const configureSocketIO = require('./config/socketio');

// Importar rutas
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const jobRoutes = require('./routes/jobRoutes');
const commentRoutes = require('./routes/commentRoutes');
const chatRoutes = require('./routes/chatRoutes');
const dataRoutes = require('./routes/dataRoutes');

// Configuración inicial de la aplicación
const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;

// Configuración de Socket.io
const io = configureSocketIO(server);

// Middleware para parsear JSON y formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// Servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Crear directorios necesarios
const directorios = [
  path.join(__dirname, 'uploads'),
  path.join(__dirname, 'uploads/profiles')
];

directorios.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api', dataRoutes);

// Endpoint de verificación del estado del servidor
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Server is running', 
    timestamp: new Date().toISOString() 
  });
});

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error('Error global:', err.stack);
  res.status(500).json({ error: 'Error en el servidor' });
});

// Inicializar la base de datos
const initDatabase = async () => {
  try {
    console.log('Comprobando estado de la base de datos...');
    
    // Verificar si la base de datos ya está inicializada
    const tableCheckResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      )`
    );
    
    const tablesExist = tableCheckResult.rows[0].exists;
    
    if (!tablesExist) {
      console.log('Inicializando base de datos...');
      
      // Leer y ejecutar archivo SQL
      const sql = fs.readFileSync(path.join(__dirname, 'db.sql'), 'utf8');
      
      await pool.query(sql);
      
      console.log('Base de datos inicializada correctamente');
    } else {
      console.log('La base de datos ya está inicializada');
    }
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
    console.error('Detalles:', error.stack);
    
    // Verificar si es un error de conexión
    if (error.code === 'ECONNREFUSED') {
      console.error('No se pudo conectar a PostgreSQL. Verifique que el servicio esté en ejecución.');
    }
    
    // Verificar si es un error de autenticación
    if (error.code === '28P01') {
      console.error('Error de autenticación. Verifique las credenciales en DATABASE_URL.');
    }
    
    // Verificar si es un error de base de datos no existente
    if (error.code === '3D000') {
      console.error('La base de datos no existe. Créela manualmente o modifique DATABASE_URL.');
    }
  }
};

// Iniciar el servidor
server.listen(port, async () => {
  console.log(`Servidor ejecutándose en el puerto ${port}`);
  
  // Inicializar la base de datos
  await initDatabase();
});

module.exports = { app, server };
