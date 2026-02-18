-- ===============================================
-- SUPERADMIN FEATURES MIGRATION
-- ===============================================
-- Run this migration to add superadmin features

-- ================= STATUS HISTORY TABLE =================
-- Track all status changes for complaints
CREATE TABLE status_history (
    id SERIAL PRIMARY KEY,
    complaint_id INT NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by VARCHAR(255),  -- Email or name of who changed it
    notes TEXT,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
);

-- ================= ASSIGNED_TO COLUMN =================
-- Add assigned_to column to complaints for admin assignment
-- Run these one by one:

-- ALTER TABLE complaints ADD COLUMN assigned_to INT NULL;
-- ALTER TABLE complaints ADD COLUMN assigned_at TIMESTAMP NULL;
-- ALTER TABLE complaints ADD FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

-- ================= SUPERADMIN SETTINGS TABLE (Optional) =================
CREATE TABLE superadmin_settings (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    escalation_notification_threshold INT DEFAULT 2,
    email_notifications_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ================= INSERT DEFAULT SETTINGS FOR EXISTING SUPERADMINS =================
-- INSERT INTO superadmin_settings (user_id, escalation_notification_threshold)
-- SELECT id, 2 FROM users WHERE role = 'superadmin'
-- ON CONFLICT (user_id) DO NOTHING;
