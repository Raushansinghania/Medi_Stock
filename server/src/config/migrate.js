const { connectDB, disconnectDB, getPool } = require('./db');
const { migrateBaseSchema } = require('./migrate_base_schema');
const { seedDatabase } = require('../../seeds/seed');
const { migrateAdminPanel } = require('./migrate_admin_panel');
const { migrateCustomerPortal } = require('./migrate_customer_portal');
const { migratePharmacistPanel } = require('./migrate_pharmacist_panel');
const logger = require('../utils/logger');

/**
 * Migration registry defining execution order, descriptions, and handlers.
 */
const MIGRATIONS = [
  {
    name: '001_base_schema',
    description: 'Foundational 20 relational InnoDB tables, PKs, FKs, and indexes',
    execute: migrateBaseSchema,
  },
  {
    name: '002_master_seeds',
    description: 'Seed default staff/customer users and initial inventory/categories',
    execute: seedDatabase,
  },
  {
    name: '003_admin_panel',
    description: 'Admin schema extensions, employee attributes, and settings',
    execute: migrateAdminPanel,
  },
  {
    name: '004_customer_portal',
    description: 'Customer portal clinical fields, order status workflow, and notifications',
    execute: migrateCustomerPortal,
  },
  {
    name: '005_pharmacist_panel',
    description: 'Pharmacist FEFO batching, prescription review workflow, and stock adjustments',
    execute: migratePharmacistPanel,
  },
];

/**
 * Ensures the migration tracking table exists
 */
async function ensureMigrationTable(pool) {
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      migration_name VARCHAR(150) NOT NULL UNIQUE,
      batch INT NOT NULL DEFAULT 1,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_migration_name (migration_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await pool.query(createTableSql);
}

/**
 * Retrieves the list of migrations already recorded in the database
 */
async function getExecutedMigrations(pool) {
  await ensureMigrationTable(pool);
  const [rows] = await pool.query('SELECT migration_name, batch, executed_at FROM schema_migrations ORDER BY id ASC');
  return rows;
}

/**
 * Unified Master Migration Runner for MediStock
 * 
 * Execution Order:
 * 1. Base Schema Initialization (20 InnoDB tables, PKs, FKs, indexes)
 * 2. Master Data Seed (Admin, Pharmacist, Customer accounts, Categories, Suppliers, Medicines)
 * 3. Admin Panel Schema & Settings
 * 4. Customer Portal Schema, Clinical Metadata & Demo Orders
 * 5. Pharmacist Workspace FEFO Batches & Verification Queue
 * 
 * Safe to execute repeatedly (100% idempotent).
 * Preserves all existing data.
 */
async function runAllMigrations() {
  logger.info('=====================================================');
  logger.info('🚀 Starting MediStock Full Database Migration Pipeline');
  logger.info('=====================================================');

  try {
    await connectDB();
    const pool = getPool();

    await ensureMigrationTable(pool);
    const executedRows = await getExecutedMigrations(pool);
    const executedMap = new Map(executedRows.map((r) => [r.migration_name, r]));

    const currentBatch = executedRows.length > 0
      ? Math.max(...executedRows.map((r) => r.batch || 1)) + 1
      : 1;

    let appliedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < MIGRATIONS.length; i++) {
      const migration = MIGRATIONS[i];
      const stepLabel = `[Step ${i + 1}/${MIGRATIONS.length}]`;

      if (executedMap.has(migration.name)) {
        const record = executedMap.get(migration.name);
        logger.info(`${stepLabel} [SKIP] ${migration.name} already applied (Batch ${record.batch}, ${record.executed_at})`);
        skippedCount++;
      } else {
        logger.info(`${stepLabel} [RUN] Executing ${migration.name}: ${migration.description}...`);
        await migration.execute();
        await pool.query(
          'INSERT INTO schema_migrations (migration_name, batch, executed_at) VALUES (?, ?, NOW())',
          [migration.name, currentBatch]
        );
        logger.success(`${stepLabel} [DONE] ${migration.name} applied successfully.`);
        appliedCount++;
      }
    }

    // Verify critical tables exist
    const [tables] = await pool.query(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()'
    );
    const tableNames = (tables || []).map((t) => (t.TABLE_NAME || t.table_name || '').toLowerCase());
    const requiredTables = ['users', 'categories', 'suppliers', 'medicines', 'sales', 'prescriptions', 'orders', 'schema_migrations'];
    const missing = requiredTables.filter((tbl) => !tableNames.includes(tbl));

    if (missing.length > 0) {
      throw new Error(`Migration completed but required tables are missing: ${missing.join(', ')}`);
    }

    logger.success('=====================================================');
    logger.success(`✅ MediStock Migrations Complete! Applied: ${appliedCount}, Skipped: ${skippedCount}, Total Tables: ${tableNames.length}`);
    logger.success('=====================================================');

    return {
      success: true,
      appliedCount,
      skippedCount,
      totalTables: tableNames.length,
      batch: currentBatch,
    };
  } catch (error) {
    logger.error('❌ Migration pipeline failed:', error.message);
    throw error;
  }
}

if (require.main === module) {
  runAllMigrations()
    .then(async () => {
      await disconnectDB();
      process.exit(0);
    })
    .catch(async () => {
      await disconnectDB();
      process.exit(1);
    });
}

module.exports = {
  runAllMigrations,
  ensureMigrationTable,
  getExecutedMigrations,
  MIGRATIONS,
};
