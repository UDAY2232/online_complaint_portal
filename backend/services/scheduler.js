/**
 * Scheduler Service
 * Manages cron jobs and scheduled tasks
 */

const { processEscalations } = require('./escalationService');

// Store interval reference for cleanup
let escalationInterval = null;

/**
 * Start the escalation scheduler
 * Runs every hour to check for SLA breaches
 * @param {object} db - MySQL database connection
 */
const startEscalationScheduler = (db) => {
  // Run immediately on startup
  console.log('⏰ [SCHEDULER] Starting escalation scheduler...');
  
  // Initial run after 30 seconds (give DB time to connect)
  setTimeout(async () => {
    console.log('⏰ [SCHEDULER] Running initial escalation check...');
    try {
      await processEscalations(db);
    } catch (err) {
      console.error('⏰ [SCHEDULER] Initial escalation check failed:', err.message);
    }
  }, 30000);

  // Schedule hourly checks
  const ONE_HOUR = 60 * 60 * 1000; // 1 hour in milliseconds
  
  escalationInterval = setInterval(async () => {
    console.log('⏰ [SCHEDULER] Running scheduled escalation check...');
    try {
      await processEscalations(db);
    } catch (err) {
      console.error('⏰ [SCHEDULER] Scheduled escalation check failed:', err.message);
    }
  }, ONE_HOUR);

  console.log('⏰ [SCHEDULER] ✅ Escalation scheduler started (runs every hour)');
};

/**
 * Stop the escalation scheduler
 */
const stopEscalationScheduler = () => {
  if (escalationInterval) {
    clearInterval(escalationInterval);
    escalationInterval = null;
    console.log('⏰ [SCHEDULER] Escalation scheduler stopped');
  }
};

/**
 * Manually trigger escalation check (for admin use)
 * @param {object} db - MySQL database connection
 */
const triggerEscalationCheck = async (db) => {
  console.log('⏰ [SCHEDULER] Manual escalation check triggered...');
  return await processEscalations(db);
};

module.exports = {
  startEscalationScheduler,
  stopEscalationScheduler,
  triggerEscalationCheck,
};
