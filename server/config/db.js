
const { Pool } = require('pg');

// Configuración de PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Verificar conexión a la base de datos
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error al conectar a PostgreSQL:', err);
    
    // Información adicional para depuración
    if (err.code === 'ECONNREFUSED') {
      console.error('No se pudo conectar al servidor PostgreSQL. Verifique que:');
      console.error('1. El servicio PostgreSQL esté en ejecución');
      console.error('2. La URL de la base de datos en .env sea correcta');
      console.error('3. El host y puerto sean accesibles');
    } else if (err.code === '28P01') {
      console.error('Error de autenticación con PostgreSQL. Verifique las credenciales en DATABASE_URL');
    } else if (err.code === '3D000') {
      console.error('La base de datos especificada no existe. Verifique el nombre en DATABASE_URL');
    }
  } else {
    console.log('Conexión a PostgreSQL establecida');
  }
});

module.exports = { pool };
