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
          created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,'new',$8,NOW())
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

      await db.query(

        "UPDATE complaints SET status=$1 WHERE id=$2",

        [req.body.status, req.params.id]

      );

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
          resolved_image_url=$2,
          resolved_at=NOW()
        WHERE id=$3
        `,

        [
          req.body.resolution_message,
          imageUrl,
          req.params.id
        ]

      );

      await client.query("COMMIT");

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
