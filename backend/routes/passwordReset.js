/**
 * Password Reset Routes
 * Handles forgot password and reset password functionality
 * Tokens are stored in database for production reliability
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const router = express.Router();

const { sendPasswordResetEmail } = require('../services/emailService');
const { passwordResetLimiter } = require('../middleware/security');

/**
 * Initialize password reset routes
 * @param {object} db - MySQL database connection
 */
const initPasswordResetRoutes = (db) => {

  // Ensure reset token columns exist (run migration)
  const ensureResetColumns = async () => {
    try {
      // Check if columns exist first
      const [columns] = await db.promise().query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'reset_token_hash'
      `);
      
      if (columns.length === 0) {
        await db.promise().query(`ALTER TABLE users ADD COLUMN reset_token_hash VARCHAR(255) NULL`);
        await db.promise().query(`ALTER TABLE users ADD COLUMN reset_token_expires TIMESTAMP NULL`);
        console.log('📧 ✅ Reset token columns added to users table');
      }
    } catch (err) {
      console.log('📧 Reset columns migration:', err.message);
    }
  };
  ensureResetColumns();

  // ================= FORGOT PASSWORD =================
  router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
    try {
      const { email } = req.body;

      console.log('\n========== FORGOT PASSWORD REQUEST ==========');
      console.log('📧 Email requested:', email);

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Always return success to prevent email enumeration
      const successResponse = { 
        message: 'If an account exists with this email, you will receive a password reset link.' 
      };

      // Check if user exists (case-insensitive)
      const [users] = await db.promise().query(
        'SELECT id, email, name FROM users WHERE LOWER(email) = LOWER(?)',
        [email]
      );

      console.log('📧 User found:', users.length > 0 ? 'Yes' : 'No');

      if (users.length === 0) {
        console.log('📧 User not found, returning success anyway (security)');
        console.log('========== FORGOT PASSWORD END ==========\n');
        return res.json(successResponse);
      }

      const user = users[0];
      console.log('📧 User ID:', user.id, 'Email:', user.email);

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store hashed token in database
      await db.promise().query(
        'UPDATE users SET reset_token_hash = ?, reset_token_expires = ? WHERE id = ?',
        [tokenHash, expiresAt, user.id]
      );

      console.log('📧 Reset token stored in database');

      // Build reset URL using environment variable
      const frontendBaseUrl = process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL;
      if (!frontendBaseUrl) {
        throw new Error('FRONTEND_BASE_URL environment variable is missing. Please set it in your .env file for password reset links to work.');
      }
      
      // Warn if localhost is being used in production
      if (process.env.NODE_ENV === 'production' && frontendBaseUrl.includes('localhost')) {
        console.warn('⚠️ WARNING: FRONTEND_BASE_URL contains localhost in production. This will cause reset links to fail on external devices.');
        console.warn('⚠️ Please set FRONTEND_BASE_URL to your production frontend URL (e.g., https://online-complaint-portal.vercel.app)');
      }
      
      const resetUrl = `${frontendBaseUrl}/reset-password/${resetToken}`;
      console.log('📧 Reset URL:', resetUrl);
      console.log('📧 Frontend Base URL:', frontendBaseUrl);
      
      // Send reset email to the user's actual email
      console.log('📧 Sending email to:', user.email);
      const emailSent = await sendPasswordResetEmail(user.email, user.name, resetUrl);
      
      if (emailSent) {
        console.log('📧 ✅ Password reset email sent to:', user.email);
      } else {
        console.log('📧 ⚠️ Email sending returned false');
      }
      
      console.log('========== FORGOT PASSWORD END ==========\n');
      res.json(successResponse);

    } catch (err) {
      console.error('Forgot password error:', err);
      res.status(500).json({ error: 'Failed to process request' });
    }
  });

  // ================= VERIFY RESET TOKEN =================
  router.get('/verify-reset-token', async (req, res) => {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(400).json({ error: 'Token is required', valid: false });
      }

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      // Find user with this token in database
      const [users] = await db.promise().query(
        'SELECT id, email, reset_token_expires FROM users WHERE reset_token_hash = ?',
        [tokenHash]
      );

      if (users.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired token', valid: false });
      }

      const user = users[0];

      // Check expiry
      if (new Date(user.reset_token_expires) < new Date()) {
        // Clear expired token
        await db.promise().query(
          'UPDATE users SET reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?',
          [user.id]
        );
        return res.status(400).json({ error: 'Token has expired', valid: false });
      }

      res.json({ valid: true, email: user.email });

    } catch (err) {
      console.error('Verify reset token error:', err);
      res.status(500).json({ error: 'Failed to verify token', valid: false });
    }
  });

  // ================= RESET PASSWORD =================
  router.post('/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      console.log('\n========== RESET PASSWORD REQUEST ==========');

      if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password are required' });
      }

      // Validate password strength
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({ 
          error: 'Password must be at least 8 characters with uppercase, lowercase, and number' 
        });
      }

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      // Find user with this token from database
      const [users] = await db.promise().query(
        'SELECT id, email, reset_token_expires FROM users WHERE reset_token_hash = ?',
        [tokenHash]
      );

      if (users.length === 0) {
        console.log('📧 ❌ Invalid token - no user found');
        return res.status(400).json({ error: 'Invalid or expired token' });
      }

      const user = users[0];
      console.log('📧 User found:', user.email);

      // Check expiry
      if (new Date(user.reset_token_expires) < new Date()) {
        console.log('📧 ❌ Token expired');
        await db.promise().query(
          'UPDATE users SET reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?',
          [user.id]
        );
        return res.status(400).json({ error: 'Token has expired' });
      }

      // Hash new password with bcrypt
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password and clear reset token atomically
      await db.promise().query(
        'UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?',
        [passwordHash, user.id]
      );

      console.log('📧 ✅ Password reset successfully for:', user.email);
      console.log('========== RESET PASSWORD END ==========\n');

      res.json({ message: 'Password reset successfully. You can now login with your new password.' });

    } catch (err) {
      console.error('Reset password error:', err);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  // ================= CHANGE PASSWORD (Authenticated) =================
  router.post('/change-password', async (req, res) => {
    try {
      // Get user from auth header (manual check since middleware might not be applied)
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }

      // Validate new password strength
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({ 
          error: 'New password must be at least 8 characters with uppercase, lowercase, and number' 
        });
      }

      // Decode token to get user ID
      const jwt = require('jsonwebtoken');
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user
      const [users] = await db.promise().query(
        'SELECT * FROM users WHERE id = ?',
        [decoded.id]
      );

      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = users[0];

      // Verify current password
      const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Hash and update new password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      await db.promise().query(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [passwordHash, user.id]
      );

      res.json({ message: 'Password changed successfully' });

    } catch (err) {
      console.error('Change password error:', err);
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      }
      res.status(500).json({ error: 'Failed to change password' });
    }
  });

  return router;
};

module.exports = initPasswordResetRoutes;
