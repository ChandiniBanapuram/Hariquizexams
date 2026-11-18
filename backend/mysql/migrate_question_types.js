// Idempotent migration: add columns for MCQ (variable options) & Fill-in-the-blank.
// Safe to run repeatedly; safe to call from server boot.
const db = require('../config/db');

async function columnExists(table, column) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS c FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  return rows[0].c > 0;
}

async function addIfMissing(table, column, definition) {
  if (await columnExists(table, column)) return;
  await db.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
  console.log(`[migrate] Added ${table}.${column}`);
}

async function migrate() {
  try {
    await addIfMissing('questions', 'question_type', "`question_type` VARCHAR(16) NOT NULL DEFAULT 'mcq'");
    await addIfMissing('questions', 'options', '`options` JSON NULL');
    await addIfMissing('questions', 'correct_answer_index', '`correct_answer_index` INT NULL');
    await addIfMissing('questions', 'accepted_answers', '`accepted_answers` JSON NULL');
    // Relax legacy NOT NULLs so fill-in-blank rows don't need dummy option values
    try { await db.query("ALTER TABLE questions MODIFY option_a TEXT NULL"); } catch (_) {}
    try { await db.query("ALTER TABLE questions MODIFY option_b TEXT NULL"); } catch (_) {}
    try { await db.query("ALTER TABLE questions MODIFY option_c TEXT NULL"); } catch (_) {}
    try { await db.query("ALTER TABLE questions MODIFY option_d TEXT NULL"); } catch (_) {}
    try { await db.query("ALTER TABLE questions MODIFY correct_option CHAR(1) NULL"); } catch (_) {}
    console.log('[migrate] question_types migration OK');
  } catch (err) {
    console.error('[migrate] question_types migration FAILED:', err.message);
  }
}

module.exports = { migrate };

if (require.main === module) {
  migrate().then(() => process.exit(0));
}
