// Set test environment variables before any module loads
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.FRONTEND_URL = 'http://localhost:5173';
