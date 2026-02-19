const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");

const upload = require("./utils/multer");
const cloudinary = require("./utils/cloudinary");

const db = require("./config/db");

const {
  authenticate,
  requireAdmin,
  requireSuperAdmin
} = require("./middleware/auth");

const initAuthRoutes = require("./routes/auth");

const {
  sendResolutionEmail,
  sendComplaintSubmissionEmail
} = require("./services/emailService");

const app = express();

app.use(cors());
app.use(express.json());


// ================= DATABASE CONNECT =================

(async () => {

  try {

    await db.query("SELECT 1");

    console.log("✅ PostgreSQL Connected");

  }
  catch (err) {

    console.error("DB ERROR:", err.message);

  }

})();


// ================= AUTH ROUTES =================

app.use("/api/auth", initAuthRoutes(db));


// ================= USER DASHBOARD =================

app.get("/api/user/dashboard", authenticate, async (req, res) => {

  try {

    const email = req.user.email;

    const total =
      await db.query("SELECT COUNT(*) FROM complaints WHERE email=$1", [email]);

    const pending =
      await db.query("SELECT COUNT(*) FROM complaints WHERE email=$1 AND status='new'", [email]);

    const review =
      await db.query("SELECT COUNT(*) FROM complaints WHERE email=$1 AND status='under-review'", [email]);

    const resolved =
      await db.query("SELECT COUNT(*) FROM complaints WHERE email=$1 AND status='resolved'", [email]);

    res.json({

      total: parseInt(total.rows[0].count),
      pending: parseInt(pending.rows[0].count),
      underReview: parseInt(review.rows[0].count),
      resolved: parseInt(resolved.rows[0].count)

    });

  }
  catch (err) {

    console.error(err);

    res.status(500).json({ error: err.message });

  }

});


// ================= USER CREATE COMPLAINT =================

app.post(
  "/api/user/complaints",
  authenticate,
  upload.single("image"),
  async (req, res) => {

    try {

      const { category, description, priority } = req.body;

      const userId = req.user.id;
      const email = req.user.email;
      const name = req.user.name;

      let imageUrl = null;

      if (req.file) {

        const uploadResult =
          await cloudinary.uploader.upload(

            `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
            { folder: "complaints" }

          );

        imageUrl = uploadResult.secure_url;

      }

      const result =
        await db.query(

          `INSERT INTO complaints
          (user_id, category, description, email, name, priority, is_anonymous, status, problem_image_url, created_at)
          VALUES ($1,$2,$3,$4,$5,$6,FALSE,'new',$7,NOW())
          RETURNING id`,

          [
            userId,
            category,
            description,
            email,
            name,
            priority || "low",
            imageUrl
          ]

        );

      const complaintId = result.rows[0].id;

      const complaint =
        await db.query("SELECT * FROM complaints WHERE id=$1", [complaintId]);

      await sendComplaintSubmissionEmail(complaint.rows[0]);

      res.json({

        success: true,
        id: complaintId

      });

    }
    catch (err) {

      console.error(err);

      res.status(500).json({

        error: err.message

      });

    }

  }
);


// ================= USER GET COMPLAINTS =================

app.get(
  "/api/user/complaints",
  authenticate,
  async (req, res) => {

    try {

      const result =
        await db.query(

          "SELECT * FROM complaints WHERE email=$1 ORDER BY created_at DESC",
          [req.user.email]

        );

      res.json(result.rows);

    }
    catch (err) {

      res.status(500).json({

        error: err.message

      });

    }

  }
);


// ================= ADMIN GET ALL COMPLAINTS =================

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

      res.status(500).json({

        error: err.message

      });

    }

  }
);


// ================= ADMIN UPDATE STATUS =================

app.put(
  "/api/admin/complaints/:id/status",
  authenticate,
  requireAdmin,
  async (req, res) => {

    try {

      const { id } = req.params;
      const { status } = req.body;

      await db.query(

        "UPDATE complaints SET status=$1 WHERE id=$2",
        [status, id]

      );

      res.json({ success: true });

    }
    catch (err) {

      res.status(500).json({

        error: err.message

      });

    }

  }
);


// ================= ADMIN RESOLVE =================

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

      const resolution = req.body.resolution_message;

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

        `UPDATE complaints
         SET status='resolved',
         resolution_message=$1,
         resolved_image_url=$2,
         resolved_at=NOW()
         WHERE id=$3`,

        [resolution, imageUrl, id]

      );

      await client.query("COMMIT");

      const complaint =
        await db.query("SELECT * FROM complaints WHERE id=$1", [id]);

      await sendResolutionEmail(complaint.rows[0]);

      res.json({

        success: true

      });

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

    res.json({

      status: "ok"

    });

  }
  catch {

    res.status(500).json({

      status: "fail"

    });

  }

});


// ================= SERVER =================

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {

  console.log("🚀 Server running on port", PORT);

});
