require('dotenv').config();
const pool = require('../db/pool');

async function migrate() {
  try {
    // Reset token для пользователей
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS reset_token TEXT,
        ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ
    `);
    console.log('✓ users: reset_token, reset_token_expires');

    // Реквизиты для счёта у клиентов
    await pool.query(`
      ALTER TABLE clients
        ADD COLUMN IF NOT EXISTS billing_details JSONB DEFAULT '{}'::jsonb
    `);
    console.log('✓ clients: billing_details');

    // Reset token для клиентов
    await pool.query(`
      ALTER TABLE clients
        ADD COLUMN IF NOT EXISTS reset_token TEXT,
        ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ
    `);
    console.log('✓ clients: reset_token, reset_token_expires');

    console.log('Migration complete');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
