const { connectDB, getPool, disconnectDB } = require('./db');
const logger = require('../utils/logger');

/**
 * Foundational Relational Database Schema for MediStock ERP & POS
 * Creates all 20 core InnoDB tables if they do not exist.
 * Safe to execute multiple times (idempotent).
 * Preserves all existing data.
 */
async function migrateBaseSchema() {
  logger.info('Starting Base Schema Initialization / Verification...');
  await connectDB();
  const pool = getPool();

  const tableDefinitions = [
    // 1. Users table
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employee_id VARCHAR(50) NULL,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role ENUM('admin', 'pharmacist', 'cashier', 'customer') NOT NULL DEFAULT 'customer',
      phone VARCHAR(20) NULL,
      address TEXT NULL,
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_users_role (role),
      INDEX idx_users_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 2. Categories table
    `CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category_name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 3. Suppliers table
    `CREATE TABLE IF NOT EXISTS suppliers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      supplier_name VARCHAR(150) NOT NULL,
      contact_person VARCHAR(100) NULL,
      phone VARCHAR(30) NULL,
      email VARCHAR(150) NULL,
      gstin VARCHAR(50) NULL,
      payment_terms VARCHAR(100) NOT NULL DEFAULT 'Net 30',
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      address TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_suppliers_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 4. Customers table
    `CREATE TABLE IF NOT EXISTS customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      customer_name VARCHAR(150) NOT NULL,
      phone VARCHAR(30) NULL,
      email VARCHAR(150) NULL,
      address TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_customers_user (user_id),
      INDEX idx_customers_email (email),
      INDEX idx_customers_phone (phone),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 5. Medicines table
    `CREATE TABLE IF NOT EXISTS medicines (
      id INT AUTO_INCREMENT PRIMARY KEY,
      medicine_name VARCHAR(150) NOT NULL,
      generic_name VARCHAR(150) NULL,
      category VARCHAR(100) NULL,
      dosage_form VARCHAR(50) DEFAULT 'Tablet',
      strength VARCHAR(50) DEFAULT NULL,
      composition TEXT DEFAULT NULL,
      description TEXT DEFAULT NULL,
      is_prescription_required TINYINT(1) DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      manufacturer VARCHAR(150) NULL,
      batch_number VARCHAR(100) NULL,
      quantity INT NOT NULL DEFAULT 0,
      reorder_level INT NOT NULL DEFAULT 10,
      purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      selling_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      mrp DECIMAL(10,2) DEFAULT NULL,
      discount_percent DECIMAL(5,2) DEFAULT 0.00,
      image_url VARCHAR(255) DEFAULT NULL,
      expiry_date DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_medicines_name (medicine_name),
      INDEX idx_medicines_category (category),
      INDEX idx_medicines_expiry (expiry_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 6. Medicine Batches (FEFO)
    `CREATE TABLE IF NOT EXISTS medicine_batches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      medicine_id INT NOT NULL,
      batch_number VARCHAR(100) NOT NULL,
      quantity INT NOT NULL DEFAULT 0,
      initial_quantity INT NOT NULL DEFAULT 0,
      purchase_price DECIMAL(10,2) DEFAULT 0.00,
      selling_price DECIMAL(10,2) DEFAULT 0.00,
      mrp DECIMAL(10,2) DEFAULT 0.00,
      expiry_date DATE NOT NULL,
      is_blocked TINYINT(1) DEFAULT 0,
      blocked_reason VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_fefo (medicine_id, is_blocked, expiry_date, quantity),
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 7. Purchases
    `CREATE TABLE IF NOT EXISTS purchases (
      id INT AUTO_INCREMENT PRIMARY KEY,
      supplier_id INT NULL,
      invoice_number VARCHAR(100) NOT NULL UNIQUE,
      purchase_date DATE NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      status ENUM('draft', 'pending_approval', 'approved', 'ordered', 'partially_received', 'received', 'cancelled') NOT NULL DEFAULT 'received',
      tax DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_purchases_supplier (supplier_id),
      INDEX idx_purchases_date (purchase_date),
      INDEX idx_purchases_status (status),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 8. Purchase Items
    `CREATE TABLE IF NOT EXISTS purchase_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      purchase_id INT NOT NULL,
      medicine_id INT NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      batch_number VARCHAR(100) NULL,
      expiry_date DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_purchase_items_purchase (purchase_id),
      INDEX idx_purchase_items_medicine (medicine_id),
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 9. Sales
    `CREATE TABLE IF NOT EXISTS sales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT NULL,
      pharmacist_id INT NULL,
      invoice_number VARCHAR(100) NOT NULL UNIQUE,
      sale_date DATE NOT NULL,
      subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      discount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      tax DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      payment_method VARCHAR(50) DEFAULT 'cash',
      status ENUM('completed', 'cancelled') NOT NULL DEFAULT 'completed',
      cancellation_reason TEXT NULL,
      cancelled_at TIMESTAMP NULL,
      cancelled_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sales_customer (customer_id),
      INDEX idx_sales_pharmacist (pharmacist_id),
      INDEX idx_sales_date (sale_date),
      INDEX idx_sales_status (status),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY (pharmacist_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 10. Sale Items
    `CREATE TABLE IF NOT EXISTS sale_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sale_id INT NOT NULL,
      medicine_id INT NOT NULL,
      batch_id INT NULL,
      batch_number VARCHAR(100) NULL,
      quantity INT NOT NULL DEFAULT 1,
      unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sale_items_sale (sale_id),
      INDEX idx_sale_items_medicine (medicine_id),
      INDEX idx_sale_items_batch (batch_id),
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE,
      FOREIGN KEY (batch_id) REFERENCES medicine_batches(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 11. Payments
    `CREATE TABLE IF NOT EXISTS payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sale_id INT NOT NULL,
      payment_date DATE NULL,
      amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      payment_method VARCHAR(50) DEFAULT 'cash',
      payment_status ENUM('completed', 'successful', 'pending', 'failed', 'refunded') DEFAULT 'completed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_payments_sale (sale_id),
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 12. Returns
    `CREATE TABLE IF NOT EXISTS returns (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sale_id INT NOT NULL,
      medicine_id INT NOT NULL,
      customer_id INT NULL,
      return_date DATE NULL,
      quantity INT NOT NULL DEFAULT 1,
      refund_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      inspection_status ENUM('pending_inspection', 'approved_restock', 'damaged_discarded') DEFAULT 'pending_inspection',
      inspected_by INT NULL,
      inspection_notes TEXT NULL,
      return_reason TEXT NULL,
      reason TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_returns_sale (sale_id),
      INDEX idx_returns_medicine (medicine_id),
      INDEX idx_returns_customer (customer_id),
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY (inspected_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 13. Expenses
    `CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      expense_title VARCHAR(150) NOT NULL,
      category VARCHAR(100) NOT NULL,
      amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      expense_date DATE NOT NULL,
      description TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_expenses_category (category),
      INDEX idx_expenses_date (expense_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 14. Prescriptions
    `CREATE TABLE IF NOT EXISTS prescriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT NULL,
      user_id INT NULL,
      doctor_name VARCHAR(150) NULL,
      prescription_date DATE NOT NULL,
      prescription_image VARCHAR(255) NULL,
      notes TEXT NULL,
      rejection_reason TEXT NULL,
      verification_remarks TEXT NULL,
      verified_by INT NULL,
      verified_at TIMESTAMP NULL,
      dispensed_by INT NULL,
      dispensed_at TIMESTAMP NULL,
      original_filename VARCHAR(255) NULL,
      file_path VARCHAR(255) NULL,
      file_type VARCHAR(100) NULL,
      file_size INT NULL,
      status ENUM('pending', 'under_review', 'approved', 'rejected', 'dispensed') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_prescriptions_customer (customer_id),
      INDEX idx_prescriptions_user (user_id),
      INDEX idx_prescriptions_status (status),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (dispensed_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 15. Orders
    `CREATE TABLE IF NOT EXISTS orders (
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
      INDEX idx_orders_customer (customer_id),
      INDEX idx_orders_user (user_id),
      INDEX idx_orders_status (status),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 16. Order Items
    `CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      medicine_id INT NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      INDEX idx_order_items_order (order_id),
      INDEX idx_order_items_medicine (medicine_id),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 17. Notifications
    `CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      type ENUM('prescription', 'order', 'payment', 'system', 'general') DEFAULT 'general',
      is_read TINYINT(1) DEFAULT 0,
      link VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_notifications_user (user_id),
      INDEX idx_notifications_is_read (is_read),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 18. Stock Movements
    `CREATE TABLE IF NOT EXISTS stock_movements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      medicine_id INT NOT NULL,
      movement_type ENUM('purchase', 'sale', 'adjustment', 'return', 'discard') NOT NULL,
      quantity INT NOT NULL,
      reference_type VARCHAR(50) NULL,
      reference_id INT NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sm_medicine (medicine_id),
      INDEX idx_sm_type (movement_type),
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 19. Audit Logs
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50) NULL,
      entity_id INT NULL,
      details TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_user (user_id),
      INDEX idx_audit_action (action),
      INDEX idx_audit_created (created_at),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 20. System Settings
    `CREATE TABLE IF NOT EXISTS system_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      setting_key VARCHAR(100) NOT NULL UNIQUE,
      setting_value TEXT NOT NULL,
      category VARCHAR(50) NOT NULL DEFAULT 'general',
      description TEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_settings_category (category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  ];

  for (const sql of tableDefinitions) {
    await pool.query(sql);
  }

  // Ensure return_reason column exists on returns for schema compatibility
  const [retReasonCol] = await pool.query("SHOW COLUMNS FROM returns LIKE 'return_reason'");
  if (retReasonCol.length === 0) {
    await pool.query("ALTER TABLE returns ADD COLUMN return_reason TEXT NULL AFTER inspection_notes");
  }

  logger.success('Base Schema verification completed: 20 relational InnoDB tables verified.');
}

if (require.main === module) {
  migrateBaseSchema()
    .then(async () => {
      await disconnectDB();
      logger.info('Base schema migration process completed.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Base schema migration failed:', err.message);
      process.exit(1);
    });
}

module.exports = { migrateBaseSchema };
