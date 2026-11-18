/**
 * run_migration.js
 * Executes the coding_platform_schema.sql migration
 * against the configured Aiven MySQL database.
 *
 * Usage:  node run_migration.js
 */
require('dotenv').config({ path: __dirname + '/../.env' });
const mysql = require('mysql2/promise');
const path  = require('path');
const fs    = require('fs');

async function run() {
  console.log('🔌 Connecting to Aiven MySQL…');
  console.log('   Host:', process.env.DB_HOST);
  console.log('   Port:', process.env.DB_PORT);
  console.log('   DB  :', process.env.DB_NAME);

  const conn = await mysql.createConnection({
    host    : process.env.DB_HOST,
    port    : parseInt(process.env.DB_PORT || '3306', 10),
    user    : process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl     : { rejectUnauthorized: false },  // Aiven requires SSL
    multipleStatements: true,                 // allow batched SQL
  });

  console.log('✅ Connected!\n');

  // ── 1. CREATE   code_submissions ──────────────────────────────
  console.log('📦 Creating table  code_submissions …');
  await conn.execute(`
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
      PRIMARY KEY (id),
      INDEX idx_cs_student  (student_id),
      INDEX idx_cs_question (question_id),
      INDEX idx_cs_status   (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('   ✓ code_submissions table ready.');

  // ── 2. CREATE OR REPLACE   v_leaderboard ─────────────────────
  console.log('📦 Creating view   v_leaderboard …');
  await conn.execute(`
    CREATE OR REPLACE VIEW v_leaderboard AS
    SELECT
      s.id              AS student_id,
      s.name,
      s.roll_number,
      s.department,
      SUM(cs.score)     AS total_score,
      COUNT(*)          AS submissions,
      MIN(cs.exec_time) AS best_time,
      MIN(cs.memory_bytes) AS best_memory,
      MAX(cs.submitted_at) AS last_submitted
    FROM code_submissions cs
    JOIN students s ON s.id = cs.student_id
    WHERE cs.is_submit = 1
    GROUP BY cs.student_id
    ORDER BY total_score DESC, best_time ASC
  `);
  console.log('   ✓ v_leaderboard view ready.\n');

  // ── 3. Verify ─────────────────────────────────────────────────
  const [tables] = await conn.execute(`SHOW TABLES LIKE 'code_submissions'`);
  const [views]  = await conn.execute(`SHOW FULL TABLES WHERE Table_type = 'VIEW' AND Tables_in_${process.env.DB_NAME} = 'v_leaderboard'`);

  console.log('🔍 Verification:');
  console.log('   code_submissions :', tables.length > 0 ? '✅ EXISTS' : '❌ MISSING');
  console.log('   v_leaderboard    :', views.length  > 0 ? '✅ EXISTS' : '❌ MISSING');

  await conn.end();
  console.log('\n🚀 Migration complete! Coding platform database is ready.');
}

run().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
