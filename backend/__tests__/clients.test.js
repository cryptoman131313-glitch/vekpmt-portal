const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

jest.mock('../src/db/pool', () => ({
  query: jest.fn(),
  on: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const pool = require('../src/db/pool');
const bcrypt = require('bcryptjs');

function staffToken(role = 'director') {
  return jwt.sign(
    { id: '100', email: 'staff@test.com', role, name: 'Staff', type: 'user', permissions: {} },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function clientToken() {
  return jwt.sign(
    { id: '200', email: 'client@test.com', name: 'Client', company: 'TestCo', type: 'client' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/clients', () => {
  it('should return 401 without auth', async () => {
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(401);
  });

  it('should return list of clients', async () => {
    const mockClients = [
      { id: '1', company_name: 'Company A', contact_name: 'John', equipment_count: '2', tickets_count: '5' },
      { id: '2', company_name: 'Company B', contact_name: 'Jane', equipment_count: '0', tickets_count: '1' },
    ];
    pool.query.mockResolvedValueOnce({ rows: mockClients });

    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${staffToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].company_name).toBe('Company A');
  });

  it('should support search parameter', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/clients?search=test')
      .set('Authorization', `Bearer ${staffToken()}`);

    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      ['%test%']
    );
  });
});

describe('GET /api/clients/:id', () => {
  it('should return 404 if client not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/clients/999')
      .set('Authorization', `Bearer ${staffToken()}`);

    expect(res.status).toBe(404);
  });

  it('should return client details', async () => {
    const mockClient = {
      id: '1', company_name: 'Test Company', inn: '1234567890',
      contact_name: 'John', contact_email: 'john@test.com',
      status: 'active',
    };
    pool.query.mockResolvedValueOnce({ rows: [mockClient] });

    const res = await request(app)
      .get('/api/clients/1')
      .set('Authorization', `Bearer ${staffToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.company_name).toBe('Test Company');
  });
});

describe('POST /api/clients', () => {
  it('should return 400 if required fields missing', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${staffToken()}`)
      .send({ company_name: 'Test' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Заполните все обязательные поля');
  });

  it('should create a client successfully', async () => {
    bcrypt.hash.mockResolvedValueOnce('$2a$12$hash');
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: '1', company_name: 'New Co', contact_name: 'John', contact_email: 'john@test.com' }],
      })
      .mockResolvedValueOnce({ rows: [] }); // client_users insert

    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${staffToken()}`)
      .send({
        company_name: 'New Co',
        contact_name: 'John',
        contact_phone: '+7999',
        contact_email: 'john@test.com',
        password: 'password123',
      });

    expect(res.status).toBe(201);
    expect(res.body.company_name).toBe('New Co');
  });

  it('should return 409 on duplicate email', async () => {
    bcrypt.hash.mockResolvedValueOnce('$2a$12$hash');
    pool.query.mockRejectedValueOnce({ code: '23505' });

    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${staffToken()}`)
      .send({
        company_name: 'Dup Co',
        contact_name: 'John',
        contact_phone: '+7999',
        contact_email: 'existing@test.com',
        password: 'password123',
      });

    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/clients/:id', () => {
  it('should update client fields', async () => {
    const updatedClient = {
      id: '1', company_name: 'Updated Co', contact_name: 'John Updated',
    };
    pool.query.mockResolvedValueOnce({ rows: [updatedClient] });

    const res = await request(app)
      .patch('/api/clients/1')
      .set('Authorization', `Bearer ${staffToken()}`)
      .send({ company_name: 'Updated Co' });

    expect(res.status).toBe(200);
    expect(res.body.company_name).toBe('Updated Co');
  });

  it('should return 404 if client not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch('/api/clients/999')
      .set('Authorization', `Bearer ${staffToken()}`)
      .send({ company_name: 'Updated' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/clients/:id', () => {
  it('should return 403 for non-director role', async () => {
    const res = await request(app)
      .delete('/api/clients/1')
      .set('Authorization', `Bearer ${staffToken('engineer')}`);

    expect(res.status).toBe(403);
  });

  it('should delete client as director', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/clients/1')
      .set('Authorization', `Bearer ${staffToken('director')}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Клиент удалён');
  });
});

describe('GET /api/clients/me/profile (client auth)', () => {
  it('should return 403 for staff token', async () => {
    const res = await request(app)
      .get('/api/clients/me/profile')
      .set('Authorization', `Bearer ${staffToken()}`);

    expect(res.status).toBe(403);
  });

  it('should return client profile', async () => {
    const mockProfile = {
      id: '200', company_name: 'TestCo', contact_name: 'Client',
      contact_email: 'client@test.com',
    };
    pool.query.mockResolvedValueOnce({ rows: [mockProfile] });

    const res = await request(app)
      .get('/api/clients/me/profile')
      .set('Authorization', `Bearer ${clientToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.company_name).toBe('TestCo');
  });
});
