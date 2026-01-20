require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const nodemailer = require("nodemailer");

const upload = require("./utils/multer");
const cloudinary = require("./utils/cloudinary");

const app = express();
app.use(cors());
app.use(express.json());

// ================= EMAIL CONFIGURATION =================
console.log("📧 Email Config:", {
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  user: process.env.EMAIL_USER ? "✅ Set" : "❌ Not set",
  pass: process.env.EMAIL_PASS ? "✅ Set" : "❌ Not set",
});

let emailEnabled = false;

const transporter = nodemailer.createTransport({
  service: "gmail", // Use Gmail service instead of manual host/port
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS?.replace(/\s/g, ""), // Remove spaces from app password
  },
});

// Verify transporter connection
transporter.verify((error, success) => {
  if (error) {
    console.error("📧 ❌ Email transporter verification failed:", error.message);
    console.log("📧 ⚠️ Email notifications will be disabled");
    emailEnabled = false;
  } else {
    console.log("📧 ✅ Email transporter ready to send");
    emailEnabled = true;
  }
});

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
  } catch (err) {
    console.error(`📧 ❌ Failed to send email to ${complaint.email}:`, err.message);
    console.error("📧 Full error:", err);
  }
};

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

// ================= SERVER =================
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`🚀 Backend running on port ${PORT}`)
);
