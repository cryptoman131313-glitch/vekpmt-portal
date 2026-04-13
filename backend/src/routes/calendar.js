const express = require('express');
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/calendar?year=2026&month=4
router.get('/', authMiddleware, async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: 'Укажите год и месяц' });
  const y = parseInt(year), m = parseInt(month);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  try {
    const { rows } = await pool.query(
      `SELECT ce.*, u.name as created_by_name,
        t.id as linked_ticket_id
       FROM calendar_events ce
       LEFT JOIN users u ON ce.created_by = u.id
       LEFT JOIN tickets t ON ce.ticket_id = t.id
       WHERE ce.event_date >= $1 AND ce.event_date <= $2
         AND (ce.type != 'personal' OR ce.created_by = $3)
       ORDER BY ce.event_date, ce.event_time NULLS LAST`,
      [start, end, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/calendar
router.post('/', authMiddleware, async (req, res) => {
  const { title, description, event_date, event_time, type, ticket_id } = req.body;
  if (!title || !event_date) return res.status(400).json({ error: 'Укажите название и дату' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO calendar_events (title, description, event_date, event_time, type, ticket_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, description || null, event_date, event_time || null, type || 'general', ticket_id || null, req.user.id]
    );
    const { rows: full } = await pool.query(
      `SELECT ce.*, u.name as created_by_name FROM calendar_events ce
       LEFT JOIN users u ON ce.created_by = u.id WHERE ce.id = $1`,
      [rows[0].id]
    );
    res.status(201).json(full[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/calendar/:id
router.patch('/:id', authMiddleware, async (req, res) => {
  const { title, description, event_date, event_time, type, ticket_id } = req.body;
  try {
    const { rows: existing } = await pool.query('SELECT * FROM calendar_events WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'Событие не найдено' });
    if (existing[0].created_by !== req.user.id && req.user.role !== 'director') {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    const { rows } = await pool.query(
      `UPDATE calendar_events SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        event_date = COALESCE($3, event_date),
        event_time = COALESCE($4, event_time),
        type = COALESCE($5, type),
        ticket_id = $6,
        updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [title, description, event_date, event_time, type, ticket_id || null, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/calendar/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM calendar_events WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Не найдено' });
    if (rows[0].created_by !== req.user.id && req.user.role !== 'director') {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    await pool.query('DELETE FROM calendar_events WHERE id = $1', [req.params.id]);
    res.json({ message: 'Удалено' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
