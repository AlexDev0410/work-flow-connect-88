
const { pool } = require('../config/db');

// Obtener categorías de trabajos
exports.getJobCategories = async (req, res) => {
  try {
    const categories = [
      "Desarrollo Web", 
      "Desarrollo Móvil", 
      "Diseño UX/UI", 
      "Marketing Digital",
      "Redacción", 
      "Traducción", 
      "Vídeo y Animación", 
      "Consultoría SEO", 
      "Administración de Sistemas",
      "Ciencia de Datos", 
      "Inteligencia Artificial"
    ];
    
    res.json(categories);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Obtener lista de habilidades
exports.getSkillsList = async (req, res) => {
  try {
    const skills = [
      "JavaScript", 
      "React", 
      "Node.js", 
      "TypeScript", 
      "Angular", 
      "Vue.js", 
      "Python",
      "Django", 
      "PHP", 
      "Laravel", 
      "WordPress", 
      "HTML", 
      "CSS", 
      "SASS",
      "Adobe Photoshop", 
      "Adobe Illustrator", 
      "Figma", 
      "Sketch", 
      "SEO",
      "Google Ads", 
      "Facebook Ads", 
      "Copywriting", 
      "Diseño Gráfico",
      "Motion Graphics", 
      "Animación 3D", 
      "MySQL", 
      "PostgreSQL", 
      "MongoDB",
      "AWS", 
      "Docker", 
      "Kubernetes", 
      "DevOps", 
      "Machine Learning"
    ];
    
    res.json(skills);
  } catch (error) {
    console.error('Error al obtener habilidades:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};
