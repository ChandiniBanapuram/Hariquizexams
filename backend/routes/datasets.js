/**
 * backend/routes/datasets.js
 * Dataset upload and management for ML/CVPR/RL coding exams.
 * Mounted at: /api/datasets
 *
 * Requires: npm install multer
 */
'use strict';
const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const db      = require('../config/db');
const baseAuthMiddleware = require('../middleware/auth');

// ─── Auth middleware ─────────────────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  baseAuthMiddleware(req, res, (err) => {
    if (err) return next(err);
    next();
  });
};

// ─── Storage directories ──────────────────────────────────────────────────────
const BASE_DATASET_DIR = path.join(__dirname, '..', 'datasets');
const DIRS = {
  csv:   path.join(BASE_DATASET_DIR, 'csv'),
  image: path.join(BASE_DATASET_DIR, 'images'),
  rl:    path.join(BASE_DATASET_DIR, 'rl'),
  audio: path.join(BASE_DATASET_DIR, 'audio'),
};

// Create directories on startup
Object.values(DIRS).forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ─── Allowed extensions & size limits ────────────────────────────────────────
const ALLOWED = {
  csv:   { exts: ['.csv'],                    maxBytes: 50  * 1024 * 1024 },
  image: { exts: ['.zip', '.jpg', '.jpeg', '.png'], maxBytes: 500 * 1024 * 1024 },
  rl:    { exts: ['.json'],                   maxBytes:  5  * 1024 * 1024 },
  audio: { exts: ['.wav', '.mp3', '.flac'],   maxBytes: 100 * 1024 * 1024 },
};

