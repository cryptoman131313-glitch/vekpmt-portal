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
    await client.query(`
      INSERT INTO users (email, password_hash, name, role, avatar, is_active)
      VALUES ($1, $2, $3, 'manager', 'МН', true)
      ON CONFLICT (email) DO UPDATE SET password_hash = $2, is_active = true
    `, ['manager@vekpmt.ru', hash, 'Менеджер Тестовый']);

    // Инженер
    await client.query(`
      INSERT INTO users (email, password_hash, name, role, avatar, is_active)
      VALUES ($1, $2, $3, 'engineer', 'ИН', true)
      ON CONFLICT (email) DO UPDATE SET password_hash = $2, is_active = true
    `, ['engineer@vekpmt.ru', hash, 'Инженер Тестовый']);

    // Тестовый клиент
    const clientRes = await client.query(`
      INSERT INTO clients (company_name, inn, contact_name, contact_phone, contact_email, status)
      VALUES ($1, $2, $3, $4, $5, 'active')
      ON CONFLICT (contact_email) DO UPDATE SET company_name = $1
      RETURNING id
    `, ['ООО Тест Компания', '7700000000', 'Иванов Иван', '+7 (999) 000-00-00', 'client@test.ru']);

    const clientId = clientRes.rows[0].id;
    const clientHash = await bcrypt.hash('Client1234', 10);

    await client.query(`
      INSERT INTO client_users (client_id, email, password_hash, name, is_active)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (email) DO UPDATE SET password_hash = $3, is_active = true
    `, [clientId, 'client@test.ru', clientHash, 'Иванов Иван']);

    console.log('=== Тестовые пользователи созданы ===');
    console.log('Руководитель: admin@vekpmt.ru / Admin1234');
    console.log('Менеджер:     manager@vekpmt.ru / Admin1234');
    console.log('Инженер:      engineer@vekpmt.ru / Admin1234');
    console.log('Клиент:       client@test.ru / Client1234');

  } catch (err) {
    console.error('Seed failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
