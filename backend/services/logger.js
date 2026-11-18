/**
 * backend/services/logger.js
 *
 * Production-grade structured logger using Winston.
 * Gracefully degrades to console if winston is not installed.
 *
 * Install:  npm install winston --save
 */
'use strict';

const path = require('path');
const fs   = require('fs');

const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

let logger;

try {
  const winston = require('winston');
  const { combine, timestamp, printf, colorize, json } = winston.format;

  // ── Custom format for console output ──────────────────────────────────────
  const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
  });

  logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      json()
    ),
    transports: [
      // Combined log (all levels)
      new winston.transports.File({
        filename: path.join(LOG_DIR, 'combined.log'),
        maxsize:  10 * 1024 * 1024,  // 10MB
        maxFiles: 5,
        tailable: true,
      }),
      // Error-only log
      new winston.transports.File({
        filename: path.join(LOG_DIR, 'error.log'),
        level:    'error',
        maxsize:  5 * 1024 * 1024,
        maxFiles: 3,
        tailable: true,
      }),
      // Security events log
      new winston.transports.File({
        filename: path.join(LOG_DIR, 'security.log'),
        level:    'warn',
        maxsize:  5 * 1024 * 1024,
        maxFiles: 3,
        tailable: true,
      }),
      // Console (coloured, human-readable)
      new winston.transports.Console({
        format: combine(
          colorize(),
          timestamp({ format: 'HH:mm:ss' }),
          consoleFormat
        ),
      }),
    ],
    // Do not crash on unhandled exceptions
    exitOnError: false,
  });

  console.log('[logger] Winston logger initialized ✓');
} catch (e) {
  // Graceful fallback: plain console logger with same API surface
  console.warn('[logger] Winston not available, using console fallback. Run: npm install winston');
  logger = {
    info:  (msg, meta) => console.log(`[INFO]  ${msg}`, meta || ''),
    warn:  (msg, meta) => console.warn(`[WARN]  ${msg}`, meta || ''),
    error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta || ''),
    debug: (msg, meta) => process.env.LOG_LEVEL === 'debug' && console.log(`[DEBUG] ${msg}`, meta || ''),
  };
}

// ─── Structured log helpers ───────────────────────────────────────────────────

const log = {
  /** General info */
  info: (msg, meta = {}) => logger.info(msg, meta),

  /** Warnings / soft errors */
  warn: (msg, meta = {}) => logger.warn(msg, meta),

  /** Hard errors */
  error: (msg, meta = {}) => logger.error(msg, meta),

  /** Debug (only when LOG_LEVEL=debug) */
  debug: (msg, meta = {}) => logger.debug(msg, meta),

  /** Security event (always logged to security.log) */
  security: (event, meta = {}) => logger.warn(`[SECURITY] ${event}`, { ...meta, security: true }),

  /** Execution event */
  execution: (status, meta = {}) => logger.info(`[EXEC] ${status}`, { ...meta, type: 'execution' }),

  /** Container lifecycle event */
  container: (action, containerId, meta = {}) =>
    logger.info(`[CONTAINER] ${action}`, { containerId, ...meta, type: 'container' }),
};

module.exports = log;
