// Idempotent migration for code_submissions:
// Ensures required columns exist so /submissions INSERT never fails silently.
const db = require('../config/db');

async function ensureColumn(table, column, ddl) {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
    [table, column]
  );
  if (rows.length === 0) {
    console.log(`[migrate_code_submissions] Adding ${table}.${column}`);
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

async function ensureColumnType(table, column, expectedType, alterDDL) {
  const [rows] = await db.query(
    `SELECT DATA_TYPE FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
    [table, column]
  );
  if (rows.length > 0 && rows[0].DATA_TYPE.toLowerCase() !== expectedType.toLowerCase()) {
    console.log(`[migrate_code_submissions] Converting ${table}.${column} to ${expectedType}`);
    try { await db.query(`ALTER TABLE ${table} MODIFY COLUMN ${alterDDL}`); }
    catch (e) { console.error(`[migrate_code_submissions] MODIFY ${column} failed:`, e.message); }
  }
}

async function migrate() {
  try {
    // Check the table exists at all
    const [tbl] = await db.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='code_submissions' LIMIT 1`
    );
    if (tbl.length === 0) {
      console.log('[migrate_code_submissions] code_submissions table not found — skipping.');
      return;
    }

    // exam_id must be VARCHAR because we now use composite string keys
    await ensureColumnType('code_submissions', 'exam_id', 'varchar', 'exam_id VARCHAR(100) NULL');

    await ensureColumn('code_submissions', 'tab_switched', 'tab_switched TINYINT(1) NOT NULL DEFAULT 0');
    await ensureColumn('code_submissions', 'stdout',       'stdout MEDIUMTEXT NULL');
    await ensureColumn('code_submissions', 'stderr',       'stderr MEDIUMTEXT NULL');
    await ensureColumn('code_submissions', 'passed_test_cases', 'passed_test_cases INT NOT NULL DEFAULT 0');
    await ensureColumn('code_submissions', 'total_test_cases',  'total_test_cases INT NOT NULL DEFAULT 0');
    await ensureColumn('code_submissions', 'execution_time',    'execution_time FLOAT NOT NULL DEFAULT 0');
    await ensureColumn('code_submissions', 'memory',            'memory INT NOT NULL DEFAULT 0');
    await ensureColumn('code_submissions', 'created_at',        'created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');

    console.log('[migrate_code_submissions] OK');
  } catch (e) {
    console.error('[migrate_code_submissions] failed:', e.message);
  }
}

module.exports = { migrate };
