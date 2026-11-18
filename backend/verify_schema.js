require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('--- coding_practice_questions ---');
    const [columns] = await connection.query('DESCRIBE coding_practice_questions');
    columns.forEach(c => console.log(`${c.Field}: ${c.Type} | Default: ${c.Default} | Extra: ${c.Extra}`));
    
    console.log('\n--- Checking for is_deleted and updated_at ---');
    const hasDeleted = columns.some(c => c.Field === 'is_deleted');
    const hasUpdated = columns.some(c => c.Field === 'updated_at');
    console.log(`is_deleted exists: ${hasDeleted}`);
    console.log(`updated_at exists: ${hasUpdated}`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await connection.end();
  }
}

checkSchema();
