-- ===============================================
-- PHASE 6 & 7: SLA, Escalation & Security Updates
-- ===============================================

-- Safe ALTER statements (run if columns don't exist)


-- ================= PHASE 6: ESCALATION COLUMNS =================

-- Add escalation columns to complaints table (if not exists)
-- Run these ALTER statements one by one:

-- ALTER TABLE complaints ADD COLUMN escalation_level INT DEFAULT 0;
-- ALTER TABLE complaints ADD COLUMN escalated_at TIMESTAMP NULL;
-- ALTER TABLE complaints ADD COLUMN resolution_message TEXT;

-- ================= PHASE 7: USERS TABLE =================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin')),
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_token VARCHAR(500),
    reset_token VARCHAR(500),
    reset_token_expires TIMESTAMP NULL,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ================= ADMIN WHITELIST =================

CREATE TABLE admin_whitelist (
    id SERIAL PRIMARY KEY,
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
CREATE TABLE escalation_history (
    id SERIAL PRIMARY KEY,
    complaint_id INT NOT NULL,
    escalation_level INT NOT NULL DEFAULT 1,
    reason TEXT,
    notified_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
);

-- ================= REFRESH TOKENS TABLE (Optional - for production) =================

CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ================= AUDIT LOG (Optional - for security) =================

CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id INT,
    details JSON,
    ip_address VARCHAR(45),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ================= SEED DATA =================

-- Insert default superadmin (change password immediately after first login!)
-- Password: 'Admin@123' (bcrypt hash)
INSERT INTO users (email, password_hash, name, role, email_verified) 
VALUES ('complaintportals@gmail.com', '$2b$10$V8nCXPCClgcjmyI4dmnOFuKWia35p7rd9NlQuT2oSzv/pWKziZaAG', 'System Admin', 'superadmin', TRUE)
ON CONFLICT (email) DO NOTHING;

-- Add default admin whitelist
INSERT INTO admin_whitelist (email) VALUES ('complaintportals@gmail.com')
ON CONFLICT (email) DO NOTHING;
