const express = require('express');
const pool = require('../db/pool');
const { authMiddleware, clientAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/equipment — список оборудования (сотрудник)
router.get('/', authMiddleware, async (req, res) => {
  const { client_id, search } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT e.*, c.company_name,
        (SELECT COUNT(*) FROM tickets t WHERE t.equipment_id = e.id) as tickets_count
       FROM equipment e
       LEFT JOIN clients c ON e.client_id = c.id
       WHERE ($1::uuid IS NULL OR e.client_id = $1)
         AND ($2::text IS NULL OR e.model ILIKE $2 OR e.serial_number ILIKE $2 OR c.company_name ILIKE $2)
       ORDER BY e.created_at DESC`,
      [client_id || null, search ? `%${search}%` : null]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/equipment/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*, c.company_name, c.contact_name, c.contact_email
       FROM equipment e LEFT JOIN clients c ON e.client_id = c.id
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Не найдено' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/equipment — добавить оборудование
router.post('/', authMiddleware, async (req, res) => {
  const { client_id, model, manufacturer, serial_number, notes } = req.body;
  if (!model) return res.status(400).json({ error: 'Укажите модель' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO equipment (client_id, model, manufacturer, serial_number, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [client_id || null, model, manufacturer || null, serial_number || null, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Серийный номер уже существует' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/equipment/:id
router.patch('/:id', authMiddleware, async (req, res) => {
  const { model, manufacturer, serial_number, notes, client_id, characteristics } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE equipment SET
        model = COALESCE($1, model),
        manufacturer = COALESCE($2, manufacturer),
        serial_number = COALESCE($3, serial_number),
        notes = COALESCE($4, notes),
        client_id = COALESCE($5, client_id),
        characteristics = COALESCE($6, characteristics),
        updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [model, manufacturer, serial_number, notes, client_id || null,
       characteristics ? JSON.stringify(characteristics) : null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Не найдено' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/equipment/client/list — оборудование клиента (ЛК)
router.get('/client/list', clientAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*,
        (SELECT COUNT(*) FROM tickets t WHERE t.equipment_id = e.id) as tickets_count
       FROM equipment e WHERE e.client_id = $1 ORDER BY e.created_at DESC`,
      [req.client.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
