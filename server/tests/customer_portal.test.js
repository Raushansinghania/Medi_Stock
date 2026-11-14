const request = require('supertest');
const app = require('../src/app');
const { connectDB, disconnectDB, query } = require('../src/config/db');

describe('MediStock Customer Portal Integration Suite', () => {
  let customerToken = '';
  let pharmacistToken = '';
  let adminToken = '';
  let createdOrderId = null;
  let sampleNotificationId = null;

  beforeAll(async () => {
    await connectDB();

    // Customer login
    const custRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'customer@medistock.com', password: 'Customer@123' });
    customerToken = custRes.body.data.token;

    // Pharmacist login
    const pharmaRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'pharmacist@medistock.com', password: 'Pharmacist@123' });
    pharmacistToken = pharmaRes.body.data.token;

    // Admin login
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@medistock.com', password: 'Admin@123' });
    adminToken = adminRes.body.data.token;
  });

  afterAll(async () => {
    await disconnectDB();
  });

  // ============================================================================
  // 1. MEDICINE SEARCH (PROBLEM 1 FIX VERIFICATION)
  // ============================================================================
  describe('1. Medicine Search & Catalogue', () => {
    it('GET /api/v1/medicines?search=Paracetamol should return matching medicines', async () => {
      const res = await request(app)
        .get('/api/v1/medicines?search=Paracetamol')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const item = res.body.data.find((m) =>
        (m.medicine_name || m.name || '').toLowerCase().includes('paracetamol')
      );
      expect(item).toBeDefined();
      expect(item.medicine_name || item.name).toContain('Paracetamol');
      // Stock status should be present
      expect(item.stock_status).toBeDefined();
      // Confidential purchase price must NOT be exposed to customer
      expect(item.purchase_price).toBeUndefined();
    });

    it('GET /api/v1/medicines?search=paracetamol should perform case-insensitive search', async () => {
      const res = await request(app)
        .get('/api/v1/medicines?search=paracetamol')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/medicines/suggestions?q=para should return suggestions list', async () => {
      const res = await request(app)
        .get('/api/v1/medicines/suggestions?q=para')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/medicines?search=NonExistentMedicineXyz should return empty array without error', async () => {
      const res = await request(app)
        .get('/api/v1/medicines?search=NonExistentMedicineXyz')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(0);
    });
  });

  // ============================================================================
  // 2. RBAC & DATA ISOLATION (PROBLEM 2 FIX VERIFICATION)
  // ============================================================================
  describe('2. RBAC & Security Isolation', () => {
    it('Customer should be FORBIDDEN (403) from accessing admin stats /api/v1/dashboard/stats', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Customer CAN access their own dashboard telemetry /api/v1/customers/me/dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/customers/me/dashboard')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile).toBeDefined();
      expect(res.body.data.stats).toBeDefined();
      expect(res.body.data.stats.totalOrders).toBeDefined();
      expect(res.body.data.stats.totalPrescriptions).toBeDefined();
    });

    it('Customer can retrieve own profile /api/v1/customers/me/profile', async () => {
      const res = await request(app)
        .get('/api/v1/customers/me/profile')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('customer@medistock.com');
    });

    it('Customer can update profile details /api/v1/customers/me/profile', async () => {
      const res = await request(app)
        .put('/api/v1/customers/me/profile')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Jane Customer Updated',
          phone: '+91 98765 43210',
          address: '45 Health Avenue, Medical City',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.name).toBe('Jane Customer Updated');
    });
  });

  // ============================================================================
  // 3. ORDERS & CHECKOUT WORKFLOW
  // ============================================================================
  describe('3. Customer Orders & Checkout', () => {
    let targetMedicine = null;

    beforeAll(async () => {
      const medRes = await request(app)
        .get('/api/v1/medicines?search=Paracetamol')
        .set('Authorization', `Bearer ${customerToken}`);
      targetMedicine = medRes.body.data[0];
    });

    it('POST /api/v1/orders should create an order from cart items', async () => {
      expect(targetMedicine).toBeDefined();

      const orderPayload = {
        order_type: 'delivery',
        delivery_address: '45 Health Avenue, Medical City',
        payment_method: 'upi',
        items: [
          {
            medicine_id: targetMedicine.id,
            quantity: 2,
            unit_price: targetMedicine.selling_price || 15.0,
          },
        ],
        notes: 'Please leave at front door',
      };

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderPayload);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.order_number).toBeDefined();
      expect(res.body.data.status).toBe('pending');
      createdOrderId = res.body.data.id;
    });

    it('GET /api/v1/orders should list orders belonging to the customer', async () => {
      const res = await request(app)
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/orders/:id should retrieve order tracking details', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdOrderId);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });

    it('PUT /api/v1/orders/:id/cancel should cancel a pending order', async () => {
      const res = await request(app)
        .put(`/api/v1/orders/${createdOrderId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Changed my mind' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('cancelled');
    });
  });

  // ============================================================================
  // 4. NOTIFICATIONS
  // ============================================================================
  describe('4. Notifications Center', () => {
    it('GET /api/v1/notifications/my should return customer notifications', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/my')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.notifications)).toBe(true);
      if (res.body.data.notifications.length > 0) {
        sampleNotificationId = res.body.data.notifications[0].id;
      }
    });

    it('PUT /api/v1/notifications/:id/read should mark notification as read', async () => {
      if (sampleNotificationId) {
        const res = await request(app)
          .put(`/api/v1/notifications/${sampleNotificationId}/read`)
          .set('Authorization', `Bearer ${customerToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
      }
    });

    it('PUT /api/v1/notifications/read-all should mark all as read', async () => {
      const res = await request(app)
        .put('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ============================================================================
  // 5. PRESCRIPTIONS WORKFLOW
  // ============================================================================
  describe('5. Prescription Review & Approval Workflow', () => {
    let testPrescriptionId = null;

    beforeAll(async () => {
      const [rows] = await query(
        'SELECT id, status FROM prescriptions ORDER BY id DESC LIMIT 1'
      );
      if (rows && rows.length > 0) {
        testPrescriptionId = rows[0].id;
      }
    });

    it('GET /api/v1/prescriptions should return customer prescriptions', async () => {
      const res = await request(app)
        .get('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('Pharmacist can approve/verify a prescription with PUT /api/v1/prescriptions/:id/status', async () => {
      if (testPrescriptionId) {
        const res = await request(app)
          .put(`/api/v1/prescriptions/${testPrescriptionId}/status`)
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .send({ status: 'verified' });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(['verified', 'approved']).toContain(res.body.data.status);
      }
    });

    it('Customer cannot approve/verify prescription (requires pharmacist/admin)', async () => {
      if (testPrescriptionId) {
        const res = await request(app)
          .put(`/api/v1/prescriptions/${testPrescriptionId}/status`)
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ status: 'verified' });

        expect(res.statusCode).toBe(403);
      }
    });
  });
});
