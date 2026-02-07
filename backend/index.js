const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const nodemailer = require("nodemailer");

const upload = require("./utils/multer");
const cloudinary = require("./utils/cloudinary");

// ================= PHASE 6 & 7 IMPORTS =================
const { runMigrations } = require("./utils/migrations");
const { startEscalationScheduler } = require("./services/scheduler");
const { initializeTransporter, sendResolutionEmail: sendResolutionEmailService, sendComplaintSubmissionEmail, sendStatusChangeEmail } = require("./services/emailService");
const { authenticate, optionalAuth, requireAdmin, requireUser } = require("./middleware/auth");
const initAuthRoutes = require("./routes/auth");
const initAdminRoutes = require("./routes/admin");
const initPasswordResetRoutes = require("./routes/passwordReset");

// ================= SECURITY MIDDLEWARE =================
const {
  generalLimiter,
  authLimiter,
  complaintLimiter,
  helmetConfig,
  sanitizeInput,
  validateComplaint,
  compressionMiddleware,
} = require("./middleware/security");
const { logger, requestLogger, errorLogger } = require("./utils/logger");

const app = express();

// ================= PRODUCTION SECURITY =================
app.use(helmetConfig); // Secure HTTP headers
app.use(compressionMiddleware); // Gzip compression

// CORS configuration - allow both local and production URLs
// Support both FRONTEND_URL (preferred) and FRONTEND_BASE_URL (legacy)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_BASE_URL,
  'https://online-complaint-portal.vercel.app',
  'https://online-complaint-portal-git-main.vercel.app'
].filter(Boolean);

// Deduplicate origins
const uniqueOrigins = [...new Set(allowedOrigins)];
console.log('🌐 CORS allowed origins:', uniqueOrigins);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (uniqueOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Also allow any vercel.app subdomain for preview deployments
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    
    // Allow any localhost port for development
    if (origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    
    console.log('⚠️ CORS blocked origin:', origin);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeInput); // XSS protection
app.use(requestLogger); // Request logging

// ================= HEALTH CHECK ENDPOINT =================
// Must be before rate limiting for monitoring tools
// Root health check for load balancers and uptime monitors
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    service: 'Online Complaint Portal API',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API root endpoint
app.get('/api', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    service: 'Online Complaint Portal API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/*',
      complaints: '/api/complaints',
      user: '/api/user/*',
      admin: '/api/admin/*'
    },
    timestamp: new Date().toISOString()
  });
});

// Rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/', generalLimiter);

// ================= EMAIL CONFIGURATION =================
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS?.replace(/\s/g, ""); // Remove spaces from app password

console.log("📧 Email Config Check:", {
  host: 'smtp.gmail.com',
  port: '587',
  user: EMAIL_USER ? `✅ Set (${EMAIL_USER.substring(0, 5)}***)` : "❌ Not set",
  pass: EMAIL_PASS ? `✅ Set (${EMAIL_PASS.length} chars)` : "❌ Not set",
});

// Enable email if credentials exist (don't wait for verification)
let emailEnabled = !!(EMAIL_USER && EMAIL_PASS);

// Create transporter with explicit SMTP settings for better cloud compatibility
const transporter = EMAIL_USER && EMAIL_PASS ? nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use STARTTLS
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
  // Cloud platform compatibility settings
  connectionTimeout: 60000, // 60 seconds
  greetingTimeout: 30000,
  socketTimeout: 60000,
  // Pool connections for reliability
  pool: true,
  maxConnections: 3,
  maxMessages: 100,
  // TLS settings for cloud environments
  tls: {
    rejectUnauthorized: false, // Accept self-signed certs in some cloud environments
    minVersion: 'TLSv1.2'
  }
}) : null;

// Async verification with timeout handling for cloud platforms
const verifyEmailTransporter = async () => {
  // Check if email credentials are configured
  if (!EMAIL_USER || !EMAIL_PASS || !transporter) {
    console.log("📧 ⚠️ Email credentials not configured - email notifications disabled");
    emailEnabled = false;
    return;
  }

  console.log("📧 ✅ Email enabled with credentials - verification will be attempted in background");
  
  try {
    // Set a manual timeout for verification
    const verifyPromise = transporter.verify();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Verification timeout after 30s')), 30000)
    );
    
    await Promise.race([verifyPromise, timeoutPromise]);
    console.log("📧 ✅ Email transporter verified and ready");
  } catch (error) {
    console.error("📧 ⚠️ Email verification failed:", error.message);
    console.log("📧 ℹ️ Will still attempt to send emails - verification often fails on cloud but sending works");
    // DON'T disable email - verification often fails on cloud but sending works
  }
};

// Run verification without blocking server startup
verifyEmailTransporter();

// ================= INITIALIZE CENTRALIZED EMAIL SERVICE =================
// Initialize the email service transporter at startup for production reliability
console.log('📧 Initializing centralized email service...');
initializeTransporter();
console.log('📧 Centralized email service initialization complete');

