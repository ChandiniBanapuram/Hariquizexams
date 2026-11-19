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
      label            VARCHAR(100) NOT NULL,
      value            VARCHAR(100) NOT NULL UNIQUE,
      admin_username   VARCHAR(128) NULL,
      admin_password   VARCHAR(255) NULL,
      created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'sections',
    sql: `CREATE TABLE IF NOT EXISTS sections (
      id         INT          NOT NULL AUTO_INCREMENT,
      label      VARCHAR(100) NOT NULL,
      value      VARCHAR(100) NOT NULL UNIQUE,
      created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'years',
    sql: `CREATE TABLE IF NOT EXISTS years (
      id         INT          NOT NULL AUTO_INCREMENT,
      label      VARCHAR(100) NOT NULL,
      value      VARCHAR(100) NOT NULL UNIQUE,
      created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'semesters',
    sql: `CREATE TABLE IF NOT EXISTS semesters (
      id         INT          NOT NULL AUTO_INCREMENT,
      label      VARCHAR(100) NOT NULL,
      value      VARCHAR(100) NOT NULL UNIQUE,
      created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'subjects',
    sql: `CREATE TABLE IF NOT EXISTS subjects (
      id               INT          NOT NULL AUTO_INCREMENT,
      label            VARCHAR(255) NOT NULL,
      value            VARCHAR(255) NOT NULL,
      department_value VARCHAR(100) NOT NULL,
      year_value       VARCHAR(50)  NOT NULL,
      semester_value   VARCHAR(50)  NOT NULL,
      created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_subject (department_value, year_value, semester_value, value)
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
      time_limit           INT          NULL     DEFAULT 15,
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
  {
    name: 'coding_practice_questions',
    sql: `CREATE TABLE IF NOT EXISTS coding_practice_questions (
      id                  INT          NOT NULL AUTO_INCREMENT,
      title               VARCHAR(255) NOT NULL,
      description         LONGTEXT     NOT NULL,
      difficulty          VARCHAR(20)  NOT NULL DEFAULT 'Easy',
      topic               VARCHAR(100) NOT NULL,
      input_format        TEXT         NULL,
      output_format       TEXT         NULL,
      visible_test_cases  JSON         NULL,
      hidden_test_cases   JSON         NULL,
      is_deleted          TINYINT(1)   NOT NULL DEFAULT 0,
      created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_cpq_diff  (difficulty),
      INDEX idx_cpq_topic (topic)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
];

// Seed default departments
const DEFAULT_DEPARTMENTS = [
  { label: 'CSE (AI & ML)',      value: 'CSE(AI&ML)',      username: 'haricse',   password: 'haricse@1234'   },
  { label: 'CSE (Data Science)', value: 'CSE(DataScience)', username: 'harics',    password: 'harics@1234'    },
  { label: 'IT',                 value: 'IT',               username: 'hariit',    password: 'hariit@1234'    },
  { label: 'ECE',                value: 'ECE',              username: 'hariece',   password: 'hariece@1234'   },
  { label: 'EEE',                value: 'EEE',              username: 'harieee',   password: 'harieee@1234'   },
  { label: 'MECH',               value: 'MECH',             username: 'harimech',  password: 'harimech@1234'  },
  { label: 'CIVIL',              value: 'CIVIL',            username: 'haricivil', password: 'haricivil@1234' },
];

// Seed default sections
const DEFAULT_SECTIONS = [
  { label: 'Section A', value: 'A' },
  { label: 'Section B', value: 'B' },
  { label: 'Section C', value: 'C' },
];

// Seed default years
const DEFAULT_YEARS = [
  { label: '1st Year', value: '1' },
  { label: '2nd Year', value: '2' },
  { label: '3rd Year', value: '3' },
  { label: '4th Year', value: '4' },
];

// Seed default semesters
const DEFAULT_SEMESTERS = [
  { label: 'Semester 1', value: '1' },
  { label: 'Semester 2', value: '2' },
  { label: 'Semester 3', value: '3' },
  { label: 'Semester 4', value: '4' },
  { label: 'Semester 5', value: '5' },
  { label: 'Semester 6', value: '6' },
  { label: 'Semester 7', value: '7' },
  { label: 'Semester 8', value: '8' },
];

// ── Default Coding Practice Questions ────────────────────────────────────────
const DEFAULT_CODING_QUESTIONS = [
  // ════════════ EASY ════════════
  {
    title: 'Hello World',
    description: 'Write a program that prints "Hello, World!" to the output.',
    difficulty: 'Easy',
    topic: 'Basics',
    input_format: 'No input required.',
    output_format: 'Print exactly: Hello, World!',
    visible_test_cases: [
      { input: '', output: 'Hello, World!' }
    ],
    hidden_test_cases: [
      { input: '', output: 'Hello, World!' }
    ]
  },
  {
    title: 'Sum of Two Numbers',
    description: 'Given two integers A and B, print their sum.',
    difficulty: 'Easy',
    topic: 'Basics',
    input_format: 'Two space-separated integers A and B on a single line.',
    output_format: 'Print the sum of A and B.',
    visible_test_cases: [
      { input: '3 5', output: '8' },
      { input: '10 20', output: '30' }
    ],
    hidden_test_cases: [
      { input: '0 0', output: '0' },
      { input: '-5 5', output: '0' },
      { input: '1000000 999999', output: '1999999' }
    ]
  },
  {
    title: 'Even or Odd',
    description: 'Given an integer N, print "Even" if it is even, or "Odd" if it is odd.',
    difficulty: 'Easy',
    topic: 'Basics',
    input_format: 'A single integer N.',
    output_format: 'Print "Even" or "Odd" (without quotes).',
    visible_test_cases: [
      { input: '4', output: 'Even' },
      { input: '7', output: 'Odd' }
    ],
    hidden_test_cases: [
      { input: '0', output: 'Even' },
      { input: '-3', output: 'Odd' },
      { input: '1000', output: 'Even' }
    ]
  },
  {
    title: 'Factorial',
    description: 'Given a non-negative integer N, compute N! (N factorial).\n\nN! = 1 × 2 × 3 × … × N\n0! = 1',
    difficulty: 'Easy',
    topic: 'Loops',
    input_format: 'A single non-negative integer N (0 ≤ N ≤ 12).',
    output_format: 'Print N!',
    visible_test_cases: [
      { input: '5', output: '120' },
      { input: '0', output: '1' }
    ],
    hidden_test_cases: [
      { input: '1', output: '1' },
      { input: '10', output: '3628800' },
      { input: '12', output: '479001600' }
    ]
  },
  {
    title: 'Reverse a String',
    description: 'Given a string S, print it reversed.',
    difficulty: 'Easy',
    topic: 'Strings',
    input_format: 'A single string S (no spaces, length ≤ 100).',
    output_format: 'Print the reversed string.',
    visible_test_cases: [
      { input: 'hello', output: 'olleh' },
      { input: 'HARI', output: 'IRAH' }
    ],
    hidden_test_cases: [
      { input: 'a', output: 'a' },
      { input: 'racecar', output: 'racecar' },
      { input: 'abcdefg', output: 'gfedcba' }
    ]
  },
  {
    title: 'Count Vowels',
    description: 'Given a string, count the number of vowels (a, e, i, o, u — both upper and lower case).',
    difficulty: 'Easy',
    topic: 'Strings',
    input_format: 'A single string S.',
    output_format: 'Print the count of vowels.',
    visible_test_cases: [
      { input: 'Hello World', output: '3' },
      { input: 'AEIOU', output: '5' }
    ],
    hidden_test_cases: [
      { input: 'xyz', output: '0' },
      { input: 'Programming', output: '3' },
      { input: 'aEiOu', output: '5' }
    ]
  },
  {
    title: 'Find Maximum in Array',
    description: 'Given an array of N integers, find and print the maximum element.',
    difficulty: 'Easy',
    topic: 'Arrays',
    input_format: 'First line: integer N.\nSecond line: N space-separated integers.',
    output_format: 'Print the maximum element.',
    visible_test_cases: [
      { input: '5\n3 1 4 1 5', output: '5' },
      { input: '3\n10 20 15', output: '20' }
    ],
    hidden_test_cases: [
      { input: '1\n42', output: '42' },
      { input: '4\n-5 -1 -3 -2', output: '-1' },
      { input: '6\n100 200 150 300 250 50', output: '300' }
    ]
  },
  // ════════════ MEDIUM ════════════
  {
    title: 'Fibonacci Series',
    description: 'Print the first N terms of the Fibonacci sequence.\n\nFibonacci: 0, 1, 1, 2, 3, 5, 8, 13, …\nEach term is the sum of the two preceding ones.',
    difficulty: 'Medium',
    topic: 'Recursion',
    input_format: 'A single integer N (1 ≤ N ≤ 20).',
    output_format: 'Print N space-separated Fibonacci numbers.',
    visible_test_cases: [
      { input: '5', output: '0 1 1 2 3' },
      { input: '1', output: '0' }
    ],
    hidden_test_cases: [
      { input: '8', output: '0 1 1 2 3 5 8 13' },
      { input: '10', output: '0 1 1 2 3 5 8 13 21 34' },
      { input: '2', output: '0 1' }
    ]
  },
  {
    title: 'Check Prime Number',
    description: 'Given an integer N, determine whether it is a prime number.\n\nA prime number is greater than 1 and has no divisors other than 1 and itself.',
    difficulty: 'Medium',
    topic: 'Number Theory',
    input_format: 'A single integer N (1 ≤ N ≤ 10^6).',
    output_format: 'Print "Prime" if N is prime, otherwise print "Not Prime".',
    visible_test_cases: [
      { input: '7', output: 'Prime' },
      { input: '10', output: 'Not Prime' }
    ],
    hidden_test_cases: [
      { input: '1', output: 'Not Prime' },
      { input: '2', output: 'Prime' },
      { input: '999983', output: 'Prime' },
      { input: '1000000', output: 'Not Prime' }
    ]
  },
  {
    title: 'Palindrome Check',
    description: 'Given a string S, determine if it reads the same forwards and backwards (case-insensitive, ignoring non-alphanumeric characters).',
    difficulty: 'Medium',
    topic: 'Strings',
    input_format: 'A single string S.',
    output_format: 'Print "Yes" if palindrome, "No" otherwise.',
    visible_test_cases: [
      { input: 'racecar', output: 'Yes' },
      { input: 'hello', output: 'No' }
    ],
    hidden_test_cases: [
      { input: 'A man a plan a canal Panama', output: 'Yes' },
      { input: 'Was it a car or a cat I saw', output: 'Yes' },
      { input: 'OpenAI', output: 'No' }
    ]
  },
  {
    title: 'Two Sum',
    description: 'Given an array of N integers and a target value T, find two numbers that add up to T and print their indices (0-based). If no such pair exists, print -1.\n\nAssume exactly one valid pair exists.',
    difficulty: 'Medium',
    topic: 'Arrays',
    input_format: 'First line: N T\nSecond line: N space-separated integers.',
    output_format: 'Print two space-separated indices i j (i < j).',
    visible_test_cases: [
      { input: '4 9\n2 7 11 15', output: '0 1' },
      { input: '3 6\n3 2 4', output: '1 2' }
    ],
    hidden_test_cases: [
      { input: '2 6\n3 3', output: '0 1' },
      { input: '5 10\n1 2 3 4 6', output: '3 4' },
      { input: '4 100\n1 2 3 4', output: '-1' }
    ]
  },
  {
    title: 'Count Word Frequency',
    description: 'Given a sentence, count the frequency of each word (case-insensitive) and print each word with its count in alphabetical order.',
    difficulty: 'Medium',
    topic: 'Strings',
    input_format: 'A single line string (words separated by spaces).',
    output_format: 'Each line: word count (sorted alphabetically by word).',
    visible_test_cases: [
      { input: 'the cat sat on the mat', output: 'cat 1\nmat 1\non 1\nsat 1\nthe 2' },
      { input: 'hello hello world', output: 'hello 2\nworld 1' }
    ],
    hidden_test_cases: [
      { input: 'a b a b a', output: 'a 3\nb 2' },
      { input: 'one', output: 'one 1' }
    ]
  },
  {
    title: 'Binary Search',
    description: 'Given a sorted array of N integers and a target T, find the index of T using binary search. If T is not found, print -1.',
    difficulty: 'Medium',
    topic: 'Searching',
    input_format: 'First line: N T\nSecond line: N sorted integers.',
    output_format: 'Print the 0-based index of T, or -1 if not found.',
    visible_test_cases: [
      { input: '5 3\n1 2 3 4 5', output: '2' },
      { input: '5 6\n1 2 3 4 5', output: '-1' }
    ],
    hidden_test_cases: [
      { input: '1 1\n1', output: '0' },
      { input: '6 4\n1 2 3 4 5 6', output: '3' },
      { input: '4 10\n2 5 7 9', output: '-1' }
    ]
  },
  {
    title: 'Bubble Sort',
    description: 'Given an array of N integers, sort them in ascending order using the Bubble Sort algorithm and print the sorted array.',
    difficulty: 'Medium',
    topic: 'Sorting',
    input_format: 'First line: integer N.\nSecond line: N space-separated integers.',
    output_format: 'Print N sorted integers separated by spaces.',
    visible_test_cases: [
      { input: '5\n64 34 25 12 22', output: '12 22 25 34 64' },
      { input: '4\n5 1 4 2', output: '1 2 4 5' }
    ],
    hidden_test_cases: [
      { input: '1\n42', output: '42' },
      { input: '3\n3 2 1', output: '1 2 3' },
      { input: '5\n10 10 10 10 10', output: '10 10 10 10 10' }
    ]
  },
  {
    title: 'Stack using Array',
    description: 'Implement a stack using an array and process Q operations:\n- PUSH x : push x onto the stack\n- POP : pop the top element and print it (print -1 if empty)\n- TOP : print the top element without removing (print -1 if empty)\n- SIZE : print the current size of the stack',
    difficulty: 'Medium',
    topic: 'Stack',
    input_format: 'First line: Q (number of operations)\nNext Q lines: each operation.',
    output_format: 'For POP, TOP, SIZE operations print the result on a new line.',
    visible_test_cases: [
      { input: '5\nPUSH 1\nPUSH 2\nTOP\nPOP\nSIZE', output: '2\n2\n1' },
      { input: '3\nPOP\nSIZE\nPUSH 5', output: '-1\n0' }
    ],
    hidden_test_cases: [
      { input: '4\nPUSH 10\nPUSH 20\nPOP\nTOP', output: '20\n10' },
      { input: '2\nSIZE\nTOP', output: '0\n-1' }
    ]
  },
  // ════════════ HARD ════════════
  {
    title: 'Longest Common Subsequence',
    description: 'Given two strings A and B, find the length of their Longest Common Subsequence (LCS).\n\nA subsequence is a sequence that can be derived by deleting some characters without changing the order.',
    difficulty: 'Hard',
    topic: 'Dynamic Programming',
    input_format: 'Two lines, each containing a string (length ≤ 100).',
    output_format: 'Print the length of the LCS.',
    visible_test_cases: [
      { input: 'ABCBDAB\nBDCABA', output: '4' },
      { input: 'AGGTAB\nGXTXAYB', output: '4' }
    ],
    hidden_test_cases: [
      { input: 'abc\nabc', output: '3' },
      { input: 'abc\ndef', output: '0' },
      { input: 'ABCDE\nACE', output: '3' }
    ]
  },
  {
    title: '0/1 Knapsack Problem',
    description: 'Given N items each with a weight W[i] and value V[i], and a knapsack with capacity C, find the maximum value you can carry.\n\nEach item can be taken at most once.',
    difficulty: 'Hard',
    topic: 'Dynamic Programming',
    input_format: 'First line: N C\nSecond line: N weights\nThird line: N values.',
    output_format: 'Print the maximum value achievable.',
    visible_test_cases: [
      { input: '4 8\n2 3 4 5\n3 4 5 6', output: '10' },
      { input: '3 50\n10 20 30\n60 100 120', output: '220' }
    ],
    hidden_test_cases: [
      { input: '1 1\n2\n10', output: '0' },
      { input: '2 10\n5 5\n6 6', output: '12' },
      { input: '5 10\n2 3 4 5 6\n3 4 5 6 7', output: '13' }
    ]
  },
  {
    title: 'Number of Islands',
    description: 'Given a 2D grid of "1"s (land) and "0"s (water), count the number of islands.\n\nAn island is surrounded by water and formed by connecting adjacent lands horizontally or vertically.',
    difficulty: 'Hard',
    topic: 'Graphs',
    input_format: 'First line: R C (rows and columns)\nNext R lines: C characters each ("1" or "0", space-separated).',
    output_format: 'Print the number of islands.',
    visible_test_cases: [
      { input: '4 5\n1 1 1 1 0\n1 1 0 1 0\n1 1 0 0 0\n0 0 0 0 0', output: '1' },
      { input: '4 5\n1 1 0 0 0\n1 1 0 0 0\n0 0 1 0 0\n0 0 0 1 1', output: '3' }
    ],
    hidden_test_cases: [
      { input: '1 1\n1', output: '1' },
      { input: '1 1\n0', output: '0' },
      { input: '3 3\n1 0 1\n0 1 0\n1 0 1', output: '5' }
    ]
  },
  {
    title: 'Merge Sort',
    description: 'Implement the Merge Sort algorithm to sort an array of N integers in ascending order.',
    difficulty: 'Hard',
    topic: 'Sorting',
    input_format: 'First line: integer N.\nSecond line: N space-separated integers.',
    output_format: 'Print N sorted integers separated by spaces.',
    visible_test_cases: [
      { input: '6\n38 27 43 3 9 82', output: '3 9 27 38 43 82' },
      { input: '4\n5 2 4 1', output: '1 2 4 5' }
    ],
    hidden_test_cases: [
      { input: '1\n99', output: '99' },
      { input: '5\n5 4 3 2 1', output: '1 2 3 4 5' },
      { input: '5\n1 1 1 1 1', output: '1 1 1 1 1' }
    ]
  },
  {
    title: 'Dijkstra\'s Shortest Path',
    description: 'Given a weighted undirected graph with N nodes and E edges, find the shortest path from source node 1 to all other nodes.\n\nIf a node is unreachable, print -1 for it.',
    difficulty: 'Hard',
    topic: 'Graphs',
    input_format: 'First line: N E\nNext E lines: u v w (edge between u and v with weight w)\nLast line: source node S.',
    output_format: 'Print N-1 lines: "node distance" for nodes 2 to N.',
    visible_test_cases: [
      { input: '5 6\n1 2 2\n1 3 4\n2 3 1\n2 4 7\n3 5 3\n4 5 1\n1', output: '2 2\n3 3\n4 7\n5 6' },
      { input: '3 2\n1 2 5\n2 3 3\n1', output: '2 5\n3 8' }
    ],
    hidden_test_cases: [
      { input: '4 3\n1 2 1\n2 3 2\n3 4 3\n1', output: '2 1\n3 3\n4 6' },
      { input: '3 1\n1 2 10\n1', output: '2 10\n3 -1' }
    ]
  }
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

    // Step 4b: Add time_limit column to questions if missing
    try {
      const [tlCols] = await rootConn.query(`SHOW COLUMNS FROM questions LIKE 'time_limit'`);
      if (tlCols.length === 0) {
        await rootConn.query(`ALTER TABLE questions ADD COLUMN time_limit INT NULL DEFAULT 15`);
        console.log('   ✅ questions.time_limit column added');
      }
    } catch (err) {
      console.warn('   ⚠️  questions.time_limit migration skipped:', err.message);
    }

    // Step 4c: Migrate departments.name -> departments.label if needed
    try {
      const [cols] = await rootConn.query(`SHOW COLUMNS FROM departments LIKE 'name'`);
      if (cols.length > 0) {
        await rootConn.query(`ALTER TABLE departments CHANGE COLUMN name label VARCHAR(100) NOT NULL`);
        console.log('   ✅ departments.name renamed to departments.label');
      }
    } catch (err) {
      console.warn('   ⚠️  departments column migration skipped:', err.message);
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
          'INSERT IGNORE INTO departments (label, value, admin_username, admin_password) VALUES (?, ?, ?, ?)',
          [dept.label, dept.value, dept.username, dept.password]
        );
      }
      console.log('   ✅ Default departments seeded');
    }

    // Step 7: Seed default sections if empty
    const [secRows] = await rootConn.query('SELECT COUNT(*) AS c FROM sections');
    if (secRows[0].c === 0) {
      for (const s of DEFAULT_SECTIONS) {
        await rootConn.query('INSERT IGNORE INTO sections (label, value) VALUES (?, ?)', [s.label, s.value]);
      }
      console.log('   ✅ Default sections seeded');
    }

    // Step 8: Seed default years if empty
    const [yearRows] = await rootConn.query('SELECT COUNT(*) AS c FROM years');
    if (yearRows[0].c === 0) {
      for (const y of DEFAULT_YEARS) {
        await rootConn.query('INSERT IGNORE INTO years (label, value) VALUES (?, ?)', [y.label, y.value]);
      }
      console.log('   ✅ Default years seeded');
    }

    // Step 9: Seed default semesters if empty
    const [semRows] = await rootConn.query('SELECT COUNT(*) AS c FROM semesters');
    if (semRows[0].c === 0) {
      for (const sem of DEFAULT_SEMESTERS) {
        await rootConn.query('INSERT IGNORE INTO semesters (label, value) VALUES (?, ?)', [sem.label, sem.value]);
      }
      console.log('   ✅ Default semesters seeded');
    }

    // Step 10: Seed default coding practice questions if empty
    const [cpqRows] = await rootConn.query('SELECT COUNT(*) AS c FROM coding_practice_questions');
    if (cpqRows[0].c === 0) {
      for (const q of DEFAULT_CODING_QUESTIONS) {
        await rootConn.query(
          `INSERT INTO coding_practice_questions
            (title, description, difficulty, topic, input_format, output_format, visible_test_cases, hidden_test_cases)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            q.title, q.description, q.difficulty, q.topic,
            q.input_format, q.output_format,
            JSON.stringify(q.visible_test_cases),
            JSON.stringify(q.hidden_test_cases)
          ]
        );
      }
      console.log(`   ✅ ${DEFAULT_CODING_QUESTIONS.length} default coding practice questions seeded`);
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
