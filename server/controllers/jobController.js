
const { pool } = require('../config/db');

// Crear trabajo
exports.createJob = async (req, res) => {
  try {
    const { title, description, budget, category, skills, status } = req.body;
    
    const result = await pool.query(
      'INSERT INTO jobs (title, description, budget, category, skills, status, user_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [title, description, budget, category, skills, status || 'open', req.user.id, new Date()]
    );
    
    // Obtener información del usuario para incluirla en la respuesta
    const userResult = await pool.query(
      'SELECT name, photo_url FROM users WHERE id = $1',
      [req.user.id]
    );
    
    const job = result.rows[0];
    const user = userResult.rows[0];
    
    res.status(201).json({
      id: job.id,
      title: job.title,
      description: job.description,
      budget: job.budget,
      category: job.category,
      skills: job.skills,
      userId: job.user_id,
      userName: user.name,
      userPhoto: user.photo_url,
      status: job.status,
      timestamp: job.created_at.getTime(),
      comments: [],
      likes: []
    });
  } catch (error) {
    console.error('Error al crear trabajo:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Obtener todos los trabajos
exports.getAllJobs = async (req, res) => {
  try {
    const jobsResult = await pool.query(`
      SELECT 
        j.*,
        u.name as user_name,
        u.photo_url as user_photo
      FROM 
        jobs j
      JOIN 
        users u ON j.user_id = u.id
      ORDER BY 
        j.created_at DESC
    `);
    
    // Obtener comentarios para cada trabajo
    const jobs = await Promise.all(jobsResult.rows.map(async (job) => {
      const commentsResult = await pool.query(`
        SELECT 
          c.*,
          u.name as user_name,
          u.photo_url as user_photo
        FROM 
          comments c
        JOIN 
          users u ON c.user_id = u.id
        WHERE 
          c.job_id = $1
        ORDER BY 
          c.created_at ASC
      `, [job.id]);
      
      // Obtener respuestas para cada comentario
      const comments = await Promise.all(commentsResult.rows.map(async (comment) => {
        const repliesResult = await pool.query(`
          SELECT 
            r.*,
            u.name as user_name,
            u.photo_url as user_photo
          FROM 
            replies r
          JOIN 
            users u ON r.user_id = u.id
          WHERE 
            r.comment_id = $1
          ORDER BY 
            r.created_at ASC
        `, [comment.id]);
        
        const replies = repliesResult.rows.map(reply => ({
          id: reply.id,
          commentId: reply.comment_id,
          userId: reply.user_id,
          userName: reply.user_name,
          userPhoto: reply.user_photo,
          content: reply.content,
          timestamp: reply.created_at.getTime()
        }));
        
        return {
          id: comment.id,
          jobId: comment.job_id,
          userId: comment.user_id,
          userName: comment.user_name,
          userPhoto: comment.user_photo,
          content: comment.content,
          timestamp: comment.created_at.getTime(),
          replies: replies
        };
      }));
      
      // Obtener likes para el trabajo
      const likesResult = await pool.query('SELECT user_id FROM job_likes WHERE job_id = $1', [job.id]);
      const likes = likesResult.rows.map(like => like.user_id);
      
      return {
        id: job.id,
        title: job.title,
        description: job.description,
        budget: job.budget,
        category: job.category,
        skills: job.skills,
        userId: job.user_id,
        userName: job.user_name,
        userPhoto: job.user_photo,
        status: job.status,
        timestamp: job.created_at.getTime(),
        comments: comments,
        likes: likes
      };
    }));
    
    res.json(jobs);
  } catch (error) {
    console.error('Error al obtener trabajos:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Obtener trabajo por ID
exports.getJobById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const jobResult = await pool.query(`
      SELECT 
        j.*,
        u.name as user_name,
        u.photo_url as user_photo
      FROM 
        jobs j
      JOIN 
        users u ON j.user_id = u.id
      WHERE 
        j.id = $1
    `, [id]);
    
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trabajo no encontrado' });
    }
    
    const job = jobResult.rows[0];
    
    // Obtener comentarios
    const commentsResult = await pool.query(`
      SELECT 
        c.*,
        u.name as user_name,
        u.photo_url as user_photo
      FROM 
        comments c
      JOIN 
        users u ON c.user_id = u.id
      WHERE 
        c.job_id = $1
      ORDER BY 
        c.created_at ASC
    `, [id]);
    
    // Obtener respuestas para cada comentario
    const comments = await Promise.all(commentsResult.rows.map(async (comment) => {
      const repliesResult = await pool.query(`
        SELECT 
          r.*,
          u.name as user_name,
          u.photo_url as user_photo
        FROM 
          replies r
        JOIN 
          users u ON r.user_id = u.id
        WHERE 
          r.comment_id = $1
        ORDER BY 
          r.created_at ASC
      `, [comment.id]);
      
      const replies = repliesResult.rows.map(reply => ({
        id: reply.id,
        commentId: reply.comment_id,
        userId: reply.user_id,
        userName: reply.user_name,
        userPhoto: reply.user_photo,
        content: reply.content,
        timestamp: reply.created_at.getTime()
      }));
      
      return {
        id: comment.id,
        jobId: comment.job_id,
        userId: comment.user_id,
        userName: comment.user_name,
        userPhoto: comment.user_photo,
        content: comment.content,
        timestamp: comment.created_at.getTime(),
        replies: replies
      };
    }));
    
    // Obtener likes
    const likesResult = await pool.query('SELECT user_id FROM job_likes WHERE job_id = $1', [id]);
    const likes = likesResult.rows.map(like => like.user_id);
    
    res.json({
      id: job.id,
      title: job.title,
      description: job.description,
      budget: job.budget,
      category: job.category,
      skills: job.skills,
      userId: job.user_id,
      userName: job.user_name,
      userPhoto: job.user_photo,
      status: job.status,
      timestamp: job.created_at.getTime(),
      comments: comments,
      likes: likes
    });
  } catch (error) {
    console.error('Error al obtener trabajo:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Actualizar trabajo
exports.updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, budget, category, skills, status } = req.body;
    
    // Verificar si el usuario es dueño del trabajo
    const jobCheck = await pool.query(
      'SELECT user_id FROM jobs WHERE id = $1',
      [id]
    );
    
    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Trabajo no encontrado' });
    }
    
    if (jobCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para actualizar este trabajo' });
    }
    
    // Actualizar trabajo
    const result = await pool.query(
      `UPDATE jobs 
       SET title = COALESCE($1, title), 
           description = COALESCE($2, description), 
           budget = COALESCE($3, budget), 
           category = COALESCE($4, category), 
           skills = COALESCE($5, skills), 
           status = COALESCE($6, status)
       WHERE id = $7 
       RETURNING *`,
      [title, description, budget, category, skills, status, id]
    );
    
    // Responder con los datos actualizados completos
    const updatedJob = await this.getJobById(req, res);
    return updatedJob;
  } catch (error) {
    console.error('Error al actualizar trabajo:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Eliminar trabajo
exports.deleteJob = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si el usuario es dueño del trabajo
    const jobCheck = await pool.query(
      'SELECT user_id FROM jobs WHERE id = $1',
      [id]
    );
    
    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Trabajo no encontrado' });
    }
    
    if (jobCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este trabajo' });
    }
    
    // Eliminar trabajo (las restricciones de clave foránea deberían eliminar los comentarios y likes)
    await pool.query(
      'DELETE FROM jobs WHERE id = $1',
      [id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar trabajo:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Añadir comentario a un trabajo
exports.addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    // Verificar si el trabajo existe
    const jobCheck = await pool.query(
      'SELECT id FROM jobs WHERE id = $1',
      [id]
    );
    
    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Trabajo no encontrado' });
    }
    
    // Crear comentario
    const result = await pool.query(
      'INSERT INTO comments (job_id, user_id, content, created_at) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, req.user.id, content, new Date()]
    );
    
    const comment = result.rows[0];
    
    // Obtener información del usuario
    const userResult = await pool.query(
      'SELECT name, photo_url FROM users WHERE id = $1',
      [req.user.id]
    );
    
    const user = userResult.rows[0];
    
    res.status(201).json({
      id: comment.id,
      jobId: comment.job_id,
      userId: comment.user_id,
      userName: user.name,
      userPhoto: user.photo_url,
      content: comment.content,
      timestamp: comment.created_at.getTime(),
      replies: []
    });
  } catch (error) {
    console.error('Error al añadir comentario:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Añadir respuesta a un comentario
exports.addReply = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    // Verificar si el comentario existe
    const commentCheck = await pool.query(
      'SELECT id FROM comments WHERE id = $1',
      [id]
    );
    
    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Comentario no encontrado' });
    }
    
    // Crear respuesta
    const result = await pool.query(
      'INSERT INTO replies (comment_id, user_id, content, created_at) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, req.user.id, content, new Date()]
    );
    
    const reply = result.rows[0];
    
    // Obtener información del usuario
    const userResult = await pool.query(
      'SELECT name, photo_url FROM users WHERE id = $1',
      [req.user.id]
    );
    
    const user = userResult.rows[0];
    
    res.status(201).json({
      id: reply.id,
      commentId: reply.comment_id,
      userId: reply.user_id,
      userName: user.name,
      userPhoto: user.photo_url,
      content: reply.content,
      timestamp: reply.created_at.getTime()
    });
  } catch (error) {
    console.error('Error al añadir respuesta:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Toggle like a un trabajo
exports.toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si el trabajo existe
    const jobCheck = await pool.query('SELECT id FROM jobs WHERE id = $1', [id]);
    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Trabajo no encontrado' });
    }
    
    // Verificar si ya dio like
    const likeCheck = await pool.query(
      'SELECT * FROM job_likes WHERE job_id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    let liked = false;
    
    if (likeCheck.rows.length > 0) {
      // Eliminar like
      await pool.query(
        'DELETE FROM job_likes WHERE job_id = $1 AND user_id = $2',
        [id, req.user.id]
      );
    } else {
      // Añadir like
      await pool.query(
        'INSERT INTO job_likes (job_id, user_id, created_at) VALUES ($1, $2, $3)',
        [id, req.user.id, new Date()]
      );
      liked = true;
    }
    
    res.json({ liked });
  } catch (error) {
    console.error('Error al actualizar like:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};
