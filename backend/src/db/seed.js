const bcrypt = require('bcryptjs');
const pool = require('./pool');

async function seed() {
  const client = await pool.connect();
  try {
    const password = 'Admin1234';
    const hash = await bcrypt.hash(password, 10);

    await client.query(`
      INSERT INTO users (email, password_hash, name, role, avatar, is_active)
      VALUES ($1, $2, $3, 'director', 'АД', true)
      ON CONFLICT (email) DO UPDATE SET password_hash = $2, is_active = true
    `, ['admin@vekpmt.ru', hash, 'Администратор']);

    console.log('=== Администратор создан ===');
    console.log('Email:    admin@vekpmt.ru');
    console.log('Пароль:   Admin1234');
  } catch (err) {
    console.error('Seed failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
