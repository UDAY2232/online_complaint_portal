/**
 * Authentication Routes - Production Ready
 * PostgreSQL (Neon) + JWT + bcrypt
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

// In production use Redis or DB
const refreshTokens = new Set();

const initAuthRoutes = (db) => {

  // ================= SIGNUP =================
  router.post('/signup', async (req, res) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required'
        });
      }

      // Check if user exists
      const existingResult = await db.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
      );

      if (existingResult.rows.length > 0) {
        return res.status(409).json({
          error: 'User already exists'
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Insert user
      const insertResult = await db.query(
        `
        INSERT INTO users
        (email, password_hash, name, role, email_verified, created_at)
        VALUES (LOWER($1), $2, $3, $4, FALSE, NOW())
        RETURNING id, email, name, role
        `,
        [email, passwordHash, name || null, ROLES.USER]
      );

      const user = insertResult.rows[0];

      // Send verification email (optional)
      const verificationToken = generateEmailVerificationToken(user.email);

      sendVerificationEmail(user.email, verificationToken)
        .catch(err => console.error('Email send failed:', err.message));

      return res.status(201).json({
        success: true,
        message: 'User created successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });

    } catch (err) {
      console.error('Signup error:', err.message);
      return res.status(500).json({
        error: 'Signup failed'
      });
    }
  });

  // ================= LOGIN =================
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password required'
        });
      }

      const result = await db.query(
        'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          error: 'Invalid credentials'
        });
      }

      const user = result.rows[0];

      const validPassword = await bcrypt.compare(
        password,
        user.password_hash
      );

      if (!validPassword) {
        return res.status(401).json({
          error: 'Invalid credentials'
        });
      }

      const accessToken = generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      });

      const refreshToken = generateRefreshToken({
        id: user.id,
        email: user.email
      });

      refreshTokens.add(refreshToken);

      return res.json({
        success: true,
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });

    } catch (err) {
      console.error('Login error:', err.message);
      return res.status(500).json({
        error: 'Login failed'
      });
    }
  });

  // ================= LOGOUT =================
  router.post('/logout', (req, res) => {

    const { refreshToken } = req.body;

    if (refreshToken) {
      refreshTokens.delete(refreshToken);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  });

  // ================= VERIFY EMAIL =================
  router.get('/verify-email', async (req, res) => {
    try {

      const { token } = req.query;

      if (!token) {
        return res.status(400).json({
          error: 'Token required'
        });
      }

      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(400).json({
          error: 'Invalid token'
        });
      }

      await db.query(
        'UPDATE users SET email_verified = TRUE WHERE email = $1',
        [decoded.email]
      );

      res.json({
        success: true,
        message: 'Email verified'
      });

    } catch (err) {

      console.error(err.message);

      res.status(500).json({
        error: 'Verification failed'
      });

    }
  });

  // ================= CURRENT USER =================
  router.get('/me', authenticate, async (req, res) => {

    try {

      const result = await db.query(
        `
        SELECT id, email, name, role, email_verified, created_at
        FROM users
        WHERE id = $1
        `,
        [req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        user: result.rows[0]
      });

    } catch (err) {

      res.status(500).json({
        error: 'Failed to fetch user'
      });

    }

  });

  return router;
};

module.exports = initAuthRoutes;
