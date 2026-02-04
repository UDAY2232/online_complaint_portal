/**
 * Authentication & Authorization Middleware
 * Implements JWT-based authentication and role-based access control
 */

const jwt = require('jsonwebtoken');
const { ROLES, ROLE_HIERARCHY } = require('../config/jwt');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

/**
 * Generate JWT Access Token
 * @param {object} payload - { id, email, role, name (optional) }
 * @returns {string} - JWT token
 */
const generateAccessToken = (payload) => {
  return jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      name: payload.name || null,  // Include name in token for display
      type: 'access',
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

/**
 * Generate Refresh Token
 * @param {object} payload - { id, email }
 * @returns {string} - JWT refresh token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      type: 'refresh',
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * Generate Email Verification Token
 * @param {string} email - User email
 * @returns {string} - JWT token
 */
const generateEmailVerificationToken = (email) => {
  return jwt.sign(
    {
      email,
      type: 'email_verification',
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

/**
 * Verify JWT Token
 * @param {string} token - JWT token
 * @returns {object|null} - Decoded payload or null if invalid
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

/**
 * Middleware: Authenticate JWT Token
 * Extracts and verifies JWT from Authorization header
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'Access denied', 
        message: 'No authorization header provided' 
      });
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ 
        error: 'Invalid token', 
        message: 'Token is invalid or expired' 
      });
    }

    if (decoded.type !== 'access') {
      return res.status(401).json({ 
        error: 'Invalid token type', 
        message: 'Please use an access token' 
      });
    }

    // Attach user info to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (err) {
    console.error('Authentication error:', err.message);
    return res.status(401).json({ 
      error: 'Authentication failed', 
      message: err.message 
    });
  }
};

/**
 * Middleware: Optional Authentication
 * Authenticates if token is provided, continues without user if not
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      req.user = null;
      return next();
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    const decoded = verifyToken(token);
    
    if (decoded && decoded.type === 'access') {
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      };
    } else {
      req.user = null;
    }

    next();
  } catch (err) {
    req.user = null;
    next();
  }
};

/**
 * Middleware Factory: Require Specific Role
 * @param {string|string[]} allowedRoles - Role or array of roles allowed
 */
const requireRole = (allowedRoles) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: `Access denied. Required role: ${roles.join(' or ')}` 
      });
    }

    next();
  };
};

/**
 * Middleware: Require Admin Role
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Authentication required' 
    });
  }

  if (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.SUPERADMIN) {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Admin access required' 
    });
  }

  next();
};

/**
 * Middleware: Require Superadmin Role
 */
const requireSuperadmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Authentication required' 
    });
  }

  if (req.user.role !== ROLES.SUPERADMIN) {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Superadmin access required' 
    });
  }

  next();
};

/**
 * Middleware: Require User Role (regular users only)
 */
const requireUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Authentication required' 
    });
  }

  // Allow users, admins, and superadmins to access user routes
  // If you want to restrict to only users, remove the admin/superadmin check
  next();
};

/**
 * Middleware: Check if user has minimum role level
 * @param {string} minRole - Minimum role required
 */
const requireMinRole = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: `Insufficient permissions. Minimum role required: ${minRole}` 
      });
    }

    next();
  };
};

/**
 * Middleware: Verify user owns the resource or is admin
 * Checks if req.user.email matches a specified field
 */
const requireOwnerOrAdmin = (emailField = 'email') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
    }

    // Admins can access any resource
    if (req.user.role === ROLES.ADMIN || req.user.role === ROLES.SUPERADMIN) {
      return next();
    }

    // For users, we'll check ownership in the route handler
    // Set a flag to indicate ownership check is required
    req.checkOwnership = true;
    req.ownerEmailField = emailField;
    
    next();
  };
};

module.exports = {
  JWT_SECRET,
  generateAccessToken,
  generateRefreshToken,
  generateEmailVerificationToken,
  verifyToken,
  authenticate,
  optionalAuth,
  requireRole,
  requireAdmin,
  requireSuperadmin,
  requireUser,
  requireMinRole,
  requireOwnerOrAdmin,
};
