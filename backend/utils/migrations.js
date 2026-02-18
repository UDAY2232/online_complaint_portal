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
        check: `SELECT column_name FROM information_schema.columns 
                WHERE table_schema = current_schema() AND table_name = 'complaints' AND column_name = 'escalation_level'`,
      sql: 'ALTER TABLE complaints ADD COLUMN escalation_level INT DEFAULT 0',
    },
    {
      name: 'Add escalated_at to complaints',
        check: `SELECT column_name FROM information_schema.columns 
                WHERE table_schema = current_schema() AND table_name = 'complaints' AND column_name = 'escalated_at'`,
      sql: 'ALTER TABLE complaints ADD COLUMN escalated_at TIMESTAMP NULL',
    },
    {
      name: 'Add resolution_message to complaints',
        check: `SELECT column_name FROM information_schema.columns 
                WHERE table_schema = current_schema() AND table_name = 'complaints' AND column_name = 'resolution_message'`,
      sql: 'ALTER TABLE complaints ADD COLUMN resolution_message TEXT',
    },
    {
      name: 'Add user_id to complaints',
        check: `SELECT column_name FROM information_schema.columns 
                WHERE table_schema = current_schema() AND table_name = 'complaints' AND column_name = 'user_id'`,
      sql: 'ALTER TABLE complaints ADD COLUMN user_id INT NULL',
    },

    // Phase 7: Users table
    {
      name: 'Create users table',
        check: `SELECT table_name FROM information_schema.tables 
                WHERE table_schema = current_schema() AND table_name = 'users'`,
      sql: `CREATE TABLE users (
          id SERIAL PRIMARY KEY,
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
        check: `SELECT column_name FROM information_schema.columns 
                WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'reset_token_hash'`,
      sql: 'ALTER TABLE users ADD COLUMN reset_token_hash VARCHAR(255) NULL',
    },
    {
      name: 'Add reset_token_expires to users',
        check: `SELECT column_name FROM information_schema.columns 
                WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'reset_token_expires'`,
      sql: 'ALTER TABLE users ADD COLUMN reset_token_expires TIMESTAMP NULL',
    },

    // Admin whitelist table
    {
      name: 'Create admin_whitelist table',
        check: `SELECT table_name FROM information_schema.tables 
                WHERE table_schema = current_schema() AND table_name = 'admin_whitelist'`,
      sql: `CREATE TABLE admin_whitelist (
          id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    },

    // Escalation history enhancements
    {
      name: 'Add escalation_level to escalation_history',
        check: `SELECT column_name FROM information_schema.columns 
                WHERE table_schema = current_schema() AND table_name = 'escalation_history' AND column_name = 'escalation_level'`,
      sql: 'ALTER TABLE escalation_history ADD COLUMN escalation_level INT DEFAULT 1',
    },
    {
      name: 'Add reason to escalation_history',
        check: `SELECT column_name FROM information_schema.columns 
                WHERE table_schema = current_schema() AND table_name = 'escalation_history' AND column_name = 'reason'`,
      sql: 'ALTER TABLE escalation_history ADD COLUMN reason TEXT',
    },

    // Add status column to users table for active/inactive/suspended states
    {
      name: 'Add status to users',
        check: `SELECT column_name FROM information_schema.columns 
                WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'status'`,
      sql: "ALTER TABLE users ADD COLUMN status ENUM('active', 'inactive', 'suspended') DEFAULT 'active'",
    },
  ];

  for (const migration of migrations) {
    try {
      // Check if migration is needed
      const checkResult = await db.query(migration.check);
      
      if (checkResult.rows.length === 0) {
        console.log(`🔧 [MIGRATION] Running: ${migration.name}`);
          await db.query(migration.sql);
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
