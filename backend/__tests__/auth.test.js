const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

// Mock the database pool
jest.mock('../src/db/pool', () => ({
  query: jest.fn(),
  on: jest.fn(),
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const pool = require('../src/db/pool');
const bcrypt = require('bcryptjs');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/auth/login', () => {
  it('should return 400 if email or password missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Введите email и пароль');
  });

  it('should return 401 if user not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'password123' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Неверный email или пароль');
  });

  it('should return 401 if password is wrong', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{
        id: '123', email: 'admin@test.com', password_hash: '$2a$12$hash',
        role: 'director', name: 'Admin', permissions: {},
      }],
    });
    bcrypt.compare.mockResolvedValueOnce(false);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('should return token and user on successful login', async () => {
    const mockUser = {
      id: '123', email: 'admin@test.com', password_hash: '$2a$12$hash',
      role: 'director', name: 'Admin', avatar: null,
      permissions: { can_view_clients: true },
      notification_settings: {},
    };
    pool.query.mockResolvedValueOnce({ rows: [mockUser] });
    bcrypt.compare.mockResolvedValueOnce(true);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'correctpass' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('admin@test.com');
    expect(res.body.user.role).toBe('director');
    expect(res.body.user.password_hash).toBeUndefined();

    // Verify token is valid
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.id).toBe('123');
    expect(decoded.type).toBe('user');
  });
});

describe('POST /api/auth/client/login', () => {
  it('should return 400 if email or password missing', async () => {
    const res = await request(app)
      .post('/api/auth/client/login')
      .send({});
    expect(res.status).toBe(400);
  });

  it('should return 401 if client not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/client/login')
      .send({ email: 'client@test.com', password: 'password123' });
    expect(res.status).toBe(401);
  });

  it('should return token and client on successful login', async () => {
    const mockClient = {
      id: '1', client_id: '456', email: 'client@test.com',
      password_hash: '$2a$12$hash', name: 'Client User',
      company_name: 'Test Company', contact_phone: '+7999',
      status: 'active',
    };
    pool.query.mockResolvedValueOnce({ rows: [mockClient] });
    bcrypt.compare.mockResolvedValueOnce(true);

    const res = await request(app)
      .post('/api/auth/client/login')
      .send({ email: 'client@test.com', password: 'correctpass' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.client.company_name).toBe('Test Company');

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.type).toBe('client');
  });
});

describe('GET /api/auth/me', () => {
  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });

  it('should return current user with valid token', async () => {
    const token = jwt.sign(
      { id: '123', email: 'admin@test.com', role: 'director', type: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const mockUser = {
      id: '123', email: 'admin@test.com', name: 'Admin',
      role: 'director', avatar: null, permissions: {},
      notification_settings: {},
    };
    pool.query.mockResolvedValueOnce({ rows: [mockUser] });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@test.com');
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('should return 400 if email missing', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({});
    expect(res.status).toBe(400);
  });

  it('should return success message even if email not found (security)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // user lookup
    pool.query.mockResolvedValueOnce({ rows: [] }); // client lookup

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('email');
  });
});

describe('POST /api/auth/reset-password', () => {
  it('should return 400 if token or password missing', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'abc' });
    expect(res.status).toBe(400);
  });

  it('should return 400 if password too short', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'abc', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Пароль минимум 8 символов');
  });

  it('should return 400 if reset token is invalid', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // user check
    pool.query.mockResolvedValueOnce({ rows: [] }); // client check

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'invalid-token', password: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Ссылка недействительна или устарела');
  });

  it('should reset password for valid staff token', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: '123' }] }); // user found
    bcrypt.hash.mockResolvedValueOnce('$2a$12$newhash');
    pool.query.mockResolvedValueOnce({ rows: [] }); // update query

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'valid-token', password: 'newpassword123' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Пароль успешно изменён');
  });
});
