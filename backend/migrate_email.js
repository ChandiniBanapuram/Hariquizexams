require('dotenv').config();
const pool = require('./config/db');

async function migrate() {
  try {
    const [result] = await pool.query(`ALTER TABLE students ADD COLUMN email VARCHAR(255) UNIQUE AFTER full_name;`);
    console.log('✅ Added email column to students table');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('✅ Email column already exists');
    } else {
      console.error('❌ Migration failed:', err);
    }
  } finally {
    process.exit(0);
  }
}

migrate();
