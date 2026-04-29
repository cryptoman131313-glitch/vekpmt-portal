const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

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

// Доверяем обратному прокси (nginx / Railway)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
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

// Rate limiting (disabled in test environment)
if (process.env.NODE_ENV !== 'test') {
  // Общий лимит — увеличен до 600 (по 1 запросу в 1.5 сек), т.к. SWR-кэш
  // делает много фоновых обновлений на любой странице
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Слишком много запросов, попробуйте позже' },
  });
  // Лимит на /api/auth — защита от перебора паролей
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Слишком много попыток входа, попробуйте через 15 минут' },
  });
  app.use('/api/', limiter);
  app.use('/api/auth', authLimiter);
}

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

module.exports = app;
