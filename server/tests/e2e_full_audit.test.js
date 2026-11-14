const request = require('supertest');
const app = require('../src/app');
const { connectDB, disconnectDB, query } = require('../src/config/db');

describe('Full E2E Audit: Cross-Panel Workflow & FEFO Dispensing', () => {
  let adminToken;
  let pharmacistToken;
  let customerToken;
  let testMedicineId;
  let testBatchId;
  let testOrderId;
  let testOrderNumber;
  let testPrescriptionId;
  let testCustomerId;

  beforeAll(async () => {
    await connectDB();

    // 1. Authenticate Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@medistock.com', password: 'Admin@123' });
    adminToken = adminRes.body.data.token;

    // 2. Authenticate Pharmacist
    const pharmRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'pharmacist@medistock.com', password: 'Pharmacist@123' });
    pharmacistToken = pharmRes.body.data.token;

    // 3. Authenticate Customer
    const custRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'customer@medistock.com', password: 'Customer@123' });
    customerToken = custRes.body.data.token;

    // Ensure customer record exists
    const [custRows] = await query('SELECT id FROM customers WHERE email = ?', ['customer@medistock.com']);
    if (custRows.length > 0) {
      testCustomerId = custRows[0].id;
    } else {
      const [newCust] = await query(
        'INSERT INTO customers (customer_name, email, phone, address) VALUES (?, ?, ?, ?)',
        ['Test Audit Customer', 'customer@medistock.com', '+1-555-0199', '42 Baker Street, London']
      );
      testCustomerId = newCust.insertId;
    }
  });

  afterAll(async () => {
    // Cleanup created test records
    if (testMedicineId) {
      await query('DELETE FROM sale_items WHERE medicine_id = ?', [testMedicineId]);
      await query('DELETE FROM stock_movements WHERE medicine_id = ?', [testMedicineId]);
      await query('DELETE FROM medicine_batches WHERE medicine_id = ?', [testMedicineId]);
    }
    if (testOrderNumber) {
      const [sales] = await query('SELECT id FROM sales WHERE invoice_number = ?', [`INV-${testOrderNumber}`]);
      for (const s of sales) {
        await query('DELETE FROM returns WHERE sale_id = ?', [s.id]);
        await query('DELETE FROM payments WHERE sale_id = ?', [s.id]);
        await query('DELETE FROM sale_items WHERE sale_id = ?', [s.id]);
        await query('DELETE FROM sales WHERE id = ?', [s.id]);
      }
    }
    if (testOrderId) {
      await query('DELETE FROM order_items WHERE order_id = ?', [testOrderId]);
      await query('DELETE FROM orders WHERE id = ?', [testOrderId]);
    }
    if (testPrescriptionId) {
      await query('DELETE FROM prescriptions WHERE id = ?', [testPrescriptionId]);
    }
    if (testMedicineId) {
      await query('DELETE FROM medicines WHERE id = ?', [testMedicineId]);
    }
    await disconnectDB();
  });

  test('Step 1: Admin creates a formulation and initial batch in MySQL', async () => {
    const medRes = await request(app)
      .post('/api/v1/medicines')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        medicine_name: 'Audit-Cillin 500mg',
        generic_name: 'Amoxicillin Trihydrate',
        category: 'Antibiotics',
        dosage_form: 'Capsule',
        strength: '500mg',
        manufacturer: 'DeepMind Pharma Labs',
        selling_price: 24.50,
        mrp: 30.00,
        purchase_price: 15.00,
        quantity: 100,
        batch_number: 'BATCH-AUDIT-001',
        expiry_date: '2028-12-31',
        is_prescription_required: 1,
      });

    expect(medRes.status).toBe(201);
    expect(medRes.body.data).toHaveProperty('id');
    testMedicineId = medRes.body.data.id;

    // Verify batch was created
    const [batches] = await query('SELECT * FROM medicine_batches WHERE medicine_id = ?', [testMedicineId]);
    expect(batches.length).toBeGreaterThan(0);
    expect(Number(batches[0].quantity)).toBe(100);
    testBatchId = batches[0].id;
  });

  test('Step 2: Customer searches medicine catalog and uploads prescription', async () => {
    // Search
    const searchRes = await request(app)
      .get('/api/v1/medicines?search=Audit-Cillin')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.length).toBeGreaterThan(0);
    const foundMed = searchRes.body.data.find(m => m.id === testMedicineId);
    expect(foundMed).toBeDefined();

    // Upload prescription record
    const [pResult] = await query(
      `INSERT INTO prescriptions (customer_id, doctor_name, notes, file_path, original_filename, file_type, file_size, status)
       VALUES (?, 'Dr. Watson MD', 'Acute Pharyngitis - 1 cap TID', 'uploads/prescriptions/audit_rx.pdf', 'audit_rx.pdf', 'application/pdf', 24500, 'pending')`,
      [testCustomerId]
    );
    testPrescriptionId = pResult.insertId;
    expect(testPrescriptionId).toBeDefined();
  });

  test('Step 3: Customer places an online prescription order', async () => {
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        customer_id: testCustomerId,
        prescription_id: testPrescriptionId,
        order_type: 'delivery',
        delivery_address: '42 Baker Street, London',
        items: [
          {
            medicine_id: testMedicineId,
            quantity: 5,
            unit_price: 24.50,
          },
        ],
        subtotal: 122.50,
        discount: 0,
        tax: 6.13,
        total_amount: 128.63,
        payment_method: 'card',
      });

    expect(orderRes.status).toBe(201);
    expect(orderRes.body.data).toHaveProperty('id');
    testOrderId = orderRes.body.data.id;
    testOrderNumber = orderRes.body.data.order_number;
  });

  test('Step 4: Pharmacist reviews and approves prescription with clinical remarks', async () => {
    const approveRes = await request(app)
      .put(`/api/v1/prescriptions/${testPrescriptionId}/status`)
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({
        status: 'approved',
        remarks: 'Dosage verified against adult guidelines. Safe to dispense.',
      });

    expect(approveRes.status).toBe(200);

    const [rx] = await query('SELECT * FROM prescriptions WHERE id = ?', [testPrescriptionId]);
    expect(rx[0].status).toBe('approved');
    expect(rx[0].verified_by).toBeDefined();
  });

  test('Step 5: Pharmacist fulfills order with atomic FEFO batch dispensing', async () => {
    const fulfillRes = await request(app)
      .put(`/api/v1/orders/${testOrderId}/status`)
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({
        status: 'delivered',
        notes: 'Dispensed and handed over to courier.',
      });

    expect(fulfillRes.status).toBe(200);

    // 1. Verify batch stock was depleted (100 - 5 = 95)
    const [batches] = await query('SELECT * FROM medicine_batches WHERE id = ?', [testBatchId]);
    expect(Number(batches[0].quantity)).toBe(95);

    // 2. Verify medicine master quantity was depleted (100 - 5 = 95)
    const [meds] = await query('SELECT * FROM medicines WHERE id = ?', [testMedicineId]);
    expect(Number(meds[0].quantity)).toBe(95);

    // 3. Verify stock movement was recorded
    const [movements] = await query(
      'SELECT * FROM stock_movements WHERE medicine_id = ? AND movement_type = "sale"',
      [testMedicineId]
    );
    expect(movements.length).toBeGreaterThan(0);
    expect(Number(movements[0].quantity)).toBe(5);

    // 4. Verify linked sales invoice was created
    const [sales] = await query('SELECT * FROM sales WHERE invoice_number = ?', [`INV-${testOrderNumber}`]);
    expect(sales.length).toBe(1);
    expect(Number(sales[0].total_amount)).toBeCloseTo(128.63, 1);

    // 5. Verify prescription was marked dispensed
    const [rx] = await query('SELECT * FROM prescriptions WHERE id = ?', [testPrescriptionId]);
    expect(rx[0].status).toBe('dispensed');

    // 6. Verify customer payment was recorded
    const [payments] = await query('SELECT * FROM payments WHERE sale_id = ?', [sales[0].id]);
    expect(payments.length).toBe(1);
    expect(payments[0].payment_status).toBe('completed');
  });

  test('Step 6: Customer can access the resulting invoice and payments', async () => {
    const invoicesRes = await request(app)
      .get('/api/v1/sales')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(invoicesRes.status).toBe(200);
    expect(Array.isArray(invoicesRes.body.data)).toBe(true);

    const paymentsRes = await request(app)
      .get('/api/v1/payments')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(paymentsRes.status).toBe(200);
    expect(paymentsRes.body.data.length).toBeGreaterThan(0);
  });
});
