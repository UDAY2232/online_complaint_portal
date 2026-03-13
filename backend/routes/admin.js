/**
 * Admin Routes
 * Protected routes for admin-only operations
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticate, requireAdmin, requireSuperadmin } = require('../middleware/auth');
const { getEscalationStats } = require('../services/escalationService');
const { triggerEscalationCheck } = require('../services/scheduler');
const { sendStatusChangeEmail } = require('../services/emailService');

/**
 * Initialize admin routes with database connection
 * @param {object} db - PostgreSQL database connection
 */
const initAdminRoutes = (db) => {

  // Apply authentication and admin role check to all routes
  router.use(authenticate);
  router.use(requireAdmin);

  // ================= GET ESCALATION STATS =================
  router.get('/escalation-stats', async (req, res) => {
    try {
      const stats = await getEscalationStats(db);
      res.json(stats);
    } catch (err) {
      console.error('Get escalation stats error:', err);
      res.status(500).json({ error: 'Failed to get escalation stats' });
    }
  });

  // ================= TRIGGER MANUAL ESCALATION CHECK =================
  router.post('/trigger-escalation', async (req, res) => {
    try {
      const result = await triggerEscalationCheck(db);
      res.json({
        message: 'Escalation check completed',
        ...result,
      });
    } catch (err) {
      console.error('Trigger escalation error:', err);
      res.status(500).json({ error: 'Failed to trigger escalation check' });
    }
  });

  // ================= ESCALATE COMPLAINT =================
  router.post('/escalate/:complaintId', async (req, res) => {
    try {
      const { complaintId } = req.params;
      const { reason } = req.body;

      // Get current complaint
      const complaint = await db.query(
        'SELECT id, escalated, escalation_level, status FROM complaints WHERE id = $1',
        [complaintId]
      );

      if (complaint.rows.length === 0) {
        return res.status(404).json({ error: 'Complaint not found' });
      }

      const currentComplaint = complaint.rows[0];
      const newEscalationLevel = (currentComplaint.escalation_level || 0) + 1;

      // Update complaint with escalation
      await db.query(
        `UPDATE complaints 
         SET escalated = TRUE, escalation_level = $1, escalated_by = $2, escalated_at = NOW(), status_updated_at = NOW()
         WHERE id = $3`,
        [newEscalationLevel, req.user.id, complaintId]
      );

      // Record in escalation_history
      await db.query(
        `INSERT INTO escalation_history (complaint_id, escalation_level, reason, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [complaintId, newEscalationLevel, reason || 'Escalated by admin']
      );

      // 📝 Record status history
      try {
        await db.query(`
          INSERT INTO status_history (complaint_id, old_status, new_status, changed_by, changed_by_role, changed_at, notes)
          VALUES ($1, $2, $3, $4, 'admin', NOW(), $5)
        `, [complaintId, currentComplaint.status, 'escalated', req.user?.email || 'system', `Escalated to level ${newEscalationLevel}`]);
      } catch (historyErr) {
        console.warn('Failed to record escalation in status history:', historyErr.message);
      }

      res.json({
        success: true,
        message: `Complaint escalated to level ${newEscalationLevel}`,
        escalationLevel: newEscalationLevel
      });
    } catch (err) {
      console.error('Escalate complaint error:', err);
      res.status(500).json({ error: 'Failed to escalate complaint: ' + err.message });
    }
  });

  // ================= GET ALL USERS (Admin can view only) =================
  router.get('/users', requireSuperadmin, async (req, res) => {
    try {
      const result = await db.query(
        'SELECT id, email, name, role, status, email_verified, created_at FROM users ORDER BY created_at DESC'
      );
      // Ensure status has a default value for users without one
      const usersWithStatus = result.rows.map(u => ({
        ...u,
        status: u.status || 'active'
      }));
      res.json(usersWithStatus);
    } catch (err) {
      console.error('Get users error:', err);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // ================= CREATE USER (Superadmin only) =================
  router.post('/users', requireSuperadmin, async (req, res) => {
    try {
      const { email, password, name, role = 'user', status = 'active' } = req.body;
      const bcrypt = require('bcryptjs');

      console.log('📝 Create user request:', { email, name, role, status, hasPassword: !!password });

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Validate role
      const validRoles = ['user', 'admin', 'superadmin'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be: user, admin, or superadmin' });
      }

      // Validate status
      const validStatuses = ['active', 'inactive', 'suspended'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be: active, inactive, or suspended' });
      }

      // Check if user already exists
      const existingResult = await db.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
      );
      const existing = existingResult.rows;

      if (existing.length > 0) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }

      // Use provided password or generate a random one
      const finalPassword = password || Math.random().toString(36).slice(-8) + 'A1!';
      const passwordHash = await bcrypt.hash(finalPassword, 10);

      const result = await db.query(
        'INSERT INTO users (email, password_hash, name, role, status, email_verified, created_at) VALUES (LOWER($1), $2, $3, $4, $5, FALSE, NOW()) RETURNING id',
        [email, passwordHash, name || null, role, status]
      );
      const userId = result.rows[0].id;
      console.log('📝 User created successfully:', userId);
      res.status(201).json({
        id: userId,
        email: email.toLowerCase(),
        name: name || null,
        role,
        status,
        message: 'User created successfully'
      });
    } catch (err) {
      console.error('Create user error:', err);
      res.status(500).json({ error: 'Failed to create user: ' + err.message });
    }
  });

  // ================= UPDATE USER (Superadmin only - handles role, status, name) =================
  router.put('/users/:id', requireSuperadmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { role, status, name, display_name } = req.body;

      console.log('📝 Update user request:', { id, role, status, name, display_name });

      // Build dynamic update query for PostgreSQL
      const updates = [];
      const values = [];

      if (role !== undefined) {
        const validRoles = ['user', 'admin', 'superadmin'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({ error: 'Invalid role. Must be: user, admin, or superadmin' });
        }
        updates.push(`role = $${updates.length + 1}`);
        values.push(role);
      }

      if (status !== undefined) {
        const validStatuses = ['active', 'inactive', 'suspended'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ error: 'Invalid status. Must be: active, inactive, or suspended' });
        }
        updates.push(`status = $${updates.length + 1}`);
        values.push(status);
      }

      if (name !== undefined) {
        updates.push(`name = $${updates.length + 1}`);
        values.push(name);
      }

      if (display_name !== undefined) {
        updates.push(`name = $${updates.length + 1}`);
        values.push(display_name);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update. Provide role, status, or name.' });
      }

      values.push(id);

      const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${updates.length + 1} RETURNING id, email, name, role, status, email_verified, created_at`;
      console.log('📝 Update query:', query, values);

      const result = await db.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ 
        message: 'User updated successfully',
        user: result.rows[0]
      });
    } catch (err) {
      console.error('Update user error:', err);
      res.status(500).json({ error: 'Failed to update user: ' + err.message });
    }
  });

  // ================= PATCH USER (Superadmin only - partial update) =================
  router.patch('/users/:id', requireSuperadmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { role, status, name, display_name } = req.body;

      console.log('📝 PATCH user request:', { id, role, status, name, display_name });

      // Build dynamic update query for PostgreSQL
      const updates = [];
      const values = [];

      if (role !== undefined) {
        const validRoles = ['user', 'admin', 'superadmin'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({ error: 'Invalid role. Must be: user, admin, or superadmin' });
        }
        updates.push(`role = $${updates.length + 1}`);
        values.push(role);
      }

      if (status !== undefined) {
        const validStatuses = ['active', 'inactive', 'suspended'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ error: 'Invalid status. Must be: active, inactive, or suspended' });
        }
        updates.push(`status = $${updates.length + 1}`);
        values.push(status);
      }

      if (name !== undefined) {
        updates.push(`name = $${updates.length + 1}`);
        values.push(name);
      }

      if (display_name !== undefined) {
        updates.push(`name = $${updates.length + 1}`);
        values.push(display_name);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update. Provide role, status, or name.' });
      }

      values.push(id);

      const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${updates.length + 1} RETURNING id, email, name, role, status, email_verified, created_at`;
      console.log('📝 PATCH query:', query, values);

      const result = await db.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ 
        message: 'User updated successfully',
        user: result.rows[0]
      });
    } catch (err) {
      console.error('PATCH user error:', err);
      res.status(500).json({ error: 'Failed to update user: ' + err.message });
    }
  });

  // ================= UPDATE USER ROLE (Superadmin only - legacy endpoint) =================
  router.put('/users/:id/role', requireSuperadmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      const validRoles = ['user', 'admin', 'superadmin'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      const result = await db.query(
        'UPDATE users SET role = $1 WHERE id = $2 RETURNING id',
        [role, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User role updated successfully' });
    } catch (err) {
      console.error('Update user role error:', err);
      res.status(500).json({ error: 'Failed to update user role' });
    }
  });

  // ================= DELETE USER (Superadmin only) =================
  router.delete('/users/:id', requireSuperadmin, async (req, res) => {
    try {
      const { id } = req.params;

      // Prevent self-deletion
      if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      await db.query('DELETE FROM users WHERE id = $1', [id]);

      res.json({ message: 'User deleted successfully' });
    } catch (err) {
      console.error('Delete user error:', err);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  // ================= GET ESCALATED COMPLAINTS =================
  router.get('/escalated-complaints', async (req, res) => {
    try {
      const result = await db.query(`
        SELECT * FROM complaints 
        WHERE escalation_level > 0 AND status != 'resolved'
        ORDER BY escalation_level DESC, created_at ASC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error('Get escalated complaints error:', err);
      res.status(500).json({ error: 'Failed to fetch escalated complaints' });
    }
  });

  // ================= GET ESCALATION HISTORY FOR COMPLAINT =================
  router.get('/complaints/:id/escalation-history', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await db.query(
        'SELECT * FROM escalation_history WHERE complaint_id = $1 ORDER BY created_at DESC',
        [id]
      );
      res.json(result.rows);
    } catch (err) {
      console.error('Get escalation history error:', err);
      res.status(500).json({ error: 'Failed to fetch escalation history' });
    }
  });

  // ================= GET ADMIN DASHBOARD STATS =================
  router.get('/dashboard-stats', async (req, res) => {
    try {
      // Total complaints by status
      const statusStatsResult = await db.query(`
        SELECT status, COUNT(*) as count 
        FROM complaints 
        GROUP BY status
      `);
      const statusStats = statusStatsResult.rows;

      // Total complaints by priority
      const priorityStatsResult = await db.query(`
        SELECT priority, COUNT(*) as count 
        FROM complaints 
        GROUP BY priority
      `);
      const priorityStats = priorityStatsResult.rows;

      // Escalation stats
      const escalationStats = await getEscalationStats(db);

      // Recent activity (last 7 days)
      const recentActivityResult = await db.query(`
        SELECT DATE(created_at) as date, COUNT(*) as count 
        FROM complaints 
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);
      const recentActivity = recentActivityResult.rows;

      // Average resolution time
      const avgResolutionResult = await db.query(`
        SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_hours
        FROM complaints 
        WHERE status = $1 AND resolved_at IS NOT NULL
      `, ['resolved']);
      const avgResolution = avgResolutionResult.rows;

      res.json({
        byStatus: statusStats,
        byPriority: priorityStats,
        escalation: escalationStats,
        recentActivity,
        avgResolutionHours: avgResolution[0]?.avg_hours || 0,
      });
    } catch (err) {
      console.error('Get dashboard stats error:', err);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  });

  // ================= WHITELIST MANAGEMENT (Superadmin only) =================
  router.get('/admin-whitelist', requireSuperadmin, async (req, res) => {
    try {
      const result = await db.query(
        'SELECT * FROM admin_whitelist ORDER BY created_at DESC'
      );
      res.json(result.rows);
    } catch (err) {
      console.error('Get admin whitelist error:', err);
      res.status(500).json({ error: 'Failed to fetch admin whitelist' });
    }
  });

  router.post('/admin-whitelist', requireSuperadmin, async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email required' });
      }

      await db.query(
        'INSERT INTO admin_whitelist (email, created_at) VALUES ($1, NOW())',
        [email]
      );

      res.status(201).json({ message: 'Email added to admin whitelist' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Email already in whitelist' });
      }
      console.error('Add to admin whitelist error:', err);
      res.status(500).json({ error: 'Failed to add to admin whitelist' });
    }
  });

  router.delete('/admin-whitelist/:email', requireSuperadmin, async (req, res) => {
    try {
      const { email } = req.params;

      await db.query(
        'DELETE FROM admin_whitelist WHERE email = $1',
        [email]
      );

      res.json({ message: 'Email removed from admin whitelist' });
    } catch (err) {
      console.error('Remove from admin whitelist error:', err);
      res.status(500).json({ error: 'Failed to remove from admin whitelist' });
    }
  });

  return router;
};

module.exports = initAdminRoutes;
