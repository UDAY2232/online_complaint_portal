require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const { v4: uuidv4 } = require("uuid");

const upload = require("./utils/multer");
const cloudinary = require("./utils/cloudinary");

const app = express();
app.use(cors()); // ❌ bodyParser.json() REMOVE

// ================= DATABASE =================
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
});

db.connect(() => console.log("✅ MySQL Connected"));

// ================= CREATE COMPLAINT =================
app.post(
  "/api/complaints",
  upload.single("image"), // 🔥 MUST match frontend
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
      console.error(err);
      res.status(500).json({ error: "Failed to submit complaint" });
    }
  }
);

// ================= SERVER =================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🚀 Backend running on port ${PORT}`)
);
