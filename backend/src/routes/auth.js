const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { sendPasswordReset } = require('../services/emailService');

const router = express.Router();

async function sendResetEmail(toEmail, resetLink) {
  await sendPasswordReset(toEmail, resetLink);
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

    // Если 2FA включена — отдаём временный токен
    if (user.totp_enabled && user.totp_secret) {
      const tempToken = jwt.sign(
        { id: user.id, type: 'totp_pending' },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );
      return res.json({ requires2fa: true, tempToken });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name, type: 'user', permissions: user.permissions || {} },
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
      `SELECT cu.*, c.company_name, c.contact_phone, c.status
       FROM client_users cu
       JOIN clients c ON c.id = cu.client_id
       WHERE cu.email = $1 AND cu.is_active = true AND c.status = 'active'`,
      [email.toLowerCase().trim()]
    );
    const client = rows[0];
    if (!client) return res.status(401).json({ error: 'Неверный email или пароль' });

    const valid = await bcrypt.compare(password, client.password_hash);
    if (!valid) return res.status(401).json({ error: 'Неверный email или пароль' });

    const token = jwt.sign(
      { id: client.client_id, email: client.email, name: client.name, company: client.company_name, type: 'client' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      client: {
        id: client.client_id,
        company_name: client.company_name,
        contact_name: client.name,
        contact_email: client.email,
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

    // Ищем среди клиентов (через client_users)
    const { rows: clientRows } = await pool.query(
      `SELECT cu.id, cu.email FROM client_users cu
       JOIN clients c ON c.id = cu.client_id
       WHERE cu.email = $1 AND cu.is_active = true AND c.status = 'active'`,
      [emailNorm]
    );
    if (clientRows[0]) {
      const token = uuidv4();
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await pool.query('UPDATE client_users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3', [token, expires, clientRows[0].id]);
      await sendResetEmail(clientRows[0].email, `${frontendUrl}/reset-password?token=${token}`);
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

    // Проверяем клиентов (через client_users)
    const { rows: clientRows } = await pool.query(
      'SELECT id FROM client_users WHERE reset_token = $1 AND reset_token_expires > NOW()', [token]
    );
    if (clientRows[0]) {
      const hash = await bcrypt.hash(password, 12);
      await pool.query('UPDATE client_users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2', [hash, clientRows[0].id]);
      return res.json({ message: 'Пароль успешно изменён' });
    }

    return res.status(400).json({ error: 'Ссылка недействительна или устарела' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/2fa/verify-login — второй шаг входа с 2FA
router.post('/2fa/verify-login', async (req, res) => {
  const { tempToken, code } = req.body;
  if (!tempToken || !code) return res.status(400).json({ error: 'Неверный запрос' });
  try {
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    if (decoded.type !== 'totp_pending') return res.status(401).json({ error: 'Недействительный токен' });

    const { rows } = await pool.query(
      'SELECT id, email, name, role, avatar, permissions, notification_settings, totp_secret FROM users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });

    const valid = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: code.replace(/\s/g, ''),
      window: 1,
    });
    if (!valid) return res.status(401).json({ error: 'Неверный код' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name, type: 'user', permissions: user.permissions || {} },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar, permissions: user.permissions, notification_settings: user.notification_settings },
    });
  } catch (err) {
    res.status(401).json({ error: 'Недействительный токен' });
  }
});

// POST /api/auth/2fa/setup — получить QR-код для настройки
router.post('/2fa/setup', authMiddleware, async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `Эффективная Техника (${req.user.email})`,
      length: 20,
    });
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
    // Сохраняем секрет временно (не включаем 2FA пока не подтвердят)
    await pool.query('UPDATE users SET totp_secret = $1 WHERE id = $2', [secret.base32, req.user.id]);
    res.json({ secret: secret.base32, qrCodeUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/2fa/enable — подтвердить код и включить 2FA
router.post('/2fa/enable', authMiddleware, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Введите код' });
  try {
    const { rows } = await pool.query('SELECT totp_secret FROM users WHERE id = $1', [req.user.id]);
    const secret = rows[0]?.totp_secret;
    if (!secret) return res.status(400).json({ error: 'Сначала настройте 2FA' });

    const valid = speakeasy.totp.verify({ secret, encoding: 'base32', token: code.replace(/\s/g, ''), window: 1 });
    if (!valid) return res.status(400).json({ error: 'Неверный код. Проверьте приложение и попробуйте снова' });

    await pool.query('UPDATE users SET totp_enabled = true WHERE id = $1', [req.user.id]);
    res.json({ message: '2FA включена' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/2fa/disable — отключить 2FA
router.post('/2fa/disable', authMiddleware, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Введите код из приложения' });
  try {
    const { rows } = await pool.query('SELECT totp_secret, totp_enabled FROM users WHERE id = $1', [req.user.id]);
    const user = rows[0];
    if (!user?.totp_enabled) return res.status(400).json({ error: '2FA не включена' });

    const valid = speakeasy.totp.verify({ secret: user.totp_secret, encoding: 'base32', token: code.replace(/\s/g, ''), window: 1 });
    if (!valid) return res.status(400).json({ error: 'Неверный код' });

    await pool.query('UPDATE users SET totp_enabled = false, totp_secret = NULL WHERE id = $1', [req.user.id]);
    res.json({ message: '2FA отключена' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/auth/2fa/status — статус 2FA текущего пользователя
router.get('/2fa/status', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT totp_enabled FROM users WHERE id = $1', [req.user.id]);
    res.json({ enabled: rows[0]?.totp_enabled || false });
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
