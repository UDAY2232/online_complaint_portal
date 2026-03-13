-- ================= COMPLETE FEATURE MIGRATION =================
-- Adds: Before/After Images, Status History, Escalation fields, Admin tracking

-- 1. Update complaints table
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS before_image_url VARCHAR(500);
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS after_image_url VARCHAR(500);
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS resolved_by INT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS admin_id INT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS escalated BOOLEAN DEFAULT FALSE;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS escalated_by INT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP;

-- Add foreign key for resolved_by
ALTER TABLE complaints ADD CONSTRAINT fk_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE complaints ADD CONSTRAINT fk_admin_id FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE complaints ADD CONSTRAINT fk_escalated_by FOREIGN KEY (escalated_by) REFERENCES users(id) ON DELETE SET NULL;

-- 2. Create status_history table
CREATE TABLE IF NOT EXISTS status_history (
    id SERIAL PRIMARY KEY,
    complaint_id INT NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_by VARCHAR(255),
    changed_by_role VARCHAR(20),
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    INDEX idx_complaint_id (complaint_id),
    INDEX idx_changed_at (changed_at)
);

-- 3. Index for escalations
CREATE INDEX IF NOT EXISTS idx_escalated ON complaints(escalated);
CREATE INDEX IF NOT EXISTS idx_escalated_by ON complaints(escalated_by);

-- 4. Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_resolved_by ON complaints(resolved_by);
CREATE INDEX IF NOT EXISTS idx_admin_id ON complaints(admin_id);
CREATE INDEX IF NOT EXISTS idx_status_updated_at ON complaints(status_updated_at);

-- Sample data to ensure the system works - optional
-- Note: These are defensive queries that check if data exists before inserting
