const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");

const upload = require("./utils/multer");
const cloudinary = require("./utils/cloudinary");

const { runMigrations } = require("./utils/migrations");
const { startEscalationScheduler } = require("./services/scheduler");

const {
  initializeTransporter,
  sendResolutionEmail: sendResolutionEmailService,
  sendComplaintSubmissionEmail
} = require("./services/emailService");

const { authenticate, requireAdmin } = require("./middleware/auth");

const initAuthRoutes = require("./routes/auth");

const db = require("./config/db");

const app = express();

app.use(cors());
app.use(express.json());


// ================= DATABASE TEST =================

(async () => {
  try {

    await db.query("SELECT 1");

    console.log("✅ PostgreSQL Connected");

    await runMigrations(db);

    console.log("✅ Migrations complete");

    startEscalationScheduler(db);

  } catch (err) {

    console.error("DB ERROR:", err.message);

  }
})();


// ================= AUTH ROUTES =================

app.use("/api/auth", initAuthRoutes(db));


// ================= CREATE COMPLAINT =================

app.post("/api/complaints", upload.single("image"), async (req, res) => {

  try {

    const {
      category,
      description,
      email,
      name,
      priority,
      is_anonymous
    } = req.body;

    let imageUrl = null;

    if (req.file) {

      const uploadResult = await cloudinary.uploader.upload(

        `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,

        { folder: "complaints" }

      );

      imageUrl = uploadResult.secure_url;

    }

    // find user id

    let userId = null;

    if (email && is_anonymous !== "true") {

      const result = await db.query(

        "SELECT id FROM users WHERE LOWER(email)=LOWER($1)",

        [email]

      );

      if (result.rows.length > 0)

        userId = result.rows[0].id;

    }


    // insert complaint

    const insertResult = await db.query(

      `INSERT INTO complaints
      (user_id, category, description, email, name, priority, is_anonymous, status, problem_image_url, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'new',$8,NOW())
      RETURNING id`,

      [
        userId,
        category,
        description,
        email,
        name,
        priority || "low",
        is_anonymous === "true",
        imageUrl
      ]

    );

    const complaintId = insertResult.rows[0].id;


    // fetch complaint

    const complaintResult = await db.query(

      "SELECT * FROM complaints WHERE id=$1",

      [complaintId]

    );

    const complaint = complaintResult.rows[0];


    if (email && is_anonymous !== "true") {

      sendComplaintSubmissionEmail(complaint);

    }

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

});


// ================= GET ALL COMPLAINTS =================

app.get("/api/complaints", async (req, res) => {

  try {

    const result = await db.query(

      "SELECT * FROM complaints ORDER BY created_at DESC"

    );

    res.json(result.rows);

  }

  catch (err) {

    res.status(500).json({

      error: err.message

    });

  }

});


// ================= GET USER COMPLAINTS =================

app.get("/api/user/complaints", authenticate, async (req, res) => {

  try {

    const result = await db.query(

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

});


// ================= UPDATE STATUS =================

app.put("/api/admin/complaints/:id/status",

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


// ================= RESOLVE COMPLAINT =================

app.put("/api/admin/complaints/:id/resolve",

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

        const uploadResult = await cloudinary.uploader.upload(

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


      const result = await db.query(

        "SELECT * FROM complaints WHERE id=$1",

        [id]

      );

      const complaint = result.rows[0];


      await sendResolutionEmailService(complaint);


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


// ================= START SERVER =================

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {

  console.log("Server running on port", PORT);

});
