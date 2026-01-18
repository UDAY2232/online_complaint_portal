require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");

const upload = require("./utils/multer");
const cloudinary = require("./utils/cloudinary");

const app = express();
app.use(cors());
app.use(express.json());

// ================= DATABASE =================

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),

  ssl: {
    rejectUnauthorized: false,
  },

  connectTimeout: 30000,   // 🔥 IMPORTANT
});



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

function connectWithRetry() {
  db.connect((err) => {
    if (err) {
      console.error("❌ MySQL connection failed, retrying in 5s:", err.message);
      setTimeout(connectWithRetry, 5000);
    } else {
      console.log("✅ MySQL Connected");
    }
  });
}

connectWithRetry();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
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

// ================= SERVER =================
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`🚀 Backend running on port ${PORT}`)
);
