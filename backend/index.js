const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Imports
const express = require("express");
const cors = require("cors");

const upload = require("./utils/multer");
const cloudinary = require("./utils/cloudinary");

const db = require("./config/db");

const { authenticate, requireAdmin } = require("./middleware/auth");

const initAuthRoutes = require("./routes/auth");

const { sendResolutionEmail, sendComplaintSubmissionEmail } = require("./services/emailService");
const { runMigrations } = require("./utils/migrations");

// App initialization (must be before any routes)
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// ================= DATABASE CONNECT =================
(async () => {
  try {
    // simple connection check
    await db.query("SELECT 1");
    console.log("✅ PostgreSQL Connected");

    // Run lightweight migrations to ensure required tables/columns exist
    try {
      await runMigrations(db);
    } catch (mErr) {
      console.error('Migration error:', mErr && mErr.message ? mErr.message : mErr);
    }
  } catch (err) {
    console.error("DB ERROR:", err && err.message ? err.message : err);
    // If DB is not available we should fail fast so client doesn't receive 500s
    process.exit(1);
  }
})();

// Global error handlers to make debugging easier
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err && err.stack ? err.stack : err);
  // it's unsafe to continue running after an uncaught exception
  process.exit(1);
});

// ================= AUTH ROUTES =================
app.use("/api/auth", initAuthRoutes(db));

// ================= USER ROUTES =================

// GET user dashboard counts
app.get("/api/user/dashboard", authenticate, async (req, res) => {
  try {
    const email = req.user && req.user.email;
    if (!email) return res.status(400).json({ error: "Missing user email" });

    const queries = [
      { text: "SELECT COUNT(*) FROM complaints WHERE email=$1", values: [email] },
      { text: "SELECT COUNT(*) FROM complaints WHERE email=$1 AND status='new'", values: [email] },
      { text: "SELECT COUNT(*) FROM complaints WHERE email=$1 AND status='under-review'", values: [email] },
      { text: "SELECT COUNT(*) FROM complaints WHERE email=$1 AND status='resolved'", values: [email] }
    ];

    const results = await Promise.all(queries.map(q => db.query(q)));

    const total = parseInt(results[0].rows[0].count, 10) || 0;
    const pending = parseInt(results[1].rows[0].count, 10) || 0;
    const underReview = parseInt(results[2].rows[0].count, 10) || 0;
    const resolved = parseInt(results[3].rows[0].count, 10) || 0;

    res.json({ total, pending, underReview, resolved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST create complaint
app.post(
  "/api/user/complaints",
  authenticate,
  upload.single("image"),
  async (req, res) => {
    try {
      const { category, description, priority, is_anonymous } = req.body;
      const userId = req.user && req.user.id;
      const email = req.user && req.user.email;
      const name = req.user && req.user.name;

      if (!category || !description) return res.status(400).json({ error: "Missing required fields" });

      let imageUrl = null;
      if (req.file) {
        const uploadResult = await cloudinary.uploader.upload(
          `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
          { folder: "complaints" }
        );
        imageUrl = uploadResult.secure_url;
      }

      const insertText = `INSERT INTO complaints
        (user_id, category, description, email, name, priority, is_anonymous, status, problem_image_url, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
        RETURNING id`;

      const insertValues = [
        userId || null,
        category,
        description,
        email || null,
        name || null,
        priority || "low",
        (is_anonymous === true || is_anonymous === "true") ? true : false,
        "new",
        imageUrl
      ];

      const result = await db.query(insertText, insertValues);
      const complaintId = result.rows[0].id;

      const complaintRes = await db.query("SELECT * FROM complaints WHERE id=$1", [complaintId]);
      const complaint = complaintRes.rows[0];

      // send email asynchronously, don't block response on failures
      sendComplaintSubmissionEmail(complaint).catch(e => console.error("Email error:", e.message));

      res.status(201).json({ success: true, id: complaintId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

// GET user complaints
app.get("/api/user/complaints", authenticate, async (req, res) => {
  try {
    const email = req.user && req.user.email;
    if (!email) return res.status(400).json({ error: "Missing user email" });

    const result = await db.query("SELECT * FROM complaints WHERE email=$1 ORDER BY created_at DESC", [email]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ================= ADMIN ROUTES =================

// Get all complaints
app.get("/api/admin/complaints", authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM complaints ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Update status
app.put("/api/admin/complaints/:id/status", authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Missing status" });

    await db.query("UPDATE complaints SET status=$1 WHERE id=$2", [status, id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Resolve complaint (transaction)
app.put(
  "/api/admin/complaints/:id/resolve",
  authenticate,
  requireAdmin,
  upload.single("image"),
  async (req, res) => {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const { id } = req.params;
      const resolution = req.body.resolution_message || null;

      let imageUrl = null;
      if (req.file) {
        const uploadResult = await cloudinary.uploader.upload(
          `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
          { folder: "complaints/resolved" }
        );
        imageUrl = uploadResult.secure_url;
      }

      const updateText = `UPDATE complaints
        SET status='resolved', resolution_message=$1, resolved_image_url=$2, resolved_at=NOW()
        WHERE id=$3`;

      await client.query(updateText, [resolution, imageUrl, id]);
      await client.query("COMMIT");

      const complaintRes = await db.query("SELECT * FROM complaints WHERE id=$1", [id]);
      const complaint = complaintRes.rows[0];

      sendResolutionEmail(complaint).catch(e => console.error("Email error:", e.message));

      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  }
);

// Health
app.get("/api/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (err) {
    console.error("Health check failed:", err.message);
    res.status(500).json({ status: "fail" });
  }
});

// Server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