// ================= SEND EMAIL FUNCTION =================
// Use centralized email service for resolution emails
// This wrapper adds logging specific to the index.js context
const sendResolutionEmail = async (complaint) => {
  console.log("\n========== EMAIL NOTIFICATION START ==========");
  console.log("📧 Complaint ID:", complaint?.id);
  console.log("📧 User Email (from DB):", complaint?.email || "NO EMAIL - will skip");
  console.log("📧 Problem Image URL:", complaint?.problem_image_url || "NONE");
  console.log("📧 Resolved Image URL:", complaint?.resolved_image_url || "NONE");
  console.log("📧 Resolution Message:", complaint?.resolution_message ? "Present" : "NONE");
  console.log("📧 Email Config - Enabled:", emailEnabled, "| Transporter:", !!transporter);

  // Critical: Ensure we have user email from database
  if (!complaint?.email) {
    console.log("📧 ❌ SKIP: No recipient email in complaint record");
    console.log("📧 ℹ️  This may be an anonymous complaint or email was not stored");
    console.log("========== EMAIL NOTIFICATION END (SKIPPED) ==========");
    return false;
  }

  try {
    // Use the centralized email service
    const result = await sendResolutionEmailService(complaint);
    
    if (result) {
      console.log("📧 ✅ Email sent successfully via emailService");
    } else {
      console.log("📧 ⚠️ Email service returned false (disabled or failed)");
    }
    
    console.log("========== EMAIL NOTIFICATION END ==========");
    return result;
  } catch (err) {
    console.error("📧 ❌ EMAIL SEND FAILED!");
    console.error("📧 Error:", err.message);
    console.error("========== EMAIL NOTIFICATION END (FAILED) ==========");
    return false;
  }
};

