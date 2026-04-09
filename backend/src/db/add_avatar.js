const pool = require('../db/pool');
async function run() {
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS show_avatar BOOLEAN DEFAULT false;
  `);
  console.log('Done');
  await pool.end();
}
run().catch(console.error);
