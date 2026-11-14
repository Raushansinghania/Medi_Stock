const { getSafeDbDetails, connectDB, disconnectDB, getPool } = require('../src/config/db');

describe('Database Configuration & MySQL Pool', () => {
  afterAll(async () => {
    await disconnectDB();
  });

  it('should retrieve database configuration details', () => {
    const details = getSafeDbDetails();
    expect(details).toHaveProperty('host');
    expect(details).toHaveProperty('port');
    expect(details).toHaveProperty('user');
    expect(details).toHaveProperty('database', 'medistock');
  });

  it('should successfully initialize MySQL connection pool and ping server', async () => {
    const pool = await connectDB();
    expect(pool).toBeDefined();

    const [rows] = await pool.query('SELECT 1 + 1 AS result');
    expect(rows[0].result).toBe(2);
  });

  it('should provide active pool through getPool()', () => {
    const pool = getPool();
    expect(pool).toBeDefined();
    expect(typeof pool.query).toBe('function');
    expect(typeof pool.execute).toBe('function');
  });
});
