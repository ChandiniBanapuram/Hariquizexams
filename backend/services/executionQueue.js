/**
 * backend/services/executionQueue.js
 *
 * Lightweight in-process execution queue.
 * Limits concurrency for ML/heavy executions to prevent server overload.
 *
 * Architecture:
 *   - Simple async semaphore (no Redis needed for now)
 *   - Pluggable: swap to BullMQ by replacing the enqueue() internals
 *   - Tracks queue size, active workers, wait times
 *
 * Future:
 *   npm install bullmq ioredis
 *   Then replace the semaphore with BullMQ Worker + Queue.
 */
'use strict';

const log = require('./logger');

// ─── Config ──────────────────────────────────────────────────────────────────

const MAX_CONCURRENT  = parseInt(process.env.EXEC_MAX_CONCURRENT  || '3',  10); // ML: max 3 parallel
const MAX_QUEUE_SIZE  = parseInt(process.env.EXEC_MAX_QUEUE_SIZE  || '50', 10);
const QUEUE_TIMEOUT_MS = parseInt(process.env.EXEC_QUEUE_TIMEOUT_MS || '120000', 10); // 2min max wait

// ─── Per-student execution rate tracking ─────────────────────────────────────
// Map<studentId, { count, resetAt }>
const studentRateMap = new Map();
const RATE_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_MAX_RUNS  = parseInt(process.env.EXEC_RATE_MAX || '10', 10);

function checkStudentRate(studentId) {
  if (!studentId) return { allowed: true };
  const now = Date.now();
  let entry = studentRateMap.get(String(studentId));
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    studentRateMap.set(String(studentId), entry);
  }
  if (entry.count >= RATE_MAX_RUNS) {
    const waitSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec: waitSec };
  }
  entry.count++;
  return { allowed: true, remaining: RATE_MAX_RUNS - entry.count };
}

// Cleanup old rate entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of studentRateMap) {
    if (now > entry.resetAt) studentRateMap.delete(id);
  }
}, 5 * 60 * 1000);

// ─── Async Semaphore ──────────────────────────────────────────────────────────

class AsyncSemaphore {
  constructor(max) {
    this._max     = max;
    this._count   = 0;
    this._waiters = [];
  }

  get activeCount()  { return this._count; }
  get waitingCount() { return this._waiters.length; }

  acquire() {
    return new Promise((resolve, reject) => {
      if (this._count < this._max) {
        this._count++;
        resolve();
      } else {
        const timer = setTimeout(() => {
          const idx = this._waiters.findIndex(w => w.resolve === resolve);
          if (idx !== -1) this._waiters.splice(idx, 1);
          reject(new Error('QUEUE_TIMEOUT'));
        }, QUEUE_TIMEOUT_MS);

        this._waiters.push({
          resolve: () => { clearTimeout(timer); resolve(); },
          reject,
        });
      }
    });
  }

  release() {
    if (this._waiters.length > 0) {
      const next = this._waiters.shift();
      next.resolve();
    } else {
      this._count = Math.max(0, this._count - 1);
    }
  }
}

const semaphore = new AsyncSemaphore(MAX_CONCURRENT);

// ─── Queue stats ──────────────────────────────────────────────────────────────
let totalProcessed = 0;
let totalFailed    = 0;
let totalTimedOut  = 0;

function getQueueStats() {
  return {
    active:    semaphore.activeCount,
    waiting:   semaphore.waitingCount,
    maxConcurrent: MAX_CONCURRENT,
    maxQueueSize:  MAX_QUEUE_SIZE,
    totalProcessed,
    totalFailed,
    totalTimedOut,
    rateWindowSec: RATE_WINDOW_MS / 1000,
    maxRunsPerWindow: RATE_MAX_RUNS,
  };
}

// ─── Main queue entry point ───────────────────────────────────────────────────

/**
 * Enqueue a code execution job with rate limiting and concurrency control.
 *
 * @param {object} opts
 * @param {string}   opts.studentId
 * @param {Function} opts.task        – async function returning execution result
 * @param {boolean}  [opts.priority]  – reserved for future BullMQ priority support
 *
 * @returns {Promise<result | { error, status }>}
 */
async function enqueue({ studentId, task, priority = false }) {
  // ── Rate limit check ──────────────────────────────────────────────────────
  const rate = checkStudentRate(studentId);
  if (!rate.allowed) {
    log.security('Execution rate limit hit', { studentId, retryAfterSec: rate.retryAfterSec });
    return {
      error: true,
      status: 'RATE_LIMITED',
      message: `Too many executions. Please wait ${rate.retryAfterSec}s before running again.`,
    };
  }

  // ── Queue capacity check ──────────────────────────────────────────────────
  if (semaphore.waitingCount >= MAX_QUEUE_SIZE) {
    log.warn('Execution queue full', { studentId, queueSize: semaphore.waitingCount });
    return {
      error: true,
      status: 'QUEUE_FULL',
      message: 'Server is busy. Please try again in a moment.',
    };
  }

  // ── Acquire slot ──────────────────────────────────────────────────────────
  const queuedAt = Date.now();
  log.info('Execution queued', { studentId, waiting: semaphore.waitingCount });

  try {
    await semaphore.acquire();
  } catch (e) {
    totalTimedOut++;
    log.warn('Execution queue timeout', { studentId });
    return {
      error: true,
      status: 'QUEUE_TIMEOUT',
      message: 'Your request timed out waiting in queue. Server is under heavy load.',
    };
  }

  const waitMs = Date.now() - queuedAt;
  log.execution('STARTED', { studentId, waitMs });

  // ── Execute ───────────────────────────────────────────────────────────────
  try {
    const result = await task();
    totalProcessed++;
    log.execution('COMPLETED', { studentId, waitMs });
    return result;
  } catch (err) {
    totalFailed++;
    log.error('Execution task failed', { studentId, error: err.message });
    throw err;
  } finally {
    semaphore.release();
  }
}

module.exports = { enqueue, getQueueStats, checkStudentRate };
