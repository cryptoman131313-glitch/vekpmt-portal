const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { authMiddleware, clientAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/clients — создать клиента вручную (сотрудник)
router.post('/', authMiddleware, async (req, res) => {
  const { company_name, inn, legal_address, actual_address, contact_name, contact_phone, contact_email, password } = req.body;
  if (!company_name || !contact_name || !contact_phone || !contact_email || !password) {
    return res.status(400).json({ error: 'Заполните все обязательные поля' });
  }
  try {
    const password_hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO clients (company_name, inn, legal_address, actual_address, contact_name, contact_phone, contact_email, password_hash, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active') RETURNING id, company_name, contact_name, contact_email`,
      [company_name, inn || null, legal_address || null, actual_address || null, contact_name, contact_phone, contact_email.toLowerCase(), password_hash]
    );
    // Создаём запись в client_users чтобы клиент мог войти в ЛК
    await pool.query(
      `INSERT INTO client_users (client_id, email, password_hash, name, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (email) DO UPDATE SET password_hash = $3, is_active = true`,
      [rows[0].id, contact_email.toLowerCase(), password_hash, contact_name]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Клиент с таким email уже существует' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/clients — список клиентов
router.get('/', authMiddleware, async (req, res) => {
  const { search } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM equipment e WHERE e.client_id = c.id) as equipment_count,
        (SELECT COUNT(*) FROM tickets t WHERE t.client_id = c.id) as tickets_count
       FROM clients c
       WHERE ($1::text IS NULL OR c.company_name ILIKE $1 OR c.contact_name ILIKE $1 OR c.contact_email ILIKE $1 OR c.contact_phone ILIKE $1 OR c.inn ILIKE $1)
       ORDER BY c.company_name ASC`,
      [search ? `%${search}%` : null]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/clients/:id — карточка клиента
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Клиент не найден' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/clients/:id/equipment
router.get('/:id/equipment', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*,
        (SELECT COUNT(*) FROM tickets t WHERE t.equipment_id = e.id) as tickets_count
       FROM equipment e WHERE e.client_id = $1 ORDER BY e.created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/clients/:id/tickets
router.get('/:id/tickets', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, tt.name as type_name, tt.color as type_color, e.model as equipment_model
       FROM tickets t
       LEFT JOIN ticket_types tt ON t.type_id = tt.id
       LEFT JOIN equipment e ON t.equipment_id = e.id
       WHERE t.client_id = $1
       ORDER BY t.created_at DESC LIMIT 20`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/clients/:id — обновить клиента
router.patch('/:id', authMiddleware, async (req, res) => {
  const { company_name, inn, legal_address, actual_address, contact_name, contact_phone, contact_email } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE clients SET
        company_name = COALESCE($1, company_name),
        inn = COALESCE($2, inn),
        legal_address = COALESCE($3, legal_address),
        actual_address = COALESCE($4, actual_address),
        contact_name = COALESCE($5, contact_name),
        contact_phone = COALESCE($6, contact_phone),
        contact_email = COALESCE($7, contact_email),
        updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [company_name, inn, legal_address, actual_address, contact_name, contact_phone, contact_email, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Клиент не найден' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/clients/me — профиль клиента (ЛК)
router.get('/me/profile', clientAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, company_name, inn, legal_address, actual_address, contact_name, contact_phone, contact_email FROM clients WHERE id = $1',
      [req.client.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Не найдено' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/clients/me/profile — обновить свой профиль (ЛК клиента)
router.patch('/me/profile', clientAuth, async (req, res) => {
  const { contact_name, contact_phone, password } = req.body;
  try {
    let password_hash;
    if (password) {
      if (password.length < 8) return res.status(400).json({ error: 'Пароль минимум 8 символов' });
      password_hash = await bcrypt.hash(password, 12);
    }
    const { rows } = await pool.query(
      `UPDATE clients SET
        contact_name = COALESCE($1, contact_name),
        contact_phone = COALESCE($2, contact_phone),
        ${password_hash ? 'password_hash = $3,' : ''}
        updated_at = NOW()
       WHERE id = $${password_hash ? 4 : 3}
       RETURNING id, company_name, inn, legal_address, contact_name, contact_phone, contact_email`,
      password_hash
        ? [contact_name || null, contact_phone || null, password_hash, req.client.id]
        : [contact_name || null, contact_phone || null, req.client.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// GET /api/clients/me/billing — реквизиты для счёта
router.get('/me/billing', clientAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT billing_details FROM clients WHERE id = $1', [req.client.id]);
    res.json(rows[0]?.billing_details || {});
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// PATCH /api/clients/me/billing — сохранить реквизиты
router.patch('/me/billing', clientAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE clients SET billing_details = $1, updated_at = NOW() WHERE id = $2 RETURNING billing_details',
      [JSON.stringify(req.body), req.client.id]
    );
    res.json(rows[0].billing_details);
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// DELETE /api/clients/:id — удалить клиента (только руководитель)
router.delete('/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'director') return res.status(403).json({ error: 'Нет доступа' });
  try {
    await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id]);
    res.json({ message: 'Клиент удалён' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
