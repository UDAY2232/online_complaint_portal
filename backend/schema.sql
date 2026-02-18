

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    -- Password reset fields (stored in DB, not memory)
    reset_token_hash VARCHAR(255) NULL,
    reset_token_expires TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_status (status),
    INDEX idx_reset_token (reset_token_hash)
);

CREATE TABLE complaints (
    id SERIAL PRIMARY KEY,
    user_id INT NULL,  -- Links to users table (NULL for anonymous/legacy)
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    email VARCHAR(255),  -- Kept for backward compatibility, prefer user_id
    name VARCHAR(255),
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'under-review', 'resolved')),
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    problem_image_url VARCHAR(500),
    resolved_image_url VARCHAR(500),
    resolution_message TEXT,
    admin_message TEXT,
    -- Phase 6: Escalation columns
    escalation_level INT DEFAULT 0,
    escalated_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_email (email),
    INDEX idx_user_id (user_id),
    INDEX idx_escalation (escalation_level)
);

CREATE TABLE anonymous_submissions (
    id SERIAL PRIMARY KEY,
    complaint_id INT NOT NULL,
    tracking_id VARCHAR(36) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
);

CREATE TABLE escalation_history (
    id SERIAL PRIMARY KEY,
    complaint_id INT NOT NULL,
    escalation_level INT NOT NULL DEFAULT 1,
    reason TEXT,
    notified_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    INDEX idx_complaint (complaint_id),
    INDEX idx_level (escalation_level)
);

CREATE TABLE admin_whitelist (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_token (token)
);

CREATE TABLE password_resets (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token_hash (token_hash),
    INDEX idx_user_id (user_id),
    INDEX idx_expires (expires_at)
);


INSERT INTO users (email, password_hash, name, role, email_verified) VALUES 
('complaintportals@gmail.com', '$2b$10$V8nCXPCClgcjmyI4dmnOFuKWia35p7rd9NlQuT2oSzv/pWKziZaAG', 'System Admin', 'superadmin', TRUE);

-- Add to whitelist

-- ================= ALTER STATEMENTS (For existing databases) =================
-- Run these if you already have the tables:
-- ALTER TABLE users ADD COLUMN reset_token_expires TIMESTAMP NULL;