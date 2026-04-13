const express = require('express');
const pool = require('../db/pool');
const { authMiddleware, clientAuth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const attachStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/attachments');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
  'application/x-rar-compressed',
  'video/mp4', 'video/quicktime',
]);
const uploadAttachment = multer({
  storage: attachStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    cb(new Error('Недопустимый тип файла'));
  },
});

async function createNotification(userId, type, title, body, ticketId) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, ticket_id) VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, title, body, ticketId || null]
    );
  } catch (e) { /* не критично */ }
}

// Применяет авто-статус по триггеру, если заявка не закрыта
async function applyAutoStatus(ticketId, trigger, changedById, changedByType) {
  const ticketResult = await pool.query(
    'SELECT t.status, t.type_id FROM tickets t WHERE t.id = $1', [ticketId]
  );
  const ticket = ticketResult.rows[0];
  if (!ticket) return;
  // Не меняем статус у закрытых/отменённых заявок
  if (['done', 'cancelled', 'closed'].includes(ticket.status)) return;

  const typeResult = await pool.query(
    'SELECT auto_statuses FROM ticket_types WHERE id = $1', [ticket.type_id]
  );
  const autoStatuses = typeResult.rows[0]?.auto_statuses || {};
  const newStatus = autoStatuses[trigger];
  if (!newStatus || newStatus === ticket.status) return;

  await pool.query(
    'UPDATE tickets SET status = $1, updated_at = NOW() WHERE id = $2',
    [newStatus, ticketId]
  );
  await pool.query(
    `INSERT INTO ticket_history (ticket_id, changed_by, changed_by_type, field_name, old_value, new_value)
     VALUES ($1, $2, $3, 'status', $4, $5)`,
    [ticketId, changedById, changedByType, ticket.status, newStatus]
  );
}

const router = express.Router();

