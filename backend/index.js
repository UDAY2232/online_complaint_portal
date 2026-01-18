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

db.connect((err) => {
  if (err) {
    console.error("❌ MySQL error", err);
    return;
  }
  console.log("✅ MySQL Connected");
});

// ================= CREATE COMPLAINT =================
app.post(
  "/api/complaints",
  upload.single("image"), // 🔑 MUST match frontend key
  async (req, res) => {
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

      if (req.file) {
        const uploadResult = await cloudinary.uploader.upload(
          req.file.path,
          { folder: "complaints" }
        );
        imageUrl = uploadResult.secure_url;
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
          is_anonymous === "true",
          imageUrl,
        ]
      );

      res.status(201).json({
        success: true,
        id: result.insertId,
        problem_image_url: imageUrl,
      });
    } catch (err) {
      console.error("❌ Submit error:", err);
      res.status(500).json({ error: "Failed to submit complaint" });
    }
  }
);

// ================= SERVER =================
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`🚀 Backend running on port ${PORT}`)
);
