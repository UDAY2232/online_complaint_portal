/**
 * JWT Configuration
 */

module.exports = {
  // Token expiration times
  ACCESS_TOKEN_EXPIRY: '24h',
  REFRESH_TOKEN_EXPIRY: '7d',
  
  // Token types
  TOKEN_TYPES: {
    ACCESS: 'access',
    REFRESH: 'refresh',
    EMAIL_VERIFICATION: 'email_verification',
    PASSWORD_RESET: 'password_reset',
  },
  
  // Role hierarchy (higher number = more permissions)
  ROLE_HIERARCHY: {
    user: 1,
    admin: 2,
    superadmin: 3,
  },
  
  // Roles enum
  ROLES: {
    USER: 'user',
    ADMIN: 'admin',
    SUPERADMIN: 'superadmin',
  },
};
