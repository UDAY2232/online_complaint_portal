// Express backend for complaint portal (MySQL + Cloudinary)
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const { v4: uuidv4 } = require("uuid");

const upload = require("./utils/multer");
const cloudinary = require("./utils/cloudinary");

const app = express();
app.use(cors());

// ================= DATABASE =================
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
});

let dbConnected = false;

db.connect((err) => {
  if (err) {
    console.error("❌ MySQL connection error:", err);
    return;
  }
  dbConnected = true;
  console.log("✅ Connected to MySQL");
});

// ================= GET ALL COMPLAINTS =================
app.get("/api/complaints", (req, res) => {
  db.query(
    "SELECT * FROM complaints ORDER BY created_at DESC",
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

// ================= CREATE COMPLAINT (WITH IMAGE) =================
app.post(
  "/api/complaints",
  upload.single("file"),
  async (req, res) => {
    if (!dbConnected) {
      return res.status(503).json({ error: "Database unavailable" });
    }

    try {
      const {
        category,
        description,
        email,
        name,
        priority,
        is_anonymous,
      } = req.body;

      let imageUrl = null;

      // Upload image to Cloudinary
      if (req.file) {
        const result = await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream({ folder: "complaints" }, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            })
            .end(req.file.buffer);
        });

        imageUrl = result.secure_url;
      }

      const [result] = await db.promise().query(
        `INSERT INTO complaints
        (category, description, email, name, priority, is_anonymous, status, problem_image_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'new', ?, NOW())`,
        [
          category,
          description,
          email || null,
          name || null,
          priority || "low",
          is_anonymous === "true" ? 1 : 0,
          imageUrl,
        ]
      );

      res.status(201).json({
        message: "Complaint submitted successfully",
        id: result.insertId,
        problem_image_url: imageUrl,
      });
    } catch (err) {
      console.error("❌ Complaint submit error:", err);
      res.status(500).json({ error: "Failed to submit complaint" });
    }
  }
);

// ================= UPDATE STATUS =================
app.put("/api/complaints/:id", async (req, res) => {
  const { status } = req.body;
  const id = req.params.id;

  try {
    await db
      .promise()
      .query("UPDATE complaints SET status=? WHERE id=?", [status, id]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Status update failed" });
  }
});

// ================= SERVER =================
const PORT = process.env.PORT || 3856;

app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
