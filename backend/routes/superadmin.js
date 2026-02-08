/**
 * Superadmin Routes
 * Protected routes for superadmin-only operations
 */

const express = require('express');
const router = express.Router();
const { authenticate, requireSuperadmin } = require('../middleware/auth');

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
        SELECT *
        FROM complaints
        WHERE escalation_level > 0
        AND status != 'resolved'
        ORDER BY escalation_level DESC, created_at ASC
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

  return router;
};

module.exports = initSuperadminRoutes;
