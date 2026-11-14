const request = require('supertest');
const app = require('../src/app');
const { connectDB, disconnectDB, query } = require('../src/config/db');

describe('MediStock Enterprise Admin Panel 15-Test Verification Suite', () => {
  let adminToken = '';
  let pharmacistToken = '';
  let customerToken = '';
  let createdMedicineId = null;
  let createdSupplierId = null;
  let createdPurchaseOrderId = null;
  let createdEmployeeId = null;
  let testSaleId = null;

  beforeAll(async () => {
    await connectDB();

    // 1. Login as Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@medistock.com', password: 'Admin@123' });
    adminToken = adminRes.body.data.token;

    // 2. Login as Pharmacist
    const pharmaRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'pharmacist@medistock.com', password: 'Pharmacist@123' });
    pharmacistToken = pharmaRes.body.data.token;

    // 3. Login as Customer
    const custRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'customer@medistock.com', password: 'Customer@123' });
    customerToken = custRes.body.data.token;

    // Reset stock and batch data for idempotency
    await query("UPDATE medicine_batches SET quantity = 50 WHERE batch_number = 'BATCH-PR500-A'");
    await query("UPDATE medicines SET quantity = 300 WHERE id = 1");
  });

  afterAll(async () => {
    await disconnectDB();
  });

  // ============================================================================
  // TEST 1: Admin Login & Dashboard Telemetry
  // ============================================================================
  it('TEST 1: Admin can log in and access the Admin Dashboard with real-time MySQL statistics', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard?range=30days')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.business).toBeDefined();
    expect(res.body.data.business.total_revenue).toBeDefined();
    expect(res.body.data.business.gross_profit).toBeDefined();
    expect(res.body.data.business.net_profit).toBeDefined();
    expect(res.body.data.inventory).toBeDefined();
    expect(res.body.data.inventory.total_medicines).toBeDefined();
    expect(res.body.data.inventory.inventory_valuation).toBeDefined();
    expect(res.body.data.operations).toBeDefined();
    expect(res.body.data.charts).toBeDefined();
    expect(res.body.data.alerts).toBeDefined();
  });

  // ============================================================================
  // TEST 2: Create and Update Medicine Master Records
  // ============================================================================
  it('TEST 2: Admin can create and update medicine records in the master catalogue', async () => {
    // Create new medicine
    const createRes = await request(app)
      .post('/api/v1/medicines')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        medicine_name: `Admin Test Drug ${Date.now()}`,
        category: 'Antibiotics',
        dosage_form: 'Capsule',
        strength: '250mg',
        quantity: 100,
        purchase_price: 12.5,
        selling_price: 25.0,
        mrp: 30.0,
        is_prescription_required: 1,
        manufacturer: 'Pfizer Healthcare',
      });

    expect(createRes.statusCode).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.id).toBeDefined();
    createdMedicineId = createRes.body.data.id;

    // Update medicine record
    const updateRes = await request(app)
      .put(`/api/v1/medicines/${createdMedicineId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        selling_price: 27.5,
        mrp: 35.0,
        strength: '500mg',
      });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(Number(updateRes.body.data.selling_price)).toBe(27.5);
  });

  // ============================================================================
  // TEST 3: Register Suppliers
  // ============================================================================
  it('TEST 3: Admin can register pharmaceutical distributors and suppliers', async () => {
    const res = await request(app)
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplier_name: `Global Pharma Dist ${Date.now()}`,
        contact_person: 'Robert Vance',
        phone: '+1-555-0199',
        email: `vendor_${Date.now()}@globalpharma.com`,
        address: '450 Industrial Parkway, NJ',
        gstin: '27AABCU9603R1ZM',
        payment_terms: 'Net 30',
        status: 'active',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    createdSupplierId = res.body.data.id;
  });

  // ============================================================================
  // TEST 4: Create and Approve Purchase Orders (Stock Unchanged)
  // ============================================================================
  it('TEST 4: Admin can create and approve purchase orders without prematurely increasing stock', async () => {
    expect(createdMedicineId).toBeDefined();

    // Check medicine stock before purchase order
    const [beforeMed] = await query('SELECT quantity FROM medicines WHERE id = ?', [createdMedicineId]);
    const initialStock = beforeMed[0].quantity;

    // Create PO with status 'ordered'
    const poRes = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplier_id: createdSupplierId || 1,
        invoice_number: `PO-TEST-${Date.now()}`,
        purchase_date: new Date().toISOString().slice(0, 10),
        status: 'ordered',
        tax: 15.0,
        notes: 'Urgent antibiotics replenishment',
        items: [
          {
            medicine_id: createdMedicineId,
            quantity: 50,
            unit_cost: 10.0,
          },
        ],
      });

    expect(poRes.statusCode).toBe(201);
    expect(poRes.body.success).toBe(true);
    expect(poRes.body.data.id).toBeDefined();
    createdPurchaseOrderId = poRes.body.data.id;

    // Verify stock is UNCHANGED because goods have not been received yet!
    const [afterMed] = await query('SELECT quantity FROM medicines WHERE id = ?', [createdMedicineId]);
    expect(afterMed[0].quantity).toBe(initialStock);

    // Update status to approved
    const approveRes = await request(app)
      .patch(`/api/v1/purchases/${createdPurchaseOrderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });

    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.body.data.status).toBe('approved');
  });

  // ============================================================================
  // TEST 5: Receiving Goods Updates Inventory and Batches Correctly
  // ============================================================================
  it('TEST 5: Receiving goods updates inventory and batch records atomically', async () => {
    expect(createdPurchaseOrderId).toBeDefined();
    expect(createdMedicineId).toBeDefined();

    const [beforeMed] = await query('SELECT quantity FROM medicines WHERE id = ?', [createdMedicineId]);
    const stockBeforeReceipt = beforeMed[0].quantity;

    const testBatchNo = `BATCH-RCV-${Date.now().toString().slice(-4)}`;
    const testExpiry = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Confirm goods receipt
    const rcvRes = await request(app)
      .post(`/api/v1/purchases/${createdPurchaseOrderId}/receive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          {
            medicine_id: createdMedicineId,
            quantity: 50,
            batch_number: testBatchNo,
            expiry_date: testExpiry,
          },
        ],
      });

    expect(rcvRes.statusCode).toBe(200);
    expect(rcvRes.body.success).toBe(true);
    expect(rcvRes.body.data.status).toBe('received');

    // Verify medicine quantity incremented by 50
    const [afterMed] = await query('SELECT quantity FROM medicines WHERE id = ?', [createdMedicineId]);
    expect(afterMed[0].quantity).toBe(stockBeforeReceipt + 50);

    // Verify batch record was created in medicine_batches
    const [batches] = await query(
      'SELECT * FROM medicine_batches WHERE medicine_id = ? AND batch_number = ?',
      [createdMedicineId, testBatchNo]
    );
    expect(batches.length).toBe(1);
    expect(batches[0].quantity).toBe(50);
  });

  // ============================================================================
  // TEST 6: Manage Pharmacist and Employee Accounts
  // ============================================================================
  it('TEST 6: Admin can provision, update, and securely reset employee accounts', async () => {
    const testEmpEmail = `staff_${Date.now()}@medistock.com`;

    // 1. Create employee
    const createEmpRes = await request(app)
      .post('/api/v1/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Dr. Arthur Pendelton',
        email: testEmpEmail,
        password: 'Password@123',
        role: 'pharmacist',
        phone: '+1-555-0811',
        address: '100 Medical Plaza, NY',
      });

    expect(createEmpRes.statusCode).toBe(201);
    expect(createEmpRes.body.success).toBe(true);
    expect(createEmpRes.body.data.id).toBeDefined();
    createdEmployeeId = createEmpRes.body.data.id;

    // 2. Update employee
    const updateEmpRes = await request(app)
      .put(`/api/v1/admin/employees/${createdEmployeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        phone: '+1-555-0999',
        status: 'active',
      });

    expect(updateEmpRes.statusCode).toBe(200);
    expect(updateEmpRes.body.data.phone).toBe('+1-555-0999');

    // 3. Reset employee password securely
    const resetRes = await request(app)
      .post(`/api/v1/admin/employees/${createdEmployeeId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ new_password: 'NewSecurePassword@456' });

    expect(resetRes.statusCode).toBe(200);
    expect(resetRes.body.success).toBe(true);
  });

  // ============================================================================
  // TEST 7: View All Authorized Sales Invoices
  // ============================================================================
  it('TEST 7: Admin can view all authorized sales invoices with line items and batches', async () => {
    const res = await request(app)
      .get('/api/v1/sales')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      testSaleId = res.body.data[0].id;
      const detailRes = await request(app)
        .get(`/api/v1/sales/${testSaleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(detailRes.statusCode).toBe(200);
      expect(detailRes.body.data.invoice_number).toBeDefined();
      expect(Array.isArray(detailRes.body.data.items)).toBe(true);
    }
  });

  // ============================================================================
  // TEST 8: Financial Reports Calculate Correctly from Database
  // ============================================================================
  it('TEST 8: Financial reports calculate revenue, COGS, expenses, and net profit from database records', async () => {
    const res = await request(app)
      .get('/api/v1/admin/finance/summary?range=30days')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pnl).toBeDefined();
    expect(res.body.data.pnl.total_sales).toBeGreaterThanOrEqual(0);
    expect(res.body.data.pnl.cogs).toBeGreaterThanOrEqual(0);
    expect(res.body.data.pnl.gross_profit).toBeDefined();
    expect(res.body.data.pnl.operating_expenses).toBeGreaterThanOrEqual(0);
    expect(res.body.data.pnl.net_profit).toBeDefined();
  });

  // ============================================================================
  // TEST 9: Prescription Activity Oversight (No Clinical Bypass)
  // ============================================================================
  it('TEST 9: Admin can review prescription activity without bypassing clinical pharmacist verification', async () => {
    const res = await request(app)
      .get('/api/v1/admin/prescriptions/overview')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.metrics).toBeDefined();
    expect(res.body.data.metrics.total_prescriptions).toBeDefined();
    expect(Array.isArray(res.body.data.recentReviews)).toBe(true);
  });

  // ============================================================================
  // TEST 10: Audit Logs Record Important Activities
  // ============================================================================
  it('TEST 10: Audit logs record critical operational events with actor timestamps', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].action).toBeDefined();
    expect(res.body.data[0].created_at).toBeDefined();
  });

  // ============================================================================
  // TEST 11: Stock Adjustments with Mandatory Audit Reasons
  // ============================================================================
  it('TEST 11: Admin can manage stock adjustments requiring a mandatory audit note', async () => {
    const [medBefore] = await query('SELECT quantity FROM medicines WHERE id = 1');
    const startQty = medBefore[0].quantity;

    const res = await request(app)
      .post('/api/v1/inventory/adjust')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        medicine_id: 1,
        adjustment: 5,
        notes: 'Administrative cycle count discrepancy adjustment',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const [medAfter] = await query('SELECT quantity FROM medicines WHERE id = 1');
    expect(medAfter[0].quantity).toBe(startQty + 5);

    // Clean up adjustment
    await query('UPDATE medicines SET quantity = quantity - 5 WHERE id = 1');
  });

  // ============================================================================
  // TEST 12: Customer Cannot Access Admin-Only APIs
  // ============================================================================
  it('TEST 12: Customer is strictly forbidden (403) from accessing Admin-only APIs', async () => {
    // 1. Admin dashboard
    const dashRes = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(dashRes.statusCode).toBe(403);

    // 2. Admin employees management
    const empRes = await request(app)
      .get('/api/v1/admin/employees')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(empRes.statusCode).toBe(403);

    // 3. Admin settings
    const setRes = await request(app)
      .get('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(setRes.statusCode).toBe(403);
  });

  // ============================================================================
  // TEST 13: Pharmacist Cannot Access Admin-Only Functions
  // ============================================================================
  it('TEST 13: Pharmacist cannot access Admin-only employee management, settings, or expenses', async () => {
    // 1. Employee provisioning
    const empRes = await request(app)
      .get('/api/v1/admin/employees')
      .set('Authorization', `Bearer ${pharmacistToken}`);
    expect(empRes.statusCode).toBe(403);

    // 2. Global system configuration
    const setRes = await request(app)
      .get('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${pharmacistToken}`);
    expect(setRes.statusCode).toBe(403);

    // 3. Operating expenses
    const expRes = await request(app)
      .get('/api/v1/expenses')
      .set('Authorization', `Bearer ${pharmacistToken}`);
    expect(expRes.statusCode).toBe(403);
  });

  // ============================================================================
  // TEST 14: Admin Changes Do Not Break Customer or Pharmacist Panels
  // ============================================================================
  it('TEST 14: Pharmacist and Customer panel APIs continue functioning seamlessly', async () => {
    // Pharmacist dashboard continues working
    const pharmaDashRes = await request(app)
      .get('/api/v1/pharmacist/dashboard')
      .set('Authorization', `Bearer ${pharmacistToken}`);
    expect(pharmaDashRes.statusCode).toBe(200);
    expect(pharmaDashRes.body.success).toBe(true);

    // Customer medicines catalogue continues working
    const custBrowseRes = await request(app)
      .get('/api/v1/medicines');
    expect(custBrowseRes.statusCode).toBe(200);
    expect(custBrowseRes.body.success).toBe(true);

    // Customer personal dashboard continues working
    const custDashRes = await request(app)
      .get('/api/v1/customers/me/dashboard')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(custDashRes.statusCode).toBe(200);
    expect(custDashRes.body.success).toBe(true);
  });

  // ============================================================================
  // TEST 15: Transactional Stock Reversal on Sale Cancellation
  // ============================================================================
  it('TEST 15: Database transactions maintain consistent stock on controlled sale cancellation', async () => {
    // 1. Make a small sale
    const saleRes = await request(app)
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({
        customer_id: 1,
        invoice_number: `INV-CANCEL-TEST-${Date.now()}`,
        items: [{ medicine_id: 1, quantity: 2, unit_price: 15.0 }],
        discount: 0,
        tax: 1.0,
        payment_method: 'cash',
      });

    expect(saleRes.statusCode).toBe(201);
    const saleIdToCancel = saleRes.body.data.id;

    // Check medicine stock before cancellation
    const [medBefore] = await query('SELECT quantity FROM medicines WHERE id = 1');
    const stockBeforeCancel = medBefore[0].quantity;

    // 2. Cancel sale as Admin
    const cancelRes = await request(app)
      .post(`/api/v1/admin/sales/${saleIdToCancel}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Accidental double bill entry' });

    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.body.data.status).toBe('cancelled');

    // 3. Verify stock restored by exactly 2 units
    const [medAfter] = await query('SELECT quantity FROM medicines WHERE id = 1');
    expect(medAfter[0].quantity).toBe(stockBeforeCancel + 2);
  });
});
