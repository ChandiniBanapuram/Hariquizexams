require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// Auto-create database + all tables on first boot (works with TiDB & Aiven)
const { autoSetup } = require('./mysql/autoSetupDatabase');
autoSetup().catch(err => console.error('[autoSetup] error:', err.message));

const express = require('express');
const cors = require('cors');
const studentRoutes     = require('./routes/student');
const adminRoutes       = require('./routes/admin');
const itAdminRoutes     = require('./routes/itadmin');
const studentAuthRoutes = require('./routes/studentAuth');
const { router: codingRouter, runCodeHandler } = require('./routes/coding');
const datasetRoutes     = require('./routes/datasets');
const mlExecutionRoutes = require('./routes/mlExecution');
const healthRoutes      = require('./routes/health');
const log               = require('./services/logger');
require('./services/containerCleanup'); // auto-starts cleanup daemon on boot

// Idempotent DB migration: add question_type / options / accepted_answers columns
try { require('./mysql/migrate_question_types').migrate(); } catch (e) { console.error('[boot] question_types migration skipped:', e.message); }
try { require('./mysql/migrate_code_submissions').migrate(); } catch (e) { console.error('[boot] code_submissions migration skipped:', e.message); }
try { require('./mysql/migrate_responses_exam_date').migrate(); } catch (e) { console.error('[boot] responses_exam_date migration skipped:', e.message); }

const app = express();
const PORT = process.env.PORT || 5000;
const rateLimit = require('express-rate-limit');

// Rate limiting for high-traffic student endpoints
const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { error: 'Too many login attempts, please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const submissionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: { error: 'Submission rate limit exceeded. Please wait a moment.' },
});

// ML execution rate limit (IP-level; per-student is handled inside executionQueue)
const mlExecLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,  // 30 runs/min per IP
  message: { error: 'ML execution rate limit exceeded. Please wait before running again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
const ALLOWED_ORIGINS = [
  'https://csmcsdexam.vercel.app',
  'https://hariquizexams.vercel.app',
  'https://hariquizexams.vercel.app',
  'https://online-examination.sairohit4531.workers.dev',
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like server-to-server, curl, Postman)
    if (!origin) return callback(null, true);
    
    // Check if origin matches allowed domains / localhost / LAN / Lovable
    if (
      ALLOWED_ORIGINS.includes(origin) ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.includes('192.168.') ||
      origin.includes('172.') ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.onrender.com') ||
      origin.endsWith('.lovable.app') ||
      origin.endsWith('.hf.space') ||
      origin.endsWith('.workers.dev') ||
      origin.endsWith('.pages.dev')
    ) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: origin not allowed — ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200,
};

// Apply CORS to all routes
app.use(cors(corsOptions));

// Explicitly handle OPTIONS preflight requests for all endpoints
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Request logging
app.use((req, res, next) => {
  if (req.path.startsWith('/api/ml-exec')) {
    log.info(`${req.method} ${req.path}`, { ip: req.ip, studentId: req.body?.studentId });
  }
  next();
});

// 🔥 ROOT CHECK
app.get("/", (req, res) => {
  res.send("Online Examination Backend is running 🚀");
});

// 🔥 DEBUG ROUTE (IMPORTANT)
app.get('/api/test', (req, res) => {
  res.json({ message: "API is working ✅" });
});

// Routes
console.log("📦 Loading Routes...");

// Primary endpoint for code execution
app.post('/api/execute', runCodeHandler);

// Disable old /api/coding/run-code to force use of /api/execute
app.post('/api/coding/run-code', (req, res) => {
  res.status(410).json({ error: 'Deprecated endpoint, use /api/execute' });
});

app.use('/api/student-auth/login', loginLimiter);
app.use('/api/submit-exam', submissionLimiter);
app.use('/api/coding/run-code', submissionLimiter);
app.use('/api/execute', submissionLimiter);
app.use('/api/ml-exec/run', mlExecLimiter);

