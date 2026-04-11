const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db/pool');
const { authMiddleware, clientAuth } = require('../middleware/auth');

const router = express.Router();

// Хранилище файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/documents');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const ALLOWED_DOC_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
]);
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_DOC_TYPES.has(file.mimetype)) return cb(null, true);
    cb(new Error('Недопустимый тип файла'));
  },
}); // 50MB

// GET /api/documents/clients — список клиентов с оборудованием для страницы документации
router.get('/clients', authMiddleware, async (req, res) => {
  try {
    const { rows: clients } = await pool.query(
      'SELECT id, company_name, contact_name FROM clients WHERE status = $1 ORDER BY company_name',
      ['active']
    );
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/documents/client/:clientId — документы клиента (сгруппировано по оборудованию)
router.get('/client/:clientId', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.*, e.model as equipment_model, e.serial_number as equipment_serial,
              u.name as uploaded_by_name
       FROM documents d
       LEFT JOIN equipment e ON d.equipment_id = e.id
       LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE d.client_id = $1
       ORDER BY d.created_at DESC`,
      [req.params.clientId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/documents/upload — загрузить документ
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  const { client_id, equipment_id, title, doc_type } = req.body;
  if (!client_id || !title || !req.file) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Укажите клиента, название и файл' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO documents (client_id, equipment_id, title, filename, filepath, filesize, doc_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        client_id,
        equipment_id || null,
        title,
        req.file.originalname,
        req.file.filename,
        req.file.size,
        doc_type || 'general',
        req.user.id,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/documents/:id — удалить документ
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Не найдено' });
    const filepath = path.join(__dirname, '../../uploads/documents', rows[0].filepath);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    await pool.query('DELETE FROM documents WHERE id = $1', [req.params.id]);
    res.json({ message: 'Удалено' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/documents/download/:id — скачать файл (сотрудник)
router.get('/download/:id', (req, res, next) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}, authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Не найдено' });
    const filepath = path.join(__dirname, '../../uploads/documents', rows[0].filepath);
    res.download(filepath, rows[0].filename);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/documents/client-download/:id — скачать файл (клиент)
router.get('/client-download/:id', (req, res, next) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}, clientAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM documents WHERE id = $1 AND client_id = $2',
      [req.params.id, req.client.id]
    );
    if (!rows[0]) return res.status(403).json({ error: 'Нет доступа' });
    const filepath = path.join(__dirname, '../../uploads/documents', rows[0].filepath);
    res.download(filepath, rows[0].filename);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/documents/my — документы текущего клиента (ЛК)
router.get('/my', clientAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.*, e.model as equipment_model, e.serial_number as equipment_serial
       FROM documents d
       LEFT JOIN equipment e ON d.equipment_id = e.id
       WHERE d.client_id = $1
       ORDER BY d.created_at DESC`,
      [req.client.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
