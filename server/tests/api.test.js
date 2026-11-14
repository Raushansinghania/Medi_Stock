const request = require('supertest');
const app = require('../src/app');
const { connectDB, disconnectDB, query } = require('../src/config/db');

describe('MediStock MySQL API Full Integration Suite', () => {
  let adminToken = '';
  let pharmacistToken = '';
  let customerToken = '';
  let testMedicineId = null;
  let testSupplierId = null;
  let testCustomerId = null;
  let testSaleId = null;

  beforeAll(async () => {
    await connectDB();

    // Login as admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@medistock.com', password: 'Admin@123' });
    adminToken = adminRes.body.data.token;

    // Login as pharmacist
    const pharmaRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'pharmacist@medistock.com', password: 'Pharmacist@123' });
    pharmacistToken = pharmaRes.body.data.token;

    // Login as customer
    const custRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'customer@medistock.com', password: 'Customer@123' });
    customerToken = custRes.body.data.token;
  });

  afterAll(async () => {
    await disconnectDB();
  });

  // ============================================================================
  // 1. AUTHENTICATION & RBAC
  // ============================================================================
  describe('1. Authentication & RBAC', () => {
    it('POST /api/v1/auth/register should create a new user', async () => {
      const uniqueEmail = `testuser_${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Integration Test User',
          email: uniqueEmail,
          password: 'Password@123',
          role: 'customer',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(uniqueEmail);
      expect(res.body.data.token).toBeDefined();
    });

    it('POST /api/v1/auth/register should reject duplicate email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Duplicate Admin',
          email: 'admin@medistock.com',
          password: 'Password@123',
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/v1/auth/login should reject invalid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@medistock.com',
          password: 'WrongPassword!',
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/v1/auth/me should return authenticated profile', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.user.email).toBe('admin@medistock.com');
      expect(res.body.data.user.role).toBe('admin');
    });

    it('GET /api/v1/auth/users should allow admin and reject customer', async () => {
      const custRes = await request(app)
        .get('/api/v1/auth/users')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(custRes.statusCode).toBe(403);

      const adminUsersRes = await request(app)
        .get('/api/v1/auth/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminUsersRes.statusCode).toBe(200);
      expect(Array.isArray(adminUsersRes.body.data)).toBe(true);
    });
  });

  // ============================================================================
  // 2. CATEGORIES
  // ============================================================================
  describe('2. Categories Management', () => {
    let catId = null;

    it('POST /api/v1/categories should create category', async () => {
      const catName = `Test Category ${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category_name: catName,
          description: 'Test category description',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.category_name).toBe(catName);
      catId = res.body.data.id;
    });

    it('GET /api/v1/categories should list categories', async () => {
      const res = await request(app).get('/api/v1/categories');
      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('PUT /api/v1/categories/:id should update category', async () => {
      const res = await request(app)
        .put(`/api/v1/categories/${catId}`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({ description: 'Updated category description' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.description).toBe('Updated category description');
    });
  });

  // ============================================================================
  // 3. MEDICINES & STOCK MANAGEMENT
  // ============================================================================
  describe('3. Medicines & Stock Management', () => {
    it('POST /api/v1/medicines should create medicine and initial stock movement', async () => {
      const batchNum = `BATCH-TEST-${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/medicines')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          medicine_name: 'Doxycycline 100mg',
          category: 'Antibiotics',
          manufacturer: 'Teva Pharmaceuticals',
          batch_number: batchNum,
          quantity: 50,
          purchase_price: 3.20,
          selling_price: 6.50,
          expiry_date: '2027-10-31',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.medicine_name).toBe('Doxycycline 100mg');
      expect(res.body.data.quantity).toBe(50);
      testMedicineId = res.body.data.id;

      // Verify stock movement
      const [sm] = await query(
        'SELECT * FROM stock_movements WHERE medicine_id = ? AND movement_type = ?',
        [testMedicineId, 'adjustment']
      );
      expect(sm.length).toBeGreaterThan(0);
      expect(sm[0].quantity).toBe(50);
    });

    it('GET /api/v1/medicines should return medicines with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/medicines?search=Doxycycline')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.some((m) => m.id === testMedicineId)).toBe(true);
    });

    it('POST /api/v1/medicines/:id/adjust-stock should prevent negative stock', async () => {
      const res = await request(app)
        .post(`/api/v1/medicines/${testMedicineId}/adjust-stock`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          adjustment: -100, // Current stock is 50, so this would lead to negative stock
          reason: 'Excess stock damage test',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('Negative stock is not allowed');
    });

    it('POST /api/v1/medicines/:id/adjust-stock should accurately adjust stock', async () => {
      const res = await request(app)
        .post(`/api/v1/medicines/${testMedicineId}/adjust-stock`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          adjustment: 10,
          reason: 'Received manual sample units',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.quantity).toBe(60); // 50 + 10 = 60
    });
  });

  // ============================================================================
  // 4. SUPPLIERS & CUSTOMERS
  // ============================================================================
  describe('4. Suppliers & Customers', () => {
    it('POST /api/v1/suppliers should create supplier', async () => {
      const res = await request(app)
        .post('/api/v1/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplier_name: `Prime Medical Wholesale ${Date.now()}`,
          contact_person: 'Marcus Brody',
          phone: '+1-555-8888',
          email: 'orders@primemed.com',
          address: '500 Logistics Way, Chicago',
        });

      expect(res.statusCode).toBe(201);
      testSupplierId = res.body.data.id;
    });

    it('POST /api/v1/customers should create customer', async () => {
      const res = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          customer_name: 'Arthur Dent',
          phone: '+1-555-4242',
          email: 'arthur@galaxy.org',
          address: '42 Cottington Lane',
        });

      expect(res.statusCode).toBe(201);
      testCustomerId = res.body.data.id;
    });
  });

  // ============================================================================
  // 5. PURCHASES & STOCK INCREASE
  // ============================================================================
  describe('5. Purchases & Stock Increase', () => {
    it('POST /api/v1/purchases should increment medicine stock atomically', async () => {
      // Current stock of testMedicineId is 60
      const [beforeRows] = await query('SELECT quantity FROM medicines WHERE id = ?', [testMedicineId]);
      const initialStock = beforeRows[0].quantity;

      const res = await request(app)
        .post('/api/v1/purchases')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          supplier_id: testSupplierId,
          invoice_number: `PUR-TEST-${Date.now()}`,
          purchase_date: '2026-11-10',
          items: [
            {
              medicine_id: testMedicineId,
              quantity: 40,
              unit_cost: 3.50,
            },
          ],
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.total_amount).toBe(140.00); // 40 * 3.50

      // Verify medicine stock increased
      const [afterRows] = await query('SELECT quantity FROM medicines WHERE id = ?', [testMedicineId]);
      expect(afterRows[0].quantity).toBe(initialStock + 40);

      // Verify stock movement was recorded
      const [sm] = await query(
        'SELECT * FROM stock_movements WHERE medicine_id = ? AND movement_type = ? AND reference_type = ?',
        [testMedicineId, 'purchase', 'purchase']
      );
      expect(sm.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // 6. SALES, POS CHECKOUT & STOCK DECREASE
  // ============================================================================
  describe('6. Sales, POS Checkout & Stock Decrease', () => {
    it('POST /api/v1/sales should reject when requested quantity exceeds stock', async () => {
      const [stockRows] = await query('SELECT quantity FROM medicines WHERE id = ?', [testMedicineId]);
      const currentStock = stockRows[0].quantity;

      const res = await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          customer_id: testCustomerId,
          sale_date: '2026-11-10',
          items: [
            {
              medicine_id: testMedicineId,
              quantity: currentStock + 50, // Exceeds available stock
              unit_price: 6.50,
            },
          ],
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('Insufficient stock');
    });

    it('POST /api/v1/sales should deduct stock, calculate totals, and record payment', async () => {
      const [stockBefore] = await query('SELECT quantity FROM medicines WHERE id = ?', [testMedicineId]);
      const initialStock = stockBefore[0].quantity;

      const invNo = `INV-TEST-${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          customer_id: testCustomerId,
          invoice_number: invNo,
          sale_date: '2026-11-10',
          discount: 5.00,
          tax: 2.50,
          payment_method: 'card',
          items: [
            {
              medicine_id: testMedicineId,
              quantity: 10,
              unit_price: 6.50, // Subtotal: 65.00
            },
          ],
        });

      expect(res.statusCode).toBe(201);
      testSaleId = res.body.data.id;

      // Subtotal = 65, Discount = 5, Tax = 2.50 => Total = 62.50
      expect(res.body.data.subtotal).toBe(65.00);
      expect(res.body.data.discount).toBe(5.00);
      expect(res.body.data.tax).toBe(2.50);
      expect(res.body.data.total_amount).toBe(62.50);

      // Verify stock deducted
      const [stockAfter] = await query('SELECT quantity FROM medicines WHERE id = ?', [testMedicineId]);
      expect(stockAfter[0].quantity).toBe(initialStock - 10);

      // Verify payment was recorded
      expect(res.body.data.payments.length).toBe(1);
      expect(res.body.data.payments[0].amount).toBe(62.50);
      expect(res.body.data.payments[0].payment_method).toBe('card');

      // Verify stock movement
      const [sm] = await query(
        'SELECT * FROM stock_movements WHERE medicine_id = ? AND movement_type = ? AND reference_id = ?',
        [testMedicineId, 'sale', testSaleId]
      );
      expect(sm.length).toBe(1);
      expect(sm[0].quantity).toBe(10);
    });
  });

  // ============================================================================
  // 7. RETURNS & STOCK RESTORATION
  // ============================================================================
  describe('7. Returns & Stock Restoration', () => {
    it('POST /api/v1/returns should reject return quantity higher than purchased in sale', async () => {
      const res = await request(app)
        .post('/api/v1/returns')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          sale_id: testSaleId,
          medicine_id: testMedicineId,
          quantity: 20, // Only 10 were purchased in this sale
          return_reason: 'Patient changed prescription',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('Maximum returnable quantity is 10');
    });

    it('POST /api/v1/returns should restore stock atomically', async () => {
      const [stockBefore] = await query('SELECT quantity FROM medicines WHERE id = ?', [testMedicineId]);
      const initialStock = stockBefore[0].quantity;

      const res = await request(app)
        .post('/api/v1/returns')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          sale_id: testSaleId,
          medicine_id: testMedicineId,
          quantity: 3,
          return_reason: 'Unopened box returned by patient',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.quantity).toBe(3);

      // Verify stock restored
      const [stockAfter] = await query('SELECT quantity FROM medicines WHERE id = ?', [testMedicineId]);
      expect(stockAfter[0].quantity).toBe(initialStock + 3);

      // Verify stock movement
      const [sm] = await query(
        'SELECT * FROM stock_movements WHERE medicine_id = ? AND movement_type = ? AND reference_type = ?',
        [testMedicineId, 'return', 'return']
      );
      expect(sm.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // 8. EXPENSES, INVENTORY SUMMARY & DASHBOARD
  // ============================================================================
  describe('8. Expenses, Inventory & Dashboard Stats', () => {
    it('POST /api/v1/expenses should record expense', async () => {
      const res = await request(app)
        .post('/api/v1/expenses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          expense_title: 'Software License Renewal',
          category: 'IT & Software',
          amount: 250.00,
          expense_date: '2026-11-10',
          description: 'MediStock Cloud DB Backup license',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.amount).toBe(250.00);
    });

    it('GET /api/v1/inventory/summary should return inventory valuations', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/summary')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.summary.total_medicines).toBeGreaterThan(0);
      expect(res.body.data.summary.total_units_in_stock).toBeGreaterThan(0);
    });

    it('GET /api/v1/dashboard/stats should return comprehensive KPIs', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.kpis).toHaveProperty('total_medicines');
      expect(res.body.data.kpis).toHaveProperty('total_revenue');
      expect(res.body.data.kpis).toHaveProperty('total_purchases');
      expect(res.body.data.kpis).toHaveProperty('total_expenses');
      expect(Array.isArray(res.body.data.recentSales)).toBe(true);
    });

    it('GET /api/v1/audit-logs should return recorded system actions', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // 9. PRESCRIPTIONS
  // ============================================================================
  describe('9. Prescription Workflow', () => {
    let prescId = null;

    it('POST /api/v1/prescriptions should create prescription', async () => {
      const res = await request(app)
        .post('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          customer_id: testCustomerId,
          doctor_name: 'Dr. Gregory House',
          prescription_date: '2026-11-10',
          notes: 'Take with food once daily',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.status).toBe('pending');
      prescId = res.body.data.id;
    });

    it('PATCH /api/v1/prescriptions/:id/status should approve prescription', async () => {
      const res = await request(app)
        .patch(`/api/v1/prescriptions/${prescId}/status`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          status: 'approved',
          notes: 'Verified with clinic and approved',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe('approved');
    });
  });
});
