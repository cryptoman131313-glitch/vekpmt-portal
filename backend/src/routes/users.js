const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { sendStaffWelcome } = require('../services/emailService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const AVATAR_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AVATAR_EXT  = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/avatars');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Жёстко фиксируем расширение по mimetype, не доверяем оригинальному имени файла
    const ext = file.mimetype === 'image/png' ? '.png'
              : file.mimetype === 'image/webp' ? '.webp'
              : '.jpg';
    cb(null, `${req.params.id}${ext}`);
  }
});
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!AVATAR_EXT.has(ext))  return cb(new Error('Допустимы только JPG/PNG/WEBP'));
    if (!AVATAR_MIME.has(file.mimetype)) return cb(new Error('Недопустимый тип файла'));
    cb(null, true);
  }
});

const router = express.Router();

// GET /api/users — список сотрудников (руководитель)
router.get('/', authMiddleware, requireRole('director'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, role, avatar, avatar_url, show_avatar, is_active, permissions, notification_settings, created_at FROM users ORDER BY role, name'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/users — создать сотрудника
router.post('/', authMiddleware, requireRole('director'), async (req, res) => {
  const { email, name, role, password, permissions } = req.body;
  if (!email || !name || !role || !password) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }
  try {
    const password_hash = await bcrypt.hash(password, 12);
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    // Руководитель всегда получает все права (зеркало логики PATCH)
    const finalPermissions = role === 'director' ? ALL_PERMISSIONS : (permissions || {});

    const { rows } = await pool.query(
      `INSERT INTO users (email, name, role, password_hash, avatar, permissions)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, name, role, avatar, permissions`,
      [email.toLowerCase(), name, role, password_hash, initials, finalPermissions]
    );
    res.status(201).json(rows[0]);

    // Email новому сотруднику с данными входа
    sendStaffWelcome(email.toLowerCase(), { name, role, password }).catch(() => {});
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email уже используется' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

const ALL_PERMISSIONS = {
  can_view_clients: true,
  can_view_registrations: true,
  can_view_equipment: true,
  can_view_documents: true,
  can_edit_messages: true,
  can_write_appeal: true,
  can_write_service: true,
  can_write_notes: true,
  can_approve_registrations: true,
  can_edit_equipment: true,
};

// GET /api/users/me — профиль текущего сотрудника
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, role, avatar, avatar_url, show_avatar, permissions FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// PATCH /api/users/me — обновить своё имя и/или пароль
router.patch('/me', authMiddleware, async (req, res) => {
  const { name, password, currentPassword } = req.body;
  try {
    let password_hash;
    if (password) {
      if (password.length < 8) return res.status(400).json({ error: 'Пароль минимум 8 символов' });
      if (!currentPassword) return res.status(400).json({ error: 'Введите текущий пароль' });
      const { rows: cur } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
      const valid = await bcrypt.compare(currentPassword, cur[0]?.password_hash || '');
      if (!valid) return res.status(400).json({ error: 'Текущий пароль неверный' });
      password_hash = await bcrypt.hash(password, 12);
    }
    const initials = name ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : undefined;
    const { rows } = await pool.query(
      `UPDATE users SET
        name = COALESCE($1, name),
        avatar = COALESCE($2, avatar),
        ${password_hash ? 'password_hash = $3,' : ''}
        updated_at = NOW()
       WHERE id = $${password_hash ? 4 : 3} RETURNING id, email, name, role, avatar, avatar_url, show_avatar, permissions`,
      password_hash
        ? [name || null, initials || null, password_hash, req.user.id]
        : [name || null, initials || null, req.user.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// PATCH /api/users/:id — обновить сотрудника
router.patch('/:id', authMiddleware, requireRole('director'), async (req, res) => {
  let { name, role, is_active, permissions, password } = req.body;
  try {
    // Руководитель всегда имеет все права
    const { rows: targetRows } = await pool.query('SELECT role FROM users WHERE id = $1', [req.params.id]);
    if (targetRows[0]?.role === 'director') permissions = ALL_PERMISSIONS;

    let password_hash = undefined;
    if (password) password_hash = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `UPDATE users SET
        name = COALESCE($1, name),
        role = COALESCE($2, role),
        is_active = COALESCE($3, is_active),
        permissions = COALESCE($4, permissions),
        ${password_hash ? 'password_hash = $5,' : ''}
        updated_at = NOW()
       WHERE id = $${password_hash ? 6 : 5} RETURNING id, email, name, role, avatar, avatar_url, show_avatar, is_active, permissions`,
      password_hash
        ? [name, role, is_active, permissions, password_hash, req.params.id]
        : [name, role, is_active, permissions, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/users/me/notifications — настройки уведомлений
router.patch('/me/notifications', authMiddleware, async (req, res) => {
  try {
    // Whitelist: принимаем только булевые флаги из фиксированного списка
    const allowed = ['email', 'sound', 'new_ticket', 'new_message', 'status_changed', 'assigned'];
    const settings = {};
    for (const key of allowed) {
      if (key in req.body) settings[key] = Boolean(req.body[key]);
    }
    const { rows } = await pool.query(
      `UPDATE users SET notification_settings = $1, updated_at = NOW() WHERE id = $2
       RETURNING notification_settings`,
      [JSON.stringify(settings), req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/users/ticket-types — типы заявок
router.get('/ticket-types', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM ticket_types WHERE is_active = true ORDER BY sort_order');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/users/ticket-types — создать тип заявки
router.post('/ticket-types', authMiddleware, requireRole('director'), async (req, res) => {
  const { name, color, statuses, auto_statuses } = req.body;
  if (!name) return res.status(400).json({ error: 'Укажите название' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO ticket_types (name, color, statuses, auto_statuses)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, color || '#71717A', JSON.stringify(statuses || []), JSON.stringify(auto_statuses || {})]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/users/ticket-types/:id — обновить тип заявки
router.patch('/ticket-types/:id', authMiddleware, requireRole('director'), async (req, res) => {
  const { name, color, statuses, auto_statuses } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE ticket_types SET
        name = COALESCE($1, name),
        color = COALESCE($2, color),
        statuses = COALESCE($3, statuses),
        auto_statuses = COALESCE($4, auto_statuses)
       WHERE id = $5 RETURNING *`,
      [name, color, statuses ? JSON.stringify(statuses) : null, auto_statuses ? JSON.stringify(auto_statuses) : null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Тип не найден' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/users/ticket-types/:id — удалить тип заявки
router.delete('/ticket-types/:id', authMiddleware, requireRole('director'), async (req, res) => {
  try {
    await pool.query('DELETE FROM ticket_types WHERE id = $1', [req.params.id]);
    res.json({ message: 'Удалено' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/users/notifications — уведомления текущего пользователя
router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );
    const unread = rows.filter(n => !n.is_read).length;
    res.json({ notifications: rows, unread });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/users/notifications/read-all
router.post('/notifications/read-all', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user.id]);
    res.json({ message: 'OK' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/users/:id/avatar — загрузить фото (руководитель или свой профиль)
router.post('/:id/avatar', authMiddleware, (req, res, next) => {
  if (req.user.role !== 'director' && String(req.user.id) !== String(req.params.id)) {
    return res.status(403).json({ error: 'Нет доступа' })
  }
  next()
}, uploadAvatar.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  try {
    const { rows } = await pool.query(
      'UPDATE users SET avatar_url = $1, show_avatar = true, updated_at = NOW() WHERE id = $2 RETURNING id, avatar_url, show_avatar',
      [avatarUrl, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// PATCH /api/users/:id/show-avatar — включить/выключить фото
router.patch('/:id/show-avatar', authMiddleware, requireRole('director'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE users SET show_avatar = $1, updated_at = NOW() WHERE id = $2 RETURNING id, avatar_url, show_avatar',
      [req.body.show_avatar, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

module.exports = router;