// ─── Multer setup (lazy require so server still starts without multer) ────────
let multerAvailable = false;
let uploadCsv, uploadImage, uploadRl, uploadAudio;
try {
  const multer = require('multer');

  const makeStorage = (type) => multer.diskStorage({
    destination: (req, file, cb) => cb(null, DIRS[type]),
    filename:    (req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase();
      const uid  = crypto.randomBytes(8).toString('hex');
      cb(null, `${Date.now()}_${uid}${ext}`);
    },
  });

  const makeFilter = (type) => (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED[type].exts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${ALLOWED[type].exts.join(', ')}`));
    }
  };

  uploadCsv   = multer({ storage: makeStorage('csv'),   fileFilter: makeFilter('csv'),   limits: { fileSize: ALLOWED.csv.maxBytes }   });
  uploadImage = multer({ storage: makeStorage('image'), fileFilter: makeFilter('image'), limits: { fileSize: ALLOWED.image.maxBytes } });
  uploadRl    = multer({ storage: makeStorage('rl'),    fileFilter: makeFilter('rl'),    limits: { fileSize: ALLOWED.rl.maxBytes }    });
  uploadAudio = multer({ storage: makeStorage('audio'), fileFilter: makeFilter('audio'), limits: { fileSize: ALLOWED.audio.maxBytes } });
  multerAvailable = true;
  console.log('[datasets] multer loaded ✓');
} catch (e) {
  console.warn('[datasets] multer not available – run: npm install multer\n', e.message);
}

// ─── Helper: multer-not-ready guard ──────────────────────────────────────────
const requireMulter = (req, res, next) => {
  if (!multerAvailable) {
    return res.status(503).json({ error: 'File upload not available. Install multer: npm install multer' });
  }
  next();
};

// ─── POST /api/datasets/upload/csv ───────────────────────────────────────────
router.post('/upload/csv', authMiddleware, requireMulter, (req, res, next) => {
  uploadCsv.single('dataset')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
      const { questionId } = req.body;
      const { originalname, filename, size, path: filePath } = req.file;

      await db.query(
        `INSERT INTO question_datasets (question_id, dataset_type, dataset_name, dataset_path, dataset_size, uploaded_at)
         VALUES (?, 'csv', ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE dataset_name = VALUES(dataset_name), dataset_path = VALUES(dataset_path), dataset_size = VALUES(dataset_size), uploaded_at = NOW()`,
        [questionId || null, originalname, filename, size]
      );

      console.log('[datasets] CSV uploaded:', originalname, 'size:', size);
      res.json({ success: true, filename, originalname, size, type: 'csv' });
    } catch (dbErr) {
      console.error('[datasets/csv]', dbErr);
      res.status(500).json({ error: dbErr.message });
    }
  });
});

// ─── POST /api/datasets/upload/image ─────────────────────────────────────────
router.post('/upload/image', authMiddleware, requireMulter, (req, res, next) => {
  uploadImage.single('dataset')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
      const { questionId } = req.body;
      const { originalname, filename, size } = req.file;

      await db.query(
        `INSERT INTO question_datasets (question_id, dataset_type, dataset_name, dataset_path, dataset_size, uploaded_at)
         VALUES (?, 'image', ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE dataset_name = VALUES(dataset_name), dataset_path = VALUES(dataset_path), dataset_size = VALUES(dataset_size), uploaded_at = NOW()`,
        [questionId || null, originalname, filename, size]
      );

      console.log('[datasets] Image uploaded:', originalname, 'size:', size);
      res.json({ success: true, filename, originalname, size, type: 'image' });
    } catch (dbErr) {
      console.error('[datasets/image]', dbErr);
      res.status(500).json({ error: dbErr.message });
    }
  });
});

// ─── POST /api/datasets/upload/rl ────────────────────────────────────────────
router.post('/upload/rl', authMiddleware, requireMulter, (req, res, next) => {
  uploadRl.single('dataset')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Validate JSON
    try {
      const content = fs.readFileSync(req.file.path, 'utf8');
      JSON.parse(content); // throws if invalid
    } catch {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Invalid JSON format in uploaded config file' });
    }

    try {
      const { questionId } = req.body;
      const { originalname, filename, size } = req.file;

      await db.query(
        `INSERT INTO question_datasets (question_id, dataset_type, dataset_name, dataset_path, dataset_size, uploaded_at)
         VALUES (?, 'rl', ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE dataset_name = VALUES(dataset_name), dataset_path = VALUES(dataset_path), dataset_size = VALUES(dataset_size), uploaded_at = NOW()`,
        [questionId || null, originalname, filename, size]
      );

      console.log('[datasets] RL config uploaded:', originalname, 'size:', size);
      res.json({ success: true, filename, originalname, size, type: 'rl' });
    } catch (dbErr) {
      console.error('[datasets/rl]', dbErr);
      res.status(500).json({ error: dbErr.message });
    }
  });
});

// ─── POST /api/datasets/upload/audio ─────────────────────────────────────────
router.post('/upload/audio', authMiddleware, requireMulter, (req, res, next) => {
  uploadAudio.single('dataset')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
      const { questionId } = req.body;
      const { originalname, filename, size } = req.file;

      await db.query(
        `INSERT INTO question_datasets (question_id, dataset_type, dataset_name, dataset_path, dataset_size, uploaded_at)
         VALUES (?, 'audio', ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE dataset_name = VALUES(dataset_name), dataset_path = VALUES(dataset_path), dataset_size = VALUES(dataset_size), uploaded_at = NOW()`,
        [questionId || null, originalname, filename, size]
      );

      console.log('[datasets] Audio uploaded:', originalname, 'size:', size);
      res.json({ success: true, filename, originalname, size, type: 'audio' });
    } catch (dbErr) {
      console.error('[datasets/audio]', dbErr);
      res.status(500).json({ error: dbErr.message });
    }
  });
});

// ─── GET /api/datasets/question/:questionId ───────────────────────────────────
router.get('/question/:questionId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM question_datasets WHERE question_id = ? ORDER BY uploaded_at DESC',
      [req.params.questionId]
    );
    res.json({ datasets: rows });
  } catch (err) {
    console.error('[datasets/get]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/datasets/download/:type/:filename ───────────────────────────────
router.get('/download/:type/:filename', async (req, res) => {
  try {
    const { type, filename } = req.params;
    if (!['csv', 'image', 'rl', 'audio'].includes(type)) {
      return res.status(400).json({ error: 'Invalid dataset type' });
    }

    // Security: prevent directory traversal
    const safeFilename = path.basename(filename);
    const filePath = path.join(DIRS[type], safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Dataset file not found' });
    }

    res.download(filePath);
  } catch (err) {
    console.error('[datasets/download]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/datasets/:id ────────────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM question_datasets WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Dataset not found' });

    const ds = rows[0];
    const typeDir = DIRS[ds.dataset_type];
    if (typeDir) {
      const filePath = path.join(typeDir, ds.dataset_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await db.query('DELETE FROM question_datasets WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Dataset deleted' });
  } catch (err) {
    console.error('[datasets/delete]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
