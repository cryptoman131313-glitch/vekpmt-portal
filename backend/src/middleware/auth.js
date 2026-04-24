const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded.type === 'totp_pending' || decoded.type === 'client') {
      return res.status(401).json({ error: 'Недействительный токен' });
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    next();
  };
}

function clientAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded.type !== 'client') {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    req.client = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}

module.exports = { authMiddleware, requireRole, clientAuth };
