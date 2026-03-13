/**
 * Complaint Portal Backend
 * Production Ready - PostgreSQL (Neon) + JWT + Cloudinary
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");

const upload = require("./utils/multer");
const cloudinary = require("./utils/cloudinary");

const db = require("./config/db");

const { authenticate, requireAdmin } = require("./middleware/auth");

const initAuthRoutes = require("./routes/auth");
const initAdminRoutes = require("./routes/admin");
const initSuperadminRoutes = require("./routes/superadmin");

const {
  sendResolutionEmail,
  sendComplaintSubmissionEmail
} = require("./services/emailService");

const { runMigrations } = require("./utils/migrations");

// ================= APP INIT =================

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ================= DATABASE CONNECT =================

(async () => {
  try {

    await db.query("SELECT 1");

    console.log("✅ PostgreSQL Connected");

    await runMigrations(db);

    console.log("✅ Migrations ensured");

  }
  catch (err) {

    console.error("❌ DATABASE CONNECTION FAILED:", err.message);

    process.exit(1);

  }
})();


// ================= GLOBAL ERROR HANDLER =================

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});


// ================= AUTH ROUTES =================

app.use("/api/auth", initAuthRoutes(db));
// Mount admin and superadmin route modules so frontend can call /api/admin/* and /api/superadmin/*
app.use("/api/admin", initAdminRoutes(db));
app.use("/api/superadmin", initSuperadminRoutes(db));


// =======================================================
// ================= USER ROUTES =========================
// =======================================================


// ================= USER DASHBOARD =================

app.get("/api/user/dashboard", authenticate, async (req, res) => {

  try {

    const email = req.user?.email;

    if (!email)
      return res.status(401).json({ error: "Invalid token" });

    const totalResult = await db.query(
      "SELECT COUNT(*) FROM complaints WHERE LOWER(email)=LOWER($1)",
      [email]
    );

    const pendingResult = await db.query(
      "SELECT COUNT(*) FROM complaints WHERE LOWER(email)=LOWER($1) AND status='new'",
      [email]
    );

    const reviewResult = await db.query(
      "SELECT COUNT(*) FROM complaints WHERE LOWER(email)=LOWER($1) AND status='under-review'",
      [email]
    );

    const resolvedResult = await db.query(
      "SELECT COUNT(*) FROM complaints WHERE LOWER(email)=LOWER($1) AND status='resolved'",
      [email]
    );

    res.json({

      total: parseInt(totalResult.rows[0].count),

      pending: parseInt(pendingResult.rows[0].count),

      underReview: parseInt(reviewResult.rows[0].count),

      resolved: parseInt(resolvedResult.rows[0].count)

    });

  }
  catch (err) {

    console.error("Dashboard error:", err);

    res.status(500).json({
      error: err.message
    });

  }

});


// ================= CREATE COMPLAINT =================

app.post(
  "/api/user/complaints",
  authenticate,
  upload.single("image"),
  async (req, res) => {

    try {

      const {
        category,
        description,
        priority,
        is_anonymous
      } = req.body;

      const userId = req.user?.id || null;
      const email = req.user?.email || null;
      const name = req.user?.name || null;

      if (!category || !description)
        return res.status(400).json({
          error: "Category and description required"
        });

      let imageUrl = null;

      if (req.file) {

        const uploadResult =
          await cloudinary.uploader.upload(
            `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
            { folder: "complaints" }
          );

        imageUrl = uploadResult.secure_url;

      }

      const insertResult = await db.query(

        `
        INSERT INTO complaints
        (
          user_id,
          category,
          description,
          email,
          name,
          priority,
          is_anonymous,
          status,
          problem_image_url,
          before_image_url,
          created_at,
          status_updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,'new',$8,$8,NOW(),NOW())
        RETURNING id
        `,

        [
          userId,
          category,
          description,
          email,
          name,
          priority || "medium",
          is_anonymous === true || is_anonymous === "true",
          imageUrl
        ]

      );

      const complaintId = insertResult.rows[0].id;

      const complaintResult =
        await db.query(
          "SELECT * FROM complaints WHERE id=$1",
          [complaintId]
        );

      // 📝 Add initial status history entry
      try {
        await db.query(
          `INSERT INTO status_history (complaint_id, old_status, new_status, changed_by, changed_by_role, changed_at, notes)
           VALUES ($1, NULL, 'new', $2, $3, NOW(), 'Complaint created')`,
          [complaintId, email || 'anonymous', 'user']
        );
      } catch (historyErr) {
        console.warn('Failed to record initial status history:', historyErr.message);
        // Don't block complaint creation if history fails
      }

      sendComplaintSubmissionEmail(
        complaintResult.rows[0]
      ).catch(err =>
        console.error("Email error:", err.message)
      );

      res.status(201).json({
        success: true,
        id: complaintId
      });

    }
    catch (err) {

      console.error("Create complaint error:", err);

      res.status(500).json({
        error: err.message
      });

    }

  }
);


// ================= GET USER COMPLAINTS =================
app.get("/api/user/complaints", authenticate, async (req, res) => {

  try {

    console.log("JWT User:", req.user);

    // Validate token data
    if (!req.user) {
      return res.status(401).json({
        error: "User not authenticated"
      });
    }

    if (!req.user.email) {
      return res.status(400).json({
        error: "User email missing in token"
      });
    }

    const email = req.user.email.toLowerCase();

    // Check table exists
 const testQuery = await db.query(`
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_name = 'complaints'
    AND table_schema = 'public'
  )
`);


    if (!testQuery.rows[0].exists) {
      return res.status(500).json({
        error: "Complaints table does not exist"
      });
    }

    // Main query
    const result = await db.query(`
  SELECT
    id,
    category,
    description,
    email,
    name,
    priority,
    status,
    problem_image_url,
    created_at,
    resolved_at
  FROM complaints
  WHERE email IS NOT NULL
  AND LOWER(email) = LOWER($1)
  ORDER BY created_at DESC
`, [email]);


    console.log("Complaints found:", result.rows.length);

    return res.json(result.rows);

  }
  catch (err) {

    console.error("❌ Complaint fetch error FULL:", err);

    return res.status(500).json({
      error: err.message,
      stack: err.stack
    });

  }

});



// =======================================================
// ================= ADMIN ROUTES ========================
// =======================================================


// ================= GET ALL =================

app.get(
  "/api/admin/complaints",
  authenticate,
  requireAdmin,
  async (req, res) => {

    try {

      const result =
        await db.query(
          "SELECT * FROM complaints ORDER BY created_at DESC"
        );

      res.json(result.rows);

    }
    catch (err) {

      console.error(err);

      res.status(500).json({
        error: err.message
      });

    }

  }
);


// ================= UPDATE STATUS =================

app.put(
  "/api/admin/complaints/:id/status",
  authenticate,
  requireAdmin,
  async (req, res) => {

    try {

      // Get current status for history
      const currentResult = await db.query(
        "SELECT status FROM complaints WHERE id=$1",
        [req.params.id]
      );
      
      const oldStatus = currentResult.rows[0]?.status;

      await db.query(

        "UPDATE complaints SET status=$1, status_updated_at=NOW() WHERE id=$2",

        [req.body.status, req.params.id]

      );

      // 📝 Record status change in history
      try {
        await db.query(`
          INSERT INTO status_history (complaint_id, old_status, new_status, changed_by, changed_by_role, changed_at, notes)
          VALUES ($1, $2, $3, $4, 'admin', NOW(), 'Status updated by admin')
        `, [req.params.id, oldStatus, req.body.status, req.user?.email || 'system']);
      } catch (historyErr) {
        console.warn('Failed to record status history:', historyErr.message);
      }

      res.json({
        success: true
      });

    }
    catch (err) {

      res.status(500).json({
        error: err.message
      });

    }

  }
);


// ================= RESOLVE =================

app.put(
  "/api/admin/complaints/:id/resolve",
  authenticate,
  requireAdmin,
  upload.single("image"),
  async (req, res) => {

    const client = await db.connect();

    try {

      await client.query("BEGIN");

      let imageUrl = null;

      if (req.file) {

        const uploadResult =
          await cloudinary.uploader.upload(
            `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
            { folder: "complaints/resolved" }
          );

        imageUrl = uploadResult.secure_url;

      }

      await client.query(

        `
        UPDATE complaints
        SET
          status='resolved',
          resolution_message=$1,
          after_image_url=$2,
          resolved_image_url=$2,
          resolved_by=$3,
          admin_id=$3,
          resolved_at=NOW(),
          status_updated_at=NOW()
        WHERE id=$4
        `,

        [
          req.body.resolution_message,
          imageUrl,
          req.user.id,
          req.params.id
        ]

      );

      await client.query("COMMIT");

      // Fetch updated complaint (with user info) to send resolution email
      try {
        const updatedResult = await client.query(
          `SELECT c.*, u.name as user_name, u.email as user_email FROM complaints c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = $1`,
          [req.params.id]
        );

        const updatedComplaint = updatedResult.rows[0] || null;

        if (updatedComplaint && (updatedComplaint.user_email || updatedComplaint.email)) {
          // Normalize email/name fields for the email service
          updatedComplaint.email = updatedComplaint.user_email || updatedComplaint.email;
          updatedComplaint.name = updatedComplaint.user_name || updatedComplaint.name;

          // Fire-and-forget sendResolutionEmail; log errors but don't block response
          sendResolutionEmail(updatedComplaint).catch(err =>
            console.error('Email sendResolutionEmail error:', err && err.message ? err.message : err)
          );
        } else {
          console.log('No recipient email found for complaint', req.params.id, '- skipping resolution email');
        }
      } catch (err) {
        console.error('Failed to fetch complaint after resolve for email:', err && err.message ? err.message : err);
      }

      // Record status change in status_history table if it exists
      try {
        await client.query(`
          INSERT INTO status_history (complaint_id, old_status, new_status, changed_by, changed_by_role, changed_at, notes)
          SELECT id, 'under-review', 'resolved', $1, 'admin', NOW(), 'Complaint resolved'
          FROM complaints WHERE id = $2
        `, [req.user?.email || 'system', req.params.id]);
      } catch (err) {
        // Table may not exist - log and continue
        console.warn('status_history insert failed (table may not exist):', err && err.message ? err.message : err);
      }

      res.json({ success: true });

    }
    catch (err) {

      await client.query("ROLLBACK");

      res.status(500).json({
        error: err.message
      });

    }
    finally {

      client.release();

    }

  }
);


// ================= HEALTH =================

app.get("/api/health", async (req, res) => {

  try {

    await db.query("SELECT 1");

    res.json({ status: "ok" });

  }
  catch {

    res.status(500).json({ status: "fail" });

  }

});

// ================= ESCALATIONS (generic listing for admin/superadmin views) =================
app.get("/api/escalations", authenticate, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    // Defensive: if escalation_history table doesn't exist, return empty array
    const existsRes = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'escalation_history' AND table_schema = current_schema()
      )
    `);

    if (!existsRes.rows[0].exists) {
      return res.json([]);
    }

    const result = await db.query(
      `
      SELECT eh.id as id, eh.complaint_id, eh.escalation_level, eh.reason as escalation_reason, eh.created_at as escalated_at,
             c.category, c.description, c.priority, c.status, c.email as complaint_email
      FROM escalation_history eh
      LEFT JOIN complaints c ON eh.complaint_id = c.id
      ORDER BY eh.created_at DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get /api/escalations error:', err);
    res.status(500).json({ error: 'Failed to fetch escalations' });
  }
});

// ================= GET STATUS HISTORY FOR COMPLAINT =================
app.get("/api/complaints/:id/status-history", authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify user owns this complaint or is admin
    const complaintResult = await db.query(
      "SELECT id, user_id, email FROM complaints WHERE id = $1",
      [id]
    );

    if (complaintResult.rows.length === 0) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    const complaint = complaintResult.rows[0];

    // Check permission: user owns complaint or is admin
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      if (complaint.user_id !== req.user.id && complaint.email?.toLowerCase() !== req.user.email?.toLowerCase()) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    // Get status history
    const historyResult = await db.query(
      `SELECT id, complaint_id, old_status, new_status, changed_by, changed_by_role, changed_at, notes
       FROM status_history
       WHERE complaint_id = $1
       ORDER BY changed_at ASC`,
      [id]
    );

    res.json({
      success: true,
      history: historyResult.rows
    });
  } catch (err) {
    console.error('Get status history error:', err);
    res.status(500).json({ error: 'Failed to fetch status history' });
  }
});

app.get("/api/debug/complaints", async (req, res) => {
  try {
    const result = await db.query("SELECT COUNT(*) FROM complaints");
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ================= START =================

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {

  console.log("🚀 Server running on port", PORT);

});
