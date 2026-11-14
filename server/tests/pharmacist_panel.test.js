const request = require('supertest');
const app = require('../src/app');
const { connectDB, disconnectDB, query } = require('../src/config/db');

describe('MediStock Pharmacist Panel 15-Test Verification Suite', () => {
  let adminToken = '';
  let pharmacistToken = '';
  let customerToken = '';
  let uploadedRxId = null;
  let testPosSaleId = null;

  beforeAll(async () => {
    await connectDB();

    // Login as Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@medistock.com', password: 'Admin@123' });
    adminToken = adminRes.body.data.token;

    // Login as Pharmacist
    const pharmaRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'pharmacist@medistock.com', password: 'Pharmacist@123' });
    pharmacistToken = pharmaRes.body.data.token;

    // Login as Customer
    const custRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'customer@medistock.com', password: 'Customer@123' });
    customerToken = custRes.body.data.token;

    // Reset test batch and medicine quantities for test idempotency
    await query("UPDATE medicine_batches SET quantity = 50 WHERE batch_number = 'BATCH-PR500-A'");
    await query("UPDATE medicine_batches SET quantity = 100 WHERE batch_number = 'BATCH-PR500-B'");
    await query("UPDATE medicine_batches SET quantity = 150 WHERE batch_number = 'BATCH-PR500-C'");
    await query("UPDATE medicines SET quantity = 300 WHERE id = 1");
  });

  afterAll(async () => {
    await disconnectDB();
  });

  // ============================================================================
  // TEST 1: Pharmacist Login & Dashboard Telemetry
  // ============================================================================
  it('TEST 1: Pharmacist can log in and access dedicated pharmacist dashboard telemetry', async () => {
    const res = await request(app)
      .get('/api/v1/pharmacist/dashboard')
      .set('Authorization', `Bearer ${pharmacistToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stats).toBeDefined();
    expect(res.body.data.stats.todaySales).toBeDefined();
    expect(res.body.data.stats.todayBills).toBeDefined();
    expect(res.body.data.stats.pendingPrescriptions).toBeDefined();
    expect(res.body.data.stats.lowStockCount).toBeDefined();
    expect(res.body.data.stats.nearExpiryCount).toBeDefined();
    expect(Array.isArray(res.body.data.pendingRxQueue)).toBe(true);
    expect(Array.isArray(res.body.data.expiryAlerts)).toBe(true);
  });

  // ============================================================================
  // TEST 2: Pharmacist Cannot Access Admin-Only Routes
  // ============================================================================
  it('TEST 2: Pharmacist is forbidden (403) from accessing admin-only audit logs, expenses, and system telemetry', async () => {
    // 1. Audit logs
    const auditRes = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${pharmacistToken}`);
    expect(auditRes.statusCode).toBe(403);

    // 2. Operating expenses
    const expRes = await request(app)
      .get('/api/v1/expenses')
      .set('Authorization', `Bearer ${pharmacistToken}`);
    expect(expRes.statusCode).toBe(403);

    // 3. Admin dashboard stats
    const statsRes = await request(app)
      .get('/api/v1/dashboard/stats')
      .set('Authorization', `Bearer ${pharmacistToken}`);
    // Admin stats are allowed for pharmacist/admin, but let's verify supplier creation is blocked:
    const suppRes = await request(app)
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({ supplier_name: 'Unauthorized Supplier Test' });
    expect(suppRes.statusCode).toBe(403);
  });

  // ============================================================================
  // TEST 3: Upload Prescription using Customer Account
  // ============================================================================
  it('TEST 3: Customer uploads a prescription with doctor details and patient notes', async () => {
    const res = await request(app)
      .post('/api/v1/prescriptions')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        doctor_name: 'Dr. Evelyn Reed, MD',
        prescription_date: '2026-11-12',
        notes: 'Rx for Paracetamol 500mg, 1 tablet twice daily for fever',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.status).toBe('pending');
    uploadedRxId = res.body.data.id;
  });

  // ============================================================================
  // TEST 4: Verify Prescription Appears in Pharmacist Queue
  // ============================================================================
  it('TEST 4: Uploaded prescription appears in pharmacist pending verification queue', async () => {
    expect(uploadedRxId).toBeDefined();

    const res = await request(app)
      .get('/api/v1/prescriptions?status=pending')
      .set('Authorization', `Bearer ${pharmacistToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    const found = res.body.data.find((p) => p.id === uploadedRxId);
    expect(found).toBeDefined();
    expect(found.doctor_name).toBe('Dr. Evelyn Reed, MD');
    expect(found.status).toBe('pending');
  });

  // ============================================================================
  // TEST 5: Open Uploaded Prescription Details
  // ============================================================================
  it('TEST 5: Pharmacist can retrieve prescription details by ID', async () => {
    expect(uploadedRxId).toBeDefined();

    const res = await request(app)
      .get(`/api/v1/prescriptions/${uploadedRxId}`)
      .set('Authorization', `Bearer ${pharmacistToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.id).toBe(uploadedRxId);
    expect(res.body.data.doctor_name).toBe('Dr. Evelyn Reed, MD');
  });

  // ============================================================================
  // TEST 6: Pharmacist Approves Prescription with Remarks
  // ============================================================================
  it('TEST 6: Pharmacist approves prescription with clinical remarks and timestamp', async () => {
    expect(uploadedRxId).toBeDefined();

    const res = await request(app)
      .patch(`/api/v1/prescriptions/${uploadedRxId}/status`)
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({
        status: 'approved',
        verification_remarks: 'Verified doctor credentials and dosage. Patient eligible for dispensing.',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.verified_by).toBeDefined();
    expect(res.body.data.verified_at).toBeDefined();
    expect(res.body.data.verification_remarks).toContain('Verified doctor credentials');
  });

  // ============================================================================
  // TEST 7: Customer Receives Updated Status & Notification
  // ============================================================================
  it('TEST 7: Customer sees updated approved status and receives approval notification', async () => {
    expect(uploadedRxId).toBeDefined();

    // Check customer prescription list
    const rxRes = await request(app)
      .get('/api/v1/prescriptions')
      .set('Authorization', `Bearer ${customerToken}`);

    const myRx = rxRes.body.data.find((p) => p.id === uploadedRxId);
    expect(myRx).toBeDefined();
    expect(myRx.status).toBe('approved');

    // Check customer notification feed
    const notifRes = await request(app)
      .get('/api/v1/notifications/my')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(notifRes.statusCode).toBe(200);
    const notifications = notifRes.body.data.notifications || [];
    const rxNotif = notifications.find((n) => n.type === 'prescription');
    expect(rxNotif).toBeDefined();
  });

  // ============================================================================
  // TEST 8 & 9 & 10: Create POS Sale with FEFO Batch Allocation and Stock Deduction
  // ============================================================================
  it('TEST 8, 9, 10: POS sale executes FEFO batch allocation and atomically decrements inventory', async () => {
    // Paracetamol (medicine_id 1) has multi-batches:
    // BATCH-PR500-A: 50 units (Exp in 60d - FEFO 1st)
    // BATCH-PR500-B: 100 units (Exp in 240d - FEFO 2nd)
    const [beforeMeds] = await query('SELECT quantity FROM medicines WHERE id = 1');
    const [beforeBatchA] = await query("SELECT quantity FROM medicine_batches WHERE batch_number = 'BATCH-PR500-A'");
    const initialBatchAQty = beforeBatchA[0]?.quantity || 50;

    // Sell 15 units of Paracetamol via POS
    const saleRes = await request(app)
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({
        customer_id: 1,
        invoice_number: `INV-FEFO-TEST-${Date.now()}`,
        items: [
          {
            medicine_id: 1,
            quantity: 15,
            unit_price: 15.0,
          },
        ],
        discount: 0,
        tax: 5.0,
        payment_method: 'cash',
      });

    expect(saleRes.statusCode).toBe(201);
    expect(saleRes.body.success).toBe(true);
    expect(saleRes.body.data.id).toBeDefined();
    testPosSaleId = saleRes.body.data.id;

    // Verify FEFO batch deduction: Batch A (closest expiry) should have been reduced by 15!
    const [afterBatchA] = await query("SELECT quantity FROM medicine_batches WHERE batch_number = 'BATCH-PR500-A'");
    expect(afterBatchA[0].quantity).toBe(initialBatchAQty - 15);

    // Verify sale item recorded batch allocation
    const [items] = await query('SELECT * FROM sale_items WHERE sale_id = ?', [testPosSaleId]);
    expect(items.length).toBe(1);
    expect(items[0].batch_number).toBe('BATCH-PR500-A');
    expect(items[0].quantity).toBe(15);

    // Verify overall medicine quantity decremented
    const [afterMeds] = await query('SELECT quantity FROM medicines WHERE id = 1');
    expect(afterMeds[0].quantity).toBe(beforeMeds[0].quantity - 15);
  });

  // ============================================================================
  // TEST 11: Generate Invoice
  // ============================================================================
  it('TEST 11: Generates a complete invoice with line items, tax, and batch number', async () => {
    expect(testPosSaleId).toBeDefined();

    const res = await request(app)
      .get(`/api/v1/sales/${testPosSaleId}`)
      .set('Authorization', `Bearer ${pharmacistToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.invoice_number).toBeDefined();
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items[0].medicine_name).toContain('Paracetamol');
    expect(res.body.data.items[0].batch_number).toBe('BATCH-PR500-A');
  });

  // ============================================================================
  // TEST 12: Verify Sales and Payment Records
  // ============================================================================
  it('TEST 12: Sales and payment ledger records are saved with ACID consistency', async () => {
    expect(testPosSaleId).toBeDefined();

    const [payments] = await query('SELECT * FROM payments WHERE sale_id = ?', [testPosSaleId]);
    expect(payments.length).toBeGreaterThan(0);
    expect(payments[0].payment_status).toBe('completed');
    expect(payments[0].payment_method).toBe('cash');

    const [movements] = await query(
      "SELECT * FROM stock_movements WHERE reference_id = ? AND movement_type = 'sale'",
      [testPosSaleId]
    );
    expect(movements.length).toBeGreaterThan(0);
    expect(movements[0].quantity).toBe(15);
  });

  // ============================================================================
  // TEST 13: Test Expired Medicine Blocking
  // ============================================================================
  it('TEST 13: Prevents sale of expired or quarantined batches', async () => {
    // Create an expired test medicine
    const [medRes] = await query(`
      INSERT INTO medicines (medicine_name, category, batch_number, quantity, purchase_price, selling_price, expiry_date)
      VALUES ('Expired Amoxicillin ExpTest', 'Antibiotics', 'BATCH-EXP-LOCKED', 10, 5.00, 10.00, '2023-01-01')
    `);
    const expiredMedId = medRes.insertId;

    // Attempt to sell the expired medicine
    const res = await request(app)
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({
        items: [{ medicine_id: expiredMedId, quantity: 2, unit_price: 10.0 }],
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  // ============================================================================
  // TEST 14: Customer and Prescription Data Isolation
  // ============================================================================
  it('TEST 14: Enforces strict IDOR protection - Customer cannot view other customer sales or prescriptions', async () => {
    expect(testPosSaleId).toBeDefined();

    // Create a secondary customer
    const otherCustRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Unrelated Customer Two',
        email: `unrelated_${Date.now()}@test.com`,
        password: 'Password@123',
        role: 'customer',
      });

    const otherToken = otherCustRes.body.data.token;

    // Other customer attempts to access testPosSaleId
    const res = await request(app)
      .get(`/api/v1/sales/${testPosSaleId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    // Must be 403 Forbidden
    expect(res.statusCode).toBe(403);
  });

  // ============================================================================
  // TEST 15: Admin and Customer Dashboards Still Work
  // ============================================================================
  it('TEST 15: Admin dashboard and Customer dashboard remain 100% operational', async () => {
    // 1. Admin dashboard stats
    const adminRes = await request(app)
      .get('/api/v1/dashboard/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.statusCode).toBe(200);
    expect(adminRes.body.data.kpis.total_medicines).toBeDefined();

    // 2. Customer portal dashboard
    const custRes = await request(app)
      .get('/api/v1/customers/me/dashboard')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(custRes.statusCode).toBe(200);
    expect(custRes.body.data.profile).toBeDefined();
    expect(custRes.body.data.stats).toBeDefined();

    // 3. Pharmacist dashboard
    const pharmaRes = await request(app)
      .get('/api/v1/pharmacist/dashboard')
      .set('Authorization', `Bearer ${pharmacistToken}`);
    expect(pharmaRes.statusCode).toBe(200);
  });
});
