require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB, getPool, transaction } = require('../src/config/db');
const { migrateBaseSchema } = require('../src/config/migrate_base_schema');
const logger = require('../src/utils/logger');

const seedDatabase = async () => {
  try {
    logger.info('Starting MediStock MySQL database seeding...');
    await connectDB();
    await migrateBaseSchema();

    const adminPasswordPlain = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
    const pharmaPasswordPlain = process.env.SEED_PHARMACIST_PASSWORD || 'Pharmacist@123';
    const custPasswordPlain = process.env.SEED_CUSTOMER_PASSWORD || 'Customer@123';

    const salt = await bcrypt.genSalt(10);
    const adminPass = await bcrypt.hash(adminPasswordPlain, salt);
    const pharmaPass = await bcrypt.hash(pharmaPasswordPlain, salt);
    const custPass = await bcrypt.hash(custPasswordPlain, salt);

    await transaction(async (conn) => {
      // 1. Seed Users (check each user individually to avoid skipping if any user exists)
      logger.info('Checking and seeding demo users (admin, pharmacist, customer)...');
      
      const [adminExists] = await conn.execute('SELECT id, role FROM users WHERE email = ?', ['admin@medistock.com']);
      let adminId = adminExists[0]?.id;
      if (!adminId) {
        const [res] = await conn.execute(
          `INSERT INTO users (employee_id, name, email, password, role, status) VALUES
           ('EMP-ADM-001', 'System Administrator', 'admin@medistock.com', ?, 'admin', 'active')`,
          [adminPass]
        );
        adminId = res.insertId;
        logger.info('Admin user seeded: admin@medistock.com');
      } else {
        await conn.execute(
          `UPDATE users SET role = 'admin', employee_id = COALESCE(employee_id, 'EMP-ADM-001'), status = 'active', password = ? WHERE id = ?`,
          [adminPass, adminId]
        );
        logger.info('Admin user verified and synchronized: admin@medistock.com (role=admin)');
      }

      const [pharmaExists] = await conn.execute('SELECT id, role FROM users WHERE email = ?', ['pharmacist@medistock.com']);
      let pharmaId = pharmaExists[0]?.id;
      if (!pharmaId) {
        const [res] = await conn.execute(
          `INSERT INTO users (employee_id, name, email, password, role, status) VALUES
           ('EMP-PHR-001', 'Lead Pharmacist Sarah', 'pharmacist@medistock.com', ?, 'pharmacist', 'active')`,
          [pharmaPass]
        );
        pharmaId = res.insertId;
        logger.info('Pharmacist user seeded: pharmacist@medistock.com');
      } else {
        await conn.execute(
          `UPDATE users SET role = 'pharmacist', employee_id = COALESCE(employee_id, 'EMP-PHR-001'), status = 'active', password = ? WHERE id = ?`,
          [pharmaPass, pharmaId]
        );
        logger.info('Pharmacist user verified and synchronized: pharmacist@medistock.com (role=pharmacist)');
      }

      const [custExists] = await conn.execute('SELECT id, role FROM users WHERE email = ?', ['customer@medistock.com']);
      let customerUserId = custExists[0]?.id;
      if (!customerUserId) {
        const [res] = await conn.execute(
          `INSERT INTO users (name, email, password, role, status) VALUES
           ('Customer Michael Clark', 'customer@medistock.com', ?, 'customer', 'active')`,
          [custPass]
        );
        customerUserId = res.insertId;
        logger.info('Customer user seeded: customer@medistock.com');
      } else {
        await conn.execute(
          `UPDATE users SET role = 'customer', status = 'active', password = ? WHERE id = ?`,
          [custPass, customerUserId]
        );
        logger.info('Customer user verified: customer@medistock.com (role=customer)');
      }

      // 2. Seed Categories
      const [catCount] = await conn.execute('SELECT COUNT(*) AS count FROM categories');
      if (catCount[0].count === 0) {
        logger.info('Seeding categories...');
        await conn.execute(
          `INSERT INTO categories (category_name, description) VALUES
           ('Antibiotics', 'Antimicrobial medicines used in the treatment and prevention of bacterial infections'),
           ('Analgesics & Pain Relief', 'Medications designed specifically to relieve pain'),
           ('Antipyretics', 'Fever reducing medications'),
           ('Cardiovascular', 'Drugs used to treat conditions of the heart or the circulatory or vascular system'),
           ('Gastrointestinal', 'Medicines that treat stomach and bowel disorders'),
           ('Vitamins & Supplements', 'Nutritional support products and essential minerals')`
        );
      }

      // 3. Seed Suppliers
      const [supCount] = await conn.execute('SELECT COUNT(*) AS count FROM suppliers');
      if (supCount[0].count === 0) {
        logger.info('Seeding suppliers...');
        await conn.execute(
          `INSERT INTO suppliers (supplier_name, contact_person, phone, email, address) VALUES
           ('PharmaCorp Healthcare', 'David Vance', '+1-555-0192', 'orders@pharmacorp.com', '100 Industrial Parkway, NJ'),
           ('Apex Lifesciences', 'Elena Rostova', '+1-555-0144', 'supply@apexlifesci.com', '45 Science Park Drive, MA'),
           ('MedLife Global Distributors', 'Rajesh Patel', '+1-555-0177', 'sales@medlifeglobal.com', '78 Pharma Boulevard, TX')`
        );
      }

      // 4. Seed Customers
      const [custCount] = await conn.execute('SELECT COUNT(*) AS count FROM customers');
      let customerRecordId = null;
      if (custCount[0].count === 0) {
        logger.info('Seeding customers...');
        const [res] = await conn.execute(
          `INSERT INTO customers (user_id, customer_name, phone, email, address) VALUES
           (?, 'Michael Clark', '+1-555-0211', 'customer@medistock.com', '12 Elm Street, Springfield'),
           (NULL, 'Emily Johnson', '+1-555-0233', 'emily.j@example.com', '45 Oak Avenue, Riverside'),
           (NULL, 'David Miller', '+1-555-0255', 'david.m@example.com', '89 Pine Road, Brookline')`,
          [customerUserId]
        );
        customerRecordId = res.insertId;
      } else {
        const [existingCust] = await conn.execute('SELECT id FROM customers WHERE email = ?', ['customer@medistock.com']);
        customerRecordId = existingCust[0]?.id;
      }

      // 5. Seed Medicines
      const [medCount] = await conn.execute('SELECT COUNT(*) AS count FROM medicines');
      if (medCount[0].count === 0) {
        logger.info('Seeding medicines catalog...');
        const medicinesList = [
          ['Paracetamol 500mg', 'Antipyretics', 'GSK Health', 'BATCH-PR500-01', 120, 2.50, 4.00, '2027-12-31'],
          ['Amoxicillin 500mg', 'Antibiotics', 'Pfizer Inc', 'BATCH-AMX-02', 80, 5.00, 8.50, '2026-11-30'],
          ['Omeprazole 20mg', 'Gastrointestinal', 'AstraZeneca', 'BATCH-OMP-03', 50, 4.00, 7.00, '2027-06-30'],
          ['Atorvastatin 10mg', 'Cardiovascular', 'Novartis', 'BATCH-ATV-04', 60, 6.50, 11.00, '2027-08-31'],
          ['Ibuprofen 400mg', 'Analgesics & Pain Relief', 'Abbott Pharma', 'BATCH-IBU-05', 100, 3.00, 5.50, '2026-12-31'],
          ['Vitamin C 1000mg', 'Vitamins & Supplements', 'Bayer Healthcare', 'BATCH-VTC-06', 75, 4.20, 7.50, '2028-01-31'],
          ['Cetirizine 10mg', 'Analgesics & Pain Relief', 'Cipla Health', 'BATCH-CTZ-07', 8, 1.80, 3.20, '2026-05-15'],
          ['Azithromycin 250mg', 'Antibiotics', 'Sun Pharma', 'BATCH-AZM-08', 5, 8.00, 14.00, '2026-04-30'],
        ];

        for (const m of medicinesList) {
          const [res] = await conn.execute(
            `INSERT INTO medicines (medicine_name, category, manufacturer, batch_number, quantity, purchase_price, selling_price, expiry_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            m
          );
          const medId = res.insertId;

          await conn.execute(
            `INSERT INTO stock_movements (medicine_id, movement_type, quantity, reference_type, reference_id, notes)
             VALUES (?, 'adjustment', ?, 'initial_seed', ?, 'Initial system seed stock')`,
            [medId, m[4], medId]
          );
        }
      }

      // 6. Seed Purchases
      const [purCount] = await conn.execute('SELECT COUNT(*) AS count FROM purchases');
      if (purCount[0].count === 0) {
        logger.info('Seeding purchase order and purchase items...');
        const [purRes] = await conn.execute(
          `INSERT INTO purchases (supplier_id, invoice_number, purchase_date, total_amount)
           VALUES (1, 'PUR-2026-0001', '2026-11-01', 500.00)`
        );
        const purchaseId = purRes.insertId;
        await conn.execute(
          `INSERT INTO purchase_items (purchase_id, medicine_id, quantity, unit_cost, subtotal)
           VALUES (?, 1, 100, 2.50, 250.00), (?, 2, 50, 5.00, 250.00)`,
          [purchaseId, purchaseId]
        );
      }

      // 7. Seed Sales
      const [saleCount] = await conn.execute('SELECT COUNT(*) AS count FROM sales');
      if (saleCount[0].count === 0 && customerRecordId) {
        logger.info('Seeding sales and sale items...');
        const [saleRes] = await conn.execute(
          `INSERT INTO sales (customer_id, invoice_number, sale_date, subtotal, discount, tax, total_amount, payment_method)
           VALUES (?, 'INV-2026-0001', '2026-11-08', 33.50, 2.00, 1.50, 33.00, 'cash')`,
          [customerRecordId]
        );
        const saleId = saleRes.insertId;
        await conn.execute(
          `INSERT INTO sale_items (sale_id, medicine_id, quantity, unit_price, subtotal)
           VALUES (?, 1, 2, 4.00, 8.00), (?, 2, 3, 8.50, 25.50)`,
          [saleId, saleId]
        );
        await conn.execute(
          `INSERT INTO payments (sale_id, amount, payment_method, payment_status)
           VALUES (?, 33.00, 'cash', 'completed')`,
          [saleId]
        );
      }

      // 8. Seed Expenses
      const [expCount] = await conn.execute('SELECT COUNT(*) AS count FROM expenses');
      if (expCount[0].count === 0) {
        logger.info('Seeding expenses...');
        await conn.execute(
          `INSERT INTO expenses (expense_title, category, amount, expense_date, description) VALUES
           ('Monthly Pharmacy Rent', 'Rent & Facilities', 1500.00, '2026-11-01', 'Storefront lease for November 2026'),
           ('Electricity & Refrigeration', 'Utilities', 320.50, '2026-11-05', 'Cooling storage electricity bill'),
           ('POS Receipt Rolls & Supplies', 'Office Supplies', 65.00, '2026-11-07', 'Thermal paper rolls for checkout printers')`
        );
      }

      // 9. Seed Prescriptions
      const [rxCount] = await conn.execute('SELECT COUNT(*) AS count FROM prescriptions');
      if (rxCount[0].count === 0 && customerRecordId && customerUserId) {
        logger.info('Seeding sample prescriptions...');
        await conn.execute(
          `INSERT INTO prescriptions (customer_id, user_id, doctor_name, prescription_date, notes, status)
           VALUES (?, ?, 'Dr. Robert Harrison, MD', '2026-11-07', 'Prescribed Amoxicillin 500mg twice daily for 7 days', 'approved')`,
          [customerRecordId, customerUserId]
        );
      }

      // 10. Audit log for seeding
      const [auditCount] = await conn.execute("SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'SYSTEM_SEEDED'");
      if (auditCount[0].count === 0 && adminId) {
        await conn.execute(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
           VALUES (?, 'SYSTEM_SEEDED', 'system', 1, 'Initial MediStock database seeded with demo master data')`,
          [adminId]
        );
      }
    });

    logger.success('✅ Database seeded / verified successfully!');
    if (process.env.NODE_ENV !== 'production') {
      logger.info('Demo Credentials (Development only):');
      logger.info(`  Admin:       admin@medistock.com / ${adminPasswordPlain}`);
      logger.info(`  Pharmacist:  pharmacist@medistock.com / ${pharmaPasswordPlain}`);
      logger.info(`  Customer:    customer@medistock.com / ${custPasswordPlain}`);
    } else {
      logger.info('Default demo users provisioned securely. Passwords configured via environment variables.');
    }
  } catch (error) {
    logger.error('Database seeding failed:', error.message);
    throw error;
  }
};

if (require.main === module) {
  seedDatabase()
    .then(async () => {
      await disconnectDB();
      process.exit(0);
    })
    .catch(async () => {
      await disconnectDB();
      process.exit(1);
    });
}

module.exports = { seedDatabase };
