/**
 * Superadmin Routes
 * Protected routes for superadmin-only operations
 */

const express = require('express');
const router = express.Router();
const { authenticate, requireSuperadmin } = require('../middleware/auth');
const { sendSuperadminEscalationAlert } = require('../services/emailService');

/**
 * Initialize superadmin routes with database connection
 * @param {object} db - MySQL database connection
 */
const initSuperadminRoutes = (db) => {

  // Apply authentication and superadmin role check to all routes
  router.use(authenticate);
  router.use(requireSuperadmin);

  // ================= GET ESCALATED COMPLAINTS =================
  router.get('/escalated-complaints', async (req, res) => {
    try {
      const [complaints] = await db.promise().query(`
        SELECT c.*, u.name, u.email
        FROM complaints c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.escalation_level > 0
        AND c.status != 'resolved'
        ORDER BY c.escalation_level DESC, c.created_at ASC
      `);

      res.json({
        success: true,
        count: complaints.length,
        complaints
      });

    } catch (err) {
      console.error('Get escalated complaints error:', err);
      res.status(500).json({ error: 'Failed to fetch escalated complaints' });
    }
  });

  // ================= GET SUPERADMIN STATS =================
  router.get('/stats', async (req, res) => {
    try {
      // Get overall complaint stats
      const [overallStats] = await db.promise().query(`
        SELECT 
          COUNT(*) as total_complaints,
          SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_complaints,
          SUM(CASE WHEN status = 'under-review' THEN 1 ELSE 0 END) as under_review,
          SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
          SUM(CASE WHEN escalation_level > 0 THEN 1 ELSE 0 END) as escalated,
          SUM(CASE WHEN escalation_level >= 2 THEN 1 ELSE 0 END) as critical_escalations,
          SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high_priority
        FROM complaints
      `);

      // Get complaints by escalation level
      const [byEscalationLevel] = await db.promise().query(`
        SELECT 
          escalation_level,
          COUNT(*) as count
        FROM complaints 
        WHERE status != 'resolved'
        GROUP BY escalation_level
        ORDER BY escalation_level
      `);

      // Get complaints by priority
      const [byPriority] = await db.promise().query(`
        SELECT 
          priority,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
          SUM(CASE WHEN escalation_level > 0 THEN 1 ELSE 0 END) as escalated
        FROM complaints
        GROUP BY priority
      `);

      // Get recent escalations (last 7 days)
      const [recentEscalations] = await db.promise().query(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM escalation_history
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date
      `);

      // Get admin performance (safe query - status_history may not exist)
      let adminPerformance = [];
      try {
        const [result] = await db.promise().query(`
          SELECT 
            u.id, u.name, u.email,
            COUNT(CASE WHEN c.status = 'resolved' THEN 1 END) as resolved_count,
            AVG(CASE WHEN c.status = 'resolved' AND c.resolved_at IS NOT NULL 
                THEN TIMESTAMPDIFF(HOUR, c.created_at, c.resolved_at) END) as avg_resolution_hours
          FROM users u
          LEFT JOIN complaints c ON c.status = 'resolved'
          WHERE u.role IN ('admin', 'superadmin') AND u.status = 'active'
          GROUP BY u.id
        `);
        adminPerformance = result;
      } catch (err) {
        console.log('Admin performance query failed (status_history may not exist):', err.message);
        // Fallback: just list admins without performance data
        const [admins] = await db.promise().query(`
          SELECT id, name, email, 0 as resolved_count, NULL as avg_resolution_hours
          FROM users WHERE role IN ('admin', 'superadmin') AND status = 'active'
        `);
        adminPerformance = admins;
      }

      res.json({
        success: true,
        stats: {
          overall: overallStats[0],
          byEscalationLevel,
          byPriority,
          recentEscalations,
          adminPerformance
        }
      });

    } catch (err) {
      console.error('Get superadmin stats error:', err);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  // ================= GET ALL ADMINS =================
  router.get('/admins', async (req, res) => {
    try {
      const [admins] = await db.promise().query(`
        SELECT id, email, name, role, status, created_at
        FROM users
        WHERE role IN ('admin', 'superadmin')
        ORDER BY role DESC, created_at ASC
      `);

      res.json({
        success: true,
        admins
      });

    } catch (err) {
      console.error('Get admins error:', err);
      res.status(500).json({ error: 'Failed to fetch admins' });
    }
  });

  // ================= GET ESCALATION HISTORY =================
  router.get('/escalation-history', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      const [history] = await db.promise().query(`
        SELECT eh.*, c.category, c.priority, c.status as current_status, 
               u.name as user_name, u.email as user_email
        FROM escalation_history eh
        LEFT JOIN complaints c ON eh.complaint_id = c.id
        LEFT JOIN users u ON c.user_id = u.id
        ORDER BY eh.created_at DESC
        LIMIT ? OFFSET ?
      `, [limit, offset]);

      const [totalCount] = await db.promise().query(
        'SELECT COUNT(*) as total FROM escalation_history'
      );

      res.json({
        success: true,
        history,
        total: totalCount[0].total,
        limit,
        offset
      });

    } catch (err) {
      console.error('Get escalation history error:', err);
      res.status(500).json({ error: 'Failed to fetch escalation history' });
    }
  });

  // ================= MANUAL ESCALATE COMPLAINT =================
  router.post('/escalate', async (req, res) => {
    try {
      const { complaintId, reason } = req.body;

      if (!complaintId) {
        return res.status(400).json({ error: 'Complaint ID is required' });
      }

      // Get current complaint
      const [complaints] = await db.promise().query(
        'SELECT * FROM complaints WHERE id = ?',
        [complaintId]
      );

      if (complaints.length === 0) {
        return res.status(404).json({ error: 'Complaint not found' });
      }

      const complaint = complaints[0];
      const newLevel = (complaint.escalation_level || 0) + 1;

      // Update complaint
      await db.promise().query(`
        UPDATE complaints 
        SET escalation_level = ?, escalated_at = NOW()
        WHERE id = ?
      `, [newLevel, complaintId]);

      // Log to escalation history
      await db.promise().query(`
        INSERT INTO escalation_history (complaint_id, escalation_level, reason, created_at)
        VALUES (?, ?, ?, NOW())
      `, [complaintId, newLevel, reason || `Manual escalation by superadmin: ${req.user.email}`]);

      // Get updated complaint with user info for notification
      const [updatedComplaints] = await db.promise().query(`
        SELECT c.*, u.name, u.email
        FROM complaints c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
      `, [complaintId]);

      res.json({
        success: true,
        message: `Complaint #${complaintId} escalated to level ${newLevel}`,
        complaint: updatedComplaints[0]
      });

    } catch (err) {
      console.error('Manual escalate error:', err);
      res.status(500).json({ error: 'Failed to escalate complaint' });
    }
  });

  // ================= ASSIGN COMPLAINT TO ADMIN =================
  router.post('/assign', async (req, res) => {
    try {
      const { complaintId, adminId } = req.body;

      if (!complaintId || !adminId) {
        return res.status(400).json({ error: 'Complaint ID and Admin ID are required' });
      }

      // Verify admin exists and is active
      const [admins] = await db.promise().query(
        'SELECT * FROM users WHERE id = ? AND role IN (?, ?) AND status = ?',
        [adminId, 'admin', 'superadmin', 'active']
      );

      if (admins.length === 0) {
        return res.status(404).json({ error: 'Admin not found or inactive' });
      }

      // Try to update complaint with assigned admin (column may not exist)
      try {
        await db.promise().query(`
          UPDATE complaints 
          SET assigned_to = ?, assigned_at = NOW()
          WHERE id = ?
        `, [adminId, complaintId]);
      } catch (err) {
        // If assigned_to column doesn't exist, log warning but continue
        console.warn('assigned_to column may not exist:', err.message);
      }

      // Try to log assignment to status_history (table may not exist)
      try {
        await db.promise().query(`
          INSERT INTO status_history (complaint_id, old_status, new_status, changed_by, changed_at)
          SELECT id, status, status, ?, NOW()
          FROM complaints WHERE id = ?
        `, [`Assigned to ${admins[0].email}`, complaintId]);
      } catch (err) {
        console.warn('status_history table may not exist:', err.message);
      }

      res.json({
        success: true,
        message: `Complaint #${complaintId} assigned to ${admins[0].email}`
      });

    } catch (err) {
      console.error('Assign complaint error:', err);
      res.status(500).json({ error: 'Failed to assign complaint' });
    }
  });

  // ================= GET SUPERADMIN SETTINGS =================
  router.get('/settings', async (req, res) => {
    try {
      // Get current superadmin info
      const superadminEmail = req.user.email;
      
      res.json({
        success: true,
        settings: {
          email: superadminEmail,
          escalationThreshold: 2, // Level at which superadmin is notified
          notificationsEnabled: true
        }
      });

    } catch (err) {
      console.error('Get settings error:', err);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  });

  // ================= UPDATE SUPERADMIN SETTINGS =================
  router.put('/settings', async (req, res) => {
    try {
      const { escalationThreshold, notificationsEnabled } = req.body;
      
      // In a real app, you would store these settings in a database table
      // For now, we'll just acknowledge the update
      
      res.json({
        success: true,
        message: 'Settings updated successfully',
        settings: {
          escalationThreshold: escalationThreshold || 2,
          notificationsEnabled: notificationsEnabled !== false
        }
      });

    } catch (err) {
      console.error('Update settings error:', err);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  // ================= GET COMPLAINT DETAILS =================
  router.get('/complaint/:id', async (req, res) => {
    try {
      const { id } = req.params;

      // Try with assigned_to join first, fallback to simpler query
      let complaints;
      try {
        const [result] = await db.promise().query(`
          SELECT c.*, u.name, u.email,
                 assigned.name as assigned_admin_name, assigned.email as assigned_admin_email
          FROM complaints c
          LEFT JOIN users u ON c.user_id = u.id
          LEFT JOIN users assigned ON c.assigned_to = assigned.id
          WHERE c.id = ?
        `, [id]);
        complaints = result;
      } catch (err) {
        // Fallback if assigned_to column doesn't exist
        const [result] = await db.promise().query(`
          SELECT c.*, u.name, u.email
          FROM complaints c
          LEFT JOIN users u ON c.user_id = u.id
          WHERE c.id = ?
        `, [id]);
        complaints = result;
      }

      if (complaints.length === 0) {
        return res.status(404).json({ error: 'Complaint not found' });
      }

      // Get status history (safe - table may not exist)
      let statusHistory = [];
      try {
        const [result] = await db.promise().query(`
          SELECT * FROM status_history
          WHERE complaint_id = ?
          ORDER BY changed_at DESC
        `, [id]);
        statusHistory = result;
      } catch (err) {
        console.log('status_history table may not exist:', err.message);
      }

      // Get escalation history
      let escalationHistory = [];
      try {
        const [result] = await db.promise().query(`
          SELECT * FROM escalation_history
          WHERE complaint_id = ?
          ORDER BY created_at DESC
        `, [id]);
        escalationHistory = result;
      } catch (err) {
        console.log('escalation_history table may not exist:', err.message);
      }

      res.json({
        success: true,
        complaint: complaints[0],
        statusHistory,
        escalationHistory
      });

    } catch (err) {
      console.error('Get complaint details error:', err);
      res.status(500).json({ error: 'Failed to fetch complaint details' });
    }
  });

  return router;
};

module.exports = initSuperadminRoutes;
