
-- Script SQL para inicializar la base de datos PostgreSQL

-- Crear tablas
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  bio TEXT,
  skills TEXT[] DEFAULT '{}',
  photo_url TEXT,
  hourly_rate NUMERIC(10, 2),
  saved_jobs TEXT[] DEFAULT '{}',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  budget NUMERIC(10, 2) NOT NULL,
  category VARCHAR(100) NOT NULL,
  skills TEXT[] DEFAULT '{}',
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS replies (
  id SERIAL PRIMARY KEY,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS job_likes (
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (job_id, user_id)
);

CREATE TABLE IF NOT EXISTS chats (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  participants INTEGER[] NOT NULL,
  is_group BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_message INTEGER
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Nuevas tablas para categorías y habilidades
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS skills (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  category_id INTEGER REFERENCES categories(id),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar datos de categorías
INSERT INTO categories (name, description) VALUES 
('Desarrollo Web', 'Servicios relacionados con el desarrollo y diseño de sitios web'),
('Desarrollo Móvil', 'Servicios relacionados con el desarrollo de aplicaciones móviles'),
('Diseño UX/UI', 'Servicios relacionados con el diseño de experiencia e interfaz de usuario'),
('Marketing Digital', 'Servicios relacionados con estrategias de marketing online'),
('Redacción', 'Servicios relacionados con creación de contenido escrito'),
('Traducción', 'Servicios relacionados con la traducción de contenido'),
('Vídeo y Animación', 'Servicios relacionados con edición de video y animación'),
('Consultoría SEO', 'Servicios relacionados con optimización para motores de búsqueda'),
('Administración de Sistemas', 'Servicios relacionados con gestión y configuración de sistemas'),
('Ciencia de Datos', 'Servicios relacionados con análisis y procesamiento de datos'),
('Inteligencia Artificial', 'Servicios relacionados con desarrollo de soluciones de IA'),
('Diseño Gráfico', 'Servicios relacionados con diseño de gráficos e imágenes'),
('Edición de Audio', 'Servicios relacionados con producción y edición de audio'),
('Modelado 3D', 'Servicios relacionados con creación de modelos tridimensionales'),
('Soporte Técnico', 'Servicios de asistencia técnica para diferentes plataformas'),
('Gestión de Proyectos', 'Servicios relacionados con la administración de proyectos'),
('Testing y QA', 'Servicios relacionados con pruebas de software y control de calidad'),
('Arquitectura de Software', 'Servicios relacionados con diseño de arquitectura de sistemas'),
('Blockchain', 'Servicios relacionados con tecnología blockchain y criptomonedas'),
('IoT', 'Servicios relacionados con Internet de las Cosas');

-- Insertar datos de habilidades
INSERT INTO skills (name, category_id) VALUES 
('JavaScript', 1),
('React', 1),
('Node.js', 1),
('TypeScript', 1),
('Angular', 1),
('Vue.js', 1),
('Python', 1),
('Django', 1),
('PHP', 1),
('Laravel', 1),
('WordPress', 1),
('HTML', 1),
('CSS', 1),
('SASS', 1),
('Flutter', 2),
('React Native', 2),
('Swift', 2),
('Kotlin', 2),
('Figma', 3),
('Sketch', 3),
('Adobe XD', 3),
('Adobe Photoshop', 12),
('Adobe Illustrator', 12),
('SEO', 8),
('Google Ads', 4),
('Facebook Ads', 4),
('Copywriting', 5),
('Traducción Inglés-Español', 6),
('Motion Graphics', 7),
('Animación 3D', 7),
('After Effects', 7),
('MySQL', 9),
('PostgreSQL', 9),
('MongoDB', 9),
('AWS', 9),
('Docker', 9),
('Kubernetes', 9),
('TensorFlow', 11),
('PyTorch', 11),
('Machine Learning', 10);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_job_id ON comments(job_id);
CREATE INDEX IF NOT EXISTS idx_replies_comment_id ON replies(comment_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chats_participants ON chats USING GIN (participants);
CREATE INDEX IF NOT EXISTS idx_skills_category_id ON skills(category_id);

-- Trigger para actualizar el timestamp de chats cuando se envía un mensaje
CREATE OR REPLACE FUNCTION update_chat_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chats 
  SET updated_at = CURRENT_TIMESTAMP,
      last_message = NEW.id
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_chat_timestamp ON messages;
CREATE TRIGGER trigger_update_chat_timestamp
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_chat_timestamp();
