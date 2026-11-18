// Idempotent migration: adds responses.exam_date so attempts can be scoped to a
// specific exam (e.g. last week's quiz vs this week's quiz) instead of per day.
const db = require('../config/db');

async function migrate() {
  try {
    const [tbl] = await db.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='responses' LIMIT 1`
    );
    if (tbl.length === 0) {
      console.log('[migrate_responses_exam_date] responses table not found — skipping.');
      return;
    }

    const [col] = await db.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema=DATABASE() AND table_name='responses' AND column_name='exam_date' LIMIT 1`
    );
    if (col.length === 0) {
      console.log('[migrate_responses_exam_date] Adding responses.exam_date');
      await db.query('ALTER TABLE responses ADD COLUMN exam_date DATE NULL');
    }

    const [idx] = await db.query(
      `SELECT 1 FROM information_schema.statistics
        WHERE table_schema=DATABASE() AND table_name='responses' AND index_name='idx_responses_attempt' LIMIT 1`
    );
    if (idx.length === 0) {
      try {
        await db.query(
          `CREATE INDEX idx_responses_attempt ON responses (roll_number, subject, exam_date)`
        );
      } catch (e) {
        console.error('[migrate_responses_exam_date] index skipped:', e.message);
      }
    }

    console.log('[migrate_responses_exam_date] OK');
  } catch (e) {
    console.error('[migrate_responses_exam_date] failed:', e.message);
  }
}

module.exports = { migrate };
