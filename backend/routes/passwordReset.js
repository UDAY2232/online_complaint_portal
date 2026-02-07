/**
 * Password Reset Routes - Production Ready
 * =========================================
 * 
 * Implements secure password reset flow:
 * - Tokens stored as SHA-256 hashes in dedicated password_resets table
 * - Tokens expire after 15 minutes
 * - Single-use tokens (marked as used after consumption)
 * - All previous tokens invalidated on new request
 * - No email enumeration (always returns success)
 * - bcrypt password hashing
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const router = express.Router();

const { sendPasswordResetEmail } = require('../services/emailService');
const { passwordResetLimiter } = require('../middleware/security');

// Token expiry time in minutes
const TOKEN_EXPIRY_MINUTES = 15;

/**
 * Initialize password reset routes
 * @param {object} db - MySQL database connection
 */
const initPasswordResetRoutes = (db) => {

  // ================= ENSURE PASSWORD_RESETS TABLE EXISTS =================
  const ensurePasswordResetsTable = async () => {
    try {
      // Check if password_resets table exists
      const [tables] = await db.promise().query(`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'password_resets'
      `);
      
      if (tables.length === 0) {
        console.log('📧 Creating password_resets table...');
        await db.promise().query(`
          CREATE TABLE password_resets (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            token_hash VARCHAR(255) NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_token_hash (token_hash),
            INDEX idx_user_id (user_id),
            INDEX idx_expires (expires_at)
          )
        `);
        console.log('📧 ✅ password_resets table created');
      } else {
        console.log('📧 ✅ password_resets table exists');
      }
    } catch (err) {
      console.error('📧 ❌ Failed to ensure password_resets table:', err.message);
    }
  };
  
  // Run migration on startup
  ensurePasswordResetsTable();

  // ================= CLEANUP EXPIRED TOKENS =================
  const cleanupExpiredTokens = async () => {
    try {
      const [result] = await db.promise().query(
        'DELETE FROM password_resets WHERE expires_at < NOW() OR used = TRUE'
      );
      if (result.affectedRows > 0) {
        console.log(`📧 🧹 Cleaned up ${result.affectedRows} expired/used password reset tokens`);
      }
    } catch (err) {
      // Silently handle - table may not exist yet
    }
  };
  
  // Clean up expired tokens every hour
  setInterval(cleanupExpiredTokens, 60 * 60 * 1000);
  // Also run once on startup (delayed)
  setTimeout(cleanupExpiredTokens, 10000);

  // ================= FORGOT PASSWORD =================
  /**
   * POST /auth/forgot-password
   * 
   * Request body: { email: string }
   * 
   * Always returns success to prevent email enumeration.
   * If user exists, sends reset email with secure token.
   */
  router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
    try {
      const { email } = req.body;

      console.log('\n========== FORGOT PASSWORD REQUEST ==========');
      console.log('📧 Email requested:', email);
      console.log('📧 Timestamp:', new Date().toISOString());

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Normalize email
      const normalizedEmail = email.trim().toLowerCase();

      // Always return the same success response (prevents email enumeration)
      const successResponse = { 
        message: 'If an account exists with this email, you will receive a password reset link.',
        success: true
      };

      // Find user by email (case-insensitive)
      const [users] = await db.promise().query(
        'SELECT id, email, name FROM users WHERE LOWER(email) = ?',
        [normalizedEmail]
      );

      console.log('📧 User found:', users.length > 0 ? 'Yes' : 'No');

      if (users.length === 0) {
        console.log('📧 User not found - returning success anyway (security)');
        console.log('========== FORGOT PASSWORD END ==========\n');
        return res.json(successResponse);
      }

      const user = users[0];
      console.log('📧 User ID:', user.id, 'Email:', user.email);

      // Invalidate ALL previous reset tokens for this user
      await db.promise().query(
        'UPDATE password_resets SET used = TRUE WHERE user_id = ? AND used = FALSE',
        [user.id]
      );
      console.log('📧 Previous tokens invalidated');

      // Generate secure random token (32 bytes = 64 hex chars)
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // Hash token for storage (never store raw token)
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      
      // Set expiry (15 minutes from now)
      const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

      // Store hashed token in password_resets table
      await db.promise().query(
        'INSERT INTO password_resets (user_id, token_hash, expires_at, used) VALUES (?, ?, ?, FALSE)',
        [user.id, tokenHash, expiresAt]
      );
      console.log('📧 Reset token stored (expires in', TOKEN_EXPIRY_MINUTES, 'minutes)');

      // Build reset URL using FRONTEND_URL environment variable
      // Support both FRONTEND_URL and FRONTEND_BASE_URL for compatibility
      const frontendUrl = process.env.FRONTEND_URL || process.env.FRONTEND_BASE_URL;
      
      // CRITICAL: Do NOT generate localhost links in production
      if (!frontendUrl) {
        console.error('📧 ❌ CRITICAL: FRONTEND_URL environment variable is NOT SET!');
        console.error('📧 ❌ Password reset emails CANNOT be sent without FRONTEND_URL');
        console.error('📧 ❌ Please set FRONTEND_URL or FRONTEND_BASE_URL in Render environment variables');
        console.error('📧 ❌ Example: FRONTEND_URL=https://your-app.vercel.app');
        // Still return success to user (don't leak internal errors)
        return res.json(successResponse);
      }
      
      // CRITICAL: Block localhost URLs in production - they will never work on user devices
      const isProduction = process.env.NODE_ENV === 'production';
      const isLocalhost = frontendUrl.includes('localhost') || frontendUrl.includes('127.0.0.1');
      
      if (isProduction && isLocalhost) {
        console.error('📧 ❌ CRITICAL: FRONTEND_URL contains localhost in production!');
        console.error('📧 ❌ Current FRONTEND_URL:', frontendUrl);
        console.error('📧 ❌ Reset links with localhost will NOT work on user devices!');
        console.error('📧 ❌ BLOCKING email send - fix FRONTEND_URL in Render environment variables');
        console.error('📧 ❌ Example: FRONTEND_URL=https://your-app.vercel.app');
        // Still return success to user (don't leak internal errors)
        return res.json(successResponse);
      }
      
      // Additional warning for non-HTTPS in production
      if (isProduction && !frontendUrl.startsWith('https://')) {
        console.warn('📧 ⚠️ WARNING: FRONTEND_URL is not HTTPS in production');
        console.warn('📧 ⚠️ Current FRONTEND_URL:', frontendUrl);
      }
      
      // Build reset URL with token as query parameter
      // URL format: ${FRONTEND_URL}/reset-password?token=XXX
      const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
      
      console.log('📧 Reset URL generated');
      console.log('📧 Frontend URL:', frontendUrl);
      console.log('📧 Token expiry:', expiresAt.toISOString());
      
      // Send reset email to the user's actual email from database
      console.log('📧 Sending email to:', user.email);
      const emailSent = await sendPasswordResetEmail(
        user.email,  // Send to user's registered email
        user.name || 'User',
        resetUrl,
        TOKEN_EXPIRY_MINUTES
      );
      
      if (emailSent) {
        console.log('📧 ✅ Password reset email sent successfully');
      } else {
        console.log('📧 ⚠️ Email send returned false (may still have been sent)');
      }
      
      console.log('========== FORGOT PASSWORD END ==========\n');
      return res.json(successResponse);

    } catch (err) {
      console.error('📧 ❌ Forgot password error:', err);
      // Return generic success to prevent information leakage
      return res.json({ 
        message: 'If an account exists with this email, you will receive a password reset link.',
        success: true
      });
    }
  });

  // ================= VERIFY RESET TOKEN =================
  /**
   * GET /auth/verify-reset-token?token=XXX
   * 
   * Verifies if a reset token is valid (not expired, not used).
   * Used by frontend to check token before showing reset form.
   */
  router.get('/verify-reset-token', async (req, res) => {
    try {
      const { token } = req.query;

      console.log('\n========== VERIFY RESET TOKEN ==========');

      if (!token || typeof token !== 'string') {
        console.log('📧 ❌ No token provided');
        return res.status(400).json({ 
          error: 'Token is required', 
          valid: false,
          code: 'MISSING_TOKEN'
        });
      }

      // Hash the received token
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      // Find token in database
      const [tokens] = await db.promise().query(
        `SELECT pr.*, u.email, u.name 
         FROM password_resets pr 
         JOIN users u ON pr.user_id = u.id 
         WHERE pr.token_hash = ?`,
        [tokenHash]
      );

      if (tokens.length === 0) {
        console.log('📧 ❌ Token not found in database');
        return res.status(400).json({ 
          error: 'Invalid or expired reset link. Please request a new password reset.',
          valid: false,
          code: 'INVALID_TOKEN'
        });
      }

      const resetRecord = tokens[0];

      // Check if token is already used
      if (resetRecord.used) {
        console.log('📧 ❌ Token already used');
        return res.status(400).json({ 
          error: 'This reset link has already been used. Please request a new password reset.',
          valid: false,
          code: 'TOKEN_USED'
        });
      }

      // Check if token is expired
      if (new Date(resetRecord.expires_at) < new Date()) {
        console.log('📧 ❌ Token expired at:', resetRecord.expires_at);
        // Mark as used to prevent future attempts
        await db.promise().query(
          'UPDATE password_resets SET used = TRUE WHERE id = ?',
          [resetRecord.id]
        );
        return res.status(400).json({ 
          error: 'This reset link has expired. Please request a new password reset.',
          valid: false,
          code: 'TOKEN_EXPIRED'
        });
      }

      console.log('📧 ✅ Token is valid for user:', resetRecord.email);
      console.log('========== VERIFY RESET TOKEN END ==========\n');

      return res.json({ 
        valid: true, 
        email: resetRecord.email,
        message: 'Token is valid'
      });

    } catch (err) {
      console.error('📧 ❌ Verify token error:', err);
      return res.status(500).json({ 
        error: 'Failed to verify token. Please try again.',
        valid: false,
        code: 'SERVER_ERROR'
      });
    }
  });

  // ================= RESET PASSWORD =================
  /**
   * POST /auth/reset-password
   * 
   * Request body: { token: string, newPassword: string }
   * 
   * Validates token, updates password, marks token as used.
   */
  router.post('/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      console.log('\n========== RESET PASSWORD REQUEST ==========');
      console.log('📧 Timestamp:', new Date().toISOString());

      // Validate inputs
      if (!token || typeof token !== 'string') {
        console.log('📧 ❌ Missing token');
        return res.status(400).json({ 
          error: 'Reset token is required',
          code: 'MISSING_TOKEN'
        });
      }

      if (!newPassword || typeof newPassword !== 'string') {
        console.log('📧 ❌ Missing password');
        return res.status(400).json({ 
          error: 'New password is required',
          code: 'MISSING_PASSWORD'
        });
      }

      // Validate password strength
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!passwordRegex.test(newPassword)) {
        console.log('📧 ❌ Weak password');
        return res.status(400).json({ 
          error: 'Password must be at least 8 characters with at least one uppercase letter, one lowercase letter, and one number',
          code: 'WEAK_PASSWORD'
        });
      }

      // Hash the received token
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      // Find token in database with user info
      const [tokens] = await db.promise().query(
        `SELECT pr.*, u.id as user_id, u.email 
         FROM password_resets pr 
         JOIN users u ON pr.user_id = u.id 
         WHERE pr.token_hash = ?`,
        [tokenHash]
      );

      if (tokens.length === 0) {
        console.log('📧 ❌ Invalid token - not found');
        return res.status(400).json({ 
          error: 'Invalid or expired reset link. Please request a new password reset.',
          code: 'INVALID_TOKEN'
        });
      }

      const resetRecord = tokens[0];

      // Check if token is already used
      if (resetRecord.used) {
        console.log('📧 ❌ Token already used');
        return res.status(400).json({ 
          error: 'This reset link has already been used. Please request a new password reset.',
          code: 'TOKEN_USED'
        });
      }

      // Check if token is expired
      if (new Date(resetRecord.expires_at) < new Date()) {
        console.log('📧 ❌ Token expired');
        await db.promise().query(
          'UPDATE password_resets SET used = TRUE WHERE id = ?',
          [resetRecord.id]
        );
        return res.status(400).json({ 
          error: 'This reset link has expired. Please request a new password reset.',
          code: 'TOKEN_EXPIRED'
        });
      }

      console.log('📧 Token valid for user:', resetRecord.email);

      // Hash new password with bcrypt
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      // Start transaction for atomic update
      const connection = await db.promise().getConnection();
      try {
        await connection.beginTransaction();

        // Update user's password
        await connection.query(
          'UPDATE users SET password_hash = ? WHERE id = ?',
          [passwordHash, resetRecord.user_id]
        );
        console.log('📧 ✅ Password updated for user:', resetRecord.email);

        // Mark THIS token as used
        await connection.query(
          'UPDATE password_resets SET used = TRUE WHERE id = ?',
          [resetRecord.id]
        );

        // Invalidate ALL other reset tokens for this user (security)
        await connection.query(
          'UPDATE password_resets SET used = TRUE WHERE user_id = ? AND id != ?',
          [resetRecord.user_id, resetRecord.id]
        );
        console.log('📧 All reset tokens for user invalidated');

        // Clear old reset token columns in users table (if they exist)
        try {
          await connection.query(
            'UPDATE users SET reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?',
            [resetRecord.user_id]
          );
        } catch (e) {
          // Columns may not exist, ignore
        }

        await connection.commit();
      } catch (txError) {
        await connection.rollback();
        throw txError;
      } finally {
        connection.release();
      }

      console.log('📧 ✅ Password reset completed successfully');
      console.log('========== RESET PASSWORD END ==========\n');

      return res.json({ 
        message: 'Password has been reset successfully. You can now login with your new password.',
        success: true
      });

    } catch (err) {
      console.error('📧 ❌ Reset password error:', err);
      return res.status(500).json({ 
        error: 'Failed to reset password. Please try again.',
        code: 'SERVER_ERROR'
      });
    }
  });

  // ================= CHANGE PASSWORD (Authenticated) =================
  /**
   * POST /auth/change-password
   * 
   * For logged-in users to change their password.
   * Requires current password verification.
   */
  router.post('/change-password', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }

      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({ 
          error: 'New password must be at least 8 characters with uppercase, lowercase, and number' 
        });
      }

      const jwt = require('jsonwebtoken');
      const token = authHeader.split(' ')[1];
      
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (jwtErr) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      const [users] = await db.promise().query(
        'SELECT * FROM users WHERE id = ?',
        [decoded.id]
      );

      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = users[0];

      const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      await db.promise().query(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [passwordHash, user.id]
      );

      // Invalidate any existing reset tokens
      await db.promise().query(
        'UPDATE password_resets SET used = TRUE WHERE user_id = ?',
        [user.id]
      );

      return res.json({ message: 'Password changed successfully' });

    } catch (err) {
      console.error('Change password error:', err);
      return res.status(500).json({ error: 'Failed to change password' });
    }
  });

  return router;
};

module.exports = initPasswordResetRoutes;
