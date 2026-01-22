/**
 * SLA Configuration
 * Defines time limits (in hours) for complaint resolution based on priority
 */

const SLA_LIMITS = {
  high: 24,    // 24 hours for high priority
  medium: 48,  // 48 hours for medium priority
  low: 72,     // 72 hours for low priority
};

/**
 * Get SLA limit in hours based on priority
 * @param {string} priority - 'high', 'medium', or 'low'
 * @returns {number} - Hours before escalation
 */
const getSlaHours = (priority) => {
  return SLA_LIMITS[priority] || SLA_LIMITS.low;
};

/**
 * Check if a complaint has breached SLA
 * @param {Date} createdAt - Complaint creation timestamp
 * @param {string} priority - Complaint priority
 * @returns {object} - { breached: boolean, hoursElapsed: number, slaLimit: number }
 */
const checkSlaBreach = (createdAt, priority) => {
  const now = new Date();
  const created = new Date(createdAt);
  const hoursElapsed = Math.floor((now - created) / (1000 * 60 * 60));
  const slaLimit = getSlaHours(priority);
  
  return {
    breached: hoursElapsed > slaLimit,
    hoursElapsed,
    slaLimit,
    hoursOverdue: Math.max(0, hoursElapsed - slaLimit),
  };
};

module.exports = {
  SLA_LIMITS,
  getSlaHours,
  checkSlaBreach,
};
