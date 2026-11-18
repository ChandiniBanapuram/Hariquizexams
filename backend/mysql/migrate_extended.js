/**
 * migrate_extended.js
 * Executes the updated schema changes for Submissions, Scoring, and Leaderboard.
 */
require('dotenv').config({ path: __dirname + '/../.env' });
const mysql = require('mysql2/promise');

async function run() {
  console.log('🔌 Connecting to Aiven MySQL…');
  const conn = await mysql.createConnection({
    host    : process.env.DB_HOST,
    port    : parseInt(process.env.DB_PORT || '3306', 10),
    user    : process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl     : { rejectUnauthorized: false },
    multipleStatements: true,
  });

  console.log('✅ Connected!\n');

  // 1. Create code_submissions if missing and add exam_id
  console.log('📦 Ensuring code_submissions table exists…');
  await conn.query(`
    CREATE TABLE IF NOT EXISTS code_submissions (
      id            INT          NOT NULL AUTO_INCREMENT,
      student_id    INT          NOT NULL,
      question_id   INT          NOT NULL,
      language      VARCHAR(20)  NOT NULL DEFAULT 'python',
      code          MEDIUMTEXT   NOT NULL,
      status        VARCHAR(50)  NOT NULL DEFAULT 'Pending',
      score         INT          NOT NULL DEFAULT 0,
      total_score   INT          NOT NULL DEFAULT 0,
      passed        INT          NOT NULL DEFAULT 0,
      total         INT          NOT NULL DEFAULT 0,
      exec_time     FLOAT        NULL,
      memory_bytes  INT          NULL,
      is_submit     TINYINT(1)   NOT NULL DEFAULT 0,
      submitted_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Add exam_id if missing
  const [columns] = await conn.query("SHOW COLUMNS FROM code_submissions LIKE 'exam_id'");
  if (columns.length === 0) {
      console.log('   Adding exam_id column…');
      await conn.query('ALTER TABLE code_submissions ADD COLUMN exam_id INT NULL AFTER question_id');
  }

  // Add indexes
  const [indexes] = await conn.query('SHOW INDEX FROM code_submissions');
  const indexNames = indexes.map(i => i.Key_name);

  if (!indexNames.includes('idx_cs_exam')) {
      console.log('   Creating idx_cs_exam…');
      await conn.query('CREATE INDEX idx_cs_exam ON code_submissions(exam_id)');
  }
  if (!indexNames.includes('idx_cs_composite')) {
      console.log('   Creating idx_cs_composite…');
      await conn.query('CREATE INDEX idx_cs_composite ON code_submissions(student_id, question_id, exam_id)');
  }

  console.log('   ✓ code_submissions updated.');

  // 2. Create v_leaderboard_best
  console.log('📦 Creating view v_leaderboard_best…');
  await conn.query(`
    CREATE OR REPLACE VIEW v_leaderboard_best AS
    WITH BestSubmissions AS (
        SELECT 
            student_id, 
            question_id, 
            exam_id,
            MAX(score) as max_score,
            MIN(exec_time) as min_time,
            MAX(submitted_at) as last_submit
        FROM code_submissions
        WHERE is_submit = 1
        GROUP BY student_id, question_id, exam_id
    )
    SELECT 
        s.id as student_id,
        s.full_name as name,
        s.roll_number,
        s.department,
        bs.exam_id,
        SUM(bs.max_score) as total_score,
        COUNT(DISTINCT bs.question_id) as problems_solved,
        SUM(bs.min_time) as total_time,
        MAX(bs.last_submit) as last_activity
    FROM students s
    JOIN BestSubmissions bs ON s.id = bs.student_id
    GROUP BY s.id, bs.exam_id
  `);
  console.log('   ✓ v_leaderboard_best ready.\n');

  await conn.end();
  console.log('🚀 Migration complete!');
}

run().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
