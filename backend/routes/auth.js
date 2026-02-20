/**
 * Authentication Routes - FINAL PRODUCTION READY
 * PostgreSQL (Neon) + JWT + bcrypt + Forgot Password + Reset Password
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

const {
  generateAccessToken,
  generateRefreshToken,
  generateEmailVerificationToken,
  verifyToken,
  authenticate,
} = require('../middleware/auth');

const { ROLES } = require('../config/jwt');

const {
  sendVerificationEmail,
  sendPasswordResetEmail
} = require('../services/emailService');

// store refresh tokens (production → use Redis)
const refreshTokens = new Set();

const initAuthRoutes = (db) => {

  // ================= SIGNUP =================
  router.post('/signup', async (req, res) => {

    try {

      const { email, password, name } = req.body;

      if (!email || !password)
        return res.status(400).json({
          error: 'Email and password required'
        });

      const existing = await db.query(
        'SELECT id FROM users WHERE LOWER(email)=LOWER($1)',
        [email]
      );

      if (existing.rows.length > 0)
        return res.status(409).json({
          error: 'User already exists'
        });

      const hash = await bcrypt.hash(password, 10);

      const result = await db.query(
        `
        INSERT INTO users
        (email,password_hash,name,role,email_verified,created_at)
        VALUES (LOWER($1),$2,$3,$4,FALSE,NOW())
        RETURNING id,email,name,role
        `,
        [email, hash, name || null, ROLES.USER]
      );

      const user = result.rows[0];

      // send verification email
      const verifyTokenEmail =
        generateEmailVerificationToken(user.email);

      sendVerificationEmail(
        user.email,
        verifyTokenEmail
      ).catch(console.error);

      res.status(201).json({
        success: true,
        user
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error: 'Signup failed'
      });

    }

  });


  // ================= LOGIN =================
  router.post('/login', async (req, res) => {

    try {

      const { email, password } = req.body;

      if (!email || !password)
        return res.status(400).json({
          error: 'Email and password required'
        });

      const result = await db.query(
        'SELECT * FROM users WHERE LOWER(email)=LOWER($1)',
        [email]
      );

      if (result.rows.length === 0)
        return res.status(401).json({
          error: 'Invalid credentials'
        });

      const user = result.rows[0];

      const valid =
        await bcrypt.compare(
          password,
          user.password_hash
        );

      if (!valid)
        return res.status(401).json({
          error: 'Invalid credentials'
        });

      const accessToken =
        generateAccessToken({
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name
        });

      const refreshToken =
        generateRefreshToken({
          id: user.id,
          email: user.email
        });

      refreshTokens.add(refreshToken);

      res.json({
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

      console.error(err);

      res.status(500).json({
        error: 'Login failed'
      });

    }

  });


  // ================= LOGOUT =================
  router.post('/logout', (req, res) => {

    const { refreshToken } = req.body;

    if (refreshToken)
      refreshTokens.delete(refreshToken);

    res.json({
      success: true
    });

  });


  // ================= CURRENT USER =================
  router.get('/me', authenticate, async (req, res) => {

    try {

      const result = await db.query(
        `
        SELECT id,email,name,role,email_verified
        FROM users
        WHERE id=$1
        `,
        [req.user.id]
      );

      if (result.rows.length === 0)
        return res.status(404).json({
          error: 'User not found'
        });

      res.json({
        success: true,
        user: result.rows[0]
      });

    } catch {

      res.status(500).json({
        error: 'Failed'
      });

    }

  });


  // ================= UPDATE PROFILE =================
  router.put('/profile', authenticate, async (req, res) => {

    try {

      const { name } = req.body;

      const result = await db.query(
        `
        UPDATE users
        SET name=$1
        WHERE id=$2
        RETURNING id,email,name,role
        `,
        [name, req.user.id]
      );

      res.json({
        success: true,
        user: result.rows[0]
      });

    } catch {

      res.status(500).json({
        error: 'Update failed'
      });

    }

  });


  // ================= CHANGE PASSWORD =================
  router.all(['/change-password', '/change_password'], authenticate, async (req, res) => {

    try {

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword)
        return res.status(400).json({
          error: 'Both passwords required'
        });

      const result = await db.query(
        'SELECT password_hash FROM users WHERE id=$1',
        [req.user.id]
      );

      const valid =
        await bcrypt.compare(
          currentPassword,
          result.rows[0].password_hash
        );

      if (!valid)
        return res.status(400).json({
          error: 'Wrong current password'
        });

      const hash =
        await bcrypt.hash(newPassword, 10);

      await db.query(
        'UPDATE users SET password_hash=$1 WHERE id=$2',
        [hash, req.user.id]
      );

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch {

      res.status(500).json({
        error: 'Failed'
      });

    }

  });


  // ================= FORGOT PASSWORD =================
  router.post('/forgot-password', async (req, res) => {

    try {

      const { email } = req.body;

      if (!email)
        return res.status(400).json({
          error: 'Email required'
        });

      const result = await db.query(
        'SELECT id,email,name FROM users WHERE LOWER(email)=LOWER($1)',
        [email]
      );

      // always return success (security)
      if (result.rows.length === 0)
        return res.json({
          success: true
        });

      const user = result.rows[0];

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          type: 'password-reset'
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const resetUrl =
        `https://online-complaint-portal.vercel.app/reset-password?token=${token}`;

      await sendPasswordResetEmail(
        user.email,
        user.name,
        resetUrl,
        15
      );

      res.json({
        success: true
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error: 'Failed'
      });

    }

  });


  // ================= VERIFY RESET TOKEN =================
  router.get('/verify-reset-token', async (req, res) => {

    try {

      const { token } = req.query;

      const decoded = verifyToken(token);

      if (!decoded || decoded.type !== 'password-reset')
        return res.status(400).json({
          valid: false
        });

      res.json({
        valid: true
      });

    } catch {

      res.status(400).json({
        valid: false
      });

    }

  });


  // ================= RESET PASSWORD =================
  router.post('/reset-password', async (req, res) => {

    try {

      const { token, newPassword } = req.body;

      const decoded = verifyToken(token);

      if (!decoded)
        return res.status(400).json({
          error: 'Invalid token'
        });

      const hash =
        await bcrypt.hash(newPassword, 10);

      await db.query(
        'UPDATE users SET password_hash=$1 WHERE id=$2',
        [hash, decoded.id]
      );

      res.json({
        success: true
      });

    } catch {

      res.status(500).json({
        error: 'Failed'
      });

    }

  });


  return router;

};

module.exports = initAuthRoutes;