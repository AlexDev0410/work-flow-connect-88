
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
    
    // Verificar si podemos conectar a la base de datos
    await pool.query('SELECT NOW()');
    
    // Verificar si la tabla users existe
    const tableCheckResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      )`
    );
    
    const tablesExist = tableCheckResult.rows[0].exists;
    
    if (!tablesExist) {
      console.log('Inicializando base de datos desde cero...');
      
      // Leer y ejecutar archivo SQL
      const sql = fs.readFileSync(path.join(__dirname, 'db.sql'), 'utf8');
      
      // Dividir el SQL en declaraciones individuales para poder ejecutarlas una por una
      const statements = sql.split(';').filter(statement => statement.trim() !== '');
      
      for (const statement of statements) {
        if (statement.trim()) {
          await pool.query(statement + ';');
        }
      }
      
      console.log('Base de datos inicializada correctamente');
    } else {
      console.log('La base de datos ya está inicializada');
      
      // Verificar si las tablas categories y skills existen
      const categoriesCheckResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'categories'
        )`
      );
      
      if (!categoriesCheckResult.rows[0].exists) {
        console.log('Creando tablas categories y skills...');
        
        // Extraer solo las partes relevantes del SQL para categories y skills
        const sql = fs.readFileSync(path.join(__dirname, 'db.sql'), 'utf8');
        const createCategoriesPattern = /CREATE TABLE IF NOT EXISTS categories[\s\S]*?;/g;
        const createSkillsPattern = /CREATE TABLE IF NOT EXISTS skills[\s\S]*?;/g;
        const insertCategoriesPattern = /INSERT INTO categories[\s\S]*?;/g;
        const insertSkillsPattern = /INSERT INTO skills[\s\S]*?;/g;
        
        const createCategoriesMatch = sql.match(createCategoriesPattern);
        const createSkillsMatch = sql.match(createSkillsPattern);
        const insertCategoriesMatch = sql.match(insertCategoriesPattern);
        const insertSkillsMatch = sql.match(insertSkillsPattern);
        
        if (createCategoriesMatch) {
          console.log('Creando tabla categories...');
          await pool.query(createCategoriesMatch[0]);
        }
        
        if (createSkillsMatch) {
          console.log('Creando tabla skills...');
          await pool.query(createSkillsMatch[0]);
        }
        
        if (insertCategoriesMatch) {
          console.log('Insertando datos en categories...');
          await pool.query(insertCategoriesMatch[0]);
        }
        
        if (insertSkillsMatch) {
          console.log('Insertando datos en skills...');
          await pool.query(insertSkillsMatch[0]);
        }
        
        console.log('Tablas categories y skills creadas correctamente');
      }
    }
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
    console.error('Detalles:', error.stack);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('No se pudo conectar a PostgreSQL. Verifique que el servicio esté en ejecución.');
    } else if (error.code === '28P01') {
      console.error('Error de autenticación. Verifique las credenciales en DATABASE_URL.');
    } else if (error.code === '3D000') {
      console.error('La base de datos no existe. Créela manualmente o modifique DATABASE_URL.');
    } else if (error.code === '42P01') {
      console.error('Error de relación inexistente. Intentando crear tablas...');
      try {
        // Intentar crear todas las tablas desde cero
        const sql = fs.readFileSync(path.join(__dirname, 'db.sql'), 'utf8');
        await pool.query(sql);
        console.log('Base de datos recuperada correctamente');
      } catch (innerError) {
        console.error('Error al recuperar la base de datos:', innerError);
      }
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
