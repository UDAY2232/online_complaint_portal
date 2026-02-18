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
 * @param {object} db - PostgreSQL database connection
 */
const initAuthRoutes = (db) => {

  // ================= SIGNUP =================
  router.post('/signup', async (req, res) => {
    try {
      const { email, password, name } = req.body;

      console.log('\n========== SIGNUP DEBUG START ==========');
      console.log('📝 Signup attempt for:', email);
      console.log('📝 Password provided:', password ? `Yes (${password.length} chars)` : 'No');
      console.log('📝 Name provided:', name || 'No');

      if (!email || !password) {
        console.log('📝 ❌ Missing email or password');
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Debug: Check total users in DB before signup
      const countResult = await db.query('SELECT COUNT(*) as count FROM users');
      const countRows = countResult.rows;
      console.log('📝 Current users count in DB:', countResult[0].count);

      // Check if user already exists (case-insensitive)
      const existingResult = await db.query(
        'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
      );
      const existing = existingResult.rows;

      if (existing.length > 0) {
        console.log('📝 ❌ User already exists:', email);
        console.log('========== SIGNUP DEBUG END ==========\n');
        return res.status(409).json({ error: 'User with this email already exists' });
      }

      // Hash password with bcrypt
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      
      console.log('📝 Password hashed successfully');
      console.log('📝 Hash length:', passwordHash.length);
      console.log('📝 Hash starts with $2:', passwordHash.startsWith('$2') ? 'Yes ✅' : 'No ❌');

      // Insert new user (store email in lowercase for consistency)
      const result = await db.query(
        `INSERT INTO users (email, password_hash, name, role, email_verified, created_at)
         VALUES (LOWER($1), $2, $3, $4, FALSE, NOW()) RETURNING id`,
        [email, passwordHash, name || null, ROLES.USER]
      );

      const userId = result.rows[0].id;
      console.log('📝 ✅ User created with ID:', userId);

      // Debug: Verify user was actually inserted
      const verifyInsertResult = await db.query(
        'SELECT id, email, password_hash, role FROM users WHERE id = $1',
        [userId]
      );
      const verifyInsert = verifyInsertResult.rows;
      
      if (verifyInsert.length > 0) {
        console.log('📝 ✅ VERIFIED: User exists in DB after insert');
        console.log('📝 ✅ Stored email:', verifyInsert[0].email);
        console.log('📝 ✅ Stored hash length:', verifyInsert[0].password_hash?.length);
        console.log('📝 ✅ Stored hash preview:', verifyInsert[0].password_hash?.substring(0, 20) + '...');
      } else {
        console.log('📝 ❌ CRITICAL: User NOT found in DB after insert!');
      }

      // Debug: Count users after insert
      const countAfterResult = await db.query('SELECT COUNT(*) as count FROM users');
      const countAfter = countAfterResult.rows;
      console.log('📝 Users count after signup:', countAfter[0].count);
      console.log('========== SIGNUP DEBUG END ==========\n');

      // Generate email verification token
      const verificationToken = generateEmailVerificationToken(email);
      
      // Send verification email (non-blocking)
      sendVerificationEmail(email, verificationToken).catch(err => {
        console.error('Failed to send verification email:', err.message);
      });

      res.status(201).json({
        message: 'User created successfully. Please check your email to verify your account.',
        userId: userId,
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

      // Query user by email (case-insensitive)
      const result = await db.query(
        'SELECT id, email, password_hash, role, name, email_verified, status FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const user = result.rows[0];

      // Compare password using bcrypt
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Generate tokens
      const accessToken = generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      });

      const refreshToken = generateRefreshToken({
        id: user.id,
        email: user.email,
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
          role: user.role,
        },
      });
    } catch (err) {
      return res.status(500).json({ error: 'Login failed: ' + err.message });
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
        'SELECT id, email, name, role, status, email_verified, created_at FROM users WHERE id = ?',
        [req.user.id]
      );

      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = users[0];
      res.json({ 
        user: {
          ...user,
          displayName: user.name || '',
        }
      });

    } catch (err) {
      console.error('Get user error:', err);
      res.status(500).json({ error: 'Failed to get user info' });
    }
  });

  // ================= UPDATE PROFILE (Save display name to DB) =================
  router.put('/profile', authenticate, async (req, res) => {
    try {
      const { name, displayName } = req.body;
      const userId = req.user.id;
      
      // Use displayName or name
      const newName = displayName || name;

      console.log('👤 Profile update for user:', userId, 'New name:', newName);

      if (newName !== undefined) {
        await db.promise().query(
          'UPDATE users SET name = ? WHERE id = ?',
          [newName, userId]
        );
      }

      // Fetch updated user
      const [users] = await db.promise().query(
        'SELECT id, email, name, role, status, email_verified FROM users WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = users[0];
      
      // Generate new token with updated name
      const newAccessToken = generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      });

      res.json({ 
        message: 'Profile updated successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name || '',
          displayName: user.name || '',
          role: user.role,
          status: user.status || 'active',
        },
        accessToken: newAccessToken,  // Return new token with updated info
      });

    } catch (err) {
      console.error('Update profile error:', err);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  return router;
};

module.exports = initAuthRoutes;