// GET /api/tickets — список заявок (сотрудник)
router.get('/', authMiddleware, async (req, res) => {
  const { status, type_id, assigned_to, search, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  let where = [];
  let params = [];
  let idx = 1;

  if (status) { where.push(`t.status = $${idx++}`); params.push(status); }
  if (type_id) { where.push(`t.type_id = $${idx++}`); params.push(type_id); }
  if (assigned_to) { where.push(`t.assigned_to = $${idx++}`); params.push(assigned_to); }
  if (search) {
    where.push(`(c.company_name ILIKE $${idx} OR t.id::text ILIKE $${idx} OR e.serial_number ILIKE $${idx} OR t.serial_manual ILIKE $${idx})`);
    params.push(`%${search}%`); idx++;
  }

  const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

  try {
    const { rows } = await pool.query(
      `SELECT t.*, c.company_name, c.contact_name, c.contact_phone,
              e.model as equipment_model, e.serial_number as equipment_serial,
              tt.name as type_name, tt.color as type_color,
              u.name as assigned_name
       FROM tickets t
       LEFT JOIN clients c ON t.client_id = c.id
       LEFT JOIN equipment e ON t.equipment_id = e.id
       LEFT JOIN ticket_types tt ON t.type_id = tt.id
       LEFT JOIN users u ON t.assigned_to = u.id
       ${whereStr}
       ORDER BY t.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM tickets t
       LEFT JOIN clients c ON t.client_id = c.id
       LEFT JOIN equipment e ON t.equipment_id = e.id
       ${whereStr}`,
      params
    );

    res.json({
      tickets: rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/tickets/stats — статистика для дашборда
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'new') as new_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status IN ('waiting_parts', 'waiting_client')) as waiting_count,
        COUNT(*) FILTER (WHERE status = 'done') as done_count,
        COUNT(*) as total_count
      FROM tickets
    `);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/tickets/stats/chart — данные для графиков дашборда
router.get('/stats/chart', authMiddleware, async (req, res) => {
  try {
    const { rows: byDay } = await pool.query(`
      SELECT TO_CHAR(created_at::date, 'DD.MM') as date, COUNT(*)::int as count
      FROM tickets
      WHERE created_at >= NOW() - INTERVAL '14 days'
      GROUP BY created_at::date, TO_CHAR(created_at::date, 'DD.MM')
      ORDER BY created_at::date
    `);
    const { rows: byStatus } = await pool.query(`
      SELECT status, COUNT(*)::int as count FROM tickets GROUP BY status ORDER BY count DESC
    `);
    const { rows: byType } = await pool.query(`
      SELECT COALESCE(tt.name, 'Без типа') as name, tt.color, COUNT(*)::int as count
      FROM tickets t LEFT JOIN ticket_types tt ON t.type_id = tt.id
      GROUP BY tt.name, tt.color ORDER BY count DESC LIMIT 6
    `);
    res.json({ byDay, byStatus, byType });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/tickets/:id — карточка заявки
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, c.company_name, c.contact_name, c.contact_phone, c.contact_email,
              e.model as equipment_model, e.manufacturer, e.serial_number as equipment_serial,
              tt.name as type_name, tt.color as type_color, tt.statuses as type_statuses,
              u.name as assigned_name
       FROM tickets t
       LEFT JOIN clients c ON t.client_id = c.id
       LEFT JOIN equipment e ON t.equipment_id = e.id
       LEFT JOIN ticket_types tt ON t.type_id = tt.id
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Заявка не найдена' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/tickets — создать заявку (сотрудник)
router.post('/', authMiddleware, async (req, res) => {
  const { client_id, equipment_id, equipment_manual, serial_manual, type_id, description, assigned_to } = req.body;
  if (!client_id || !type_id || !description) {
    return res.status(400).json({ error: 'Заполните обязательные поля' });
  }
  try {
    // Получаем авто-статусы типа
    const typeResult = await pool.query('SELECT auto_statuses FROM ticket_types WHERE id = $1', [type_id]);
    const autoStatuses = typeResult.rows[0]?.auto_statuses || {};

    // Определяем начальный статус
    let initialStatus = autoStatuses.created || 'new';
    // Если сразу назначен инженер — применяем авто-статус назначения
    if (assigned_to && autoStatuses.assigned) initialStatus = autoStatuses.assigned;

    const { rows } = await pool.query(
      `INSERT INTO tickets (client_id, equipment_id, equipment_manual, serial_manual, type_id, status, description, assigned_to, created_by_client)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false) RETURNING *`,
      [client_id, equipment_id || null, equipment_manual || null, serial_manual || null, type_id, initialStatus, description, assigned_to || null]
    );

    await pool.query(
      `INSERT INTO ticket_history (ticket_id, changed_by, changed_by_type, field_name, old_value, new_value)
       VALUES ($1, $2, 'user', 'status', null, $3)`,
      [rows[0].id, req.user.id, initialStatus]
    );

    // Уведомления директорам и менеджерам о новой заявке
    const clientRow = await pool.query('SELECT company_name FROM clients WHERE id = $1', [client_id]);
    const companyName = clientRow.rows[0]?.company_name || '';
    const { rows: staff } = await pool.query(`SELECT id FROM users WHERE role IN ('director','manager') AND is_active = true`);
    for (const s of staff) {
      await createNotification(s.id, 'info', 'Новая заявка', `Заявка #${rows[0].id} от ${companyName}`, rows[0].id);
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/tickets/:id — обновить заявку (статус, назначение)
router.patch('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status, assigned_to } = req.body;
  try {
    const current = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Заявка не найдена' });

    const updates = [];
    const params = [];
    let idx = 1;

    let newStatus = status;

    // Авто-статус при назначении инженера
    if (assigned_to !== undefined && assigned_to !== current.rows[0].assigned_to) {
      const typeResult = await pool.query('SELECT auto_statuses FROM ticket_types WHERE id = $1', [current.rows[0].type_id]);
      const autoStatuses = typeResult.rows[0]?.auto_statuses || {};
      if (assigned_to && autoStatuses.assigned && !status) {
        newStatus = autoStatuses.assigned;
      }
    }

    if (newStatus !== undefined) { updates.push(`status = $${idx++}`); params.push(newStatus); }
    if (assigned_to !== undefined) { updates.push(`assigned_to = $${idx++}`); params.push(assigned_to); }
    updates.push(`updated_at = NOW()`);

    if (updates.length === 1) return res.status(400).json({ error: 'Нечего обновлять' });

    params.push(id);
    const { rows } = await pool.query(
      `UPDATE tickets SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    // Логируем изменение статуса
    if (newStatus && newStatus !== current.rows[0].status) {
      await pool.query(
        `INSERT INTO ticket_history (ticket_id, changed_by, changed_by_type, field_name, old_value, new_value)
         VALUES ($1, $2, 'user', 'status', $3, $4)`,
        [id, req.user.id, current.rows[0].status, newStatus]
      );
    }

    // Логируем смену назначенного
    if (assigned_to !== undefined && assigned_to !== current.rows[0].assigned_to) {
      const newUser = assigned_to ? await pool.query('SELECT name FROM users WHERE id = $1', [assigned_to]) : null;
      const oldUser = current.rows[0].assigned_to ? await pool.query('SELECT name FROM users WHERE id = $1', [current.rows[0].assigned_to]) : null;
      await pool.query(
        `INSERT INTO ticket_history (ticket_id, changed_by, changed_by_type, field_name, old_value, new_value)
         VALUES ($1, $2, 'user', 'assigned', $3, $4)`,
        [id, req.user.id, oldUser?.rows[0]?.name || null, newUser?.rows[0]?.name || null]
      );
    }

    // Уведомление назначенному инженеру
    if (assigned_to !== undefined && assigned_to && assigned_to !== current.rows[0].assigned_to) {
      await createNotification(assigned_to, 'info', 'Вы назначены на заявку', `Заявка #${id}`, parseInt(id));
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/tickets/:id/messages — сообщения заявки
router.get('/:id/messages', authMiddleware, async (req, res) => {
  const { channel } = req.query;
  let where = 'WHERE m.ticket_id = $1 AND m.is_deleted = false';
  const params = [req.params.id];
  if (channel) { where += ' AND m.channel = $2'; params.push(channel); }
  try {
    const { rows } = await pool.query(
      `SELECT m.*,
        CASE WHEN m.sender_type = 'user' THEN u.name ELSE c.contact_name END as sender_name,
        CASE WHEN m.sender_type = 'user' THEN u.role ELSE 'client' END as sender_role,
        CASE WHEN m.sender_type = 'user' THEN u.avatar ELSE NULL END as sender_avatar,
        json_agg(a.*) FILTER (WHERE a.id IS NOT NULL) as attachments
       FROM messages m
       LEFT JOIN users u ON m.sender_type = 'user' AND m.sender_id = u.id
       LEFT JOIN clients c ON m.sender_type = 'client' AND m.sender_id = c.id
       LEFT JOIN attachments a ON a.message_id = m.id
       ${where}
       GROUP BY m.id, u.name, u.role, u.avatar, c.contact_name
       ORDER BY m.created_at ASC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/tickets/:id/messages — отправить сообщение (сотрудник)
router.post('/:id/messages', authMiddleware, async (req, res) => {
  const { content, channel = 'appeal' } = req.body;
  if (!content && !req.body.attachments) {
    return res.status(400).json({ error: 'Введите сообщение' });
  }

  // Руководитель может писать везде, остальные — проверяем разрешения
  if (req.user.role !== 'director') {
    const perms = req.user.permissions || {};
    if (channel === 'appeal' && !perms.can_write_appeal) {
      return res.status(403).json({ error: 'Нет доступа к чату с клиентом' });
    }
    if (channel === 'service' && !perms.can_write_service) {
      return res.status(403).json({ error: 'Нет доступа к служебному чату' });
    }
    if (channel === 'notes' && !perms.can_write_notes) {
      return res.status(403).json({ error: 'Нет доступа к примечаниям' });
    }
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO messages (ticket_id, sender_type, sender_id, channel, content)
       VALUES ($1, 'user', $2, $3, $4) RETURNING *`,
      [req.params.id, req.user.id, channel, content]
    );

    await pool.query('UPDATE tickets SET updated_at = NOW() WHERE id = $1', [req.params.id]);

    // Авто-статус только для канала Обращение
    if (channel === 'appeal') {
      await pool.query(
        `INSERT INTO ticket_history (ticket_id, changed_by, changed_by_type, field_name, old_value, new_value)
         VALUES ($1, $2, 'user', 'message', null, $3)`,
        [req.params.id, req.user.id, content.slice(0, 100)]
      );
      await applyAutoStatus(req.params.id, 'staff_replied', req.user.id, 'user');

      // Уведомляем директоров и менеджеров о новом сообщении (кроме отправителя)
      const ticketId = req.params.id;
      const { rows: staff } = await pool.query(`SELECT id FROM users WHERE role IN ('director','manager') AND is_active = true`);
      for (const s of staff) {
        if (s.id !== req.user.id) {
          await createNotification(s.id, 'info', 'Новое сообщение', `Заявка #${ticketId}: ${(content || '').slice(0, 60)}`, parseInt(ticketId));
        }
      }
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/tickets/:id/messages/:msgId — редактировать сообщение
router.patch('/:id/messages/:msgId', authMiddleware, async (req, res) => {
  const { content } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE messages SET content = $1, is_edited = true, updated_at = NOW()
       WHERE id = $2 AND sender_id = $3 AND sender_type = 'user' RETURNING *`,
      [content, req.params.msgId, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Сообщение не найдено' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/tickets/:id/messages/:msgId — удалить сообщение
router.delete('/:id/messages/:msgId', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      `UPDATE messages SET is_deleted = true, updated_at = NOW()
       WHERE id = $1 AND sender_id = $2 AND sender_type = 'user'`,
      [req.params.msgId, req.user.id]
    );
    res.json({ message: 'Удалено' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/tickets/client — создать заявку (клиент)
router.post('/client/new', clientAuth, async (req, res) => {
  const { equipment_id, equipment_manual, serial_manual, type_id, description } = req.body;
  if (!type_id || !description) {
    return res.status(400).json({ error: 'Заполните обязательные поля' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO tickets (client_id, equipment_id, equipment_manual, serial_manual, type_id, status, description, created_by_client)
       VALUES ($1, $2, $3, $4, $5, 'new', $6, true) RETURNING *`,
      [req.client.id, equipment_id || null, equipment_manual || null, serial_manual || null, type_id, description]
    );
    await pool.query(
      `INSERT INTO ticket_history (ticket_id, changed_by, changed_by_type, field_name, old_value, new_value)
       VALUES ($1, $2, 'client', 'created', null, 'new')`,
      [rows[0].id, req.client.id]
    );
    // Уведомляем всех активных сотрудников
    const clientInfo = await pool.query('SELECT company_name FROM clients WHERE id = $1', [req.client.id]);
    const companyName = clientInfo.rows[0]?.company_name || 'Клиент';
    const staff = await pool.query('SELECT id FROM users WHERE is_active = true');
    for (const s of staff.rows) {
      await createNotification(s.id, 'new_ticket', `Новая заявка #${rows[0].id}`, `${companyName}: ${description.slice(0, 70)}`, rows[0].id);
    }
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/tickets/client/list — заявки клиента
router.get('/client/list', clientAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, e.model as equipment_model, tt.name as type_name, tt.color as type_color
       FROM tickets t
       LEFT JOIN equipment e ON t.equipment_id = e.id
       LEFT JOIN ticket_types tt ON t.type_id = tt.id
       WHERE t.client_id = $1
       ORDER BY t.created_at DESC`,
      [req.client.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/tickets/:id/messages/client — сообщения для клиента (только appeal)
router.get('/:id/messages/client', clientAuth, async (req, res) => {
  try {
    const ticket = await pool.query('SELECT client_id FROM tickets WHERE id = $1', [req.params.id]);
    if (!ticket.rows[0] || ticket.rows[0].client_id !== req.client.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    const { rows } = await pool.query(
      `SELECT m.*,
        CASE WHEN m.sender_type = 'user' THEN u.name ELSE c.contact_name END as sender_name,
        CASE WHEN m.sender_type = 'user' THEN u.role ELSE 'client' END as sender_role,
        json_agg(a.*) FILTER (WHERE a.id IS NOT NULL) as attachments
       FROM messages m
       LEFT JOIN users u ON m.sender_type = 'user' AND m.sender_id = u.id
       LEFT JOIN clients c ON m.sender_type = 'client' AND m.sender_id = c.id
       LEFT JOIN attachments a ON a.message_id = m.id
       WHERE m.ticket_id = $1 AND m.channel = 'appeal' AND m.is_deleted = false
       GROUP BY m.id, u.name, u.role, c.contact_name
       ORDER BY m.created_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/tickets/:id/messages/client — клиент отправляет сообщение
router.post('/:id/messages/client', clientAuth, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Введите сообщение' });
  try {
    const ticket = await pool.query('SELECT client_id FROM tickets WHERE id = $1', [req.params.id]);
    if (!ticket.rows[0] || ticket.rows[0].client_id !== req.client.id) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    const { rows } = await pool.query(
      `INSERT INTO messages (ticket_id, sender_type, sender_id, channel, content)
       VALUES ($1, 'client', $2, 'appeal', $3) RETURNING *`,
      [req.params.id, req.client.id, content]
    );
    await pool.query('UPDATE tickets SET updated_at = NOW() WHERE id = $1', [req.params.id]);
    await pool.query(
      `INSERT INTO ticket_history (ticket_id, changed_by, changed_by_type, field_name, old_value, new_value)
       VALUES ($1, $2, 'client', 'message', null, $3)`,
      [req.params.id, req.client.id, content.slice(0, 100)]
    );
    // Авто-статус: клиент ответил
    await applyAutoStatus(req.params.id, 'client_replied', req.client.id, 'client');

    // Уведомляем назначенного сотрудника и руководителей
    const ticketFull = await pool.query(
      `SELECT t.assigned_to, c.company_name FROM tickets t
       LEFT JOIN clients c ON t.client_id = c.id WHERE t.id = $1`,
      [req.params.id]
    );
    const tkt = ticketFull.rows[0];
    const company = tkt?.company_name || 'Клиент';
    const notifBody = `Заявка #${req.params.id} от ${company}: ${content.slice(0, 60)}`;
    const toNotify = new Set();
    if (tkt?.assigned_to) toNotify.add(tkt.assigned_to);
    const directors = await pool.query(`SELECT id FROM users WHERE role = 'director' AND is_active = true`);
    directors.rows.forEach((r: any) => toNotify.add(r.id));
    for (const uid of toNotify) {
      await createNotification(uid, 'new_message', 'Новое сообщение от клиента', notifBody, parseInt(req.params.id));
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/tickets/:id/attachments — загрузить файл (сотрудник)
router.post('/:id/attachments', authMiddleware, uploadAttachment.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO attachments (ticket_id, message_id, filename, filepath, filesize, mimetype, uploaded_by_type, uploaded_by_name)
       VALUES ($1, NULL, $2, $3, $4, $5, 'user', $6) RETURNING *`,
      [req.params.id, req.file.originalname, `/uploads/attachments/${req.file.filename}`, req.file.size, req.file.mimetype, req.user.name]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// POST /api/tickets/:id/attachments/client — загрузить файл (клиент)
router.post('/:id/attachments/client', clientAuth, uploadAttachment.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO attachments (ticket_id, message_id, filename, filepath, filesize, mimetype, uploaded_by_type, uploaded_by_name)
       VALUES ($1, NULL, $2, $3, $4, $5, 'client', $6) RETURNING *`,
      [req.params.id, req.file.originalname, `/uploads/attachments/${req.file.filename}`, req.file.size, req.file.mimetype, req.client.contact_name]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// GET /api/tickets/:id/attachments — список вложений заявки (сотрудник)
router.get('/:id/attachments', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM attachments WHERE ticket_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch { res.json([]); }
});

// GET /api/tickets/:id/attachments/client — список вложений заявки (клиент)
router.get('/:id/attachments/client', clientAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM attachments WHERE ticket_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch { res.json([]); }
});

// GET /api/tickets/:id/history — история изменений (только руководитель)
router.get('/:id/history', authMiddleware, async (req, res) => {
  try {
    // История изменений
    const { rows: history } = await pool.query(
      `SELECT h.*,
        CASE h.changed_by_type
          WHEN 'user' THEN (SELECT name FROM users WHERE id = h.changed_by::uuid)
          WHEN 'client' THEN (SELECT contact_name FROM clients WHERE id = h.changed_by::uuid)
          ELSE 'Система'
        END as changed_by_name,
        CASE h.changed_by_type
          WHEN 'user' THEN (SELECT role FROM users WHERE id = h.changed_by::uuid)
          ELSE NULL
        END as changed_by_role
       FROM ticket_history h
       WHERE h.ticket_id = $1
       ORDER BY h.created_at ASC`,
      [req.params.id]
    );

    // Сообщения для расчёта времени ответа
    const { rows: messages } = await pool.query(
      `SELECT sender_type, sender_name, created_at FROM messages
       WHERE ticket_id = $1 AND channel = 'appeal' AND is_deleted = false
       ORDER BY created_at ASC`,
      [req.params.id]
    );

    // Время первого ответа сотрудника
    const { rows: ticket } = await pool.query(
      'SELECT created_at FROM tickets WHERE id = $1', [req.params.id]
    );
    const ticketCreated = ticket[0]?.created_at;
    const firstStaffMsg = messages.find(m => m.sender_type === 'user');
    const firstClientMsg = messages.find(m => m.sender_type === 'client');

    // Пары клиент→сотрудник для среднего времени ответа
    const responseTimes = [];
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].sender_type === 'client') {
        const nextStaff = messages.slice(i + 1).find(m => m.sender_type === 'user');
        if (nextStaff) {
          responseTimes.push(new Date(nextStaff.created_at) - new Date(messages[i].created_at));
        }
      }
    }
    const avgResponseMs = responseTimes.length
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : null;

    res.json({
      history,
      stats: {
        ticket_created: ticketCreated,
        first_staff_reply: firstStaffMsg?.created_at || null,
        first_client_reply: firstClientMsg?.created_at || null,
        time_to_first_response_ms: firstStaffMsg && ticketCreated
          ? new Date(firstStaffMsg.created_at) - new Date(ticketCreated)
          : null,
        avg_response_time_ms: avgResponseMs,
        total_messages: messages.length,
        staff_messages: messages.filter(m => m.sender_type === 'user').length,
        client_messages: messages.filter(m => m.sender_type === 'client').length,
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
