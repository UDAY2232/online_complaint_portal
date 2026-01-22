/**
 * Escalation Service
 * Handles automatic complaint escalation based on SLA rules
 */

const { checkSlaBreach, getSlaHours } = require('../config/sla');
const { sendEscalationEmail } = require('./emailService');

/**
 * Process escalations for all overdue complaints
 * @param {object} db - MySQL database connection
 */
const processEscalations = async (db) => {
  console.log('⏰ [ESCALATION] Starting escalation check...');
  
  try {
    // Fetch all unresolved complaints
    const [complaints] = await db.promise().query(`
      SELECT * FROM complaints 
      WHERE status != 'resolved'
      ORDER BY created_at ASC
    `);

    console.log(`⏰ [ESCALATION] Found ${complaints.length} unresolved complaints`);

    let escalatedCount = 0;
    const now = new Date();

    for (const complaint of complaints) {
      const slaCheck = checkSlaBreach(complaint.created_at, complaint.priority);

      if (slaCheck.breached) {
        // Check if we should escalate again (avoid spamming)
        // Only escalate if:
        // 1. Never escalated before, OR
        // 2. Escalated more than 24 hours ago
        const lastEscalation = complaint.escalated_at ? new Date(complaint.escalated_at) : null;
        const hoursSinceLastEscalation = lastEscalation 
          ? Math.floor((now - lastEscalation) / (1000 * 60 * 60))
          : Infinity;

        // Escalate every 24 hours after initial breach
        if (hoursSinceLastEscalation >= 24) {
          const newLevel = (complaint.escalation_level || 0) + 1;

          console.log(`⏰ [ESCALATION] Escalating complaint #${complaint.id}:`);
          console.log(`   - Priority: ${complaint.priority}`);
          console.log(`   - SLA Limit: ${slaCheck.slaLimit} hours`);
          console.log(`   - Hours Elapsed: ${slaCheck.hoursElapsed} hours`);
          console.log(`   - Hours Overdue: ${slaCheck.hoursOverdue} hours`);
          console.log(`   - New Escalation Level: ${newLevel}`);

          // Update complaint with escalation info
          await db.promise().query(`
            UPDATE complaints 
            SET escalation_level = ?, escalated_at = NOW()
            WHERE id = ?
          `, [newLevel, complaint.id]);

          // Log escalation to history
          await db.promise().query(`
            INSERT INTO escalation_history (complaint_id, escalation_level, reason, created_at)
            VALUES (?, ?, ?, NOW())
          `, [
            complaint.id, 
            newLevel, 
            `SLA breach: ${slaCheck.hoursOverdue} hours overdue (${complaint.priority} priority)`
          ]);

          // Send escalation email to admin
          const updatedComplaint = { ...complaint, escalation_level: newLevel };
          await sendEscalationEmail(updatedComplaint, slaCheck.hoursOverdue);

          escalatedCount++;
        }
      }
    }

    console.log(`⏰ [ESCALATION] Escalation check complete. Escalated: ${escalatedCount} complaints`);
    return { processed: complaints.length, escalated: escalatedCount };

  } catch (err) {
    console.error('⏰ [ESCALATION] ❌ Error during escalation check:', err.message);
    throw err;
  }
};

/**
 * Get escalation statistics
 * @param {object} db - MySQL database connection
 */
const getEscalationStats = async (db) => {
  try {
    const [stats] = await db.promise().query(`
      SELECT 
        COUNT(*) as total_unresolved,
        SUM(CASE WHEN escalation_level > 0 THEN 1 ELSE 0 END) as total_escalated,
        SUM(CASE WHEN escalation_level >= 3 THEN 1 ELSE 0 END) as critical_escalations,
        AVG(escalation_level) as avg_escalation_level
      FROM complaints 
      WHERE status != 'resolved'
    `);

    const [byPriority] = await db.promise().query(`
      SELECT 
        priority,
        COUNT(*) as count,
        SUM(CASE WHEN escalation_level > 0 THEN 1 ELSE 0 END) as escalated
      FROM complaints 
      WHERE status != 'resolved'
      GROUP BY priority
    `);

    return {
      summary: stats[0],
      byPriority,
    };
  } catch (err) {
    console.error('⏰ [ESCALATION] ❌ Error fetching stats:', err.message);
    throw err;
  }
};

module.exports = {
  processEscalations,
  getEscalationStats,
};
