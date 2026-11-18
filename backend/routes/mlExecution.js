/**
 * backend/routes/mlExecution.js  (v2 – Production)
 *
 * ML/CVPR/RL code execution API.
 *
 * New in v2:
 *   ✓ Pre-execution security scan (blocks malicious imports)
 *   ✓ Execution queue (max 3 concurrent, 10/min per student)
 *   ✓ Auto-evaluation engine (accuracy, MSE, R², reward)
 *   ✓ Submission locking (prevent re-run after final submit)
 *   ✓ Per-domain execution timeout enforcement
 *   ✓ AI-generated code detection (soft flag)
 *   ✓ Plagiarism (token bigram + variable normalization)
 *   ✓ Structured logging via Winston logger
 *   ✓ Enhanced admin analytics with domain/section breakdown
 *   ✓ Student execution history with full output
 */
'use strict';

const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const db      = require('../config/db');
const log     = require('../services/logger');
const authMiddleware = require('../middleware/auth');

const SUPER_DEPTS = ['CSMCSD', 'CS', 'ALL', 'ADMIN', 'SUPERADMIN', 'IT', 'MASTER'];
const isSuperDept = (d) =>
  !!d && SUPER_DEPTS.includes(String(d).replace(/[\s()._-]/g, '').toUpperCase());

const { executeCode, tokenSimilarity, GRAPH_DIR, IMAGE_DIR } = require('../services/executionEngine');
const { scanCode }          = require('../services/securityScanner');
const { enqueue, getQueueStats } = require('../services/executionQueue');
const { autoEvaluate }      = require('../services/autoEvaluator');

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function logRuntime(execId, level, message) {
  try {
    await db.query(
      'INSERT INTO runtime_logs (execution_id, log_level, message) VALUES (?, ?, ?)',
      [execId, level, message]
    );
  } catch {}
}

async function saveMetrics(execId, studentId, questionId, examId, domain, metrics) {
  if (!metrics || Object.keys(metrics).length === 0) return;
  const rows = Object.entries(metrics).map(([name, value]) =>
    [execId, studentId, questionId || null, examId || null, name, value, null, domain || null]
  );
  if (rows.length > 0) {
    await db.query(
      `INSERT INTO student_metrics (execution_id, student_id, question_id, exam_id, metric_name, metric_value, metric_unit, domain) VALUES ?`,
      [rows]
    ).catch(() => {});
  }
}

async function saveGraphs(execId, studentId, questionId, examId, graphs) {
  for (const g of graphs) {
    let filePath = null;
    try {
      const buf  = Buffer.from(g.base64.split(',')[1] || '', 'base64');
      const name = `${Date.now()}_${g.filename || 'graph.png'}`;
      filePath   = path.join(GRAPH_DIR, name);
      fs.writeFileSync(filePath, buf);
    } catch {}
    await db.query(
      `INSERT INTO graph_outputs (execution_id, student_id, question_id, exam_id, graph_title, graph_type, file_path, base64_data) VALUES (?,?,?,?,?,?,?,?)`,
      [execId, studentId, questionId || null, examId || null, g.filename || null, 'matplotlib', filePath, g.base64]
    ).catch(() => {});
  }
}

async function saveImages(execId, studentId, questionId, examId, images) {
  for (const img of images) {
    let filePath = null;
    try {
      const buf  = Buffer.from(img.base64.split(',')[1] || '', 'base64');
      const name = `${Date.now()}_${img.filename || 'image.png'}`;
      filePath   = path.join(IMAGE_DIR, name);
      fs.writeFileSync(filePath, buf);
    } catch {}
    await db.query(
      `INSERT INTO image_outputs (execution_id, student_id, question_id, exam_id, image_label, file_path, base64_data, mime_type) VALUES (?,?,?,?,?,?,?,?)`,
      [execId, studentId, questionId || null, examId || null, img.filename || 'output', filePath, img.base64, img.mime || 'image/png']
    ).catch(() => {});
  }
}

