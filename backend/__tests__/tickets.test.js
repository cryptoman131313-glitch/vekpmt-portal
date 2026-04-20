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

function staffToken(role = 'director', permissions = {}) {
  return jwt.sign(
    { id: '100', email: 'staff@test.com', role, name: 'Staff', type: 'user', permissions },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function clientToken(clientId = '200') {
  return jwt.sign(
    { id: clientId, email: 'client@test.com', name: 'Client', company: 'TestCo', type: 'client' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/tickets', () => {
  it('should return 401 without auth', async () => {
    const res = await request(app).get('/api/tickets');
    expect(res.status).toBe(401);
  });

  it('should return paginated ticket list', async () => {
    const mockTickets = [
      { id: 1, status: 'new', company_name: 'TestCo', type_name: 'Ремонт' },
    ];
    pool.query
      .mockResolvedValueOnce({ rows: mockTickets }) // tickets query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // count query

    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${staffToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
  });

  it('should support filters', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const res = await request(app)
      .get('/api/tickets?status=new&page=2&limit=5')
      .set('Authorization', `Bearer ${staffToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(5);
  });
});

describe('GET /api/tickets/stats', () => {
  it('should return ticket statistics', async () => {
    const mockStats = {
      new_count: '3', in_progress_count: '5',
      waiting_count: '2', done_count: '10', total_count: '20',
    };
    pool.query.mockResolvedValueOnce({ rows: [mockStats] });

    const res = await request(app)
      .get('/api/tickets/stats')
      .set('Authorization', `Bearer ${staffToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.new_count).toBe('3');
    expect(res.body.total_count).toBe('20');
  });
});

describe('GET /api/tickets/:id', () => {
  it('should return 404 if ticket not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/tickets/999')
      .set('Authorization', `Bearer ${staffToken()}`);

    expect(res.status).toBe(404);
  });

  it('should return ticket detail', async () => {
    const mockTicket = {
      id: 1, status: 'new', description: 'Test ticket',
      company_name: 'TestCo', type_name: 'Ремонт',
    };
    pool.query.mockResolvedValueOnce({ rows: [mockTicket] });

    const res = await request(app)
      .get('/api/tickets/1')
      .set('Authorization', `Bearer ${staffToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Test ticket');
  });
});

describe('POST /api/tickets', () => {
  it('should return 400 if required fields missing', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${staffToken()}`)
      .send({ client_id: '1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Заполните обязательные поля');
  });

  it('should create a ticket', async () => {
    const mockTicket = {
      id: 1, client_id: '1', type_id: '1', status: 'new',
      description: 'Broken equipment',
    };

    pool.query
      .mockResolvedValueOnce({ rows: [{ auto_statuses: { created: 'new' } }] }) // ticket type
      .mockResolvedValueOnce({ rows: [mockTicket] }) // insert ticket
      .mockResolvedValueOnce({ rows: [] }) // insert history
      .mockResolvedValueOnce({ rows: [{ company_name: 'TestCo' }] }) // client lookup
      .mockResolvedValueOnce({ rows: [{ id: '100' }] }) // staff for notifications
      .mockResolvedValueOnce({ rows: [] }); // notification insert

    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${staffToken()}`)
      .send({
        client_id: '1',
        type_id: '1',
        description: 'Broken equipment',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(1);
  });
});

describe('PATCH /api/tickets/:id', () => {
  it('should return 404 if ticket not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch('/api/tickets/999')
      .set('Authorization', `Bearer ${staffToken()}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(404);
  });

  it('should update ticket status', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'new', type_id: '1', assigned_to: null }] }) // current
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'in_progress' }] }) // update
      .mockResolvedValueOnce({ rows: [] }); // history

    const res = await request(app)
      .patch('/api/tickets/1')
      .set('Authorization', `Bearer ${staffToken()}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
  });
});

describe('POST /api/tickets/:id/messages', () => {
  it('should return 400 if content is empty', async () => {
    const res = await request(app)
      .post('/api/tickets/1/messages')
      .set('Authorization', `Bearer ${staffToken()}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Введите сообщение');
  });

  it('should return 403 if engineer lacks channel permission', async () => {
    const token = staffToken('engineer', { can_write_appeal: false });

    const res = await request(app)
      .post('/api/tickets/1/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello', channel: 'appeal' });

    expect(res.status).toBe(403);
  });

  it('should send a message as director (any channel)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, ticket_id: 1, content: 'Test message' }] }) // insert message
      .mockResolvedValueOnce({ rows: [] }) // update ticket
      .mockResolvedValueOnce({ rows: [] }) // insert history
      .mockResolvedValueOnce({ rows: [] }) // auto status: ticket lookup
      .mockResolvedValueOnce({ rows: [{ id: '101' }] }) // staff for notifications
      .mockResolvedValueOnce({ rows: [] }); // notification insert

    const res = await request(app)
      .post('/api/tickets/1/messages')
      .set('Authorization', `Bearer ${staffToken('director')}`)
      .send({ content: 'Test message', channel: 'appeal' });

    expect(res.status).toBe(201);
  });
});

describe('GET /api/tickets/:id/history', () => {
  it('should return 403 for non-director', async () => {
    const res = await request(app)
      .get('/api/tickets/1/history')
      .set('Authorization', `Bearer ${staffToken('engineer')}`);

    expect(res.status).toBe(403);
  });

  it('should return history for director', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, field_name: 'status', old_value: 'new', new_value: 'in_progress' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ created_at: '2024-01-01' }] });

    const res = await request(app)
      .get('/api/tickets/1/history')
      .set('Authorization', `Bearer ${staffToken('director')}`);

    expect(res.status).toBe(200);
    expect(res.body.history).toBeDefined();
    expect(res.body.stats).toBeDefined();
  });
});

describe('Client ticket endpoints', () => {
  describe('POST /api/tickets/client/new', () => {
    it('should return 403 for staff token', async () => {
      const res = await request(app)
        .post('/api/tickets/client/new')
        .set('Authorization', `Bearer ${staffToken()}`)
        .send({ type_id: '1', description: 'Test' });

      expect(res.status).toBe(403);
    });

    it('should return 400 if required fields missing', async () => {
      const res = await request(app)
        .post('/api/tickets/client/new')
        .set('Authorization', `Bearer ${clientToken()}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should create a ticket as client', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'new', client_id: '200' }] }) // insert
        .mockResolvedValueOnce({ rows: [] }) // history
        .mockResolvedValueOnce({ rows: [{ company_name: 'TestCo' }] }) // client info
        .mockResolvedValueOnce({ rows: [{ id: '100' }] }) // staff
        .mockResolvedValueOnce({ rows: [] }); // notification

      const res = await request(app)
        .post('/api/tickets/client/new')
        .set('Authorization', `Bearer ${clientToken()}`)
        .send({ type_id: '1', description: 'Equipment broken' });

      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/tickets/client/list', () => {
    it('should return client tickets', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'new', equipment_model: 'Model X' }],
      });

      const res = await request(app)
        .get('/api/tickets/client/list')
        .set('Authorization', `Bearer ${clientToken()}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });
});
