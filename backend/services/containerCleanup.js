/**
 * backend/services/containerCleanup.js
 *
 * Periodic cleanup daemon for Docker containers and temp directories.
 *
 * Features:
 *   ✓ Kills orphaned exam containers older than TIMEOUT
 *   ✓ Removes stale temp directories from OS temp
 *   ✓ Purges old graph/image files beyond retention period
 *   ✓ Logs all cleanup actions
 *   ✓ Runs automatically when imported (no manual start needed)
 *
 * Safe: Only touches containers/dirs with "exam_" or "exec_" prefixes.
 */
'use strict';

const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const log = require('./logger');

// ─── Config ──────────────────────────────────────────────────────────────────

const CLEANUP_INTERVAL_MS   = parseInt(process.env.CLEANUP_INTERVAL_MS    || '300000',   10); // 5 min
const CONTAINER_MAX_AGE_SEC = parseInt(process.env.CONTAINER_MAX_AGE_SEC  || '120',      10); // 2 min
const TEMP_DIR_MAX_AGE_MS   = parseInt(process.env.TEMP_DIR_MAX_AGE_MS    || '600000',   10); // 10 min
const OUTPUT_RETENTION_DAYS = parseInt(process.env.OUTPUT_RETENTION_DAYS   || '30',       10); // 30 days

const OUTPUT_BASE = path.join(__dirname, '..', 'student_outputs');
const GRAPH_DIR   = path.join(OUTPUT_BASE, 'graphs');
const IMAGE_DIR   = path.join(OUTPUT_BASE, 'images');
const LOG_FILE_DIR = path.join(OUTPUT_BASE, 'logs');

// ─── Docker container cleanup ─────────────────────────────────────────────────

async function cleanOrphanedContainers() {
  const strategy = (process.env.EXECUTION_STRATEGY || 'judge0').toLowerCase();
  if (strategy !== 'docker') return { cleaned: 0 };

  try {
    // List all running exam_ containers
    const { stdout } = await execFileAsync('docker', [
      'ps', '--format', '{{.ID}} {{.Names}} {{.Status}}',
      '--filter', 'name=exam_',
    ], { timeout: 5000 });

    const lines = (stdout || '').trim().split('\n').filter(Boolean);
    let cleaned = 0;

    for (const line of lines) {
      const parts = line.split(/\s+/);
      const containerId = parts[0];
      const name = parts[1];
      const status = parts.slice(2).join(' ');

      // Parse uptime: "Up 3 minutes" → extract age
      const minuteMatch = status.match(/Up (\d+) minute/);
      const hourMatch   = status.match(/Up (\d+) hour/);
      const secMatch    = status.match(/Up (\d+) second/);

      let ageSec = 0;
      if (hourMatch)   ageSec = parseInt(hourMatch[1]) * 3600;
      else if (minuteMatch) ageSec = parseInt(minuteMatch[1]) * 60;
      else if (secMatch)    ageSec = parseInt(secMatch[1]);

      if (ageSec > CONTAINER_MAX_AGE_SEC) {
        try {
          await execFileAsync('docker', ['rm', '-f', containerId], { timeout: 5000 });
          log.container('ORPHAN_REMOVED', name, { ageSec });
          cleaned++;
        } catch (e) {
          log.warn('Failed to remove orphan container', { name, error: e.message });
        }
      }
    }

    return { cleaned };
  } catch (e) {
    // Docker not available – that's fine
    return { cleaned: 0, error: e.message };
  }
}

// ─── Temp directory cleanup ───────────────────────────────────────────────────

function cleanTempDirectories() {
  const tmpBase = os.tmpdir();
  let cleaned = 0;

  try {
    const entries = fs.readdirSync(tmpBase);
    const now = Date.now();

    for (const entry of entries) {
      // Only clean dirs with our execution prefixes
      if (!entry.startsWith('exec_') &&
          !entry.startsWith('docker_exec_') &&
          !entry.startsWith('py_exec_')) {
        continue;
      }

      const fullPath = path.join(tmpBase, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (!stat.isDirectory()) continue;

        const age = now - stat.mtimeMs;
        if (age > TEMP_DIR_MAX_AGE_MS) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          log.debug('Cleaned stale temp dir', { dir: entry, ageMin: Math.round(age / 60000) });
          cleaned++;
        }
      } catch {}
    }
  } catch (e) {
    log.warn('Temp dir cleanup scan failed', { error: e.message });
  }

  return { cleaned };
}

// ─── Old output file cleanup ──────────────────────────────────────────────────

function cleanOldOutputs() {
  const retentionMs = OUTPUT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let cleaned = 0;

  for (const dir of [GRAPH_DIR, IMAGE_DIR, LOG_FILE_DIR]) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isFile() && (now - stat.mtimeMs) > retentionMs) {
            fs.unlinkSync(fullPath);
            cleaned++;
          }
        } catch {}
      }
    } catch {}
  }

  if (cleaned > 0) {
    log.info('Cleaned old output files', { cleaned, retentionDays: OUTPUT_RETENTION_DAYS });
  }
  return { cleaned };
}

// ─── Combined cleanup run ─────────────────────────────────────────────────────

async function runCleanup() {
  const start = Date.now();

  const containers = await cleanOrphanedContainers();
  const tempDirs   = cleanTempDirectories();
  const outputs    = cleanOldOutputs();

  const totalCleaned = containers.cleaned + tempDirs.cleaned + outputs.cleaned;

  if (totalCleaned > 0) {
    log.info('Cleanup cycle complete', {
      containers: containers.cleaned,
      tempDirs:   tempDirs.cleaned,
      outputs:    outputs.cleaned,
      durationMs: Date.now() - start,
    });
  }

  return { containers, tempDirs, outputs, totalCleaned };
}

// ─── Auto-start interval ─────────────────────────────────────────────────────

let _cleanupInterval = null;

function startCleanupDaemon() {
  if (_cleanupInterval) return; // already running

  // Run immediately on startup
  runCleanup().catch(() => {});

  // Then every CLEANUP_INTERVAL_MS
  _cleanupInterval = setInterval(() => {
    runCleanup().catch(e => {
      log.warn('Cleanup cycle failed', { error: e.message });
    });
  }, CLEANUP_INTERVAL_MS);

  log.info('Container cleanup daemon started', { intervalMs: CLEANUP_INTERVAL_MS });
}

function stopCleanupDaemon() {
  if (_cleanupInterval) {
    clearInterval(_cleanupInterval);
    _cleanupInterval = null;
    log.info('Container cleanup daemon stopped');
  }
}

// Auto-start when module is loaded
startCleanupDaemon();

module.exports = { runCleanup, startCleanupDaemon, stopCleanupDaemon };
