-- ===============================================
-- PHASE 6 & 7: SLA, Escalation & Security Updates
-- ===============================================

-- Safe ALTER statements (run if columns don't exist)
-- MySQL will error if column exists, handle in application or run conditionally

-- ================= PHASE 6: ESCALATION COLUMNS =================

-- Add escalation columns to complaints table (if not exists)
-- Run these ALTER statements one by one:

-- ALTER TABLE complaints ADD COLUMN escalation_level INT DEFAULT 0;
-- ALTER TABLE complaints ADD COLUMN escalated_at TIMESTAMP NULL;
-- ALTER TABLE complaints ADD COLUMN resolution_message TEXT;

-- ================= PHASE 7: USERS TABLE =================

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role ENUM('user', 'admin', 'superadmin') NOT NULL DEFAULT 'user',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_token VARCHAR(500),
    reset_token VARCHAR(500),
    reset_token_expires TIMESTAMP NULL,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
);

-- ================= ADMIN WHITELIST =================

-- Whitelist of approved admin emails
CREATE TABLE IF NOT EXISTS admin_whitelist (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    added_by INT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ================= ENHANCED ESCALATION HISTORY =================

-- Drop and recreate escalation_history with more fields
-- First backup if needed, then:

-- If escalation_history exists, add columns:
-- ALTER TABLE escalation_history ADD COLUMN escalation_level INT DEFAULT 1;
-- ALTER TABLE escalation_history ADD COLUMN reason TEXT;
-- ALTER TABLE escalation_history ADD COLUMN notified_at TIMESTAMP NULL;

-- Or create fresh if doesn't exist:
CREATE TABLE IF NOT EXISTS escalation_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    complaint_id INT NOT NULL,
    escalation_level INT NOT NULL DEFAULT 1,
    reason TEXT,
    notified_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    INDEX idx_complaint (complaint_id),
    INDEX idx_level (escalation_level)
);

-- ================= REFRESH TOKENS TABLE (Optional - for production) =================

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_token (token)
);

-- ================= AUDIT LOG (Optional - for security) =================

CREATE TABLE IF NOT EXISTS audit_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id INT,
    details JSON,
    ip_address VARCHAR(45),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_created (created_at)
);

-- ================= SEED DATA =================

-- Insert default superadmin (change password immediately after first login!)
-- Password: 'Admin@123' (bcrypt hash)
INSERT IGNORE INTO users (email, password_hash, name, role, email_verified) 
VALUES ('complaintportals@gmail.com', '$2b$10$V8nCXPCClgcjmyI4dmnOFuKWia35p7rd9NlQuT2oSzv/pWKziZaAG', 'System Admin', 'superadmin', TRUE);

-- Add default admin whitelist
INSERT IGNORE INTO admin_whitelist (email) VALUES ('complaintportals@gmail.com');