// ─── POST /api/ml-exec/run ────────────────────────────────────────────────────

router.post('/run', async (req, res) => {
  try {
    const globalStart = Date.now();
    const {
      code,
      language    = 'python',
      domain,
      stdin       = '',
      studentId,
      questionId,
      examId,
      isSubmit    = false,
      datasetType,
    } = req.body;

    if (!code || !language) {
      return res.status(400).json({ error: 'code and language are required' });
    }

    // ── Security scan (pre-queue) ────────────────────────────────────────────
    const scan = scanCode(code, language, domain, { checkAI: true });
    if (!scan.safe) {
      log.security('Code rejected before queue', { studentId, language, domain, reason: scan.reason });
      return res.status(400).json({
        success:    false,
        status:     'SECURITY_BLOCKED',
        error:      scan.reason,
        blocked:    scan.blocked,
        stdout:     '',
        stderr:     scan.reason,
        graphs:     [],
        images:     [],
        metrics:    {},
        executionTimeMs: 0,
      });
    }

    if (scan.aiSuspected) {
      log.security('AI-generated code suspected', { studentId, questionId, examId });
    }

    // ── Submission locking (exam submits are final) ──────────────────────────
    if (isSubmit && studentId && questionId && examId && parseInt(studentId) !== 0) {
      try {
        const [existing] = await db.query(
          `SELECT id FROM execution_results WHERE student_id=? AND question_id=? AND exam_id=? AND status='Accepted' LIMIT 1`,
          [studentId, questionId, examId]
        );
        if (existing.length > 0) {
          return res.status(409).json({
            success: false,
            status:  'ALREADY_SUBMITTED',
            error:   'You have already submitted an accepted solution for this question.',
          });
        }
      } catch {}
    }

    // ── Find dataset paths ────────────────────────────────────────────────────
    let datasets = [];
    if (questionId) {
      try {
        // Fetch all datasets attached to this question
        const [dsRows] = await db.query(
          'SELECT dataset_type, dataset_name, dataset_path FROM question_datasets WHERE question_id=?',
          [questionId]
        );
        datasets = dsRows.map(row => {
          const subDir = { csv: 'csv', image: 'images', rl: 'rl', audio: 'audio' }[row.dataset_type] || 'csv';
          return {
            filename: row.dataset_name,
            localPath: path.join(__dirname, '..', 'datasets', subDir, row.dataset_path)
          };
        });
      } catch {}
    }

    // ── Enqueue execution ────────────────────────────────────────────────────
    log.info('Execution request queued', { studentId, language, domain, isSubmit });

    const queueResult = await enqueue({
      studentId,
      task: async () => executeCode({ code, language, domain, stdin, datasets, skipScan: true }),
    });

    // Queue error (rate limited / queue full / timeout)
    if (queueResult?.error) {
      return res.status(429).json({
        success: false,
        status:  queueResult.status,
        error:   queueResult.message,
        stdout:  '',
        stderr:  queueResult.message,
        graphs:  [],
        images:  [],
        metrics: {},
        executionTimeMs: 0,
      });
    }

    const execResult = queueResult;
    const { stdout = '', stderr = '', compileError = '', timedOut = false } = execResult;
    const graphs  = Array.isArray(execResult.graphs) ? execResult.graphs : [];
    const images  = Array.isArray(execResult.images) ? execResult.images : [];
    const metrics = execResult.metrics || {};

    // ── Auto-evaluation (ML domains only) ────────────────────────────────────
    let autoGrade = null;
    let evalRules = null;
    if (domain && questionId) {
      try {
        const [qRows] = await db.query('SELECT question FROM questions WHERE id=? LIMIT 1', [questionId]);
        if (qRows.length > 0) {
          const qParsed = JSON.parse(qRows[0].question || '{}');
          evalRules = qParsed.evaluationRules || null;
        }
      } catch {}
      try {
        const ae = autoEvaluate({ stdout, domain, rules: evalRules, graphs: graphs.length, images: images.length });
        autoGrade = ae.autoGrade;
      } catch (e) {
        log.warn('Auto-evaluation failed', { error: e.message });
      }
    }

    // ── Determine status ─────────────────────────────────────────────────────
    const hasError = !!(stderr || compileError);
    const status   = timedOut        ? 'TIMEOUT'
                   : execResult.status === 'SECURITY_BLOCKED' ? 'SECURITY_BLOCKED'
                   : hasError        ? 'Failed'
                   : 'Accepted';

    const elapsedMs   = Date.now() - globalStart;
    const hasGraphs   = graphs.length  > 0;
    const hasImages   = images.length  > 0;
    const hasMetrics  = Object.keys(metrics).length > 0;

    // ── Persist to DB ────────────────────────────────────────────────────────
    let execId = null;
    if (studentId) {
      try {
        const [ins] = await db.query(
          `INSERT INTO execution_results
            (student_id, question_id, exam_id, language, domain, code, stdout, stderr, compile_error,
             status, has_graphs, has_images, has_metrics, execution_time_ms)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            studentId, questionId || null, examId || null,
            language, domain || null,
            code.substring(0, 65535),
            stdout.substring(0, 65535),
            stderr.substring(0, 65535),
            compileError.substring(0, 65535),
            status,
            hasGraphs  ? 1 : 0,
            hasImages  ? 1 : 0,
            hasMetrics ? 1 : 0,
            elapsedMs,
          ]
        );
        execId = ins.insertId;

        await Promise.allSettled([
          saveMetrics(execId, studentId, questionId, examId, domain, metrics),
          saveGraphs (execId, studentId, questionId, examId, graphs),
          saveImages (execId, studentId, questionId, examId, images),
          logRuntime (execId, timedOut ? 'WARN' : hasError ? 'ERROR' : 'INFO',
            `lang=${language} domain=${domain} status=${status} time=${elapsedMs}ms ai_suspected=${scan.aiSuspected}`
          ),
        ]);
      } catch (dbErr) {
        log.error('DB save failed for execution', { error: dbErr.message });
      }
    }

    return res.json({
      success:         true,
      stdout,
      stderr,
      compileError,
      status,
      timedOut,
      aiSuspected:     scan.aiSuspected,
      graphs:          graphs.map(g => ({ filename: g.filename, url: g.url, base64: g.base64, mime: g.mime })),
      images:          images.map(i => ({ filename: i.filename, url: i.url, base64: i.base64, mime: i.mime })),
      metrics,
      autoGrade,
      executionTimeMs: elapsedMs,
      executionId:     execId,
      hasGraphs,
      hasImages,
      hasMetrics,
    });
  } catch (err) {
    log.error('Unhandled execution route error', { error: err.message });
    return res.status(500).json({
      error: true,
      message: err.message || 'Internal server error during execution'
    });
  }
});

// ─── GET /api/ml-exec/history/:studentId ─────────────────────────────────────

router.get('/history/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { limit = 20, examId, questionId } = req.query;

    let sql = `SELECT id, question_id, exam_id, language, domain, status,
                      has_graphs, has_images, has_metrics, execution_time_ms, created_at
               FROM execution_results WHERE student_id=?`;
    const params = [studentId];

    if (examId)     { sql += ' AND exam_id=?';     params.push(examId); }
    if (questionId) { sql += ' AND question_id=?';  params.push(questionId); }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const [rows] = await db.query(sql, params);
    res.json({ history: rows });
  } catch (err) {
    log.error('Fetch history failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/ml-exec/history/:studentId/:execId ─────────────────────────────

router.get('/history/:studentId/:execId', async (req, res) => {
  try {
    const { studentId, execId } = req.params;
    const [rows] = await db.query(
      'SELECT * FROM execution_results WHERE id=? AND student_id=? LIMIT 1',
      [execId, studentId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });

    const [graphs]  = await db.query('SELECT id, graph_title, base64_data FROM graph_outputs WHERE execution_id=? ORDER BY id', [execId]);
    const [images]  = await db.query('SELECT id, image_label, base64_data, mime_type FROM image_outputs WHERE execution_id=? ORDER BY id', [execId]);
    const [metrics] = await db.query('SELECT metric_name, metric_value, metric_unit FROM student_metrics WHERE execution_id=? ORDER BY id', [execId]);
    const [logs]    = await db.query('SELECT log_level, message, created_at FROM runtime_logs WHERE execution_id=? ORDER BY id LIMIT 50', [execId]);

    res.json({ execution: rows[0], graphs, images, metrics, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/ml-exec/graphs/:execId ─────────────────────────────────────────

router.get('/graphs/:execId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, graph_title, graph_type, base64_data, created_at FROM graph_outputs WHERE execution_id=? ORDER BY id',
      [req.params.execId]
    );
    res.json({ graphs: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/ml-exec/admin/execution ────────────────────────────────────────
// Fetch latest ML execution result for a student+question, used by admin modal

router.get('/admin/execution', authMiddleware, async (req, res) => {
  try {
    const { studentId, questionId, examId } = req.query;
    if (!studentId || !questionId) {
      return res.status(400).json({ error: 'studentId and questionId are required' });
    }

    let sql = `
      SELECT er.*, s.department FROM execution_results er
      JOIN students s ON s.id = er.student_id
      WHERE er.student_id=? AND er.question_id=?
    `;
    const params = [studentId, questionId];
    if (examId) { sql += ' AND er.exam_id=?'; params.push(examId); }
    sql += ' ORDER BY er.created_at DESC LIMIT 1';

    const [rows] = await db.query(sql, params);
    if (!rows.length) return res.json({ execution: null, graphs: [], images: [], metrics: [] });

    // Block dept-scoped admins from reading other depts' execution results
    if (req.admin && req.admin.department && !isSuperDept(req.admin.department)) {
      const a = req.admin.department.replace(/[\s()]/g, '').toUpperCase();
      const b = (rows[0].department || '').replace(/[\s()]/g, '').toUpperCase();
      if (a !== b) return res.status(403).json({ error: 'Forbidden: You do not have access to execution results from other departments' });
    }

    const execId = rows[0].id;
    const [graphs]  = await db.query('SELECT id, graph_title, base64_data FROM graph_outputs WHERE execution_id=? ORDER BY id', [execId]);
    const [images]  = await db.query('SELECT id, image_label, base64_data, mime_type FROM image_outputs WHERE execution_id=? ORDER BY id', [execId]);
    const [metrics] = await db.query('SELECT metric_name, metric_value, metric_unit FROM student_metrics WHERE execution_id=? ORDER BY id', [execId]);

    res.json({ execution: rows[0], graphs, images, metrics });
  } catch (err) {
    log.error('Admin execution fetch failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/ml-exec/metrics/:studentId ─────────────────────────────────────

router.get('/metrics/:studentId', async (req, res) => {
  try {
    const { examId, domain, limit = 100 } = req.query;
    let sql = 'SELECT * FROM student_metrics WHERE student_id=?';
    const params = [req.params.studentId];
    if (examId)  { sql += ' AND exam_id=?';  params.push(examId); }
    if (domain)  { sql += ' AND domain=?';   params.push(domain); }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit, 10));
    const [rows] = await db.query(sql, params);
    res.json({ metrics: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/ml-exec/datasets/:questionId ───────────────────────────────────

router.get('/datasets/:questionId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, dataset_type, dataset_name, dataset_size, uploaded_at FROM question_datasets WHERE question_id=? ORDER BY uploaded_at DESC',
      [req.params.questionId]
    );
    res.json({ datasets: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/ml-exec/plagiarism/check ──────────────────────────────────────

router.post('/plagiarism/check', authMiddleware, async (req, res) => {
  try {
    const { examId, questionId, threshold = 70 } = req.body;
    let department = null;
    const adminDept = req.admin && req.admin.department;
    if (adminDept && !isSuperDept(adminDept)) {
      department = adminDept;
    }

    let sql = `SELECT cs.id, cs.student_id, cs.code, s.full_name, s.roll_number
               FROM code_submissions cs
               JOIN students s ON s.id = cs.student_id
               WHERE cs.code IS NOT NULL AND LENGTH(cs.code) > 50`;
    const params = [];
    if (examId)     { sql += ' AND cs.exam_id=?';     params.push(examId); }
    if (questionId) { sql += ' AND cs.question_id=?'; params.push(questionId); }
    if (department) {
      sql += ` AND LOWER(REPLACE(REPLACE(REPLACE(s.department, ' ', ''), '(', ''), ')', '')) = ?`;
      params.push(department.replace(/[\s()]/g, '').toLowerCase());
    }

    const [submissions] = await db.query(sql, params);
    if (submissions.length < 2) {
      return res.json({ pairs: [], message: 'Not enough submissions to compare' });
    }

    const pairs = [];
    for (let i = 0; i < submissions.length; i++) {
      for (let j = i + 1; j < submissions.length; j++) {
        const simPct = tokenSimilarity(submissions[i].code, submissions[j].code);
        if (simPct >= threshold) {
          pairs.push({
            studentA:    { id: submissions[i].student_id, name: submissions[i].full_name, roll: submissions[i].roll_number },
            studentB:    { id: submissions[j].student_id, name: submissions[j].full_name, roll: submissions[j].roll_number },
            similarity:  simPct,
            flagged:     simPct >= 85,
          });
          await db.query(
            `INSERT INTO plagiarism_results (exam_id, question_id, student_id_a, student_id_b, similarity_pct, flagged)
             VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE similarity_pct=VALUES(similarity_pct), flagged=VALUES(flagged)`,
            [examId || null, questionId || null, submissions[i].student_id, submissions[j].student_id, simPct, simPct >= 85 ? 1 : 0]
          ).catch(() => {});
        }
      }
    }

    pairs.sort((a, b) => b.similarity - a.similarity);
    log.info('Plagiarism check complete', { examId, questionId, pairs: pairs.length, threshold });
    res.json({ pairs, total: pairs.length, threshold });
  } catch (err) {
    log.error('Plagiarism check failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/ml-exec/admin/analytics ────────────────────────────────────────

router.get('/admin/analytics', authMiddleware, async (req, res) => {
  try {
    let { examId, domain, date, section, department } = req.query;

    const adminDept = req.admin && req.admin.department;
    if (adminDept && !isSuperDept(adminDept)) {
      department = adminDept;
    }

    let where = 'WHERE 1=1';
    const p = [];
    if (examId)  { where += ' AND er.exam_id=?';            p.push(examId); }
    if (domain)  { where += ' AND er.domain=?';             p.push(domain); }
    if (date)    { where += ' AND DATE(er.created_at)=?';   p.push(date); }
    if (department) {
      where += ` AND LOWER(REPLACE(REPLACE(REPLACE(s.department, ' ', ''), '(', ''), ')', '')) = ?`;
      p.push(department.replace(/[\s()]/g, '').toLowerCase());
    }

    // Summary
    const [[summary]] = await db.query(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN er.status='Accepted' THEN 1 ELSE 0 END) as accepted,
              SUM(CASE WHEN er.status='TIMEOUT' THEN 1 ELSE 0 END) as timedOut,
              SUM(CASE WHEN er.status='SECURITY_BLOCKED' THEN 1 ELSE 0 END) as blocked,
              AVG(er.execution_time_ms) as avgTime,
              SUM(er.has_graphs) as withGraphs,
              SUM(er.has_images) as withImages,
              SUM(er.has_metrics) as withMetrics
       FROM execution_results er
       JOIN students s ON s.id = er.student_id
       ${where}`,
      p
    );

    // Domain distribution
    const [domains] = await db.query(
      `SELECT er.domain, COUNT(*) as count 
       FROM execution_results er
       JOIN students s ON s.id = er.student_id
       ${where} 
       GROUP BY er.domain ORDER BY count DESC`,
      p
    );

    // Accuracy trend (last 30 days)
    const [accuracyTrend] = await db.query(
      `SELECT DATE(sm.created_at) as day, AVG(sm.metric_value) as avg_value, COUNT(*) as runs
       FROM student_metrics sm
       JOIN execution_results er ON er.id=sm.execution_id
       JOIN students s ON s.id = er.student_id
       ${where} AND sm.metric_name='accuracy'
       GROUP BY day ORDER BY day ASC LIMIT 30`,
      p
    );

    // Recent compile errors
    const [recentErrors] = await db.query(
      `SELECT er.student_id, er.language, er.domain, LEFT(er.stderr, 200) as stderr_preview, er.created_at
       FROM execution_results er
       JOIN students s ON s.id = er.student_id
       ${where} AND er.status='Failed'
       ORDER BY er.created_at DESC LIMIT 10`,
      p
    );

    // Plagiarism flags
    let plagiarismSql = 'SELECT COUNT(DISTINCT pr.id) as flagged FROM plagiarism_results pr JOIN students s ON s.id = pr.student_id_a WHERE pr.flagged=1';
    const plagiarismParams = [];
    if (examId) {
      plagiarismSql += ' AND pr.exam_id=?';
      plagiarismParams.push(examId);
    }
    if (department) {
      plagiarismSql += ` AND LOWER(REPLACE(REPLACE(REPLACE(s.department, ' ', ''), '(', ''), ')', '')) = ?`;
      plagiarismParams.push(department.replace(/[\s()]/g, '').toLowerCase());
    }
    const [plagiarism] = await db.query(plagiarismSql, plagiarismParams);

    // Queue stats
    const queue = getQueueStats();

    res.json({
      summary: {
        totalRuns:   summary.total   || 0,
        accepted:    summary.accepted || 0,
        timedOut:    summary.timedOut || 0,
        blocked:     summary.blocked  || 0,
        successRate: summary.total > 0 ? ((summary.accepted / summary.total) * 100).toFixed(1) : '0',
        avgTimeMs:   Math.round(summary.avgTime || 0),
        withGraphs:  summary.withGraphs  || 0,
        withImages:  summary.withImages  || 0,
        withMetrics: summary.withMetrics || 0,
        flaggedPlagiarism: plagiarism[0]?.flagged || 0,
      },
      domains,
      accuracyTrend,
      recentErrors,
      queue,
    });
  } catch (err) {
    log.error('Admin analytics failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/ml-exec/queue/stats ────────────────────────────────────────────

router.get('/queue/stats', (req, res) => {
  res.json(getQueueStats());
});

// ─── GET /api/ml-exec/submission/status/:studentId/:questionId ───────────────

router.get('/submission/status/:studentId/:questionId', async (req, res) => {
  try {
    const { studentId, questionId } = req.params;
    const { examId } = req.query;

    if (parseInt(studentId) === 0) {
      return res.json({
        submitted:    false,
        locked:       false,
        lastStatus:   null,
        lastScore:    0,
        executionId:  null,
        submittedAt:  null,
      });
    }

    const params = [studentId, questionId];
    let sql = `SELECT id, status, score, execution_time as execution_time_ms, created_at
               FROM code_submissions
               WHERE student_id=? AND question_id=?`;
    if (examId) { sql += ' AND exam_id=?'; params.push(examId); }
    sql += ' ORDER BY created_at DESC LIMIT 1';

    const [rows] = await db.query(sql, params);
    const latest = rows[0] || null;

    res.json({
      submitted:    !!latest,
      locked:       !!latest, // If an entry exists in code_submissions, it's a final submission and is locked!
      lastStatus:   latest?.status || null,
      lastScore:    latest?.score  || 0,
      executionId:  latest?.id     || null,
      submittedAt:  latest?.created_at || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
