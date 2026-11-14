const { connectDB, query, transaction } = require('./db');
const { migrateBaseSchema } = require('./migrate_base_schema');
const logger = require('../utils/logger');

async function migratePharmacistPanel() {
  logger.info('Starting Pharmacist Panel database migrations...');
  await connectDB();
  await migrateBaseSchema();

  try {
    // 1. Create medicine_batches table for FEFO inventory management
    await query(`
      CREATE TABLE IF NOT EXISTS medicine_batches (
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
      ) ENGINE=InnoDB;
    `);
    logger.success('Table `medicine_batches` verified/created.');

    // 2. Add batch_id and batch_number to sale_items if not present
    const [saleItemCols] = await query('DESCRIBE sale_items');
    const saleItemColNames = saleItemCols.map((c) => c.Field);

    if (!saleItemColNames.includes('batch_id')) {
      await query('ALTER TABLE sale_items ADD COLUMN batch_id INT NULL AFTER medicine_id');
      logger.success('Added `batch_id` to `sale_items`.');
    }
    if (!saleItemColNames.includes('batch_number')) {
      await query('ALTER TABLE sale_items ADD COLUMN batch_number VARCHAR(100) NULL AFTER batch_id');
      logger.success('Added `batch_number` to `sale_items`.');
    }

    // 3. Add inspection status and notes to returns table
    const [returnCols] = await query('DESCRIBE returns');
    const returnColNames = returnCols.map((c) => c.Field);

    if (!returnColNames.includes('inspection_status')) {
      await query(`
        ALTER TABLE returns 
        ADD COLUMN inspection_status ENUM('pending_inspection', 'approved_restock', 'damaged_discarded') DEFAULT 'pending_inspection' AFTER refund_amount,
        ADD COLUMN inspected_by INT NULL AFTER inspection_status,
        ADD COLUMN inspection_notes TEXT NULL AFTER inspected_by
      `);
      logger.success('Added inspection columns to `returns`.');
    }

    // 4. Add verification remarks and dispensing timestamp to prescriptions table
    const [rxCols] = await query('DESCRIBE prescriptions');
    const rxColNames = rxCols.map((c) => c.Field);

    if (!rxColNames.includes('verification_remarks')) {
      await query('ALTER TABLE prescriptions ADD COLUMN verification_remarks TEXT NULL AFTER rejection_reason');
      logger.success('Added `verification_remarks` to `prescriptions`.');
    }
    if (!rxColNames.includes('dispensed_by')) {
      await query('ALTER TABLE prescriptions ADD COLUMN dispensed_by INT NULL AFTER verified_by');
      logger.success('Added `dispensed_by` to `prescriptions`.');
    }
    if (!rxColNames.includes('dispensed_at')) {
      await query('ALTER TABLE prescriptions ADD COLUMN dispensed_at TIMESTAMP NULL AFTER verified_at');
      logger.success('Added `dispensed_at` to `prescriptions`.');
    }

    // Modify status column in prescriptions to support under_review and dispensed
    await query(`
      ALTER TABLE prescriptions 
      MODIFY COLUMN status ENUM('pending', 'under_review', 'approved', 'rejected', 'dispensed') DEFAULT 'pending'
    `);
    logger.success('Updated `prescriptions.status` ENUM with full lifecycle states.');

    // 5. Seed multi-batch FEFO inventory for medicines
    // Clear out existing batches to avoid duplicates on re-run
    const [existingBatches] = await query('SELECT COUNT(*) AS cnt FROM medicine_batches');
    if (existingBatches[0].cnt === 0) {
      logger.info('Seeding multi-batch FEFO inventory for medicines...');

      // Find Paracetamol (id 1)
      const [para] = await query("SELECT id, selling_price, mrp, purchase_price FROM medicines WHERE medicine_name LIKE '%Paracetamol%' LIMIT 1");
      if (para.length > 0) {
        const pId = para[0].id;
        const sPrice = para[0].selling_price || 15.0;
        const pPrice = para[0].purchase_price || 8.0;
        const mrp = para[0].mrp || 20.0;

        // Batch A: 50 units, expires in 2 months (Next to expire - FEFO 1st)
        await query(`
          INSERT INTO medicine_batches (medicine_id, batch_number, quantity, initial_quantity, purchase_price, selling_price, mrp, expiry_date, is_blocked)
          VALUES (?, 'BATCH-PR500-A', 50, 50, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 0)
        `, [pId, pPrice, sPrice, mrp]);

        // Batch B: 100 units, expires in 8 months (FEFO 2nd)
        await query(`
          INSERT INTO medicine_batches (medicine_id, batch_number, quantity, initial_quantity, purchase_price, selling_price, mrp, expiry_date, is_blocked)
          VALUES (?, 'BATCH-PR500-B', 100, 100, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 240 DAY), 0)
        `, [pId, pPrice, sPrice, mrp]);

        // Batch C: 150 units, expires in 18 months (FEFO 3rd)
        await query(`
          INSERT INTO medicine_batches (medicine_id, batch_number, quantity, initial_quantity, purchase_price, selling_price, mrp, expiry_date, is_blocked)
          VALUES (?, 'BATCH-PR500-C', 150, 150, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 540 DAY), 0)
        `, [pId, pPrice, sPrice, mrp]);

        // Batch Expired: 25 units, expired 30 days ago (Must be blocked from sale!)
        await query(`
          INSERT INTO medicine_batches (medicine_id, batch_number, quantity, initial_quantity, purchase_price, selling_price, mrp, expiry_date, is_blocked, blocked_reason)
          VALUES (?, 'BATCH-PR500-EXP', 25, 25, ?, ?, ?, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 1, 'Expired batch - quarantined')
        `, [pId, pPrice, sPrice, mrp]);

        // Update total quantity in medicines table
        await query('UPDATE medicines SET quantity = 300, batch_number = ? WHERE id = ?', ['BATCH-PR500-A', pId]);
      }

      // Populate batches for other medicines based on their existing rows
      const [allMeds] = await query('SELECT * FROM medicines');
      for (const m of allMeds) {
        if (m.medicine_name.includes('Paracetamol')) continue; // Already seeded above

        const exp = m.expiry_date || new Date(Date.now() + 365 * 24 * 3600 * 1000);
        await query(`
          INSERT INTO medicine_batches (medicine_id, batch_number, quantity, initial_quantity, purchase_price, selling_price, mrp, expiry_date, is_blocked)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        `, [
          m.id,
          m.batch_number || `BATCH-${m.id}-01`,
          m.quantity || 50,
          m.quantity || 50,
          m.purchase_price || 10.0,
          m.selling_price || 20.0,
          m.mrp || 25.0,
          exp,
        ]);
      }
      logger.success('Multi-batch FEFO inventory seeded successfully.');
    } else {
      logger.info('Batches already present, skipping initial batch seed.');
    }

    // 6. Ensure sample pending and approved prescriptions exist
    const [rxCount] = await query('SELECT COUNT(*) AS cnt FROM prescriptions WHERE status = "pending"');
    if (rxCount[0].cnt === 0) {
      const [custUsers] = await query("SELECT id FROM users WHERE email = 'customer@medistock.com'");
      const targetUserId = custUsers[0]?.id || 3;
      const [custRows] = await query("SELECT id FROM customers WHERE email = 'customer@medistock.com' OR user_id = ?", [targetUserId]);
      const targetCustomerId = custRows[0]?.id || 1;

      if (custUsers.length > 0) {
        await query(`
          INSERT INTO prescriptions (customer_id, user_id, doctor_name, prescription_date, notes, status, original_filename, file_type, file_size)
          VALUES 
          (?, ?, 'Dr. Robert Shaw, MD (Cardiology)', CURDATE(), 'Rx: Paracetamol 500mg (1 TDS), Atorvastatin 10mg (1 HS)', 'pending', 'cardio_rx_sample.pdf', 'application/pdf', 145000),
          (?, ?, 'Dr. Sarah Connor, MD (Internal Med)', DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'Rx: Amoxicillin 500mg (1 BD x 5 days)', 'under_review', 'antibiotic_rx.jpg', 'image/jpeg', 280000)
        `, [targetCustomerId, targetUserId, targetCustomerId, targetUserId]);
        logger.success('Sample pending prescriptions seeded for verification queue.');
      }
    }

    logger.success('Pharmacist Panel database migration completed successfully!');
  } catch (err) {
    logger.error('Migration failed:', err.message);
    throw err;
  }
}

if (require.main === module) {
  const { connectDB, disconnectDB } = require('./db');
  connectDB()
    .then(() => migratePharmacistPanel())
    .then(() => disconnectDB())
    .then(() => {
      logger.info('Migration process finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { migratePharmacistPanel };
