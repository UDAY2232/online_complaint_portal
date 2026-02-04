/**
 * Database Migration Script
 * Run this to add Phase 6 & 7 columns safely
 */

const runMigrations = async (db) => {
  console.log('🔧 [MIGRATION] Starting database migrations...');

  const migrations = [
    // Phase 6: Escalation columns
    {
      name: 'Add escalation_level to complaints',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'complaints' AND COLUMN_NAME = 'escalation_level'`,
      sql: 'ALTER TABLE complaints ADD COLUMN escalation_level INT DEFAULT 0',
    },
    {
      name: 'Add escalated_at to complaints',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'complaints' AND COLUMN_NAME = 'escalated_at'`,
      sql: 'ALTER TABLE complaints ADD COLUMN escalated_at TIMESTAMP NULL',
    },
    {
      name: 'Add resolution_message to complaints',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'complaints' AND COLUMN_NAME = 'resolution_message'`,
      sql: 'ALTER TABLE complaints ADD COLUMN resolution_message TEXT',
    },
    {
      name: 'Add user_id to complaints',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'complaints' AND COLUMN_NAME = 'user_id'`,
      sql: 'ALTER TABLE complaints ADD COLUMN user_id INT NULL',
    },

    // Phase 7: Users table
    {
      name: 'Create users table',
      check: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`,
      sql: `CREATE TABLE users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        role ENUM('user', 'admin', 'superadmin') NOT NULL DEFAULT 'user',
        email_verified BOOLEAN NOT NULL DEFAULT FALSE,
        reset_token_hash VARCHAR(255) NULL,
        reset_token_expires TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_role (role)
      )`,
    },

    // Add reset token columns to existing users table
    {
      name: 'Add reset_token_hash to users',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'reset_token_hash'`,
      sql: 'ALTER TABLE users ADD COLUMN reset_token_hash VARCHAR(255) NULL',
    },
    {
      name: 'Add reset_token_expires to users',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'reset_token_expires'`,
      sql: 'ALTER TABLE users ADD COLUMN reset_token_expires TIMESTAMP NULL',
    },

    // Admin whitelist table
    {
      name: 'Create admin_whitelist table',
      check: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_whitelist'`,
      sql: `CREATE TABLE admin_whitelist (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    },

    // Escalation history enhancements
    {
      name: 'Add escalation_level to escalation_history',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'escalation_history' AND COLUMN_NAME = 'escalation_level'`,
      sql: 'ALTER TABLE escalation_history ADD COLUMN escalation_level INT DEFAULT 1',
    },
    {
      name: 'Add reason to escalation_history',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'escalation_history' AND COLUMN_NAME = 'reason'`,
      sql: 'ALTER TABLE escalation_history ADD COLUMN reason TEXT',
    },

    // Add status column to users table for active/inactive/suspended states
    {
      name: 'Add status to users',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'status'`,
      sql: "ALTER TABLE users ADD COLUMN status ENUM('active', 'inactive', 'suspended') DEFAULT 'active'",
    },
  ];

  for (const migration of migrations) {
    try {
      // Check if migration is needed
      const [checkResult] = await db.promise().query(migration.check);
      
      if (checkResult.length === 0) {
        console.log(`🔧 [MIGRATION] Running: ${migration.name}`);
        await db.promise().query(migration.sql);
        console.log(`🔧 [MIGRATION] ✅ Completed: ${migration.name}`);
      } else {
        console.log(`🔧 [MIGRATION] ⏭️ Skipped (already exists): ${migration.name}`);
      }
    } catch (err) {
      console.error(`🔧 [MIGRATION] ❌ Failed: ${migration.name}`, err.message);
      // Continue with other migrations
    }
  }

  console.log('🔧 [MIGRATION] ✅ All migrations completed');
};

module.exports = { runMigrations };
