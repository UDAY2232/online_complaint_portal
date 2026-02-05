-- ================= PASSWORD RESETS TABLE =================
-- This migration creates a dedicated table for password reset tokens
-- Run this migration if it doesn't already exist

-- Create password_resets table
CREATE TABLE IF NOT EXISTS password_resets (
    id INT PRIMARY KEY AUTO_INCREMENT,
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

-- Note: The old columns in users table (reset_token_hash, reset_token_expires)
-- are deprecated and can be removed after migration if desired
