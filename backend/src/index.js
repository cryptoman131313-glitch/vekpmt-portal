require('dotenv').config();

// Проверяем критичные переменные окружения перед запуском
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET не задан или слишком короткий (минимум 32 символа)');
  process.exit(1);
}
if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
  console.error('FATAL: не задана ни DATABASE_URL, ни DB_HOST');
  process.exit(1);
}

const app = require('./app');

const PORT = process.env.PORT || 3001;
// Привязка к localhost в продакшене (nginx проксирует запросы из 127.0.0.1).
// Для Railway/облака — слушаем все интерфейсы через HOST=0.0.0.0
const HOST = process.env.HOST || '127.0.0.1';

// Ловим необработанные ошибки процесса, чтобы они попадали в логи PM2
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  // PM2 перезапустит процесс
  process.exit(1);
});

app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
});
