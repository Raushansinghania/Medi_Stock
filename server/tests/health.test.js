const request = require('supertest');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');

describe('System Health & Base Architecture', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  it('GET / should return root metadata', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('name', 'MediStock Pharmacy Management System API');
    expect(res.body).toHaveProperty('version', '1.0.0');
    expect(res.body).toHaveProperty('status', 'online');
  });

  it('GET /api/v1/health should return system telemetry and operational status with MySQL database', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('service', 'MediStock API Server');
    expect(res.body.data).toHaveProperty('version', '1.0.0');
    expect(res.body.data).toHaveProperty('database');
    expect(res.body.data.database).toHaveProperty('status', 'connected');
    expect(res.body.data.database).toHaveProperty('database', 'medistock');
    expect(res.body.data).toHaveProperty('tableCount');
    expect(res.body.data.tableCount).toBeGreaterThanOrEqual(20);
    expect(res.body.data).toHaveProperty('memoryUsage');
  });

  it('GET /api/v1/unknown-route should return structured 404 response', async () => {
    const res = await request(app).get('/api/v1/unknown-route');
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toContain('Route not found');
  });
});
