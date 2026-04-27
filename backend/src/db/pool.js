const { Pool } = require('pg');
require('dotenv').config();

// SSL управляется переменной окружения DB_SSL
// - DB_SSL=true   → SSL включён с rejectUnauthorized:false (Railway, облачные БД)
// - DB_SSL=false  → SSL выключен (локальная БД на Beget VPS)
// - не задано     → автоопределение: если есть DATABASE_URL → SSL включён (облако)
function resolveSsl() {
  const flag = (process.env.DB_SSL || '').toLowerCase().trim();
  if (flag === 'true' || flag === '1' || flag === 'require') return { rejectUnauthorized: false };
  if (flag === 'false' || flag === '0' || flag === 'disable') return false;
  // Фолбэк: в облачных провайдерах обычно есть DATABASE_URL → значит SSL нужен
  return process.env.DATABASE_URL ? { rejectUnauthorized: false } : false;
}

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: resolveSsl(),
      }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: resolveSsl(),
      }
);

pool.on('connect', (client) => {
  client.query("SET timezone = 'UTC'");
  console.log('PostgreSQL connected');
});

pool.on('error', (err) => {
  console.error('PostgreSQL error:', err);
});

module.exports = pool;
