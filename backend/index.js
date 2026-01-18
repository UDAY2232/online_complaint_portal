// Express backend for complaint portal (MySQL)
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Database configuration - directly in code as requested
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false
  }
});

let dbConnected = false;
db.connect((err) => {
  if (err) {
    console.error('MySQL connection error:', err);
    dbConnected = false;
    // Keep server running; routes will return 503 when DB is not ready.
    return;
  }
  dbConnected = true;
  console.log('Connected to MySQL');
  // Ensure status_history table exists
  db.query(`
    CREATE TABLE IF NOT EXISTS status_history (
      id INT PRIMARY KEY AUTO_INCREMENT,
      complaint_id INT NOT NULL,
      old_status ENUM('new','under-review','resolved') NOT NULL,
      new_status ENUM('new','under-review','resolved') NOT NULL,
      changed_by VARCHAR(255),
      changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id)
    )
  `, (err) => {
    if (err) console.error('Failed ensuring status_history table:', err);
  });
});

// --- Complaint CRUD ---
// Return complaints with escalation info (if any)
app.get('/api/complaints', (req, res) => {
  const query = `
    SELECT c.*, e.id AS escalation_id, e.created_at AS escalated_at
    FROM complaints c
    LEFT JOIN escalation_history e ON c.id = e.complaint_id
    ORDER BY c.created_at DESC
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    // Normalize results: set escalation_status if escalated_at exists
    const normalized = results.map((row) => ({
      ...row,
      escalation_status: row.escalated_at ? 'escalated' : null,
      escalated_at: row.escalated_at || null,
    }));

    res.json(normalized);
  });
});

app.post('/api/complaints', (req, res) => {
  const { category, description, email, name, priority, is_anonymous } = req.body;

  if (!dbConnected) {
    console.error('Attempted to submit complaint but DB is not connected');
    return res.status(503).json({ error: 'Database unavailable. Try again later.' });
  }

  (async () => {
    try {
      // Begin transaction
      await db.promise().beginTransaction();

      const [insertResult] = await db.promise().query(
        'INSERT INTO complaints (category, description, email, name, priority, is_anonymous, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
        [category, description, email || null, name || null, priority || 'low', !!is_anonymous, 'new']
      );

      const complaintId = insertResult.insertId;

      let trackingId = null;
      if (is_anonymous) {
        trackingId = uuidv4();
        await db.promise().query(
          'INSERT INTO anonymous_submissions (complaint_id, tracking_id) VALUES (?, ?)',
          [complaintId, trackingId]
        );
      }

      await db.promise().commit();

      const resp = { id: complaintId, message: 'Complaint submitted successfully' };
      if (trackingId) resp.trackingId = trackingId;
      return res.status(201).json(resp);
    } catch (error) {
      try {
        await db.promise().rollback();
      } catch (rollbackErr) {
        console.error('Rollback error:', rollbackErr);
      }
      console.error('Error submitting complaint:', error);
      return res.status(500).json({ error: 'Failed to submit complaint', details: error.message });
    }
  })();
});

app.put('/api/complaints/:id', async (req, res) => {
  if (!dbConnected) return res.status(503).json({ error: 'Database unavailable' });
  const { status, changed_by } = req.body;
  const complaintId = req.params.id;

  try {
    // fetch current status
    const [rows] = await db.promise().query('SELECT status FROM complaints WHERE id = ?', [complaintId]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Complaint not found' });
    const oldStatus = rows[0].status;

    // update status
    await db.promise().query('UPDATE complaints SET status = ? WHERE id = ?', [status, complaintId]);

    // record history
    await db.promise().query(
      'INSERT INTO status_history (complaint_id, old_status, new_status, changed_by) VALUES (?, ?, ?, ?)',
      [complaintId, oldStatus, status, changed_by || 'admin']
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating complaint status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// --- Escalation History ---
app.get('/api/escalations', (req, res) => {
  db.query('SELECT * FROM escalation_history ORDER BY created_at DESC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// POST /api/complaints/check-escalations -> find overdue unresolved complaints and create escalation entries
app.post('/api/complaints/check-escalations', async (req, res) => {
  try {
    // Find complaints not resolved and older than 48 hours that are NOT already escalated
    const selectQ = `
      SELECT c.id, c.created_at
      FROM complaints c
      LEFT JOIN escalation_history e ON e.complaint_id = c.id
      WHERE c.status != 'resolved'
        AND TIMESTAMPDIFF(HOUR, c.created_at, NOW()) > 48
        AND e.id IS NULL
    `;
    const [rows] = await db.promise().query(selectQ);
    const complaintIds = rows.map(r => r.id);

    if (complaintIds.length === 0) {
      return res.json({ message: 'No new escalations', escalated: [] });
    }

    // Insert escalation entries
    const insertValues = complaintIds.map(id => [id]);
    await db.promise().query('INSERT INTO escalation_history (complaint_id) VALUES ?', [insertValues]);

    // Return details of escalated complaints
    const detailsQ = `SELECT c.*, e.created_at AS escalated_at FROM complaints c JOIN escalation_history e ON c.id = e.complaint_id WHERE e.complaint_id IN (${complaintIds.map(()=>'?').join(',')})`;
    const [escalatedRows] = await db.promise().query(detailsQ, complaintIds);

    res.json({ message: 'Escalations created', escalated: escalatedRows });
  } catch (error) {
    console.error('Error checking escalations:', error);
    res.status(500).json({ error: 'Failed to check escalations' });
  }
});

// Get status history for a complaint
app.get('/api/complaints/:id/history', async (req, res) => {
  const complaintId = req.params.id;
  try {
    const [rows] = await db.promise().query(
      'SELECT id, complaint_id, old_status, new_status, changed_by, changed_at FROM status_history WHERE complaint_id = ? ORDER BY changed_at ASC',
      [complaintId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching status history:', error);
    res.status(500).json({ error: 'Failed to fetch status history' });
  }
});

// --- User Roles (for demo, not secure) ---
app.get('/api/user-roles', (req, res) => {
  db.query('SELECT * FROM user_roles', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Create a user role
app.post('/api/user-roles', async (req, res) => {
  const { email, role } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    const [result] = await db.promise().query('INSERT INTO user_roles (email, role) VALUES (?, ?)', [email, role || 'user']);
    res.status(201).json({ id: result.insertId, email, role: role || 'user' });
  } catch (error) {
    console.error('Error creating user role:', error);
    res.status(500).json({ error: 'Failed to create user role' });
  }
});

// Update a user role
app.put('/api/user-roles/:id', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  try {
    await db.promise().query('UPDATE user_roles SET role = ? WHERE id = ?', [role, id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// --- Anonymous Complaint Tracking ---
app.get('/api/track/:trackingId', (req, res) => {
  const { trackingId } = req.params;
  
  db.query(
    `SELECT c.*, a.tracking_id 
     FROM complaints c 
     JOIN anonymous_submissions a ON c.id = a.complaint_id 
     WHERE a.tracking_id = ?`,
    [trackingId],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0) {
        return res.status(404).json({ error: 'Complaint not found' });
      }
      res.json(results[0]);
    }
  );
});

// Get all anonymous submissions for admin
app.get('/api/anonymous-submissions', (req, res) => {
  db.query(
    `SELECT c.*, a.tracking_id 
     FROM complaints c 
     JOIN anonymous_submissions a ON c.id = a.complaint_id 
     ORDER BY c.created_at DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

// --- Start server ---
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});