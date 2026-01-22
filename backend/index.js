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
const { initializeTransporter, sendResolutionEmail: sendResolutionEmailService } = require("./services/emailService");
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
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeInput); // XSS protection
app.use(requestLogger); // Request logging

// Rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/', generalLimiter);

// ================= EMAIL CONFIGURATION =================
console.log("📧 Email Config:", {
  host: 'smtp.gmail.com',
  port: '587',
  user: process.env.EMAIL_USER ? "✅ Set" : "❌ Not set",
  pass: process.env.EMAIL_PASS ? "✅ Set" : "❌ Not set",
});

let emailEnabled = false;

// Create transporter with explicit SMTP settings for better cloud compatibility
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS?.replace(/\s/g, ""), // Remove spaces from app password
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
});

// Async verification with timeout handling for cloud platforms
const verifyEmailTransporter = async () => {
  // Check if email credentials are configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("📧 ⚠️ Email credentials not configured - email notifications disabled");
    emailEnabled = false;
    return;
  }

  try {
    // Set a manual timeout for verification
    const verifyPromise = transporter.verify();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Verification timeout')), 30000)
    );
    
    await Promise.race([verifyPromise, timeoutPromise]);
    console.log("📧 ✅ Email transporter ready to send");
    emailEnabled = true;
  } catch (error) {
    console.error("📧 ❌ Email transporter verification failed:", error.message);
    console.log("📧 ⚠️ Email notifications will be disabled");
    console.log("📧 ℹ️ Note: This is common on cloud platforms. Emails may still work when sending.");
    emailEnabled = false;
    
    // Enable email anyway if credentials exist - verification can fail but sending might work
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      console.log("📧 ℹ️ Enabling email anyway - will retry on first send attempt");
      emailEnabled = true;
    }
  }
};

// Run verification without blocking server startup
verifyEmailTransporter();

