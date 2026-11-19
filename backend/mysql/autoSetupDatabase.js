/**
 * autoSetupDatabase.js
 * Automatically creates the database and ALL tables on first boot.
 * Works with TiDB Cloud Serverless and Aiven MySQL.
 * Called from server.js before anything else.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

const DB_TYPE     = process.env.DB_TYPE     || 'aiven';
const DB_HOST     = process.env.DB_HOST;
const DB_PORT     = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER     = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME     = process.env.DB_NAME     || 'exam_db';
const DB_SSL      = process.env.DB_SSL      === 'true';

// Aiven CA cert (only used when DB_TYPE=aiven)
const aivenCaCert = `-----BEGIN CERTIFICATE-----
MIIEUDCCArigAwIBAgIULCTRqlE9nm3ujxzv4u88Wl/catowDQYJKoZIhvcNAQEM
BQAwQDE+MDwGA1UEAww1NjgxMDRkY2EtZjhjMS00MTBkLTkyNTgtNmIwODkzNGFl
NzZiIEdFTiAxIFByb2plY3QgQ0EwHhcNMjUxMjI0MTc1NDUzWhcNMzUxMjIyMTc1
NDUzWjBAMT4wPAYDVQQDDDU2ODEwNGRjYS1mOGMxLTQxMGQtOTI1OC02YjA4OTM0
YWU3NmIgR0VOIDEgUHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCC
AYoCggGBALzN7nz/+LOXOOltvGPg/dAiHQYw7YF2o5xEPY50jLmsMv2RnL6F4kWZ
OHcXJ6/elYBQYaWks2Z+YjhlIuPS4psDjaJ0vu0ELBmv9q1Pa7daLXl8g2HDSOZe
aY4+T7M9brMRez3xKPvT+ZrVopcb9Ft0WmcoijtqXJmAzcrCFXjIKFMWUhIBPszi
VMccmohqJvbb2IJEZdPL1po58myLzmyxLWNAeY1/2kGHe0S2wrHvhXTBTx+/Rb3F
MOxuJ2W/dB3Wo7UK7sIivP6RcXc60bVb+X2wQIrraX+9zLGWJfCiDr3UYNkrCnpu
vyp8Hle5Nb7GRJ0ZNvbDsgJeq9eaZPhTxDgeHfyCf6XDU3eLxTAb0tpF24kJWOXl
qauhPbJ3ubEpJuchfo0cWbv2D9Q/5I3t8STaoF76si201NEi0HqwSsM344/XYVQ+
3cPY4L8tfdmx4Rla/AVFhR2lQue9L+VMivA6Ryr9qhhWmv8iIc8y7ugVWxS6Epxx
Y1EycTuwmQIDAQABo0IwQDAdBgNVHQ4EFgQU+gV6quUQgnaDDXGRijL9y9bMiwUw
EgYDVR0TAQH/BAgwBgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQAD
ggGBAHwKArtuZlF8BW4D3Kt3StpI634U6DajlLWxRBi+zS4ZkiEm6W4mVuOIQk8g
Utzy6GHCUGS3XQUFbZk0JzaWPOs0RwhpX5qFTm54TLbRO2jjg9+2fjmCSgrOTMrb
FD4lYubI8vAAdmvq7qrLQyFi4RQb3kfPl6gA097zvlpk1vgqIW+HKcBFRTchikxh
iE0pCCKtICA3cK+PF4jK1Xq+jQZTHaiyyzcuZcS9pVb/9r1KgvqMGu6R+wbByDhw
USf8ECCsQn1XYY6AmdXwpA7PKfxGgk0c15uJTzcnEqoLkeT8wsC1VqsfquI/2CZh
ghT1ciZm8feZSmhS0E913I92/ZF+6ivLbQwXuGdD9cbFrjjBhltb9cl+PWff2o4+
j8CPjQPTxyu7dPbYQnnRo8uI/wI6LSjS8aTvyUeB5+bx3IKm+GZYl1vEI0p3Ipgc
IImHx/5GxihNC/jH8E1juPsuyVAIKxLTbzB+Y6TJVheaplelIOSLvGI3HAcIwE5C
Dl5xmw==
-----END CERTIFICATE-----`;

const sslConfig = DB_SSL
  ? DB_TYPE === 'tidb'
    ? { rejectUnauthorized: true }
    : { ca: aivenCaCert, rejectUnauthorized: false }
  : undefined;

// All CREATE TABLE statements for the full schema
const TABLES = [
  {
    name: 'departments',
    sql: `CREATE TABLE IF NOT EXISTS departments (
      id               INT          NOT NULL AUTO_INCREMENT,
      name             VARCHAR(100) NOT NULL,
      value            VARCHAR(100) NOT NULL UNIQUE,
      admin_username   VARCHAR(128) NULL,
      admin_password   VARCHAR(255) NULL,
      created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'students',
    sql: `CREATE TABLE IF NOT EXISTS students (
      id             INT          NOT NULL AUTO_INCREMENT,
      roll_number    VARCHAR(50)  NOT NULL UNIQUE,
      email          VARCHAR(150) NULL,
      password       VARCHAR(255) NOT NULL,
      plain_password VARCHAR(255) NULL,
      full_name      VARCHAR(150) NOT NULL,
      name           VARCHAR(150) GENERATED ALWAYS AS (full_name) VIRTUAL,
      department     VARCHAR(100) NOT NULL,
      section        VARCHAR(50)  NOT NULL,
      year           VARCHAR(50)  NOT NULL,
      semester       VARCHAR(50)  NOT NULL,
      created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_st_roll   (roll_number),
      INDEX idx_st_dept   (department),
      INDEX idx_st_email  (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'questions',
    sql: `CREATE TABLE IF NOT EXISTS questions (
      id                   INT          NOT NULL AUTO_INCREMENT,
      department           VARCHAR(100) NOT NULL,
      section              VARCHAR(50)  NOT NULL,
      year                 VARCHAR(50)  NOT NULL,
      semester             VARCHAR(50)  NOT NULL,
      subject              VARCHAR(100) NOT NULL,
      question             TEXT         NOT NULL,
      option_a             TEXT         NULL,
      option_b             TEXT         NULL,
      option_c             TEXT         NULL,
      option_d             TEXT         NULL,
      correct_option       CHAR(1)      NULL,
      question_type        VARCHAR(16)  NOT NULL DEFAULT 'mcq',
      options              JSON         NULL,
      correct_answer_index INT          NULL,
      accepted_answers     JSON         NULL,
      image_url            VARCHAR(500) NULL,
      exam_date            DATE         NULL,
      created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_q_dept    (department),
      INDEX idx_q_subject (subject),
      INDEX idx_q_date    (exam_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'exam_configs',
    sql: `CREATE TABLE IF NOT EXISTS exam_configs (
      id                   INT          NOT NULL AUTO_INCREMENT,
      department           VARCHAR(100) NOT NULL,
      section              VARCHAR(50)  NOT NULL,
      year                 VARCHAR(50)  NOT NULL,
      semester             VARCHAR(50)  NOT NULL,
      subject              VARCHAR(100) NOT NULL,
      time_limit           INT          NOT NULL DEFAULT 30,
      is_active            TINYINT(1)   NOT NULL DEFAULT 0,
      shuffle_questions    TINYINT(1)   NOT NULL DEFAULT 0,
      show_previous_scores TINYINT(1)   NOT NULL DEFAULT 1,
      enable_copy_paste    TINYINT(1)   NOT NULL DEFAULT 0,
      auto_submit_tab_switch TINYINT(1) NOT NULL DEFAULT 0,
      question_count       INT          NULL,
      exam_date            DATE         NULL,
      created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_exam_config (department, section, year, semester, subject, exam_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'responses',
    sql: `CREATE TABLE IF NOT EXISTS responses (
      id           INT          NOT NULL AUTO_INCREMENT,
      roll_number  VARCHAR(50)  NOT NULL,
      name         VARCHAR(150) NOT NULL,
      department   VARCHAR(100) NOT NULL,
      section      VARCHAR(50)  NOT NULL,
      year         VARCHAR(50)  NOT NULL,
      semester     VARCHAR(50)  NOT NULL,
      subject      VARCHAR(100) NOT NULL,
      answers      JSON         NULL,
      score        INT          NOT NULL DEFAULT 0,
      total_marks  INT          NOT NULL DEFAULT 0,
      tab_switched TINYINT(1)   NOT NULL DEFAULT 0,
      exam_date    DATE         NULL,
      submitted_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_r_roll    (roll_number),
      INDEX idx_r_dept    (department),
      INDEX idx_r_subject (subject),
      INDEX idx_r_date    (exam_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'code_submissions',
    sql: `CREATE TABLE IF NOT EXISTS code_submissions (
      id           INT          NOT NULL AUTO_INCREMENT,
      student_id   INT          NOT NULL,
      question_id  INT          NOT NULL,
      exam_id      VARCHAR(100) NULL,
      language     VARCHAR(20)  NOT NULL DEFAULT 'python',
      code         MEDIUMTEXT   NOT NULL,
      status       VARCHAR(50)  NOT NULL DEFAULT 'Pending',
      score        INT          NOT NULL DEFAULT 0,
      total_score  INT          NOT NULL DEFAULT 0,
      passed       INT          NOT NULL DEFAULT 0,
      total        INT          NOT NULL DEFAULT 0,
      exec_time    FLOAT        NULL,
      memory_bytes INT          NULL,
      is_submit    TINYINT(1)   NOT NULL DEFAULT 0,
      tab_switched TINYINT(1)   NOT NULL DEFAULT 0,
      created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      submitted_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_cs_student  (student_id),
      INDEX idx_cs_question (question_id),
      INDEX idx_cs_exam     (exam_id),
      INDEX idx_cs_status   (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'execution_results',
    sql: `CREATE TABLE IF NOT EXISTS execution_results (
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
      INDEX idx_er_student  (student_id),
      INDEX idx_er_question (question_id),
      INDEX idx_er_exam     (exam_id),
      INDEX idx_er_created  (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'graph_outputs',
    sql: `CREATE TABLE IF NOT EXISTS graph_outputs (
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
      INDEX idx_go_exec    (execution_id),
      INDEX idx_go_student (student_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'image_outputs',
    sql: `CREATE TABLE IF NOT EXISTS image_outputs (
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
      INDEX idx_io_exec    (execution_id),
      INDEX idx_io_student (student_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'student_metrics',
    sql: `CREATE TABLE IF NOT EXISTS student_metrics (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'runtime_logs',
    sql: `CREATE TABLE IF NOT EXISTS runtime_logs (
      id           INT           NOT NULL AUTO_INCREMENT,
      execution_id INT           NOT NULL,
      log_level    VARCHAR(20)   NOT NULL DEFAULT 'INFO',
      message      TEXT          NULL,
      created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_rl_exec (execution_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'plagiarism_results',
    sql: `CREATE TABLE IF NOT EXISTS plagiarism_results (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'question_datasets',
    sql: `CREATE TABLE IF NOT EXISTS question_datasets (
      id            INT           NOT NULL AUTO_INCREMENT,
      question_id   INT           NOT NULL,
      dataset_type  VARCHAR(50)   NOT NULL DEFAULT 'csv',
      dataset_name  VARCHAR(255)  NOT NULL,
      dataset_path  VARCHAR(500)  NOT NULL,
      dataset_size  BIGINT        NULL,
      uploaded_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_qd_question (question_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'system_settings',
    sql: `CREATE TABLE IF NOT EXISTS system_settings (
      setting_key   VARCHAR(255) NOT NULL,
      setting_value LONGTEXT     NULL,
      PRIMARY KEY (setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
];

// Seed default departments
const DEFAULT_DEPARTMENTS = [
  { name: 'CSE (AI & ML)',     value: 'CSE(AI&ML)',      username: 'haricse',  password: 'haricse@1234'  },
  { name: 'CSE (Data Science)',value: 'CSE(DataScience)', username: 'harics',   password: 'harics@1234'   },
  { name: 'IT',                value: 'IT',               username: 'hariit',   password: 'hariit@1234'   },
  { name: 'ECE',               value: 'ECE',              username: 'hariece',  password: 'hariece@1234'  },
  { name: 'EEE',               value: 'EEE',              username: 'harieee',  password: 'harieee@1234'  },
  { name: 'MECH',              value: 'MECH',             username: 'harimech', password: 'harimech@1234' },
  { name: 'CIVIL',             value: 'CIVIL',            username: 'haricivil',password: 'haricivil@1234'},
];

async function autoSetup() {
  console.log('🔧 [AutoSetup] Starting database auto-setup...');
  console.log(`   DB_TYPE : ${DB_TYPE}`);
  console.log(`   DB_HOST : ${DB_HOST}`);
  console.log(`   DB_NAME : ${DB_NAME}`);

  let rootConn;
  try {
    // Step 1: Connect WITHOUT database to create it if missing
    rootConn = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      ssl: sslConfig,
    });

    // Step 2: Create the database
    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ [AutoSetup] Database '${DB_NAME}' ready`);

    // Step 3: Switch to it
    await rootConn.query(`USE \`${DB_NAME}\``);

    // Step 4: Create all tables
    for (const table of TABLES) {
      try {
        await rootConn.query(table.sql);
        console.log(`   ✅ Table '${table.name}' OK`);
      } catch (err) {
        console.warn(`   ⚠️  Table '${table.name}' skipped: ${err.message}`);
      }
    }

    // Step 5: Create leaderboard view (safe – skip on TiDB if unsupported)
    try {
      await rootConn.query(`
        CREATE OR REPLACE VIEW v_leaderboard AS
        SELECT
          s.id            AS student_id,
          s.name,
          s.roll_number,
          s.department,
          SUM(cs.score)   AS total_score,
          COUNT(*)        AS submissions,
          MIN(cs.exec_time)    AS best_time,
          MIN(cs.memory_bytes) AS best_memory,
          MAX(cs.submitted_at) AS last_submitted
        FROM code_submissions cs
        JOIN students s ON s.id = cs.student_id
        WHERE cs.is_submit = 1
        GROUP BY cs.student_id, s.id, s.name, s.roll_number, s.department
        ORDER BY total_score DESC, best_time ASC
      `);
      console.log('   ✅ View v_leaderboard OK');
    } catch (err) {
      console.warn('   ⚠️  v_leaderboard view skipped:', err.message);
    }

    // Step 6: Seed default departments if empty
    const [deptRows] = await rootConn.query('SELECT COUNT(*) AS c FROM departments');
    if (deptRows[0].c === 0) {
      for (const dept of DEFAULT_DEPARTMENTS) {
        await rootConn.query(
          'INSERT IGNORE INTO departments (name, value, admin_username, admin_password) VALUES (?, ?, ?, ?)',
          [dept.name, dept.value, dept.username, dept.password]
        );
      }
      console.log('   ✅ Default departments seeded');
    }

    console.log('🎉 [AutoSetup] Database fully ready!\n');
  } catch (err) {
    console.error('❌ [AutoSetup] FAILED:', err.message);
    console.error('   Check DB_HOST, DB_USER, DB_PASSWORD in your .env file');
  } finally {
    if (rootConn) await rootConn.end();
  }
}

module.exports = { autoSetup };

// Allow running directly: node autoSetupDatabase.js
if (require.main === module) {
  autoSetup().then(() => process.exit(0)).catch(() => process.exit(1));
}
