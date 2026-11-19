
const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'backend/.env' });

async function check() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '4000', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
  });

  console.log('Connected to TiDB!');

  const [responses] = await connection.query('SELECT id, roll_number, name, department, section, year, semester, subject, score, total_marks, submitted_at FROM responses');
  console.log('--- RESPONSES ---');
  console.log(JSON.stringify(responses, null, 2));

  const [admins] = await connection.query('SELECT id, username, department FROM admins');
  console.log('--- ADMINS ---');
  console.log(JSON.stringify(admins, null, 2));

  const [depts] = await connection.query('SELECT * FROM departments');
  console.log('--- DEPARTMENTS ---');
  console.log(JSON.stringify(depts, null, 2));

  const [practiceQuestionsCount] = await connection.query('SELECT COUNT(*) as count FROM coding_practice_questions');
  console.log('--- CODING PRACTICE QUESTIONS COUNT ---');
  console.log(practiceQuestionsCount);

  await connection.end();
}

check().catch(console.error);
