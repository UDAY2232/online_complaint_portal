/**
 * Authentication Routes
 * Handles login, signup, token refresh, and email verification
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

const {
  generateAccessToken,
  generateRefreshToken,
  generateEmailVerificationToken,
  verifyToken,
  authenticate,
} = require('../middleware/auth');
const { ROLES } = require('../config/jwt');
const { sendVerificationEmail } = require('../services/emailService');

// Store for refresh tokens (in production, use Redis or database)
const refreshTokens = new Set();

/**
 * Initialize auth routes with database connection
 * @param {object} db - MySQL database connection
 */
const initAuthRoutes = (db) => {

  // ================= SIGNUP =================
  router.post('/signup', async (req, res) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Check if user already exists
      const [existing] = await db.promise().query(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );

      if (existing.length > 0) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Insert new user
      const [result] = await db.promise().query(
        `INSERT INTO users (email, password_hash, name, role, email_verified, created_at)
         VALUES (?, ?, ?, ?, FALSE, NOW())`,
        [email, passwordHash, name || null, ROLES.USER]
      );

      // Generate email verification token
      const verificationToken = generateEmailVerificationToken(email);
      
      // Send verification email (non-blocking)
      sendVerificationEmail(email, verificationToken).catch(err => {
        console.error('Failed to send verification email:', err.message);
      });

      res.status(201).json({
        message: 'User created successfully. Please check your email to verify your account.',
        userId: result.insertId,
      });

    } catch (err) {
      console.error('Signup error:', err);
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  // ================= LOGIN =================
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Find user
      const [users] = await db.promise().query(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );

      if (users.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const user = users[0];

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Check if email is verified (optional - can be enforced or just warned)
      const emailVerified = user.email_verified;

      // Generate tokens
      const accessToken = generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      const refreshToken = generateRefreshToken({
        id: user.id,
        email: user.email,
      });

      // Store refresh token
      refreshTokens.add(refreshToken);

      res.json({
        message: 'Login successful',
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified,
        },
      });

    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // ================= REFRESH TOKEN =================
  router.post('/refresh', async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
      }

      // Check if token exists in store
      if (!refreshTokens.has(refreshToken)) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      // Verify token
      const decoded = verifyToken(refreshToken);
      if (!decoded || decoded.type !== 'refresh') {
        refreshTokens.delete(refreshToken);
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      // Get user from database
      const [users] = await db.promise().query(
        'SELECT * FROM users WHERE id = ?',
        [decoded.id]
      );

      if (users.length === 0) {
        refreshTokens.delete(refreshToken);
        return res.status(401).json({ error: 'User not found' });
      }

      const user = users[0];

      // Generate new access token
      const accessToken = generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      res.json({
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });

    } catch (err) {
      console.error('Token refresh error:', err);
      res.status(500).json({ error: 'Failed to refresh token' });
    }
  });

  // ================= LOGOUT =================
  router.post('/logout', (req, res) => {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      refreshTokens.delete(refreshToken);
    }

    res.json({ message: 'Logged out successfully' });
  });

  // ================= VERIFY EMAIL =================
  router.get('/verify-email', async (req, res) => {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(400).json({ error: 'Verification token required' });
      }

      const decoded = verifyToken(token);
      
      if (!decoded || decoded.type !== 'email_verification') {
        return res.status(400).json({ error: 'Invalid or expired verification token' });
      }

      // Update user's email_verified status
      await db.promise().query(
        'UPDATE users SET email_verified = TRUE WHERE email = ?',
        [decoded.email]
      );

      res.json({ message: 'Email verified successfully' });

    } catch (err) {
      console.error('Email verification error:', err);
      res.status(500).json({ error: 'Failed to verify email' });
    }
  });

  // ================= RESEND VERIFICATION EMAIL =================
  router.post('/resend-verification', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email required' });
      }

      // Check if user exists
      const [users] = await db.promise().query(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );

      if (users.length === 0) {
        // Don't reveal if user exists
        return res.json({ message: 'If an account exists, a verification email will be sent' });
      }

      const user = users[0];

      if (user.email_verified) {
        return res.status(400).json({ error: 'Email already verified' });
      }

      // Generate and send new verification token
      const verificationToken = generateEmailVerificationToken(email);
      await sendVerificationEmail(email, verificationToken);

      res.json({ message: 'Verification email sent' });

    } catch (err) {
      console.error('Resend verification error:', err);
      res.status(500).json({ error: 'Failed to resend verification email' });
    }
  });

  // ================= GET CURRENT USER =================
  router.get('/me', authenticate, async (req, res) => {
    try {
      const [users] = await db.promise().query(
        'SELECT id, email, name, role, email_verified, created_at FROM users WHERE id = ?',
        [req.user.id]
      );

      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user: users[0] });

    } catch (err) {
      console.error('Get user error:', err);
      res.status(500).json({ error: 'Failed to get user info' });
    }
  });

  return router;
};

module.exports = initAuthRoutes;
