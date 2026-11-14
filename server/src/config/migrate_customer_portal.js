require('dotenv').config();
const { connectDB, disconnectDB, getPool } = require('./db');
const logger = require('../utils/logger');

const runMigration = async () => {
  try {
    await connectDB();
    const pool = getPool();
    logger.info('Starting Customer Portal Database Migration...');

    // Helper to check if column exists
    const columnExists = async (table, column) => {
      const [rows] = await pool.query(
        `SELECT COUNT(*) AS count FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
      );
      return rows[0].count > 0;
    };

    // 1. Upgrade `medicines` table
    logger.info('Upgrading medicines table schema...');
    if (!(await columnExists('medicines', 'dosage_form'))) {
      await pool.query(`ALTER TABLE medicines ADD COLUMN dosage_form VARCHAR(50) DEFAULT 'Tablet' AFTER category`);
    }
    if (!(await columnExists('medicines', 'strength'))) {
      await pool.query(`ALTER TABLE medicines ADD COLUMN strength VARCHAR(50) DEFAULT NULL AFTER dosage_form`);
    }
    if (!(await columnExists('medicines', 'composition'))) {
      await pool.query(`ALTER TABLE medicines ADD COLUMN composition TEXT DEFAULT NULL AFTER strength`);
    }
    if (!(await columnExists('medicines', 'description'))) {
      await pool.query(`ALTER TABLE medicines ADD COLUMN description TEXT DEFAULT NULL AFTER composition`);
    }
    if (!(await columnExists('medicines', 'is_prescription_required'))) {
      await pool.query(`ALTER TABLE medicines ADD COLUMN is_prescription_required TINYINT(1) DEFAULT 0 AFTER description`);
    }
    if (!(await columnExists('medicines', 'is_active'))) {
      await pool.query(`ALTER TABLE medicines ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER is_prescription_required`);
    }
    if (!(await columnExists('medicines', 'mrp'))) {
      await pool.query(`ALTER TABLE medicines ADD COLUMN mrp DECIMAL(10,2) DEFAULT NULL AFTER selling_price`);
    }
    if (!(await columnExists('medicines', 'discount_percent'))) {
      await pool.query(`ALTER TABLE medicines ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT 0.00 AFTER mrp`);
    }
    if (!(await columnExists('medicines', 'image_url'))) {
      await pool.query(`ALTER TABLE medicines ADD COLUMN image_url VARCHAR(255) DEFAULT NULL AFTER discount_percent`);
    }

    // 2. Upgrade `prescriptions` table
    logger.info('Upgrading prescriptions table schema...');
    if (!(await columnExists('prescriptions', 'rejection_reason'))) {
      await pool.query(`ALTER TABLE prescriptions ADD COLUMN rejection_reason TEXT DEFAULT NULL AFTER notes`);
    }
    if (!(await columnExists('prescriptions', 'verified_by'))) {
      await pool.query(`ALTER TABLE prescriptions ADD COLUMN verified_by INT DEFAULT NULL AFTER rejection_reason`);
    }
    if (!(await columnExists('prescriptions', 'verified_at'))) {
      await pool.query(`ALTER TABLE prescriptions ADD COLUMN verified_at TIMESTAMP NULL DEFAULT NULL AFTER verified_by`);
    }
    if (!(await columnExists('prescriptions', 'original_filename'))) {
      await pool.query(`ALTER TABLE prescriptions ADD COLUMN original_filename VARCHAR(255) DEFAULT NULL AFTER verified_at`);
    }
    if (!(await columnExists('prescriptions', 'file_path'))) {
      await pool.query(`ALTER TABLE prescriptions ADD COLUMN file_path VARCHAR(255) DEFAULT NULL AFTER original_filename`);
    }
    if (!(await columnExists('prescriptions', 'file_type'))) {
      await pool.query(`ALTER TABLE prescriptions ADD COLUMN file_type VARCHAR(100) DEFAULT NULL AFTER file_path`);
    }
    if (!(await columnExists('prescriptions', 'file_size'))) {
      await pool.query(`ALTER TABLE prescriptions ADD COLUMN file_size INT DEFAULT NULL AFTER file_type`);
    }

    // 3. Upgrade `customers` table with user_id
    logger.info('Upgrading customers table schema...');
    if (!(await columnExists('customers', 'user_id'))) {
      await pool.query(`ALTER TABLE customers ADD COLUMN user_id INT NULL AFTER id`);
      // Link customer Michael Clark
      await pool.query(`UPDATE customers c JOIN users u ON c.email = u.email SET c.user_id = u.id WHERE c.user_id IS NULL`);
    }

    // 4. Create `orders` table
    logger.info('Creating orders table if not exists...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_number VARCHAR(100) NOT NULL UNIQUE,
        customer_id INT NULL,
        user_id INT NOT NULL,
        prescription_id INT NULL,
        order_type ENUM('pickup', 'delivery') DEFAULT 'pickup',
        delivery_address TEXT NULL,
        status ENUM('pending', 'awaiting_prescription', 'confirmed', 'processing', 'ready_for_collection', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
        subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        discount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        tax DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        payment_method VARCHAR(50) DEFAULT 'cash',
        payment_status ENUM('pending', 'successful', 'failed', 'refunded') DEFAULT 'pending',
        notes TEXT NULL,
        cancellation_reason TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_orders_user (user_id),
        INDEX idx_orders_customer (customer_id),
        INDEX idx_orders_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 5. Create `order_items` table
    logger.info('Creating order_items table if not exists...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        medicine_id INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        INDEX idx_order_items_order (order_id),
        INDEX idx_order_items_medicine (medicine_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 6. Create `notifications` table
    logger.info('Creating notifications table if not exists...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        type ENUM('prescription', 'order', 'payment', 'system', 'general') DEFAULT 'general',
        is_read TINYINT(1) DEFAULT 0,
        link VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notifications_user (user_id),
        INDEX idx_notifications_is_read (is_read)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 7. Enrich existing medicines with realistic healthcare metadata
    logger.info('Enriching sample medicine records...');
    const medicineEnhancements = [
      {
        id: 1,
        dosage_form: 'Tablet',
        strength: '500mg',
        composition: 'Paracetamol (Acetaminophen) 500mg',
        description: 'Commonly used analgesic and antipyretic medication used to treat fever and mild-to-moderate pain such as headaches, muscle aches, and colds.',
        is_prescription_required: 0,
        mrp: 5.00,
        discount_percent: 20.00
      },
      {
        id: 2,
        dosage_form: 'Capsule',
        strength: '500mg',
        composition: 'Amoxicillin Trihydrate 500mg',
        description: 'Broad-spectrum penicillin antibiotic used to treat bacterial infections of the respiratory tract, ear, nose, throat, skin, and urinary tract.',
        is_prescription_required: 1,
        mrp: 10.00,
        discount_percent: 15.00
      },
      {
        id: 3,
        dosage_form: 'Delayed-Release Capsule',
        strength: '20mg',
        composition: 'Omeprazole Magnesium 20mg',
        description: 'Proton pump inhibitor (PPI) that decreases the amount of acid produced in the stomach, treating GERD, peptic ulcer disease, and heartburn.',
        is_prescription_required: 0,
        mrp: 8.50,
        discount_percent: 17.50
      },
      {
        id: 4,
        dosage_form: 'Tablet',
        strength: '10mg',
        composition: 'Atorvastatin Calcium 10mg',
        description: 'Statin medication used to lower bad cholesterol (LDL) and triglycerides in the blood, and to decrease risk of cardiovascular disease.',
        is_prescription_required: 1,
        mrp: 13.00,
        discount_percent: 15.00
      },
      {
        id: 5,
        dosage_form: 'Film-Coated Tablet',
        strength: '400mg',
        composition: 'Ibuprofen 400mg',
        description: 'Nonsteroidal anti-inflammatory drug (NSAID) used for treating pain, fever, and inflammation caused by arthritis, headaches, or toothaches.',
        is_prescription_required: 0,
        mrp: 6.50,
        discount_percent: 15.00
      },
      {
        id: 6,
        dosage_form: 'Chewable Tablet',
        strength: '1000mg',
        composition: 'Ascorbic Acid (Vitamin C) 1000mg + Zinc 10mg',
        description: 'Essential antioxidant and immune defense support supplement helping collagen formation, wound healing, and iron absorption.',
        is_prescription_required: 0,
        mrp: 9.00,
        discount_percent: 16.50
      },
      {
        id: 7,
        dosage_form: 'Tablet',
        strength: '10mg',
        composition: 'Cetirizine Hydrochloride 10mg',
        description: 'Second-generation antihistamine used to relieve allergy symptoms such as watery eyes, runny nose, itching, and hives.',
        is_prescription_required: 0,
        mrp: 4.00,
        discount_percent: 20.00
      },
      {
        id: 8,
        dosage_form: 'Tablet',
        strength: '250mg',
        composition: 'Azithromycin Dihydrate 250mg',
        description: 'Macrolide antibiotic that fights bacteria associated with respiratory infections, skin infections, ear infections, and sexually transmitted diseases.',
        is_prescription_required: 1,
        mrp: 16.50,
        discount_percent: 15.00
      }
    ];

    for (const m of medicineEnhancements) {
      await pool.query(
        `UPDATE medicines 
         SET dosage_form = ?, strength = ?, composition = ?, description = ?, is_prescription_required = ?, mrp = ?, discount_percent = ?
         WHERE id = ?`,
        [m.dosage_form, m.strength, m.composition, m.description, m.is_prescription_required, m.mrp, m.discount_percent, m.id]
      );
    }

    // 8. Seed sample demo order for Michael Clark (User ID 3, Customer ID 1) if none exists
    const [existingOrders] = await pool.query('SELECT COUNT(*) AS count FROM orders WHERE user_id = 3');
    if (existingOrders[0].count === 0) {
      logger.info('Seeding sample orders and notifications for customer demo account...');
      const [ordRes] = await pool.query(
        `INSERT INTO orders (order_number, customer_id, user_id, order_type, delivery_address, status, subtotal, discount, tax, total_amount, payment_method, payment_status, notes)
         VALUES ('ORD-2026-0001', 1, 3, 'delivery', '12 Elm Street, Springfield', 'delivered', 33.50, 2.00, 1.50, 33.00, 'cash', 'successful', 'Standard home delivery')`
      );
      const ordId = ordRes.insertId;

      await pool.query(
        `INSERT INTO order_items (order_id, medicine_id, quantity, unit_price, subtotal)
         VALUES (?, 1, 2, 4.00, 8.00), (?, 2, 3, 8.50, 25.50)`,
        [ordId, ordId]
      );

      // Seed an active processing order
      const [ordRes2] = await pool.query(
        `INSERT INTO orders (order_number, customer_id, user_id, order_type, delivery_address, status, subtotal, discount, tax, total_amount, payment_method, payment_status, notes)
         VALUES ('ORD-2026-0002', 1, 3, 'pickup', 'Main Pharmacy Counter Pickup', 'processing', 19.50, 2.00, 1.00, 18.50, 'cash', 'pending', 'Order verified by Pharmacist Sarah')`
      );
      const ordId2 = ordRes2.insertId;

      await pool.query(
        `INSERT INTO order_items (order_id, medicine_id, quantity, unit_price, subtotal)
         VALUES (?, 3, 1, 7.00, 7.00), (?, 5, 2, 5.50, 11.00)`,
        [ordId2, ordId2]
      );

      // Seed notifications for customer
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, is_read, link) VALUES
         (3, 'Order Delivered Successfully', 'Your order ORD-2026-0001 has been delivered to 12 Elm Street.', 'order', 1, '/customer/orders'),
         (3, 'Prescription Approved', 'Your prescription for Amoxicillin 500mg has been verified and approved by Pharmacist Sarah.', 'prescription', 0, '/customer/prescriptions'),
         (3, 'Order In Processing', 'Your pickup order ORD-2026-0002 is currently being packed and will be ready for collection shortly.', 'order', 0, '/customer/orders')`
      );
    }

    logger.success('Customer Portal Migration completed successfully!');
    await disconnectDB();
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
};

runMigration();
