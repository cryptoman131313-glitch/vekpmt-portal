const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Отправка email через SMTP (или лог если не настроен)
async function sendResetEmail(toEmail, resetLink) {
  if (!process.env.SMTP_HOST || process.env.SMTP_USER === 'your_email@vekpmt.ru') {
    console.log(`[RESET PASSWORD] Ссылка для ${toEmail}: ${resetLink}`);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: `"Сервисный Портал" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'Восстановление пароля — Эффективная Техника',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px">
        <h2 style="color:#18181B">Восстановление пароля</h2>
        <p>Вы запросили сброс пароля для Сервисного Портала.</p>
        <p>Нажмите кнопку ниже, чтобы задать новый пароль. Ссылка действительна 1 час.</p>
        <a href="${resetLink}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#CC0033;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Сбросить пароль</a>
        <p style="color:#71717A;font-size:12px">Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо.</p>
      </div>
    `,
  });
}

// POST /api/auth/login — вход сотрудника
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Введите email и пароль' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Неверный email или пароль' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name, type: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        permissions: user.permissions,
        notification_settings: user.notification_settings,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/client/login — вход клиента
router.post('/client/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Введите email и пароль' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT * FROM clients WHERE contact_email = $1 AND status = $2',
      [email.toLowerCase().trim(), 'active']
    );
    const client = rows[0];
    if (!client) return res.status(401).json({ error: 'Неверный email или пароль' });

    const valid = await bcrypt.compare(password, client.password_hash);
    if (!valid) return res.status(401).json({ error: 'Неверный email или пароль' });

    const token = jwt.sign(
      { id: client.id, email: client.contact_email, company: client.company_name, type: 'client' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      client: {
        id: client.id,
        company_name: client.company_name,
        contact_name: client.contact_name,
        contact_email: client.contact_email,
        contact_phone: client.contact_phone,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Введите email' });
  try {
    const emailNorm = email.toLowerCase().trim();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    // Ищем среди сотрудников
    const { rows: userRows } = await pool.query(
      'SELECT id, email FROM users WHERE email = $1 AND is_active = true', [emailNorm]
    );
    if (userRows[0]) {
      const token = uuidv4();
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await pool.query('UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3', [token, expires, userRows[0].id]);
      await sendResetEmail(userRows[0].email, `${frontendUrl}/reset-password?token=${token}`);
      return res.json({ message: 'Если такой email существует, на него отправлено письмо' });
    }

    // Ищем среди клиентов
    const { rows: clientRows } = await pool.query(
      'SELECT id, contact_email FROM clients WHERE contact_email = $1 AND status = $2', [emailNorm, 'active']
    );
    if (clientRows[0]) {
      const token = uuidv4();
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await pool.query('UPDATE clients SET reset_token = $1, reset_token_expires = $2 WHERE id = $3', [token, expires, clientRows[0].id]);
      await sendResetEmail(clientRows[0].contact_email, `${frontendUrl}/reset-password?token=${token}`);
    }

    res.json({ message: 'Если такой email существует, на него отправлено письмо' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Неверный запрос' });
  if (password.length < 8) return res.status(400).json({ error: 'Пароль минимум 8 символов' });
  try {
    // Проверяем сотрудников
    const { rows: userRows } = await pool.query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()', [token]
    );
    if (userRows[0]) {
      const hash = await bcrypt.hash(password, 12);
      await pool.query('UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2', [hash, userRows[0].id]);
      return res.json({ message: 'Пароль успешно изменён' });
    }

    // Проверяем клиентов
    const { rows: clientRows } = await pool.query(
      'SELECT id FROM clients WHERE reset_token = $1 AND reset_token_expires > NOW()', [token]
    );
    if (clientRows[0]) {
      const hash = await bcrypt.hash(password, 12);
      await pool.query('UPDATE clients SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2', [hash, clientRows[0].id]);
      return res.json({ message: 'Пароль успешно изменён' });
    }

    return res.status(400).json({ error: 'Ссылка недействительна или устарела' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/auth/me — текущий пользователь
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, role, avatar, permissions, notification_settings FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
