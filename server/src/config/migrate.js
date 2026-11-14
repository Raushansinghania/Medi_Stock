const { connectDB, disconnectDB } = require('./db');
const { migrateBaseSchema } = require('./migrate_base_schema');
const { seedDatabase } = require('../../seeds/seed');
const { migrateAdminPanel } = require('./migrate_admin_panel');
const { migrateCustomerPortal } = require('./migrate_customer_portal');
const { migratePharmacistPanel } = require('./migrate_pharmacist_panel');
const logger = require('../utils/logger');

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

    logger.info('[Step 1/5] Executing Base Schema Migration...');
    await migrateBaseSchema();

    logger.info('[Step 2/5] Executing Master Data Seed...');
    await seedDatabase();

    logger.info('[Step 3/5] Executing Admin Panel Migration...');
    await migrateAdminPanel();

    logger.info('[Step 4/5] Executing Customer Portal Migration...');
    await migrateCustomerPortal();

    logger.info('[Step 5/5] Executing Pharmacist Workspace & FEFO Migration...');
    await migratePharmacistPanel();

    logger.success('=====================================================');
    logger.success('✅ All MediStock Database Migrations Completed Successfully!');
    logger.success('=====================================================');
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

module.exports = { runAllMigrations };
