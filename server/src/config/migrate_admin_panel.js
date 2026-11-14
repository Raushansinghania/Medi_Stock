const { connectDB, query, getPool } = require('./db');
const logger = require('../utils/logger');

async function migrateAdminPanel() {
  logger.info('Starting Admin Panel Database Migration...');
  await connectDB();

  try {
    // 1. Expand users table
    logger.info('Migrating users table...');
    const [userCols] = await query("SHOW COLUMNS FROM users LIKE 'role'");
    if (userCols.length > 0 && !userCols[0].Type.includes('cashier')) {
      await query("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'pharmacist', 'cashier', 'customer') NOT NULL DEFAULT 'customer'");
      logger.info('Updated users.role enum to include cashier');
    }

    const [phoneCol] = await query("SHOW COLUMNS FROM users LIKE 'phone'");
    if (phoneCol.length === 0) {
      await query("ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL AFTER email");
    }

    const [addrCol] = await query("SHOW COLUMNS FROM users LIKE 'address'");
    if (addrCol.length === 0) {
      await query("ALTER TABLE users ADD COLUMN address TEXT NULL AFTER phone");
    }

    const [statusCol] = await query("SHOW COLUMNS FROM users LIKE 'status'");
    if (statusCol.length === 0) {
      await query("ALTER TABLE users ADD COLUMN status ENUM('active', 'inactive') NOT NULL DEFAULT 'active' AFTER role");
    }

    const [empIdCol] = await query("SHOW COLUMNS FROM users LIKE 'employee_id'");
    if (empIdCol.length === 0) {
      await query("ALTER TABLE users ADD COLUMN employee_id VARCHAR(50) NULL AFTER id");
    }

    const [userCreatedAtCol] = await query("SHOW COLUMNS FROM users LIKE 'created_at'");
    if (userCreatedAtCol.length === 0) {
      await query("ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER status");
    }

    // Set employee_id for default staff
    await query("UPDATE users SET employee_id = 'EMP-ADM-001', phone = '+1-555-0101', status = 'active' WHERE role = 'admin' AND employee_id IS NULL");
    await query("UPDATE users SET employee_id = 'EMP-PHR-001', phone = '+1-555-0102', status = 'active' WHERE role = 'pharmacist' AND employee_id IS NULL");

    // 2. Expand purchases table
    logger.info('Migrating purchases table...');
    const [pStatusCol] = await query("SHOW COLUMNS FROM purchases LIKE 'status'");
    if (pStatusCol.length === 0) {
      await query(`
        ALTER TABLE purchases
        ADD COLUMN status ENUM('draft', 'pending_approval', 'approved', 'ordered', 'partially_received', 'received', 'cancelled') NOT NULL DEFAULT 'received' AFTER total_amount,
        ADD COLUMN tax DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER status,
        ADD COLUMN notes TEXT NULL AFTER tax
      `);
      logger.info('Added status, tax, notes to purchases table');
    }

    // 3. Expand purchase_items table
    logger.info('Migrating purchase_items table...');
    const [piBatchCol] = await query("SHOW COLUMNS FROM purchase_items LIKE 'batch_number'");
    if (piBatchCol.length === 0) {
      await query(`
        ALTER TABLE purchase_items
        ADD COLUMN batch_number VARCHAR(100) NULL AFTER subtotal,
        ADD COLUMN expiry_date DATE NULL AFTER batch_number
      `);
      logger.info('Added batch_number, expiry_date to purchase_items table');
    }

    // 4. Expand suppliers table
    logger.info('Migrating suppliers table...');
    const [suppGstinCol] = await query("SHOW COLUMNS FROM suppliers LIKE 'gstin'");
    if (suppGstinCol.length === 0) {
      await query(`
        ALTER TABLE suppliers
        ADD COLUMN gstin VARCHAR(50) NULL AFTER email,
        ADD COLUMN payment_terms VARCHAR(100) NOT NULL DEFAULT 'Net 30' AFTER gstin,
        ADD COLUMN status ENUM('active', 'inactive') NOT NULL DEFAULT 'active' AFTER payment_terms
      `);
      logger.info('Added gstin, payment_terms, status to suppliers table');
    }

    // 5. Expand medicines table
    logger.info('Migrating medicines table...');
    const [reorderCol] = await query("SHOW COLUMNS FROM medicines LIKE 'reorder_level'");
    if (reorderCol.length === 0) {
      await query("ALTER TABLE medicines ADD COLUMN reorder_level INT NOT NULL DEFAULT 10 AFTER quantity");
      logger.info('Added reorder_level to medicines table');
    }

    const [genNameCol] = await query("SHOW COLUMNS FROM medicines LIKE 'generic_name'");
    if (genNameCol.length === 0) {
      await query("ALTER TABLE medicines ADD COLUMN generic_name VARCHAR(150) NULL AFTER medicine_name");
      logger.info('Added generic_name to medicines table');
    }

    // 6. Expand sales table
    logger.info('Migrating sales table...');
    const [saleStatusCol] = await query("SHOW COLUMNS FROM sales LIKE 'status'");
    if (saleStatusCol.length === 0) {
      await query(`
        ALTER TABLE sales
        ADD COLUMN pharmacist_id INT NULL AFTER customer_id,
        ADD COLUMN status ENUM('completed', 'cancelled') NOT NULL DEFAULT 'completed' AFTER payment_method,
        ADD COLUMN cancellation_reason TEXT NULL AFTER status,
        ADD COLUMN cancelled_at TIMESTAMP NULL AFTER cancellation_reason,
        ADD COLUMN cancelled_by INT NULL AFTER cancelled_at
      `);
      logger.info('Added pharmacist_id, status, cancellation fields to sales table');
    }

    // 7. Create system_settings table
    logger.info('Creating system_settings table...');
    await query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) NOT NULL UNIQUE,
        setting_value TEXT NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'general',
        description TEXT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Seed default settings if empty
    const [settingsCount] = await query('SELECT COUNT(*) AS count FROM system_settings');
    if (settingsCount[0].count === 0) {
      const defaultSettings = [
        ['pharmacy_name', 'MediStock Central Pharmacy & Dispensary', 'general', 'Official trading name'],
        ['pharmacy_address', '123 Healthcare Boulevard, Medical District, NY 10001', 'general', 'Registered premises address'],
        ['pharmacy_phone', '+1 (555) 019-2834', 'general', 'Official customer support phone'],
        ['pharmacy_email', 'admin@medistock.com', 'general', 'Administrative dispatch email'],
        ['currency_symbol', '$', 'billing', 'Store currency denomination'],
        ['tax_gst_rate', '5.0', 'billing', 'Standard pharmaceutical sales tax / GST percentage'],
        ['invoice_prefix', 'INV-', 'billing', 'Sequential tax invoice prefix'],
        ['default_reorder_level', '15', 'inventory', 'Default threshold for low stock triggers'],
        ['fefo_critical_days', '30', 'inventory', 'Urgent expiration warning window in days'],
        ['fefo_warning_days', '90', 'inventory', 'Approaching expiration notification threshold'],
        ['auto_block_expired', '1', 'security', 'Automatically reject checkout of expired medication batches'],
      ];

      for (const [key, val, cat, desc] of defaultSettings) {
        await query(
          'INSERT INTO system_settings (setting_key, setting_value, category, description) VALUES (?, ?, ?, ?)',
          [key, val, cat, desc]
        );
      }
      logger.info('Seeded default system settings');
    }

    logger.info('Admin Panel Database Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    logger.error(`Migration failed: ${err.message}`);
    process.exit(1);
  }
}

migrateAdminPanel();
