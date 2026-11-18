/**
 * backend/routes/health.js
 *
 * Health monitoring endpoints for production ops.
 *
 *   GET /api/health           – quick liveness check
 *   GET /api/health/runtime   – Python runtime availability
 *   GET /api/health/docker    – Docker daemon + image availability
 *   GET /api/health/database  – DB connection
 *   GET /api/health/queue     – Execution queue status
 *   GET /api/health/all       – Full system health report
 */
'use strict';

const express = require('express');
const router  = express.Router();
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const db  = require('../config/db');
const log = require('../services/logger');
const { getQueueStats } = require('../services/executionQueue');

const REQUIRED_IMAGES = [
  'exam-c-runtime:latest',
  'exam-cpp-runtime:latest',
  'exam-java-runtime:latest',
  'exam-python-runtime:latest',
  'exam-ml-runtime:latest',
  'exam-cvpr-runtime:latest',
  'exam-rl-runtime:latest',
];

// ─── Liveness ────────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString(), version: '2.0.0' });
});

// ─── Python runtime ───────────────────────────────────────────────────────────

router.get('/runtime', async (req, res) => {
  const bin = process.env.PYTHON_BIN || 'python';
  try {
    const { stdout } = await execFileAsync(bin, ['--version'], { timeout: 3000 });
    const version = (stdout || '').trim();
    return res.json({ status: 'ok', runtime: bin, version });
  } catch (err) {
    log.warn('Python runtime health check failed', { error: err.message });
    return res.json({ status: 'unavailable', runtime: bin, error: err.message });
  }
});

// ─── Docker ───────────────────────────────────────────────────────────────────

router.get('/docker', async (req, res) => {
  const strategy = (process.env.EXECUTION_STRATEGY || 'judge0').toLowerCase();

  if (strategy !== 'docker') {
    return res.json({
      status: 'not_configured',
      message: `EXECUTION_STRATEGY=${strategy} (docker not active)`,
    });
  }

  try {
    const { stdout: infoOut } = await execFileAsync('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 5000 });
    const dockerVersion = (infoOut || '').trim();

    // Check which images are available
    const { stdout: imagesOut } = await execFileAsync('docker', ['images', '--format', '{{.Repository}}:{{.Tag}}'], { timeout: 5000 });
    const available = (imagesOut || '').split('\n').map(s => s.trim()).filter(Boolean);

    const imageStatus = REQUIRED_IMAGES.map(img => ({
      image:     img,
      available: available.includes(img),
    }));
    const allReady = imageStatus.every(i => i.available);

    // Count running exam containers
    const { stdout: psOut } = await execFileAsync(
      'docker', ['ps', '--filter', 'name=exam_', '--format', '{{.ID}}'],
      { timeout: 3000 }
    ).catch(() => ({ stdout: '' }));
    const activeContainers = (psOut || '').split('\n').filter(Boolean).length;

    return res.json({
      status:    allReady ? 'ok' : 'degraded',
      dockerVersion,
      images:    imageStatus,
      imagesReady: imageStatus.filter(i => i.available).length,
      imagesTotal: REQUIRED_IMAGES.length,
      activeContainers,
    });
  } catch (err) {
    log.warn('Docker health check failed', { error: err.message });
    return res.json({ status: 'unavailable', error: err.message });
  }
});

// ─── Database ─────────────────────────────────────────────────────────────────

router.get('/database', async (req, res) => {
  try {
    const start = Date.now();
    await db.query('SELECT 1');
    const latencyMs = Date.now() - start;

    // Count rows in key tables
    const [[exec]]    = await db.query('SELECT COUNT(*) as n FROM execution_results').catch(() => [[{ n: -1 }]]);
    const [[metrics]] = await db.query('SELECT COUNT(*) as n FROM student_metrics').catch(()  => [[{ n: -1 }]]);
    const [[graphs]]  = await db.query('SELECT COUNT(*) as n FROM graph_outputs').catch(()    => [[{ n: -1 }]]);

    return res.json({
      status:    'ok',
      latencyMs,
      tables: {
        execution_results: exec.n,
        student_metrics:   metrics.n,
        graph_outputs:     graphs.n,
      },
    });
  } catch (err) {
    log.error('Database health check failed', { error: err.message });
    return res.json({ status: 'unavailable', error: err.message });
  }
});

// ─── Execution queue ──────────────────────────────────────────────────────────

router.get('/queue', (req, res) => {
  const stats = getQueueStats();
  const status = stats.active >= stats.maxConcurrent ? 'saturated'
               : stats.waiting > 10               ? 'busy'
               : 'ok';
  res.json({ status, ...stats });
});

// ─── Full system health ───────────────────────────────────────────────────────

router.get('/all', async (req, res) => {
  const [runtime, docker, database, queue] = await Promise.allSettled([
    fetch(`http://localhost:${process.env.PORT || 5000}/api/health/runtime`).then(r => r.json()).catch(e => ({ status: 'error', error: e.message })),
    fetch(`http://localhost:${process.env.PORT || 5000}/api/health/docker`).then(r => r.json()).catch(e => ({ status: 'error', error: e.message })),
    fetch(`http://localhost:${process.env.PORT || 5000}/api/health/database`).then(r => r.json()).catch(e => ({ status: 'error', error: e.message })),
    Promise.resolve(getQueueStats()),
  ]);

  const get = r => r.status === 'fulfilled' ? r.value : { status: 'error' };

  const report = {
    overall:  'ok',
    ts:       new Date().toISOString(),
    runtime:  get(runtime),
    docker:   get(docker),
    database: get(database),
    queue:    get(queue),
    uptime:   Math.round(process.uptime()),
    memory:   process.memoryUsage(),
  };

  // Degrade overall if any critical service is down
  if (get(database).status !== 'ok') report.overall = 'degraded';
  if (get(runtime).status  === 'unavailable') report.overall = 'degraded';

  res.json(report);
});

module.exports = router;
