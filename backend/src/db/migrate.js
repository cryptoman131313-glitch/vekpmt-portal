const pool = require('./pool');

const migrations = `
-- Пользователи (сотрудники)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'manager', -- director, manager, engineer
  avatar VARCHAR(10),
  is_active BOOLEAN DEFAULT true,
  permissions JSONB DEFAULT '{}',
  notification_settings JSONB DEFAULT '{"email": true, "sound": true, "new_ticket": true, "new_message": true}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Типы заявок
CREATE TABLE IF NOT EXISTS ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#71717A',
  statuses JSONB DEFAULT '[]',
  auto_statuses JSONB DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Клиенты (организации)
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(255) NOT NULL,
  inn VARCHAR(12),
  legal_address TEXT,
  actual_address TEXT,
  contact_name VARCHAR(255),
  contact_phone VARCHAR(50),
  contact_email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active', -- active, blocked
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Пользователи клиентов (логины для ЛК)
CREATE TABLE IF NOT EXISTS client_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  reset_token TEXT,
  reset_token_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Заявки на регистрацию
CREATE TABLE IF NOT EXISTS registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(255) NOT NULL,
  inn VARCHAR(12),
  legal_address TEXT,
  contact_name VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(50) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
  rejected_reason TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Оборудование
CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  model VARCHAR(255) NOT NULL,
  manufacturer VARCHAR(255),
  serial_number VARCHAR(100) UNIQUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Заявки
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
  equipment_manual VARCHAR(255),
  serial_manual VARCHAR(100),
  type_id UUID REFERENCES ticket_types(id) ON DELETE SET NULL,
  status VARCHAR(100) DEFAULT 'new',
  description TEXT,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_client BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Сообщения в заявке
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL, -- client, user
  sender_id UUID NOT NULL,
  channel VARCHAR(20) NOT NULL, -- appeal (Обращение), service (Служебный чат), notes (Примечания)
  content TEXT,
  is_edited BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Вложения
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  filepath VARCHAR(500) NOT NULL,
  filesize INTEGER,
  mimetype VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Уведомления
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50), -- new_ticket, new_message, status_changed
  title VARCHAR(255),
  body TEXT,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Документы для клиентов
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  filepath VARCHAR(500) NOT NULL,
  filesize INTEGER,
  doc_type VARCHAR(100), -- passport, manual, maintenance, warranty, general
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- История изменений статуса заявки
CREATE TABLE IF NOT EXISTS ticket_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  changed_by UUID,
  changed_by_type VARCHAR(20), -- user, system
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Системные настройки (типы документов, характеристики оборудования и др.)
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Доп. колонки (добавлены позже, идемпотентно)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_avatar BOOLEAN DEFAULT false;

-- Индексы
CREATE INDEX IF NOT EXISTS idx_tickets_client ON tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_equipment_client ON equipment(client_id);
`;

const seedDefaults = `
-- Типы заявок по умолчанию (только если таблица пустая)
INSERT INTO ticket_types (name, color, statuses, auto_statuses, sort_order)
SELECT * FROM (VALUES
  ('Гарантия', '#16A34A', '["new", "in_progress", "waiting_parts", "waiting_client", "done", "cancelled"]'::jsonb, '{"created": "new", "assigned": "in_progress"}'::jsonb, 1),
  ('Ремонт', '#EA580C', '["new", "in_progress", "waiting_parts", "waiting_client", "done", "cancelled"]'::jsonb, '{"created": "new", "assigned": "in_progress"}'::jsonb, 2),
  ('ТО', '#2563EB', '["new", "in_progress", "done", "cancelled"]'::jsonb, '{"created": "new", "assigned": "in_progress"}'::jsonb, 3),
  ('Запчасти', '#7C3AED', '["new", "in_progress", "waiting_parts", "done", "cancelled"]'::jsonb, '{"created": "new", "assigned": "in_progress"}'::jsonb, 4)
) AS v(name, color, statuses, auto_statuses, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM ticket_types WHERE ticket_types.name = v.name);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');
    await client.query(migrations);
    console.log('Seeding defaults...');
    await client.query(seedDefaults);
    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
