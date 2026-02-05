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
 * @param {object} db - MySQL database connection
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

  // ================= GET ALL USERS (Admin) =================
  router.get('/users', async (req, res) => {
    try {
      const [users] = await db.promise().query(
        'SELECT id, email, name, role, status, email_verified, created_at FROM users ORDER BY created_at DESC'
      );
      // Ensure status has a default value for users without one
      const usersWithStatus = users.map(u => ({
        ...u,
        status: u.status || 'active'
      }));
      res.json(usersWithStatus);
    } catch (err) {
      console.error('Get users error:', err);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // ================= CREATE USER (Admin) =================
  router.post('/users', async (req, res) => {
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
      const [existing] = await db.promise().query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER(?)',
        [email]
      );

      if (existing.length > 0) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }

      // Use provided password or generate a random one
      const finalPassword = password || Math.random().toString(36).slice(-8) + 'A1!';
      const passwordHash = await bcrypt.hash(finalPassword, 10);

      const [result] = await db.promise().query(
        'INSERT INTO users (email, password_hash, name, role, status, email_verified, created_at) VALUES (LOWER(?), ?, ?, ?, ?, FALSE, NOW())',
        [email, passwordHash, name || null, role, status]
      );

      console.log('📝 User created successfully:', result.insertId);

      res.status(201).json({
        id: result.insertId,
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

  // ================= UPDATE USER (General - handles role, status, name) =================
  router.put('/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { role, status, name, display_name } = req.body;

      console.log('📝 Update user request:', { id, role, status, name, display_name });

      // Build dynamic update query
      const updates = [];
      const values = [];

      if (role !== undefined) {
        const validRoles = ['user', 'admin', 'superadmin'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({ error: 'Invalid role. Must be: user, admin, or superadmin' });
        }
        updates.push('role = ?');
        values.push(role);
      }

      if (status !== undefined) {
        const validStatuses = ['active', 'inactive', 'suspended'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ error: 'Invalid status. Must be: active, inactive, or suspended' });
        }
        updates.push('status = ?');
        values.push(status);
      }

      if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
      }

      if (display_name !== undefined) {
        updates.push('name = ?');
        values.push(display_name);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update. Provide role, status, or name.' });
      }

      values.push(id);

      const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
      console.log('📝 Update query:', query, values);

      const [result] = await db.promise().query(query, values);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Fetch updated user
      const [updatedUser] = await db.promise().query(
        'SELECT id, email, name, role, status, email_verified, created_at FROM users WHERE id = ?',
        [id]
      );

      res.json({ 
        message: 'User updated successfully',
        user: updatedUser[0]
      });
    } catch (err) {
      console.error('Update user error:', err);
      res.status(500).json({ error: 'Failed to update user: ' + err.message });
    }
  });

  // ================= PATCH USER (Partial Update - preferred method) =================
  router.patch('/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { role, status, name, display_name } = req.body;

      console.log('📝 PATCH user request:', { id, role, status, name, display_name });

      // Build dynamic update query
      const updates = [];
      const values = [];

      if (role !== undefined) {
        const validRoles = ['user', 'admin', 'superadmin'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({ error: 'Invalid role. Must be: user, admin, or superadmin' });
        }
        updates.push('role = ?');
        values.push(role);
      }

      if (status !== undefined) {
        const validStatuses = ['active', 'inactive', 'suspended'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ error: 'Invalid status. Must be: active, inactive, or suspended' });
        }
        updates.push('status = ?');
        values.push(status);
      }

      if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
      }

      if (display_name !== undefined) {
        updates.push('name = ?');
        values.push(display_name);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update. Provide role, status, or name.' });
      }

      values.push(id);

      const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
      console.log('📝 PATCH query:', query, values);

      const [result] = await db.promise().query(query, values);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Fetch updated user
      const [updatedUser] = await db.promise().query(
        'SELECT id, email, name, role, status, email_verified, created_at FROM users WHERE id = ?',
        [id]
      );

      res.json({ 
        message: 'User updated successfully',
        user: updatedUser[0]
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

      const [result] = await db.promise().query(
        'UPDATE users SET role = ? WHERE id = ?',
        [role, id]
      );

      if (result.affectedRows === 0) {
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

      await db.promise().query('DELETE FROM users WHERE id = ?', [id]);

      res.json({ message: 'User deleted successfully' });
    } catch (err) {
      console.error('Delete user error:', err);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  // ================= GET ESCALATED COMPLAINTS =================
  router.get('/escalated-complaints', async (req, res) => {
    try {
      const [complaints] = await db.promise().query(`
        SELECT * FROM complaints 
        WHERE escalation_level > 0 AND status != 'resolved'
        ORDER BY escalation_level DESC, created_at ASC
      `);
      res.json(complaints);
    } catch (err) {
      console.error('Get escalated complaints error:', err);
      res.status(500).json({ error: 'Failed to fetch escalated complaints' });
    }
  });

  // ================= GET ESCALATION HISTORY FOR COMPLAINT =================
  router.get('/complaints/:id/escalation-history', async (req, res) => {
    try {
      const { id } = req.params;
      const [history] = await db.promise().query(
        'SELECT * FROM escalation_history WHERE complaint_id = ? ORDER BY created_at DESC',
        [id]
      );
      res.json(history);
    } catch (err) {
      console.error('Get escalation history error:', err);
      res.status(500).json({ error: 'Failed to fetch escalation history' });
    }
  });

  // ================= GET ADMIN DASHBOARD STATS =================
  router.get('/dashboard-stats', async (req, res) => {
    try {
      // Total complaints by status
      const [statusStats] = await db.promise().query(`
        SELECT status, COUNT(*) as count 
        FROM complaints 
        GROUP BY status
      `);

      // Total complaints by priority
      const [priorityStats] = await db.promise().query(`
        SELECT priority, COUNT(*) as count 
        FROM complaints 
        GROUP BY priority
      `);

      // Escalation stats
      const escalationStats = await getEscalationStats(db);

      // Recent activity (last 7 days)
      const [recentActivity] = await db.promise().query(`
        SELECT DATE(created_at) as date, COUNT(*) as count 
        FROM complaints 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);

      // Average resolution time
      const [avgResolution] = await db.promise().query(`
        SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) as avg_hours
        FROM complaints 
        WHERE status = 'resolved' AND resolved_at IS NOT NULL
      `);

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
      const [whitelist] = await db.promise().query(
        'SELECT * FROM admin_whitelist ORDER BY created_at DESC'
      );
      res.json(whitelist);
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

      await db.promise().query(
        'INSERT INTO admin_whitelist (email, created_at) VALUES (?, NOW())',
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

      await db.promise().query(
        'DELETE FROM admin_whitelist WHERE email = ?',
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
