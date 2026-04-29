const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// Принимает любой валидный JWT — и сотрудника, и клиента (только для GET).
// PUT остаётся под requireRole('director').
function anyAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  try {
    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}

// GET /api/settings/:key — получить настройку (доступно и сотрудникам, и клиентам)
router.get('/:key', anyAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT value FROM system_settings WHERE key = $1', [req.params.key]);
    res.json(rows[0]?.value || []);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/settings/:key — сохранить настройку (только руководитель)
router.put('/:key', authMiddleware, requireRole('director'), async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [req.params.key, JSON.stringify(req.body.value)]
    );
    res.json({ message: 'OK' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
