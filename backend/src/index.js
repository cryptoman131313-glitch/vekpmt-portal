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

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const ticketRoutes = require('./routes/tickets');
const clientRoutes = require('./routes/clients');
const equipmentRoutes = require('./routes/equipment');
const userRoutes = require('./routes/users');
const registrationRoutes = require('./routes/registrations');
const settingsRoutes = require('./routes/settings');
const documentRoutes = require('./routes/documents');
const calendarRoutes = require('./routes/calendar');

const app = express();
const PORT = process.env.PORT || 3001;
// Привязка к localhost в продакшене (nginx проксирует запросы из 127.0.0.1).
// Для Railway/облака — слушаем все интерфейсы через HOST=0.0.0.0
const HOST = process.env.HOST || '127.0.0.1';

// Доверяем обратному прокси (nginx / Railway)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // отключаем CSP — он мешает API-серверу
}));

// CORS
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files (uploads) — только для авторизованных
const jwt = require('jsonwebtoken');
app.use('/uploads', (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    if (!token) return res.status(401).json({ error: 'Не авторизован' });
    jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}, express.static(path.join(__dirname, '../uploads')));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Слишком много попыток, попробуйте позже' } });
app.use('/api/', limiter);
app.use('/api/auth', authLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/calendar', calendarRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Маршрут не найден' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

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
