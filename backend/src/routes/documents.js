const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
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
const ALLOWED_DOC_EXT = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.pdf',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.zip',
]);
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_DOC_EXT.has(ext)) return cb(new Error('Недопустимое расширение файла'));
    if (!ALLOWED_DOC_TYPES.has(file.mimetype)) return cb(new Error('Недопустимый тип файла'));
    cb(null, true);
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
    const safeName = (req.file.originalname || 'file').replace(/[^\w.\-]/g, '_').slice(0, 255);
    const { rows } = await pool.query(
      `INSERT INTO documents (client_id, equipment_id, title, filename, filepath, filesize, doc_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        client_id,
        equipment_id || null,
        title,
        safeName,
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

// --- Безопасные ссылки на скачивание ---
// Идея: сессионный JWT не утекает в URL. Клиент запрашивает короткоживущий
// download-токен (60 сек), который действителен только для конкретного документа.

function issueDownloadToken(payload) {
  return jwt.sign(
    { ...payload, kind: 'doc_download' },
    process.env.JWT_SECRET,
    { expiresIn: '60s', algorithm: 'HS256' }
  );
}

function verifyDownloadToken(token, expectedDocId, expectedAudience) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded.kind !== 'doc_download') return null;
    if (decoded.docId !== expectedDocId) return null;
    if (decoded.aud !== expectedAudience) return null;
    return decoded;
  } catch { return null; }
}

// POST /api/documents/:id/download-link — сотрудник получает короткоживущую ссылку
router.post('/:id/download-link', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id FROM documents WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Не найдено' });
    const dl = issueDownloadToken({ docId: req.params.id, aud: 'staff', userId: req.user.id });
    res.json({ url: `/api/documents/download/${req.params.id}?dl=${dl}` });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// POST /api/documents/:id/client-download-link — клиент получает короткоживущую ссылку
router.post('/:id/client-download-link', clientAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id FROM documents WHERE id = $1 AND client_id = $2',
      [req.params.id, req.client.id]
    );
    if (!rows[0]) return res.status(403).json({ error: 'Нет доступа' });
    const dl = issueDownloadToken({ docId: req.params.id, aud: 'client', clientId: req.client.id });
    res.json({ url: `/api/documents/client-download/${req.params.id}?dl=${dl}` });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// GET /api/documents/download/:id — скачать файл (сотрудник)
// Поддержка двух способов авторизации:
//   1) заголовок Authorization (API-вызовы)
//   2) одноразовый ?dl=... (для <a href> из браузера)
router.get('/download/:id', async (req, res) => {
  try {
    let authorized = false;
    if (req.query.dl) {
      authorized = !!verifyDownloadToken(req.query.dl, req.params.id, 'staff');
    } else if (req.headers.authorization) {
      try {
        jwt.verify(req.headers.authorization.split(' ')[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
        authorized = true;
      } catch {}
    }
    if (!authorized) return res.status(401).json({ error: 'Не авторизован' });

    const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Не найдено' });
    const filepath = path.join(__dirname, '../../uploads/documents', rows[0].filepath);
    res.download(filepath, rows[0].filename);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/documents/client-download/:id — скачать файл (клиент)
router.get('/client-download/:id', async (req, res) => {
  try {
    let clientId = null;
    if (req.query.dl) {
      const decoded = verifyDownloadToken(req.query.dl, req.params.id, 'client');
      if (decoded) clientId = decoded.clientId;
    } else if (req.headers.authorization) {
      try {
        const decoded = jwt.verify(req.headers.authorization.split(' ')[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
        if (decoded.type === 'client') clientId = decoded.id;
      } catch {}
    }
    if (!clientId) return res.status(401).json({ error: 'Не авторизован' });

    const { rows } = await pool.query(
      'SELECT * FROM documents WHERE id = $1 AND client_id = $2',
      [req.params.id, clientId]
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
