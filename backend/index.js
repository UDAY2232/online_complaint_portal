// Express backend for complaint portal (MySQL)
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Database configuration using ENV variables (Render + Railway)
const db = mysql.createConnection({
  host:switchyard.proxy.rlwy.net,
  user:root,
  password:qiFRKXUgYgOIXgcYzTNvvcubGzaZWciu,
  database:railway,
  port:53657,
  ssl: {
    rejectUnauthorized: false
  }
});

let dbConnected = false;

db.connect((err) => {
  if (err) {
    console.error('❌ MySQL connection error:', err);
    dbConnected = false;
    return;
  }
  dbConnected = true;
  console.log('✅ Connected to Railway MySQL');

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

// ✅ PORT – Render provides this automatically
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
