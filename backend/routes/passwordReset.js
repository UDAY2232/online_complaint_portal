/**
 * Password Reset Routes
 * Handles forgot password and reset password functionality
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const router = express.Router();

const { sendPasswordResetEmail } = require('../services/emailService');
const { passwordResetLimiter } = require('../middleware/security');

// Store for reset tokens (in production, store in database with expiry)
const resetTokens = new Map();

/**
 * Initialize password reset routes
 * @param {object} db - MySQL database connection
 */
const initPasswordResetRoutes = (db) => {

  // ================= FORGOT PASSWORD =================
  router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Always return success to prevent email enumeration
      const successResponse = { 
        message: 'If an account exists with this email, you will receive a password reset link.' 
      };

      // Check if user exists
      const [users] = await db.promise().query(
        'SELECT id, email, name FROM users WHERE email = ?',
        [email]
      );

      if (users.length === 0) {
        // Don't reveal that user doesn't exist
        return res.json(successResponse);
      }

      const user = users[0];

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      
      // Store token with expiry (1 hour)
      resetTokens.set(tokenHash, {
        userId: user.id,
        email: user.email,
        expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
      });

      // Clean up expired tokens periodically
      for (const [key, value] of resetTokens) {
        if (value.expiresAt < Date.now()) {
          resetTokens.delete(key);
        }
      }

      // Send reset email
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
      
      await sendPasswordResetEmail(user.email, user.name, resetUrl);

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
      const tokenData = resetTokens.get(tokenHash);

      if (!tokenData) {
        return res.status(400).json({ error: 'Invalid or expired token', valid: false });
      }

      if (tokenData.expiresAt < Date.now()) {
        resetTokens.delete(tokenHash);
        return res.status(400).json({ error: 'Token has expired', valid: false });
      }

      res.json({ valid: true, email: tokenData.email });

    } catch (err) {
      console.error('Verify reset token error:', err);
      res.status(500).json({ error: 'Failed to verify token', valid: false });
    }
  });

  // ================= RESET PASSWORD =================
  router.post('/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;

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
      const tokenData = resetTokens.get(tokenHash);

      if (!tokenData) {
        return res.status(400).json({ error: 'Invalid or expired token' });
      }

      if (tokenData.expiresAt < Date.now()) {
        resetTokens.delete(tokenHash);
        return res.status(400).json({ error: 'Token has expired' });
      }

      // Hash new password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update user's password
      await db.promise().query(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [passwordHash, tokenData.userId]
      );

      // Remove used token
      resetTokens.delete(tokenHash);

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