const path = require('path');
app.use('/api', studentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/it-admin', itAdminRoutes);
app.use('/api/student-auth', studentAuthRoutes);
app.use('/api/coding', codingRouter);
app.use('/api/datasets', datasetRoutes);
app.use('/api/ml-exec', mlExecutionRoutes);
app.use('/api/health', healthRoutes);

// Static artifact serving for AI graphs and generated metrics
app.use('/executions', express.static(path.join(__dirname, 'executions')));

// Simple liveness probe (doesn't conflict with /api/health/* router)
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Global error handler — always set CORS headers even on crashes
app.use((err, req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  log.error('Unhandled error', { path: req.path, error: err.message });
  res.status(500).json({ error: true, message: err.message || 'Internal Server Error' });
});

// Graceful shutdown: cleanup any lingering containers
process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});
process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // Database self-healing patch on startup
  try {
    const db = require('./config/db');
    console.log('🔄 Running database schema self-healing checks...');
    
    // 1. Ensure all 7 ML execution tables exist
    console.log('📦 Verifying / creating ML tables...');
    
    await db.query(`
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

    await db.query(`
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

    await db.query(`
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

    await db.query(`
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

    await db.query(`
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

    await db.query(`
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

    await db.query(`
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

    await db.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_key   VARCHAR(255) NOT NULL,
        setting_value LONGTEXT NULL,
        PRIMARY KEY (setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ Base tables verified / created successfully!');

    // 2. Check if 'score' column and other v2 columns exist in 'execution_results'
    const [cols] = await db.query('DESCRIBE execution_results').catch(() => [[]]);
    if (cols.length > 0) {
      const colNames = cols.map(c => c.Field);
      
      const missingPatches = [
        { name: 'score', query: 'ALTER TABLE execution_results ADD COLUMN score FLOAT NOT NULL DEFAULT 0' },
        { name: 'ai_suspected', query: 'ALTER TABLE execution_results ADD COLUMN ai_suspected TINYINT(1) NOT NULL DEFAULT 0' },
        { name: 'auto_grade_score', query: 'ALTER TABLE execution_results ADD COLUMN auto_grade_score FLOAT NULL' },
        { name: 'auto_grade_passed', query: 'ALTER TABLE execution_results ADD COLUMN auto_grade_passed TINYINT(1) NULL' },
        { name: 'auto_grade_detail', query: 'ALTER TABLE execution_results ADD COLUMN auto_grade_detail TEXT NULL' },
      ];

      for (const patch of missingPatches) {
        if (!colNames.includes(patch.name)) {
          console.log(`➕ Adding missing "${patch.name}" column to execution_results table...`);
          await db.query(patch.query);
          console.log(`✅ "${patch.name}" column added successfully!`);
        }
      }

      // 3. Ensure 'admin_username' and 'admin_password' exist in 'departments'
      const [deptCols] = await db.query('DESCRIBE departments').catch(() => [[]]);
      if (deptCols.length > 0) {
        const deptColNames = deptCols.map(c => c.Field);
        if (!deptColNames.includes('admin_username')) {
          console.log('➕ Adding missing "admin_username" column to departments table...');
          await db.query('ALTER TABLE departments ADD COLUMN admin_username VARCHAR(128) NULL');
        }
        if (!deptColNames.includes('admin_password')) {
          console.log('➕ Adding missing "admin_password" column to departments table...');
          await db.query('ALTER TABLE departments ADD COLUMN admin_password VARCHAR(255) NULL');
        }
        
        // Seed default logins for existing departments if empty
        await db.query(`
          UPDATE departments 
          SET admin_username = 'haricse', admin_password = 'haricse@1234' 
          WHERE value = 'CSE(AI&ML)' AND (admin_username IS NULL OR admin_username = '')
        `);
        await db.query(`
          UPDATE departments 
          SET admin_username = 'haridsa', admin_password = 'haridsa@1234' 
          WHERE value = 'CSE(DataScience)' AND (admin_username IS NULL OR admin_username = '')
        `);
      }

      // 4. Ensure students, responses, questions, and exam_configs table columns year and semester are VARCHAR(50)
      const tablesToModify = ['students', 'responses', 'questions', 'exam_configs'];
      for (const tableName of tablesToModify) {
        const [cols] = await db.query(`DESCRIBE ${tableName}`).catch(() => [[]]);
        if (cols.length > 0) {
          const yearCol = cols.find(c => c.Field === 'year');
          const semCol = cols.find(c => c.Field === 'semester');
          
          if (yearCol && (!yearCol.Type.toLowerCase().startsWith('varchar') || parseInt(yearCol.Type.replace(/\D/g, ''), 10) < 50)) {
            console.log(`➕ Altering column "year" in ${tableName} table to VARCHAR(50)...`);
            await db.query(`ALTER TABLE ${tableName} MODIFY COLUMN year VARCHAR(50) NOT NULL`);
          }
          if (semCol && (!semCol.Type.toLowerCase().startsWith('varchar') || parseInt(semCol.Type.replace(/\D/g, ''), 10) < 50)) {
            console.log(`➕ Altering column "semester" in ${tableName} table to VARCHAR(50)...`);
            await db.query(`ALTER TABLE ${tableName} MODIFY COLUMN semester VARCHAR(50) NOT NULL`);
          }
        }
      }

      console.log('✅ Database schema self-healing checks complete.');
    } else {
      console.log('⚠️ Could not fetch execution_results columns.');
    }
  } catch (err) {
    console.error('❌ Database self-healing patch failed:', err.message);
  }
});