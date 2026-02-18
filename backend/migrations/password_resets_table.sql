-- ================= PASSWORD RESETS TABLE =================
-- This migration creates a dedicated table for password reset tokens
-- Run this migration if it doesn't already exist

CREATE TABLE password_resets (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Note: The old columns in users table (reset_token_hash, reset_token_expires)
-- are deprecated and can be removed after migration if desired
