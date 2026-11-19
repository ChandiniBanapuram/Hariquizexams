const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function seed() {
  console.log('--- Connecting to TiDB Cloud Database ---');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '4000', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
  });

  console.log('Connected to TiDB successfully!');

  const jsonPath = path.join(__dirname, '..', 'seeded_practice_questions.json');
  const questions = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Loaded ${questions.length} questions from JSON.`);

  // Clear existing questions to ensure clean state
  await connection.query('TRUNCATE TABLE coding_practice_questions');
  console.log('Cleared existing coding_practice_questions table.');

  // Insert in batches of 50
  const batchSize = 50;
  for (let i = 0; i < questions.length; i += batchSize) {
    const chunk = questions.slice(i, i + batchSize);
    const values = chunk.map(q => [
      q.title,
      q.description,
      q.difficulty || 'Easy',
      q.topic,
      q.input_format || 'Standard Input',
      q.output_format || 'Standard Output',
      JSON.stringify(q.visible_test_cases || []),
      JSON.stringify(q.hidden_test_cases || []),
      0
    ]);

    const sql = `
      INSERT INTO coding_practice_questions 
      (title, description, difficulty, topic, input_format, output_format, visible_test_cases, hidden_test_cases, is_deleted)
      VALUES ?
    `;

    await connection.query(sql, [values]);
    console.log(`Inserted batch ${i + 1} to ${Math.min(i + batchSize, questions.length)}`);
  }

  const [countResult] = await connection.query('SELECT COUNT(*) as total FROM coding_practice_questions WHERE is_deleted = 0');
  console.log(`\nVerification: Total coding practice questions in TiDB = ${countResult[0].total}`);

  const [distResult] = await connection.query(`
    SELECT topic, difficulty, COUNT(*) as count 
    FROM coding_practice_questions 
    WHERE is_deleted = 0 
    GROUP BY topic, difficulty 
    ORDER BY topic, difficulty
  `);
  console.log('\nBreakdown by Module & Difficulty:');
  console.table(distResult);

  await connection.end();
  console.log('--- Seeding completed successfully! ---');
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
