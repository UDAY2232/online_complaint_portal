/**
 * Security Middleware
 * Production-ready security configurations
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

// ================= RATE LIMITERS =================

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use default key generator (handles IPv6 properly)
});

/**
 * Auth rate limiter (stricter)
 * 5 login attempts per 15 minutes per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    error: 'Too many login attempts. Please try again after 15 minutes.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

/**
 * Complaint submission rate limiter
 * 10 complaints per hour per IP
 */
const complaintLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    error: 'Too many complaints submitted. Please try again after an hour.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Password reset rate limiter
 * 3 attempts per hour per IP
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    error: 'Too many password reset attempts. Please try again after an hour.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ================= HELMET CONFIGURATION =================

const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.cloudinary.com", "https://res.cloudinary.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow images from Cloudinary
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

// ================= INPUT SANITIZATION =================

/**
 * Sanitize user input to prevent XSS
 */
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Remove potential XSS patterns
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    }
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        obj[key] = sanitize(obj[key]);
      }
    }
    return obj;
  };

  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);

  next();
};

// ================= REQUEST VALIDATION =================

/**
 * Validate email format
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 * At least 8 chars, 1 uppercase, 1 lowercase, 1 number
 */
const validatePassword = (password) => {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
};

/**
 * Signup validation middleware
 */
const validateSignup = (req, res, next) => {
  const { email, password, name } = req.body;
  const errors = [];

  if (!email || !validateEmail(email)) {
    errors.push('Valid email is required');
  }

  if (!password || !validatePassword(password)) {
    errors.push('Password must be at least 8 characters with uppercase, lowercase, and number');
  }

  if (name && (name.length < 2 || name.length > 100)) {
    errors.push('Name must be between 2 and 100 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  next();
};

/**
 * Complaint validation middleware
 */
const validateComplaint = (req, res, next) => {
  const { category, description, priority } = req.body;
  const errors = [];

  const validCategories = ['road', 'water', 'electricity', 'sanitation', 'public_safety', 'other'];
  const validPriorities = ['low', 'medium', 'high'];

  if (!category || !validCategories.includes(category)) {
    errors.push('Valid category is required');
  }

  if (!description || description.length < 10 || description.length > 2000) {
    errors.push('Description must be between 10 and 2000 characters');
  }

  if (priority && !validPriorities.includes(priority)) {
    errors.push('Priority must be low, medium, or high');
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  next();
};

// ================= COMPRESSION =================

const compressionMiddleware = compression({
  level: 6,
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
});

module.exports = {
  generalLimiter,
  authLimiter,
  complaintLimiter,
  passwordResetLimiter,
  helmetConfig,
  sanitizeInput,
  validateEmail,
  validatePassword,
  validateSignup,
  validateComplaint,
  compressionMiddleware,
};
