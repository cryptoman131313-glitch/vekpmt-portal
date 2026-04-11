const bcrypt = require('bcryptjs');
const pool = require('./pool');

async function seed() {
  const client = await pool.connect();
  try {
    const hash = await bcrypt.hash('Admin1234', 10);

    // Администратор / Руководитель
    await client.query(`
      INSERT INTO users (email, password_hash, name, role, avatar, is_active)
      VALUES ($1, $2, $3, 'director', 'АД', true)
      ON CONFLICT (email) DO UPDATE SET password_hash = $2, is_active = true
    `, ['admin@vekpmt.ru', hash, 'Администратор']);

    // Менеджер
    const managerRes = await client.query(`
      INSERT INTO users (email, password_hash, name, role, avatar, is_active)
      VALUES ($1, $2, $3, 'manager', 'МН', true)
      ON CONFLICT (email) DO UPDATE SET password_hash = $2, is_active = true
      RETURNING id
    `, ['manager@vekpmt.ru', hash, 'Менеджер Тестовый']);
    const managerId = managerRes.rows[0].id;

    // Инженер
    await client.query(`
      INSERT INTO users (email, password_hash, name, role, avatar, is_active)
      VALUES ($1, $2, $3, 'engineer', 'ИН', true)
      ON CONFLICT (email) DO UPDATE SET password_hash = $2, is_active = true
    `, ['engineer@vekpmt.ru', hash, 'Инженер Тестовый']);

    // Тестовый клиент
    const clientRes = await client.query(`
      INSERT INTO clients (company_name, inn, legal_address, actual_address, contact_name, contact_phone, contact_email, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
      ON CONFLICT (contact_email) DO UPDATE SET company_name = $1
      RETURNING id
    `, [
      'ООО Тест Компания',
      '7700000000',
      'г. Москва, ул. Тестовая, д. 1',
      'г. Москва, ул. Тестовая, д. 1',
      'Иванов Иван Иванович',
      '+7 (999) 000-00-00',
      'client@test.ru'
    ]);
    const clientId = clientRes.rows[0].id;

    const clientHash = await bcrypt.hash('Client1234', 10);
    await client.query(`
      INSERT INTO client_users (client_id, email, password_hash, name, is_active)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (email) DO UPDATE SET password_hash = $3, is_active = true
    `, [clientId, 'client@test.ru', clientHash, 'Иванов Иван Иванович']);

    // Оборудование
    const equipRes = await client.query(`
      INSERT INTO equipment (client_id, model, manufacturer, serial_number, notes)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (serial_number) DO UPDATE SET client_id = $1
      RETURNING id
    `, [clientId, 'A-160', 'Эффективная Техника', 'ET-A160-2023-001', 'Упаковочный автомат, введён в эксплуатацию 01.03.2023']);
    const equipId = equipRes.rows[0].id;

    // Тип заявки — берём первый доступный
    const typeRes = await client.query(`SELECT id FROM ticket_types LIMIT 1`);
    const typeId = typeRes.rows[0]?.id || null;

    // Заявка
    const ticketRes = await client.query(`
      INSERT INTO tickets (client_id, equipment_id, type_id, status, description, assigned_to, created_by_client)
      VALUES ($1, $2, $3, 'in_progress', $4, $5, false)
      RETURNING id
    `, [
      clientId,
      equipId,
      typeId,
      'Не срабатывает датчик подачи плёнки. Машина останавливается на 3-м цикле упаковки.',
      managerId
    ]);
    const ticketId = ticketRes.rows[0].id;

    // Сообщение в заявке
    await client.query(`
      INSERT INTO messages (ticket_id, sender_type, sender_id, channel, content)
      VALUES ($1, 'user', $2, 'service', $3)
    `, [ticketId, managerId, 'Приняли заявку в работу. Инженер выедет в течение 2 рабочих дней.']);

    // Документ
    await client.query(`
      INSERT INTO documents (client_id, equipment_id, title, filename, filepath, filesize, doc_type, uploaded_by)
      SELECT $1, $2, $3, $4, $5, $6, $7, u.id
      FROM users u WHERE u.role = 'director' LIMIT 1
    `, [
      clientId,
      equipId,
      'Паспорт оборудования A-160',
      'passport_a160.pdf',
      '/uploads/documents/passport_a160.pdf',
      245760,
      'passport'
    ]);

    console.log('=== Тестовые данные созданы ===');
    console.log('Руководитель: admin@vekpmt.ru / Admin1234');
    console.log('Менеджер:     manager@vekpmt.ru / Admin1234');
    console.log('Инженер:      engineer@vekpmt.ru / Admin1234');
    console.log('Клиент:       client@test.ru / Client1234');
    console.log(`Оборудование: A-160 (серийный ET-A160-2023-001)`);
    console.log(`Заявка #${ticketId}: датчик подачи плёнки`);

  } catch (err) {
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

seed();
