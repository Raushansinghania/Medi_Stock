require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB, getPool, transaction } = require('../src/config/db');
const logger = require('../src/utils/logger');

const seedDatabase = async () => {
  try {
    logger.info('Starting MediStock MySQL database seeding...');
    await connectDB();
    const pool = getPool();

    // Check if users table already has data
    const [existingUsers] = await pool.query('SELECT COUNT(*) AS count FROM users');
    if (existingUsers[0].count > 0) {
      logger.warn('Database already contains user records. Skipping full reseed to prevent duplicate data.');
      await disconnectDB();
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const adminPass = await bcrypt.hash('Admin@123', salt);
    const pharmaPass = await bcrypt.hash('Pharmacist@123', salt);
    const custPass = await bcrypt.hash('Customer@123', salt);

    await transaction(async (conn) => {
      // 1. Seed Users
      logger.info('Seeding users (admin, pharmacist, customer)...');
      await conn.execute(
        `INSERT INTO users (name, email, password, role) VALUES
         ('System Administrator', 'admin@medistock.com', ?, 'admin'),
         ('Lead Pharmacist Sarah', 'pharmacist@medistock.com', ?, 'pharmacist'),
         ('Customer Michael Clark', 'customer@medistock.com', ?, 'customer')`,
        [adminPass, pharmaPass, custPass]
      );

      // 2. Seed Categories
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

      // 3. Seed Suppliers
      logger.info('Seeding suppliers...');
      await conn.execute(
        `INSERT INTO suppliers (supplier_name, contact_person, phone, email, address) VALUES
         ('PharmaCorp Healthcare', 'David Vance', '+1-555-0192', 'orders@pharmacorp.com', '100 Industrial Parkway, NJ'),
         ('Apex Lifesciences', 'Elena Rostova', '+1-555-0144', 'supply@apexlifesci.com', '45 Science Park Drive, MA'),
         ('MedLife Global Distributors', 'Rajesh Patel', '+1-555-0177', 'sales@medlifeglobal.com', '78 Pharma Boulevard, TX')`
      );

      // 4. Seed Customers
      logger.info('Seeding customers...');
      await conn.execute(
        `INSERT INTO customers (customer_name, phone, email, address) VALUES
         ('Michael Clark', '+1-555-0211', 'customer@medistock.com', '12 Elm Street, Springfield'),
         ('Emily Johnson', '+1-555-0233', 'emily.j@example.com', '45 Oak Avenue, Riverside'),
         ('David Miller', '+1-555-0255', 'david.m@example.com', '89 Pine Road, Brookline')`
      );

      // 5. Seed Medicines
      logger.info('Seeding medicines catalog...');
      const medicinesList = [
        ['Paracetamol 500mg', 'Antipyretics', 'GSK Health', 'BATCH-PR500-01', 120, 2.50, 4.00, '2027-12-31'],
        ['Amoxicillin 500mg', 'Antibiotics', 'Pfizer Inc', 'BATCH-AMX-02', 80, 5.00, 8.50, '2026-11-30'],
        ['Omeprazole 20mg', 'Gastrointestinal', 'AstraZeneca', 'BATCH-OMP-03', 50, 4.00, 7.00, '2027-06-30'],
        ['Atorvastatin 10mg', 'Cardiovascular', 'Novartis', 'BATCH-ATV-04', 60, 6.50, 11.00, '2027-08-31'],
        ['Ibuprofen 400mg', 'Analgesics & Pain Relief', 'Abbott Pharma', 'BATCH-IBU-05', 100, 3.00, 5.50, '2026-12-31'],
        ['Vitamin C 1000mg', 'Vitamins & Supplements', 'Bayer Healthcare', 'BATCH-VTC-06', 75, 4.20, 7.50, '2028-01-31'],
        ['Cetirizine 10mg', 'Analgesics & Pain Relief', 'Cipla Health', 'BATCH-CTZ-07', 8, 1.80, 3.20, '2026-05-15'], // Low stock demo
        ['Azithromycin 250mg', 'Antibiotics', 'Sun Pharma', 'BATCH-AZM-08', 5, 8.00, 14.00, '2026-04-30'], // Low stock demo
      ];

      for (const m of medicinesList) {
        const [res] = await conn.execute(
          `INSERT INTO medicines (medicine_name, category, manufacturer, batch_number, quantity, purchase_price, selling_price, expiry_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          m
        );
        const medId = res.insertId;

        // Stock movement for initial stock
        await conn.execute(
          `INSERT INTO stock_movements (medicine_id, movement_type, quantity, reference_type, reference_id, notes)
           VALUES (?, 'adjustment', ?, 'initial_seed', ?, 'Initial system seed stock')`,
          [medId, m[4], medId]
        );
      }

      // 6. Seed a sample purchase
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

      // 7. Seed sample sales
      logger.info('Seeding sales and sale items...');
      const [saleRes] = await conn.execute(
        `INSERT INTO sales (customer_id, invoice_number, sale_date, subtotal, discount, tax, total_amount, payment_method)
         VALUES (1, 'INV-2026-0001', '2026-11-08', 33.50, 2.00, 1.50, 33.00, 'cash')`
      );
      const saleId = saleRes.insertId;
      await conn.execute(
        `INSERT INTO sale_items (sale_id, medicine_id, quantity, unit_price, subtotal)
         VALUES (?, 1, 2, 4.00, 8.00), (?, 2, 3, 8.50, 25.50)`,
        [saleId, saleId]
      );

      // Seed payment for this sale
      await conn.execute(
        `INSERT INTO payments (sale_id, amount, payment_method, payment_status)
         VALUES (?, 33.00, 'cash', 'completed')`,
        [saleId]
      );

      // 8. Seed sample expenses
      logger.info('Seeding expenses...');
      await conn.execute(
        `INSERT INTO expenses (expense_title, category, amount, expense_date, description) VALUES
         ('Monthly Pharmacy Rent', 'Rent & Facilities', 1500.00, '2026-11-01', 'Storefront lease for November 2026'),
         ('Electricity & Refrigeration', 'Utilities', 320.50, '2026-11-05', 'Cooling storage electricity bill'),
         ('POS Receipt Rolls & Supplies', 'Office Supplies', 65.00, '2026-11-07', 'Thermal paper rolls for checkout printers')`
      );

      // 9. Seed sample prescription
      logger.info('Seeding sample prescriptions...');
      await conn.execute(
        `INSERT INTO prescriptions (customer_id, user_id, doctor_name, prescription_date, notes, status)
         VALUES (1, 3, 'Dr. Robert Harrison, MD', '2026-11-07', 'Prescribed Amoxicillin 500mg twice daily for 7 days', 'approved')`
      );

      // 10. Audit log for seeding
      await conn.execute(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES (1, 'SYSTEM_SEEDED', 'system', 1, 'Initial MediStock database seeded with demo master data')`
      );
    });

    logger.success('✅ Database seeded successfully with demo categories, medicines, suppliers, customers, sales, and accounts!');
    logger.info('Demo Credentials:');
    logger.info('  Admin:       admin@medistock.com / Admin@123');
    logger.info('  Pharmacist:  pharmacist@medistock.com / Pharmacist@123');
    logger.info('  Customer:    customer@medistock.com / Customer@123');

    await disconnectDB();
  } catch (error) {
    logger.error('Database seeding failed:', error.message);
    await disconnectDB();
    process.exit(1);
  }
};

seedDatabase();