// ================= DEBUG: DATABASE USERS ENDPOINT (Development Only) =================
// IMPORTANT: Remove or protect this endpoint in production
app.get("/api/debug/users", async (req, res) => {
  // Only allow in development or with special header
  const isDevMode = process.env.NODE_ENV !== 'production';
  const hasDebugKey = req.headers['x-debug-key'] === process.env.DEBUG_SECRET;
  
  if (!isDevMode && !hasDebugKey) {
    return res.status(403).json({ error: "Debug endpoints disabled in production" });
  }
  
  console.log("\n========== DEBUG: USERS ==========");
  try {
    const [users] = await db.promise().query(
      'SELECT id, email, role, email_verified, password_hash, created_at FROM users ORDER BY id'
    );
    
    console.log("📊 Total users:", users.length);
    users.forEach(u => {
      console.log(`  - ID ${u.id}: ${u.email} (${u.role}) - Hash: ${u.password_hash?.substring(0,20)}...`);
    });
    
    res.json({
      count: users.length,
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        role: u.role,
        email_verified: u.email_verified,
        password_hash_length: u.password_hash?.length,
        password_hash_preview: u.password_hash?.substring(0, 30) + '...',
        password_hash_valid: u.password_hash?.startsWith('$2'),
        created_at: u.created_at
      }))
    });
  } catch (err) {
    console.error("Debug users error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= DEBUG: TEST BCRYPT ENDPOINT (Development Only) =================
app.post("/api/debug/test-password", async (req, res) => {
  // Only allow in development or with special header
  const isDevMode = process.env.NODE_ENV !== 'production';
  const hasDebugKey = req.headers['x-debug-key'] === process.env.DEBUG_SECRET;
  
  if (!isDevMode && !hasDebugKey) {
    return res.status(403).json({ error: "Debug endpoints disabled in production" });
  }
  
  const bcrypt = require('bcryptjs');
  const { email, password } = req.body;
  
  console.log("\n========== DEBUG: TEST PASSWORD ==========");
  console.log("Testing for email:", email);
  
  try {
    const [users] = await db.promise().query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?)',
      [email]
    );
    
    if (users.length === 0) {
      return res.json({ found: false, message: 'User not found' });
    }
    
    const user = users[0];
    const hash = user.password_hash;
    
    console.log("Hash from DB:", hash);
    console.log("Password to test:", password);
    
    const isMatch = await bcrypt.compare(password, hash);
    
    console.log("Bcrypt compare result:", isMatch);
    
    res.json({
      found: true,
      email: user.email,
      hash_length: hash?.length,
      hash_preview: hash?.substring(0, 30),
      hash_valid_format: hash?.startsWith('$2'),
      password_matches: isMatch
    });
  } catch (err) {
    console.error("Test password error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= TEST EMAIL ENDPOINT =================
app.get("/api/test-email", async (req, res) => {
  console.log("\n========== TEST EMAIL ENDPOINT ==========");
  console.log("📧 EMAIL_USER:", EMAIL_USER || "NOT SET");
  console.log("📧 EMAIL_PASS:", EMAIL_PASS ? `SET (${EMAIL_PASS.length} chars)` : "NOT SET");
  console.log("📧 emailEnabled:", emailEnabled);
  console.log("📧 transporter:", transporter ? "EXISTS" : "NULL");

  // Always return diagnostic info
  const diagnostics = {
    EMAIL_USER_SET: !!EMAIL_USER,
    EMAIL_USER_VALUE: EMAIL_USER ? `${EMAIL_USER.substring(0, 5)}***@${EMAIL_USER.split('@')[1] || ''}` : "NOT SET",
    EMAIL_PASS_SET: !!EMAIL_PASS,
    EMAIL_PASS_LENGTH: EMAIL_PASS ? EMAIL_PASS.length : 0,
    emailEnabled,
    transporterExists: !!transporter,
    nodeEnv: process.env.NODE_ENV || 'not set'
  };

  if (!emailEnabled || !transporter) {
    return res.json({
      success: false,
      error: "Email not configured - check Render environment variables",
      diagnostics,
      fix: "Add EMAIL_USER and EMAIL_PASS to Render Dashboard → Environment"
    });
  }

  try {
    const testEmail = req.query.email || EMAIL_USER;
    console.log("📧 Sending test email to:", testEmail);

    const info = await transporter.sendMail({
      from: `"Complaint Portal TEST" <${EMAIL_USER}>`,
      to: testEmail,
      subject: "✅ Test Email - Complaint Portal",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #22c55e;">✅ Email Configuration Working!</h2>
          <p>This is a test email from your Complaint Portal.</p>
          <p>If you received this, email notifications are configured correctly.</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        </div>
      `
    });

    console.log("📧 ✅ Test email sent!", info.messageId);
    res.json({
      success: true,
      message: "Test email sent successfully",
      messageId: info.messageId,
      response: info.response,
      diagnostics
    });
  } catch (err) {
    console.error("📧 ❌ Test email failed:", err.message);
    res.json({
      success: false,
      error: err.message,
      code: err.code,
      responseCode: err.responseCode,
      diagnostics
    });
  }
});

// ================= EMAIL STATUS ENDPOINT =================
app.get("/api/email-status", (req, res) => {
  res.json({
    configured: emailEnabled,
    EMAIL_USER: EMAIL_USER ? "✅ SET" : "❌ NOT SET",
    EMAIL_PASS: EMAIL_PASS ? "✅ SET" : "❌ NOT SET",
    transporter: transporter ? "✅ CREATED" : "❌ NULL",
    message: emailEnabled 
      ? "Email is configured and ready" 
      : "Email NOT configured - add EMAIL_USER and EMAIL_PASS to Render environment variables"
  });
});

// ================= DATABASE =================

// Use connection pool for reliability (handles reconnection automatically)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false,
  },
  connectTimeout: 30000,
});

// Use pool as db for all queries
const db = pool;



// ================= CREATE COMPLAINT =================
app.post(
  "/api/complaints",
  upload.single("image"),
  async (req, res) => {
    try {
      const { category, description, email, name, priority, is_anonymous } =
        req.body;

      let imageUrl = null;

      if (req.file) {
        const result = await cloudinary.uploader.upload(
          `data:${req.file.mimetype};base64,${req.file.buffer.toString(
            "base64"
          )}`,
          { folder: "complaints" }
        );
        imageUrl = result.secure_url;
      }

      // Try to find user_id if email is provided
      let userId = null;
      if (email && is_anonymous !== "true") {
        const [users] = await db.promise().query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER(?)',
          [email]
        );
        if (users.length > 0) {
          userId = users[0].id;
        }
      }

      const [resultDb] = await db.promise().query(
        `INSERT INTO complaints
        (user_id, category, description, email, name, priority, is_anonymous, status, problem_image_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, NOW())`,
        [
          userId,
          category,
          description,
          email || null,
          name || null,
          priority || "low",
          is_anonymous === "true",
          imageUrl,
        ]
      );

      // Fetch the created complaint
      const [newComplaint] = await db.promise().query(
        'SELECT * FROM complaints WHERE id = ?',
        [resultDb.insertId]
      );

      // Send confirmation email to user (non-blocking)
      if (email && is_anonymous !== "true") {
        sendComplaintSubmissionEmail(newComplaint[0]).catch(err => {
          console.error('📧 Failed to send submission email:', err.message);
        });
      }

      res.status(201).json({
        message: "Complaint submitted successfully",
        id: resultDb.insertId,
        problem_image_url: imageUrl,
      });
    } catch (err) {
      console.error("❌ Complaint submit error:", err);
      res.status(500).json({ error: "Failed to submit complaint" });
    }
  }
);

// ================= GET ALL COMPLAINTS =================
app.get("/api/complaints", async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query("SELECT * FROM complaints ORDER BY created_at DESC");

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch complaints" });
  }
});

// ================= DATABASE CONNECTION TEST & INIT =================
(async () => {
  try {
    // Test pool connection
    const [result] = await pool.promise().query('SELECT 1');
    console.log("✅ MySQL Pool Connected");
    
    // Run migrations
    await runMigrations(db);
    console.log("✅ Database migrations complete");
    
    // Start the escalation scheduler
    startEscalationScheduler(db);
  } catch (err) {
    console.error("❌ MySQL connection failed:", err.message);
    console.error("Retrying in 5 seconds...");
    setTimeout(() => process.exit(1), 5000); // Exit and let process manager restart
  }
})();

// Initialize email service
initializeTransporter();

// ================= PHASE 7: AUTH ROUTES =================
app.use('/api/auth', initAuthRoutes(db));
app.use('/api/auth', initPasswordResetRoutes(db));

// ================= PHASE 7: ADMIN ROUTES =================
app.use('/api/admin', initAdminRoutes(db));

// ================= PHASE 6: ESCALATION ROUTES (Public for frontend compatibility) =================
const { triggerEscalationCheck } = require("./services/scheduler");
const { getEscalationStats } = require("./services/escalationService");

// Check escalations (frontend calls this)
app.post("/api/complaints/check-escalations", async (req, res) => {
  try {
    const result = await triggerEscalationCheck(db);
    
    // Fetch escalated complaints to return
    const [escalated] = await db.promise().query(`
      SELECT * FROM complaints 
      WHERE escalation_level > 0 AND status != 'resolved'
      ORDER BY escalation_level DESC, created_at ASC
    `);
    
    res.json({
      message: "Escalation check completed",
      processed: result.processed,
      escalatedCount: result.escalated,
      escalated: escalated,
    });
  } catch (err) {
    console.error("Escalation check error:", err);
    res.status(500).json({ error: "Failed to check escalations" });
  }
});

// Get escalations list
app.get("/api/escalations", async (req, res) => {
  try {
    const [escalated] = await db.promise().query(`
      SELECT c.*, eh.reason as escalation_reason, eh.created_at as escalation_date
      FROM complaints c
      LEFT JOIN escalation_history eh ON c.id = eh.complaint_id
      WHERE c.escalation_level > 0
      ORDER BY c.escalation_level DESC, c.created_at ASC
    `);
    
    res.json(escalated);
  } catch (err) {
    console.error("Get escalations error:", err);
    res.status(500).json({ error: "Failed to fetch escalations" });
  }
});



// ================= UPDATE COMPLAINT STATUS =================
app.put("/api/complaints/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, changed_by } = req.body;

    // Validate status
    const validStatuses = ["new", "under-review", "resolved"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Get current complaint data for email
    const [currentComplaint] = await db.promise().query(
      "SELECT * FROM complaints WHERE id = ?",
      [id]
    );

    if (currentComplaint.length === 0) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    await db.promise().query(
      "UPDATE complaints SET status = ? WHERE id = ?",
      [status, id]
    );

    // Fetch updated complaint
    const [updated] = await db.promise().query(
      "SELECT * FROM complaints WHERE id = ?",
      [id]
    );

    // Send status change email for under-review status
    if (status === 'under-review' && updated[0]?.email) {
      sendStatusChangeEmail(updated[0], status).catch(err => {
        console.error('📧 Failed to send status change email:', err.message);
      });
    }

    res.json({ message: "Status updated successfully", id, status, complaint: updated[0] });
  } catch (err) {
    console.error("❌ Update status error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// ================= RESOLVE COMPLAINT (ADMIN) - TRANSACTIONAL =================
app.put(
  "/api/complaints/:id/resolve",
  upload.single("image"),
  async (req, res) => {
    const id = req.params.id;
    let connection = null;
    let resolvedImageUrl = null;
    
    console.log("\n========== RESOLVE COMPLAINT START ==========");
    console.log("📥 Resolve request for ID:", id);
    console.log("📝 Message:", req.body.resolution_message || "(empty)");
    console.log("📷 File:", req.file ? req.file.originalname : "No file");
    console.log("⏱️  Timestamp:", new Date().toISOString());
    
    try {
      const resolution_message = req.body.resolution_message || "";

      // Check if complaint exists first
      const [existing] = await db
        .promise()
        .query("SELECT * FROM complaints WHERE id = ?", [id]);

      if (existing.length === 0) {
        console.log("❌ Complaint not found:", id);
        return res.status(404).json({ error: "Complaint not found" });
      }
      
      const originalComplaint = existing[0];
      console.log("📧 Complaint owner email (from DB):", originalComplaint.email || "NO EMAIL");

      // Upload to Cloudinary ONLY if file exists (before transaction)
      if (req.file && req.file.buffer) {
        console.log("☁️ Uploading resolution image to Cloudinary...");
        try {
          const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
          const result = await cloudinary.uploader.upload(base64Image, {
            folder: "complaints/resolved",
          });
          resolvedImageUrl = result.secure_url;
          console.log("✅ Cloudinary upload successful:", resolvedImageUrl);
        } catch (uploadErr) {
          console.error("❌ Cloudinary upload failed:", uploadErr.message);
          throw new Error(`Image upload failed: ${uploadErr.message}`);
        }
      }

      // Start transaction for atomic database updates
      connection = await db.promise().getConnection();
      await connection.beginTransaction();
      console.log("🔒 Transaction started");

      try {
        // Step 1: Update complaint status, resolution message, and image URL
        await connection.query(
          `UPDATE complaints 
           SET status = 'resolved', 
               resolution_message = ?, 
               resolved_image_url = ?,
               resolved_at = NOW(),
               escalation_level = 0
           WHERE id = ?`,
          [resolution_message, resolvedImageUrl, id]
        );
        console.log("✅ Step 1: Complaint status updated to resolved");

        // Step 2: Insert timeline/history entry (if escalation_history table exists)
        try {
          await connection.query(
            `INSERT INTO escalation_history 
             (complaint_id, escalation_level, reason, notified_at, created_at) 
             VALUES (?, 0, ?, NOW(), NOW())`,
            [id, `Resolved with message: ${resolution_message.substring(0, 100)}${resolution_message.length > 100 ? '...' : ''}`]
          );
          console.log("✅ Step 2: Timeline entry inserted");
        } catch (historyErr) {
          // Table might not exist or have different schema - log but continue
          console.log("ℹ️  Step 2: Timeline entry skipped (table may not exist):", historyErr.message);
        }

        // Commit transaction
        await connection.commit();
        console.log("✅ Transaction committed successfully");

      } catch (txErr) {
        // Rollback on any database error
        await connection.rollback();
        console.error("❌ Transaction rolled back due to error:", txErr.message);
        throw txErr;
      }

      // Fetch updated complaint with all fields, JOIN with users to get email via user_id
      const [updated] = await db
        .promise()
        .query(`
          SELECT c.*, u.email AS user_email 
          FROM complaints c 
          LEFT JOIN users u ON c.user_id = u.id 
          WHERE c.id = ?
        `, [id]);

      const resolvedComplaint = updated[0];
      // Prefer user_id -> users.email, fallback to complaint.email for backward compatibility
      const recipientEmail = resolvedComplaint.user_email || resolvedComplaint.email;
      
      console.log("\n📋 Resolved Complaint Details:");
      console.log("   ID:", resolvedComplaint.id);
      console.log("   User ID:", resolvedComplaint.user_id || "NONE (legacy/anonymous)");
      console.log("   User Email (from users table):", resolvedComplaint.user_email || "NONE");
      console.log("   Complaint Email (legacy):", resolvedComplaint.email || "NONE");
      console.log("   Final Recipient:", recipientEmail || "NO EMAIL");
      console.log("   Problem Image:", resolvedComplaint.problem_image_url || "NONE");
      console.log("   Resolution Image:", resolvedComplaint.resolved_image_url || "NONE");
      console.log("   Resolution Message:", resolvedComplaint.resolution_message ? "Present" : "NONE");

      // Send email notification (NON-BLOCKING - don't let email failure break the API)
      let emailSent = false;
      if (recipientEmail) {
        console.log("\n📧 Sending resolution email to:", recipientEmail);
        // Fire and forget - don't await to prevent API failure if email fails
        const complaintWithEmail = { ...resolvedComplaint, email: recipientEmail };
        sendResolutionEmail(complaintWithEmail)
          .then((result) => {
            console.log("📧 Email result:", result ? "SENT ✅" : "FAILED/SKIPPED ⚠️");
          })
          .catch((err) => {
            console.error("📧 Email error (non-blocking):", err.message);
          });
        emailSent = true; // Indicates email was attempted (not necessarily delivered)
      } else {
        console.log("📧 Skipping email - no email address found for complaint owner");
      }

      console.log("========== RESOLVE COMPLAINT END (SUCCESS) ==========\n");

      res.json({
        success: true,
        message: "Complaint resolved successfully",
        emailSent: emailSent,
        complaint: resolvedComplaint,
      });
      
    } catch (err) {
      // Enhanced error logging for production debugging
      console.error("\n❌ ========== RESOLVE COMPLAINT ERROR ==========");
      console.error("❌ Complaint ID:", id);
      console.error("❌ Error Type:", err.name || 'Unknown');
      console.error("❌ Error Message:", err.message);
      console.error("❌ Has File:", !!req.file);
      if (err.http_code) console.error("❌ Cloudinary HTTP Code:", err.http_code);
      console.error("❌ Stack:", err.stack);
      console.error("❌ =============================================\n");
      
      // Categorize error for user-friendly response
      let statusCode = 500;
      let errorMessage = "Failed to resolve complaint";
      
      if (err.message?.includes('Image upload') || err.http_code === 401) {
        errorMessage = "Image upload failed - please try again or resolve without image";
      } else if (err.code === 'LIMIT_FILE_SIZE') {
        statusCode = 400;
        errorMessage = "File too large (max 5MB)";
      } else if (err.code?.startsWith('ER_')) {
        errorMessage = "Database error occurred - please try again";
      }
      
      res.status(statusCode).json({ 
        success: false,
        error: errorMessage, 
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    } finally {
      // Always release connection back to pool
      if (connection) {
        connection.release();
        console.log("🔓 Database connection released");
      }
    }
  }
);

// Also support POST for backward compatibility (uses same transactional logic)
app.post(
  "/api/complaints/:id/resolve",
  upload.single("image"),
  async (req, res) => {
    const id = req.params.id;
    let connection = null;
    let resolvedImageUrl = null;
    
    console.log("\n========== RESOLVE COMPLAINT (POST) START ==========");
    console.log("📥 Resolve request for ID:", id);
    console.log("📝 Message:", req.body.resolution_message || "(empty)");
    console.log("📷 File:", req.file ? req.file.originalname : "No file");
    console.log("⏱️  Timestamp:", new Date().toISOString());
    
    try {
      const resolution_message = req.body.resolution_message || "";

      // Check if complaint exists
      const [existing] = await db
        .promise()
        .query("SELECT * FROM complaints WHERE id = ?", [id]);

      if (existing.length === 0) {
        return res.status(404).json({ error: "Complaint not found" });
      }

      const originalComplaint = existing[0];
      console.log("📧 Complaint owner email (from DB):", originalComplaint.email || "NO EMAIL");

      // Upload to Cloudinary ONLY if file exists (before transaction)
      if (req.file && req.file.buffer) {
        console.log("☁️ Uploading resolution image to Cloudinary...");
        try {
          const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
          const result = await cloudinary.uploader.upload(base64Image, {
            folder: "complaints/resolved",
          });
          resolvedImageUrl = result.secure_url;
          console.log("✅ Cloudinary upload successful:", resolvedImageUrl);
        } catch (uploadErr) {
          console.error("❌ Cloudinary upload failed:", uploadErr.message);
          throw new Error(`Image upload failed: ${uploadErr.message}`);
        }
      }

      // Start transaction for atomic database updates
      connection = await db.promise().getConnection();
      await connection.beginTransaction();
      console.log("🔐 Transaction started");

      try {
        // Update complaint status
        await connection.query(
          `UPDATE complaints 
           SET status = 'resolved', 
               resolution_message = ?, 
               resolved_image_url = ?,
               resolved_at = NOW(),
               escalation_level = 0
           WHERE id = ?`,
          [resolution_message, resolvedImageUrl, id]
        );
        console.log("✅ Complaint updated to resolved");

        // Insert timeline entry
        try {
          await connection.query(
            `INSERT INTO escalation_history 
             (complaint_id, escalation_level, reason, notified_at, created_at) 
             VALUES (?, 0, ?, NOW(), NOW())`,
            [id, `Resolved: ${resolution_message.substring(0, 100)}${resolution_message.length > 100 ? '...' : ''}`]
          );
          console.log("✅ Timeline entry added");
        } catch (historyErr) {
          console.log("ℹ️  Timeline entry skipped:", historyErr.message);
        }

        await connection.commit();
        console.log("✅ Transaction committed");

      } catch (txErr) {
        await connection.rollback();
        console.error("❌ Transaction rolled back:", txErr.message);
        throw txErr;
      }

      // Fetch updated complaint with all fields, JOIN with users to get email via user_id
      const [updated] = await db
        .promise()
        .query(`
          SELECT c.*, u.email AS user_email 
          FROM complaints c 
          LEFT JOIN users u ON c.user_id = u.id 
          WHERE c.id = ?
        `, [id]);

      const resolvedComplaint = updated[0];
      // Prefer user_id -> users.email, fallback to complaint.email for backward compatibility
      const recipientEmail = resolvedComplaint.user_email || resolvedComplaint.email;
      
      console.log("📧 User Email (from users table):", resolvedComplaint.user_email || "NONE");
      console.log("📧 Final Recipient:", recipientEmail || "NO EMAIL");

      // Send email notification (NON-BLOCKING - don't let email failure break the API)
      let emailSent = false;
      if (recipientEmail) {
        console.log("📧 Sending resolution email to:", recipientEmail);
        // Fire and forget - don't await to prevent API failure if email fails
        const complaintWithEmail = { ...resolvedComplaint, email: recipientEmail };
        sendResolutionEmail(complaintWithEmail)
          .then((result) => {
            console.log("📧 Email result:", result ? "SENT ✅" : "FAILED ⚠️");
          })
          .catch((err) => {
            console.error("📧 Email error (non-blocking):", err.message);
          });
        emailSent = true; // Indicates email was attempted
      } else {
        console.log("📧 Skipping email - no email address found for complaint owner");
      }

      console.log("========== RESOLVE COMPLAINT (POST) END ==========\n");

      res.json({
        success: true,
        message: "Complaint resolved successfully",
        emailSent: emailSent,
        complaint: resolvedComplaint,
      });
      
    } catch (err) {
      console.error("\n❌ ========== RESOLVE ERROR (POST) ==========");
      console.error("❌ Complaint ID:", id);
      console.error("❌ Error:", err.message);
      console.error("❌ ==========================================\n");
      
      let statusCode = 500;
      let errorMessage = "Failed to resolve complaint";
      
      if (err.message?.includes('Image upload')) {
        errorMessage = "Image upload failed - please try again";
      } else if (err.code === 'LIMIT_FILE_SIZE') {
        statusCode = 400;
        errorMessage = "File too large (max 5MB)";
      }
      
      res.status(statusCode).json({ 
        success: false,
        error: errorMessage
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

// ================= GET COMPLAINT HISTORY =================
app.get("/api/complaints/:id/history", async (req, res) => {
  try {
    const { id } = req.params;

    // Get the complaint details
    const [complaint] = await db
      .promise()
      .query("SELECT * FROM complaints WHERE id = ?", [id]);

    if (complaint.length === 0) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    const c = complaint[0];
    
    // Build history timeline based on complaint data
    const history = [];

    // Entry 1: Complaint created
    history.push({
      id: 1,
      old_status: null,
      new_status: "new",
      changed_at: c.created_at,
      changed_by: c.is_anonymous ? "Anonymous" : (c.name || c.email || "User"),
    });

    // Entry 2: If status is under-review or resolved, add under-review step
    if (c.status === "under-review" || c.status === "resolved") {
      history.push({
        id: 2,
        old_status: "new",
        new_status: "under-review",
        changed_at: c.created_at, // We don't have exact timestamp, use created_at
        changed_by: "Admin",
      });
    }

    // Entry 3: If resolved, add resolved step
    if (c.status === "resolved") {
      history.push({
        id: 3,
        old_status: "under-review",
        new_status: "resolved",
        changed_at: c.resolved_at || c.created_at,
        changed_by: "Admin",
        resolution_message: c.resolution_message || null,
        resolved_image_url: c.resolved_image_url || null,
      });
    }

    res.json(history);
  } catch (err) {
    console.error("❌ Get complaint history error:", err);
    res.status(500).json({ error: "Failed to fetch complaint history" });
  }
});

// ================= PHASE 7: PROTECTED ROUTES =================

// GET USER'S OWN COMPLAINTS (Protected)
app.get("/api/user/complaints", authenticate, async (req, res) => {
  try {
    const userEmail = req.user.email;
    
    const [rows] = await db
      .promise()
      .query("SELECT * FROM complaints WHERE email = ? ORDER BY created_at DESC", [userEmail]);

    res.json(rows);
  } catch (err) {
    console.error("Get user complaints error:", err);
    res.status(500).json({ error: "Failed to fetch user complaints" });
  }
});

// SUBMIT COMPLAINT (Protected - with email verification check)
app.post("/api/user/complaints", authenticate, upload.single("image"), async (req, res) => {
  try {
    // Check if user email is verified
    const [users] = await db.promise().query(
      'SELECT email_verified FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Optional: Enforce email verification
    // if (!users[0].email_verified) {
    //   return res.status(403).json({ error: "Please verify your email before submitting complaints" });
    // }

    const { category, description, priority } = req.body;
    const email = req.user.email;
    const name = req.user.name || req.body.name;

    let imageUrl = null;

    if (req.file) {
      const result = await cloudinary.uploader.upload(
        `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
        { folder: "complaints" }
      );
      imageUrl = result.secure_url;
    }

    const [resultDb] = await db.promise().query(
      `INSERT INTO complaints
      (user_id, category, description, email, name, priority, is_anonymous, status, problem_image_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, FALSE, 'new', ?, NOW())`,
      [
        req.user.id,  // Link to authenticated user
        category,
        description,
        email,
        name || null,
        priority || "low",
        imageUrl,
      ]
    );

    // Fetch the created complaint
    const [newComplaint] = await db.promise().query(
      'SELECT * FROM complaints WHERE id = ?',
      [resultDb.insertId]
    );

    // Send confirmation email to user
    sendComplaintSubmissionEmail(newComplaint[0]).catch(err => {
      console.error('📧 Failed to send submission email:', err.message);
    });

    res.status(201).json({
      message: "Complaint submitted successfully",
      id: resultDb.insertId,
      problem_image_url: imageUrl,
    });
  } catch (err) {
    console.error("❌ Protected complaint submit error:", err);
    res.status(500).json({ error: "Failed to submit complaint" });
  }
});

// ADMIN: UPDATE STATUS (Protected)
app.put("/api/admin/complaints/:id/status", authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["new", "under-review", "resolved"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    await db.promise().query(
      "UPDATE complaints SET status = ? WHERE id = ?",
      [status, id]
    );

    res.json({ message: "Status updated successfully", id, status });
  } catch (err) {
    console.error("❌ Admin update status error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// ADMIN: RESOLVE COMPLAINT (Protected) - Transactional
app.put("/api/admin/complaints/:id/resolve", authenticate, requireAdmin, upload.single("image"), async (req, res) => {
  const id = req.params.id;
  let connection = null;
  let resolvedImageUrl = null;
  
  console.log("\n========== ADMIN RESOLVE COMPLAINT START ==========");
  console.log("📥 Admin:", req.user.email);
  console.log("📥 Complaint ID:", id);
  console.log("📝 Message:", req.body.resolution_message || "(empty)");
  console.log("📷 File:", req.file ? req.file.originalname : "No file");

  try {
    const resolution_message = req.body.resolution_message || "";

    const [existing] = await db.promise().query("SELECT * FROM complaints WHERE id = ?", [id]);

    if (existing.length === 0) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    const originalComplaint = existing[0];
    console.log("📧 Complaint owner email:", originalComplaint.email || "NO EMAIL");

    // Upload image before transaction
    if (req.file && req.file.buffer) {
      console.log("☁️ Uploading to Cloudinary...");
      try {
        const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        const result = await cloudinary.uploader.upload(base64Image, {
          folder: "complaints/resolved",
        });
        resolvedImageUrl = result.secure_url;
        console.log("✅ Cloudinary URL:", resolvedImageUrl);
      } catch (uploadErr) {
        console.error("❌ Cloudinary upload failed:", uploadErr.message);
        throw new Error(`Image upload failed: ${uploadErr.message}`);
      }
    }

    // Start transaction
    connection = await db.promise().getConnection();
    await connection.beginTransaction();

    try {
      // Update complaint
      await connection.query(
        `UPDATE complaints 
         SET status = 'resolved', 
             resolution_message = ?, 
             resolved_image_url = ?,
             resolved_at = NOW(),
             escalation_level = 0
         WHERE id = ?`,
        [resolution_message, resolvedImageUrl, id]
      );

      // Insert timeline entry
      try {
        await connection.query(
          `INSERT INTO escalation_history 
           (complaint_id, escalation_level, reason, notified_at, created_at) 
           VALUES (?, 0, ?, NOW(), NOW())`,
          [id, `Admin ${req.user.email} resolved: ${resolution_message.substring(0, 80)}...`]
        );
      } catch (historyErr) {
        console.log("ℹ️  Timeline entry skipped:", historyErr.message);
      }

      await connection.commit();
      console.log("✅ Transaction committed");

    } catch (txErr) {
      await connection.rollback();
      throw txErr;
    }

    // Fetch updated complaint with all fields including resolved_image_url and resolution_message
    // JOIN with users to get email via user_id for proper email delivery
    const [updated] = await db.promise().query(`
      SELECT c.*, u.email AS user_email 
      FROM complaints c 
      LEFT JOIN users u ON c.user_id = u.id 
      WHERE c.id = ?
    `, [id]);

    const resolvedComplaint = updated[0];
    // Prefer user_id -> users.email, fallback to complaint.email for backward compatibility
    const recipientEmail = resolvedComplaint?.user_email || resolvedComplaint?.email;

    console.log("✅ Complaint resolved by admin:", req.user.email);
    console.log("📋 Resolution details:");
    console.log("   - Problem Image:", resolvedComplaint?.problem_image_url || "NONE");
    console.log("   - Resolved Image:", resolvedComplaint?.resolved_image_url || "NONE");
    console.log("   - Resolution Message:", resolvedComplaint?.resolution_message ? "Present" : "NONE");
    console.log("   - Recipient Email:", recipientEmail || "NONE");

    // Send resolution email with all fields
    let emailResult = false;
    if (recipientEmail) {
      const complaintWithEmail = { ...resolvedComplaint, email: recipientEmail };
      emailResult = await sendResolutionEmail(complaintWithEmail);
      console.log("📧 [PRODUCTION LOG] Resolution email sent:", emailResult ? "SUCCESS" : "FAILED");
    } else {
      console.log("📧 Skipping email - no recipient email found");
    }

    console.log("========== ADMIN RESOLVE COMPLAINT END ==========\n");

    res.json({
      success: true,
      message: "Complaint resolved successfully",
      emailSent: emailResult,
      complaint: updated[0],
    });
  } catch (err) {
    console.error("❌ Admin resolve complaint error:", err.message);
    res.status(500).json({ 
      success: false,
      error: "Failed to resolve complaint", 
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ADMIN: GET ALL COMPLAINTS (Protected)
app.get("/api/admin/complaints", authenticate, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query("SELECT * FROM complaints ORDER BY created_at DESC");

    res.json(rows);
  } catch (err) {
    console.error("Admin get complaints error:", err);
    res.status(500).json({ error: "Failed to fetch complaints" });
  }
});

// GET SINGLE COMPLAINT (Protected - owner or admin)
app.get("/api/user/complaints/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [complaints] = await db.promise().query(
      "SELECT * FROM complaints WHERE id = ?",
      [id]
    );

    if (complaints.length === 0) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    const complaint = complaints[0];

    // Check ownership (unless admin)
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      if (complaint.email !== req.user.email) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    res.json(complaint);
  } catch (err) {
    console.error("Get single complaint error:", err);
    res.status(500).json({ error: "Failed to fetch complaint" });
  }
});

// ================= HEALTH CHECK ENDPOINT =================
app.get("/api/health", async (req, res) => {
  try {
    // Check database connection
    await db.promise().query("SELECT 1");
    
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: "connected",
      version: process.env.npm_package_version || "1.0.0",
    });
  } catch (err) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: err.message,
    });
  }
});

// ================= GLOBAL ERROR HANDLER =================
app.use(errorLogger);

app.use((err, req, res, next) => {
  logger.error("Unhandled error:", err);
  
  // Don't leak error details in production
  const isDev = process.env.NODE_ENV !== 'production';
  
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Internal server error',
    ...(isDev && { stack: err.stack }),
  });
});

// ================= 404 HANDLER =================
app.use((req, res) => {
  console.log(`⚠️ 404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: "Endpoint not found",
    path: req.originalUrl,
    method: req.method,
    hint: "Check if the route exists and the HTTP method is correct"
  });
});

// ================= SERVER =================
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  logger.info(`🚀 Backend running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🚀 Backend running on port ${PORT}`);
});
