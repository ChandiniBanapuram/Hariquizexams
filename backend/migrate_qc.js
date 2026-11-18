require('dotenv').config();
const db = require('./config/db');

async function migrate() {
  try {
    const [rows] = await db.query("SHOW COLUMNS FROM exam_configs LIKE 'question_count'");
    if (rows.length === 0) {
      console.log('Adding question_count column...');
      await db.query('ALTER TABLE exam_configs ADD COLUMN question_count INT DEFAULT NULL');
      console.log('Column added successfully.');
    } else {
      console.log('Column already exists.');
    }
  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    process.exit(0);
  }
}

migrate();
