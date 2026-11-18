require('dotenv').config({ path: 'backend/.env' });
const db = require('../config/db');

async function run() {
  try {
    console.log('Adding tab_switched column to code_submissions...');
    await db.query(`
      ALTER TABLE code_submissions 
      ADD COLUMN tab_switched BOOLEAN DEFAULT FALSE
    `);
    console.log('Successfully added tab_switched column.');
    process.exit(0);
  } catch (err) {
    console.error('Error adding column:', err.message);
    process.exit(1);
  }
}

run();
