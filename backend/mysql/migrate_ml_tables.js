/**
 * migrate_ml_tables.js
 * Creates all ML execution tables needed by mlExecution.js routes.
 * Run: node mysql/migrate_ml_tables.js
 */
require('dotenv').config({ path: __dirname + '/../.env' });
const mysql = require('mysql2/promise');

async function run() {
  console.log('🔌 Connecting to Aiven MySQL…');
  console.log('   Host:', process.env.DB_HOST);
  console.log('   DB  :', process.env.DB_NAME);

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

  // ── 1. execution_results ─────────────────────────────────────────────────────
  console.log('📦 Creating execution_results …');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS execution_results (
      id                 INT           NOT NULL AUTO_INCREMENT,
      student_id         INT           NOT NULL,
      question_id        INT           NULL,
      exam_id            VARCHAR(100)  NULL,
      language           VARCHAR(50)   NOT NULL DEFAULT 'python',
      domain             VARCHAR(100)  NULL,
      code               MEDIUMTEXT    NULL,
      stdout             MEDIUMTEXT    NULL,
      stderr             MEDIUMTEXT    NULL,
      compile_error      MEDIUMTEXT    NULL,
      status             VARCHAR(50)   NOT NULL DEFAULT 'Pending',
      has_graphs         TINYINT(1)    NOT NULL DEFAULT 0,
      has_images         TINYINT(1)    NOT NULL DEFAULT 0,
      has_metrics        TINYINT(1)    NOT NULL DEFAULT 0,
      ai_suspected       TINYINT(1)    NOT NULL DEFAULT 0,
      auto_grade_score   FLOAT         NULL,
      auto_grade_passed  TINYINT(1)    NULL,
      auto_grade_detail  TEXT          NULL,
      score              FLOAT         NOT NULL DEFAULT 0,
      execution_time_ms  INT           NULL,
      created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_er_student   (student_id),
      INDEX idx_er_question  (question_id),
      INDEX idx_er_exam      (exam_id),
      INDEX idx_er_created   (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('   ✓ execution_results ready.');

  // ── 2. graph_outputs ─────────────────────────────────────────────────────────
  console.log('📦 Creating graph_outputs …');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS graph_outputs (
      id           INT           NOT NULL AUTO_INCREMENT,
      execution_id INT           NOT NULL,
      student_id   INT           NOT NULL,
      question_id  INT           NULL,
      exam_id      VARCHAR(100)  NULL,
      graph_title  VARCHAR(255)  NULL,
      graph_type   VARCHAR(50)   NULL DEFAULT 'matplotlib',
      file_path    VARCHAR(500)  NULL,
      base64_data  LONGTEXT      NULL,
      created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_go_exec (execution_id),
      INDEX idx_go_student (student_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('   ✓ graph_outputs ready.');

  // ── 3. image_outputs ─────────────────────────────────────────────────────────
  console.log('📦 Creating image_outputs …');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS image_outputs (
      id           INT           NOT NULL AUTO_INCREMENT,
      execution_id INT           NOT NULL,
      student_id   INT           NOT NULL,
      question_id  INT           NULL,
      exam_id      VARCHAR(100)  NULL,
      image_label  VARCHAR(255)  NULL,
      file_path    VARCHAR(500)  NULL,
      base64_data  LONGTEXT      NULL,
      mime_type    VARCHAR(50)   NULL DEFAULT 'image/png',
      created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_io_exec (execution_id),
      INDEX idx_io_student (student_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('   ✓ image_outputs ready.');

  // ── 4. student_metrics ───────────────────────────────────────────────────────
  console.log('📦 Creating student_metrics …');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS student_metrics (
      id            INT           NOT NULL AUTO_INCREMENT,
      execution_id  INT           NOT NULL,
      student_id    INT           NOT NULL,
      question_id   INT           NULL,
      exam_id       VARCHAR(100)  NULL,
      metric_name   VARCHAR(100)  NOT NULL,
      metric_value  DOUBLE        NOT NULL DEFAULT 0,
      metric_unit   VARCHAR(50)   NULL,
      domain        VARCHAR(100)  NULL,
      created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_sm_exec    (execution_id),
      INDEX idx_sm_student (student_id),
      INDEX idx_sm_domain  (domain)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('   ✓ student_metrics ready.');

  // ── 5. runtime_logs ──────────────────────────────────────────────────────────
  console.log('📦 Creating runtime_logs …');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS runtime_logs (
      id           INT           NOT NULL AUTO_INCREMENT,
      execution_id INT           NOT NULL,
      log_level    VARCHAR(20)   NOT NULL DEFAULT 'INFO',
      message      TEXT          NULL,
      created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_rl_exec (execution_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('   ✓ runtime_logs ready.');

  // ── 6. plagiarism_results ────────────────────────────────────────────────────
  console.log('📦 Creating plagiarism_results …');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS plagiarism_results (
      id             INT          NOT NULL AUTO_INCREMENT,
      exam_id        VARCHAR(100) NULL,
      question_id    INT          NULL,
      student_id_a   INT          NOT NULL,
      student_id_b   INT          NOT NULL,
      similarity_pct DOUBLE       NOT NULL DEFAULT 0,
      flagged        TINYINT(1)   NOT NULL DEFAULT 0,
      created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pair (exam_id, question_id, student_id_a, student_id_b),
      INDEX idx_pr_exam (exam_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('   ✓ plagiarism_results ready.');

  // ── 7. question_datasets ─────────────────────────────────────────────────────
  console.log('📦 Creating question_datasets …');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS question_datasets (
      id            INT           NOT NULL AUTO_INCREMENT,
      question_id   INT           NOT NULL,
      dataset_type  VARCHAR(50)   NOT NULL DEFAULT 'csv',
      dataset_name  VARCHAR(255)  NOT NULL,
      dataset_path  VARCHAR(500)  NOT NULL,
      dataset_size  BIGINT        NULL,
      uploaded_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_qd_question (question_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('   ✓ question_datasets ready.\n');

  // ── Verify ───────────────────────────────────────────────────────────────────
  const tables = ['execution_results', 'graph_outputs', 'image_outputs', 'student_metrics', 'runtime_logs', 'plagiarism_results', 'question_datasets'];
  console.log('🔍 Verification:');
  for (const t of tables) {
    const [rows] = await conn.execute(`SHOW TABLES LIKE '${t}'`);
    console.log(`   ${t}: ${rows.length > 0 ? '✅ EXISTS' : '❌ MISSING'}`);
  }

  await conn.end();
  console.log('\n🚀 ML tables migration complete!');
}

run().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
