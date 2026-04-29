const express = require('express');
const bcrypt = require('bcryptjs');
const https = require('https');
const pool = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { sendRegistrationReceivedToStaff, sendRegistrationApproved, sendRegistrationRejected } = require('../services/emailService');

const router = express.Router();

async function verifyRecaptcha(token) {
  const secret = process.env.RECAPTCHA_SECRET;
  if (!secret || secret === 'your_recaptcha_secret') return true; // dev mode — пропускаем
  return new Promise((resolve) => {
    const postData = `secret=${secret}&response=${token}`;
    const req = https.request({
      hostname: 'www.google.com',
      path: '/recaptcha/api/siteverify',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': postData.length }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data).success); } catch { resolve(false); }
      });
    });
    req.on('error', () => resolve(false));
    req.write(postData);
    req.end();
  });
}

// POST /api/registrations — подача заявки на регистрацию (публичный)
router.post('/', async (req, res) => {
  const { company_name, inn, legal_address, contact_name, contact_phone, contact_email, password, recaptcha_token } = req.body;

  if (!company_name || !contact_name || !contact_phone || !contact_email || !password) {
    return res.status(400).json({ error: 'Заполните все обязательные поля' });
  }

  const captchaOk = await verifyRecaptcha(recaptcha_token);
  if (!captchaOk) {
    return res.status(400).json({ error: 'Не пройдена проверка reCAPTCHA' });
  }

  try {
    // Проверка дублей
    const existing = await pool.query(
      'SELECT id FROM registrations WHERE contact_email = $1 AND status = $2',
      [contact_email.toLowerCase(), 'pending']
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Заявка с этим email уже ожидает рассмотрения' });
    }
    const existingClient = await pool.query(
      'SELECT id FROM clients WHERE contact_email = $1',
      [contact_email.toLowerCase()]
    );
    if (existingClient.rows.length > 0) {
      return res.status(409).json({ error: 'Клиент с таким email уже зарегистрирован' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `INSERT INTO registrations (company_name, inn, legal_address, contact_name, contact_phone, contact_email, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, company_name, contact_email, created_at`,
      [company_name, inn || null, legal_address || null, contact_name,
       contact_phone, contact_email.toLowerCase(), password_hash]
    );

    res.status(201).json({ message: 'Заявка на регистрацию отправлена', registration: rows[0] });

    // Email руководителям о новой заявке
    const { rows: directors } = await pool.query(`SELECT email FROM users WHERE role = 'director' AND is_active = true`);
    for (const d of directors) {
      sendRegistrationReceivedToStaff(d.email, { company_name, contact_name, contact_phone, contact_email }).catch(() => {});
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/registrations — список заявок (только сотрудники)
router.get('/', authMiddleware, async (req, res) => {
  const { status = 'pending' } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT r.*, u.name as reviewed_by_name
       FROM registrations r
       LEFT JOIN users u ON r.reviewed_by = u.id
       WHERE r.status = $1
       ORDER BY r.created_at DESC`,
      [status]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/registrations/count — счётчик ожидающих
router.get('/count', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT COUNT(*) as count FROM registrations WHERE status = 'pending'"
    );
    res.json({ count: parseInt(rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/registrations/:id/approve — одобрить
router.post('/:id/approve', authMiddleware, requireRole('director', 'manager'), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query('SELECT * FROM registrations WHERE id = $1', [id]);
    const reg = rows[0];
    if (!reg) return res.status(404).json({ error: 'Заявка не найдена' });
    if (reg.status !== 'pending') return res.status(400).json({ error: 'Заявка уже обработана' });

    // Создаём клиента
    const { rows: clientRows } = await client.query(
      `INSERT INTO clients (company_name, inn, legal_address, contact_name, contact_phone, contact_email, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [reg.company_name, reg.inn, reg.legal_address, reg.contact_name,
       reg.contact_phone, reg.contact_email, reg.password_hash]
    );

    // Создаём учётную запись для входа в ЛК
    await client.query(
      `INSERT INTO client_users (client_id, email, password_hash, name) VALUES ($1, $2, $3, $4)`,
      [clientRows[0].id, reg.contact_email, reg.password_hash, reg.contact_name]
    );

    // Обновляем заявку
    await client.query(
      `UPDATE registrations SET status = 'approved', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2`,
      [req.user.id, id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Регистрация одобрена', client_id: clientRows[0].id });

    // Email клиенту об одобрении
    sendRegistrationApproved(reg.contact_email, { contact_name: reg.contact_name }).catch(() => {});
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// POST /api/registrations/:id/reject — отклонить
router.post('/:id/reject', authMiddleware, requireRole('director', 'manager'), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM registrations WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Заявка не найдена' });
    if (rows[0].status !== 'pending') return res.status(400).json({ error: 'Заявка уже обработана' });

    await pool.query(
      `UPDATE registrations SET status = 'rejected', rejected_reason = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3`,
      [reason || null, req.user.id, id]
    );

    res.json({ message: 'Регистрация отклонена' });

    // Email клиенту об отклонении
    sendRegistrationRejected(rows[0].contact_email, { contact_name: rows[0].contact_name, reason }).catch(() => {});
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/registrations/:id — удалить заявку (только директор)
router.delete('/:id', authMiddleware, requireRole('director'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM registrations WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Заявка не найдена' });
    res.json({ message: 'Заявка удалена' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