// ================= SEND EMAIL FUNCTION =================
const sendResolutionEmail = async (complaint) => {
  try {
    console.log("📧 Attempting to send email for complaint:", complaint.id);
    console.log("📧 User email:", complaint.email || "NO EMAIL");
    console.log("📧 Email enabled:", emailEnabled);

    // Skip if email is not configured properly
    if (!emailEnabled) {
      console.log("📧 ⚠️ Email is disabled - skipping notification");
      return;
    }

    // Only send if user email exists
    if (!complaint.email) {
      console.log("📧 ⚠️ No email address - skipping notification");
      return;
    }

    const resolvedImageSection = complaint.resolved_image_url
      ? `<p><strong>Resolution Image:</strong></p>
         <img src="${complaint.resolved_image_url}" alt="Resolution" style="max-width: 400px; border-radius: 8px;" />`
      : "";

    const mailOptions = {
      from: `"Complaint Portal" <${process.env.EMAIL_USER}>`,
      to: complaint.email,
      subject: `Your Complaint #${complaint.id} Has Been Resolved`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #22c55e;">✅ Your Complaint Has Been Resolved</h2>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Complaint ID:</strong> #${complaint.id}</p>
            <p><strong>Category:</strong> ${complaint.category}</p>
            <p><strong>Status:</strong> <span style="color: #22c55e; font-weight: bold;">Resolved</span></p>
          </div>
          
          ${complaint.resolution_message ? `
          <div style="margin: 20px 0;">
            <h3>Resolution Message:</h3>
            <p style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; border-left: 4px solid #22c55e;">
              ${complaint.resolution_message}
            </p>
          </div>
          ` : ""}
          
          ${resolvedImageSection}
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
          
          <p style="color: #6b7280; font-size: 14px;">
            Thank you for using our Complaint Portal. If you have any further questions, please don't hesitate to reach out.
          </p>
        </div>
      `,
    };

    console.log("📧 Sending email to:", complaint.email);
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 ✅ Resolution email sent to: ${complaint.email}`);
    console.log("📧 Message ID:", info.messageId);
    return true;
  } catch (err) {
    console.error(`📧 ❌ Failed to send email to ${complaint.email}:`, err.message);
    // Don't log full error in production to avoid exposing credentials
    if (process.env.NODE_ENV !== 'production') {
      console.error("📧 Full error:", err);
    }
    return false;
  }
};

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

      const [resultDb] = await db.promise().query(
        `INSERT INTO complaints
        (category, description, email, name, priority, is_anonymous, status, problem_image_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'new', ?, NOW())`,
        [
          category,
          description,
          email || null,
          name || null,
          priority || "low",
          is_anonymous === "true",
          imageUrl,
        ]
      );

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

    await db.promise().query(
      "UPDATE complaints SET status = ? WHERE id = ?",
      [status, id]
    );

    res.json({ message: "Status updated successfully", id, status });
  } catch (err) {
    console.error("❌ Update status error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// ================= RESOLVE COMPLAINT (ADMIN) =================
app.put(
  "/api/complaints/:id/resolve",
  upload.single("image"),
  async (req, res) => {
    try {
      const id = req.params.id;
      const resolution_message = req.body.resolution_message || "";

      console.log("📥 Resolve request for ID:", id);
      console.log("📝 Message:", resolution_message);
      console.log("📷 File:", req.file ? req.file.originalname : "No file");

      // Check if complaint exists
      const [existing] = await db
        .promise()
        .query("SELECT * FROM complaints WHERE id = ?", [id]);

      if (existing.length === 0) {
        return res.status(404).json({ error: "Complaint not found" });
      }

      let resolvedImageUrl = null;

      // Upload to Cloudinary ONLY if file exists
      if (req.file && req.file.buffer) {
        console.log("☁️ Uploading to Cloudinary...");
        const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        const result = await cloudinary.uploader.upload(base64Image, {
          folder: "complaints/resolved",
        });
        resolvedImageUrl = result.secure_url;
        console.log("✅ Cloudinary URL:", resolvedImageUrl);
      }

      // Update database
      await db.promise().query(
        `UPDATE complaints 
         SET status = 'resolved', 
             resolution_message = ?, 
             resolved_image_url = ?,
             resolved_at = NOW()
         WHERE id = ?`,
        [resolution_message, resolvedImageUrl, id]
      );

      // Fetch updated complaint
      const [updated] = await db
        .promise()
        .query("SELECT * FROM complaints WHERE id = ?", [id]);

      console.log("✅ Complaint resolved successfully");

      // Send email notification (non-blocking)
      sendResolutionEmail(updated[0]).catch(err => {
        console.error("📧 Email sending failed in background:", err.message);
      });

      res.json({
        success: true,
        message: "Complaint resolved successfully",
        complaint: updated[0],
      });
    } catch (err) {
      console.error("❌ Resolve complaint error:", err.message);
      console.error("Full error:", err);
      res.status(500).json({ 
        success: false,
        error: "Failed to resolve complaint", 
        details: err.message 
      });
    }
  }
);

// Also support POST for backward compatibility
app.post(
  "/api/complaints/:id/resolve",
  upload.single("image"),
  async (req, res) => {
    try {
      const id = req.params.id;
      const resolution_message = req.body.resolution_message || "";

      console.log("📥 [POST] Resolve request for ID:", id);
      console.log("📝 Message:", resolution_message);
      console.log("📷 File:", req.file ? req.file.originalname : "No file");

      // Check if complaint exists
      const [existing] = await db
        .promise()
        .query("SELECT * FROM complaints WHERE id = ?", [id]);

      if (existing.length === 0) {
        return res.status(404).json({ error: "Complaint not found" });
      }

      let resolvedImageUrl = null;

      // Upload to Cloudinary ONLY if file exists
      if (req.file && req.file.buffer) {
        console.log("☁️ Uploading to Cloudinary...");
        const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        const result = await cloudinary.uploader.upload(base64Image, {
          folder: "complaints/resolved",
        });
        resolvedImageUrl = result.secure_url;
        console.log("✅ Cloudinary URL:", resolvedImageUrl);
      }

      // Update database with EXACT column names
      await db.promise().query(
        `UPDATE complaints 
         SET status = 'resolved', 
             resolution_message = ?, 
             resolved_image_url = ?,
             resolved_at = NOW()
         WHERE id = ?`,
        [resolution_message, resolvedImageUrl, id]
      );

      // Fetch updated complaint
      const [updated] = await db
        .promise()
        .query("SELECT * FROM complaints WHERE id = ?", [id]);

      console.log("✅ Complaint resolved successfully");

      // Send email notification (non-blocking)
      sendResolutionEmail(updated[0]).catch(err => {
        console.error("📧 Email sending failed in background:", err.message);
      });

      res.json({
        success: true,
        message: "Complaint resolved successfully",
        complaint: updated[0],
      });
    } catch (err) {
      console.error("❌ Resolve complaint error:", err.message);
      console.error("Full error:", err);
      res.status(500).json({ 
        success: false,
        error: "Failed to resolve complaint", 
        details: err.message 
      });
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
      (category, description, email, name, priority, is_anonymous, status, problem_image_url, created_at)
      VALUES (?, ?, ?, ?, ?, FALSE, 'new', ?, NOW())`,
      [
        category,
        description,
        email,
        name || null,
        priority || "low",
        imageUrl,
      ]
    );

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

// ADMIN: RESOLVE COMPLAINT (Protected)
app.put("/api/admin/complaints/:id/resolve", authenticate, requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const id = req.params.id;
    const resolution_message = req.body.resolution_message || "";

    console.log("📥 [ADMIN] Resolve request for ID:", id);

    const [existing] = await db.promise().query("SELECT * FROM complaints WHERE id = ?", [id]);

    if (existing.length === 0) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    let resolvedImageUrl = null;

    if (req.file && req.file.buffer) {
      console.log("☁️ Uploading to Cloudinary...");
      const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      const result = await cloudinary.uploader.upload(base64Image, {
        folder: "complaints/resolved",
      });
      resolvedImageUrl = result.secure_url;
      console.log("✅ Cloudinary URL:", resolvedImageUrl);
    }

    await db.promise().query(
      `UPDATE complaints 
       SET status = 'resolved', 
           resolution_message = ?, 
           resolved_image_url = ?,
           resolved_at = NOW()
       WHERE id = ?`,
      [resolution_message, resolvedImageUrl, id]
    );

    const [updated] = await db.promise().query("SELECT * FROM complaints WHERE id = ?", [id]);

    console.log("✅ Complaint resolved by admin:", req.user.email);

    // Send enhanced resolution email
    sendResolutionEmailService(updated[0]).catch(err => {
      console.error("📧 Email sending failed:", err.message);
    });

    res.json({
      success: true,
      message: "Complaint resolved successfully",
      complaint: updated[0],
    });
  } catch (err) {
    console.error("❌ Admin resolve complaint error:", err.message);
    res.status(500).json({ 
      success: false,
      error: "Failed to resolve complaint", 
      details: err.message 
    });
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
  res.status(404).json({ error: "Endpoint not found" });
});

// ================= SERVER =================
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  logger.info(`🚀 Backend running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🚀 Backend running on port ${PORT}`);
});
