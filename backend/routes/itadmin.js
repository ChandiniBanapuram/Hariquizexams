const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// ==================== IT ADMIN AUTH ====================

const IT_ADMIN_USERNAME = process.env.IT_ADMIN_USERNAME;
const IT_ADMIN_PASSWORD = process.env.IT_ADMIN_PASSWORD;

// Middleware: verify IT Admin token
const itAdminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    if (decoded.role !== 'itadmin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === IT_ADMIN_USERNAME && password === IT_ADMIN_PASSWORD) {
    const token = jwt.sign({ username, role: 'itadmin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, message: 'Login successful' });
  }
  res.status(401).json({ message: 'Invalid credentials' });
});

// ==================== DEPARTMENTS ====================
router.get('/departments', itAdminAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM departments ORDER BY label');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch departments', error: e.message });
  }
});

router.post('/departments', itAdminAuth, async (req, res) => {
  try {
    const { label, value, admin_username, admin_password } = req.body;
    if (!label || !value) return res.status(400).json({ message: 'Label and value are required' });
    await db.query(
      'INSERT INTO departments (label, value, admin_username, admin_password) VALUES (?, ?, ?, ?)', 
      [label, value, admin_username || null, admin_password || null]
    );
    res.json({ message: 'Department added' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Department already exists' });
    res.status(500).json({ message: 'Failed to add department', error: e.message });
  }
});

router.put('/departments/:id', itAdminAuth, async (req, res) => {
  try {
    const { label, value, admin_username, admin_password } = req.body;
    if (!label || !value) return res.status(400).json({ message: 'Label and value are required' });
    await db.query(
      'UPDATE departments SET label = ?, value = ?, admin_username = ?, admin_password = ? WHERE id = ?',
      [label, value, admin_username || null, admin_password || null, req.params.id]
    );
    res.json({ message: 'Department updated successfully' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Department value already exists' });
    res.status(500).json({ message: 'Failed to update department', error: e.message });
  }
});

router.delete('/departments/:id', itAdminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM departments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Department deleted' });
  } catch (e) {
    res.status(500).json({ message: 'Failed to delete department', error: e.message });
  }
});

// ==================== SECTIONS ====================
router.get('/sections', itAdminAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM sections ORDER BY label');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch sections', error: e.message });
  }
});

router.post('/sections', itAdminAuth, async (req, res) => {
  try {
    const { label, value } = req.body;
    if (!label || !value) return res.status(400).json({ message: 'Label and value are required' });
    await db.query('INSERT INTO sections (label, value) VALUES (?, ?)', [label, value]);
    res.json({ message: 'Section added' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Section already exists' });
    res.status(500).json({ message: 'Failed to add section', error: e.message });
  }
});

router.delete('/sections/:id', itAdminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM sections WHERE id = ?', [req.params.id]);
    res.json({ message: 'Section deleted' });
  } catch (e) {
    res.status(500).json({ message: 'Failed to delete section', error: e.message });
  }
});

// ==================== YEARS ====================
router.get('/years', itAdminAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM years ORDER BY value');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch years', error: e.message });
  }
});

router.post('/years', itAdminAuth, async (req, res) => {
  try {
    const { label, value } = req.body;
    if (!label || !value) return res.status(400).json({ message: 'Label and value are required' });
    await db.query('INSERT INTO years (label, value) VALUES (?, ?)', [label, value]);
    res.json({ message: 'Year added' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Year already exists' });
    res.status(500).json({ message: 'Failed to add year', error: e.message });
  }
});

router.delete('/years/:id', itAdminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM years WHERE id = ?', [req.params.id]);
    res.json({ message: 'Year deleted' });
  } catch (e) {
    res.status(500).json({ message: 'Failed to delete year', error: e.message });
  }
});

// ==================== SEMESTERS ====================
router.get('/semesters', itAdminAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM semesters ORDER BY value');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch semesters', error: e.message });
  }
});

router.post('/semesters', itAdminAuth, async (req, res) => {
  try {
    const { label, value } = req.body;
    if (!label || !value) return res.status(400).json({ message: 'Label and value are required' });
    await db.query('INSERT INTO semesters (label, value) VALUES (?, ?)', [label, value]);
    res.json({ message: 'Semester added' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Semester already exists' });
    res.status(500).json({ message: 'Failed to add semester', error: e.message });
  }
});

router.delete('/semesters/:id', itAdminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM semesters WHERE id = ?', [req.params.id]);
    res.json({ message: 'Semester deleted' });
  } catch (e) {
    res.status(500).json({ message: 'Failed to delete semester', error: e.message });
  }
});

// ==================== SUBJECTS ====================
router.get('/subjects', itAdminAuth, async (req, res) => {
  try {
    const { department, year, semester } = req.query;
    let query = 'SELECT * FROM subjects WHERE 1=1';
    const params = [];
    if (department) { query += ' AND department_value = ?'; params.push(department); }
    if (year) { query += ' AND year_value = ?'; params.push(year); }
    if (semester) { query += ' AND semester_value = ?'; params.push(semester); }
    query += ' ORDER BY label';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch subjects', error: e.message });
  }
});

router.post('/subjects', itAdminAuth, async (req, res) => {
  try {
    const { department_value, year_value, semester_value, label, value } = req.body;
    if (!department_value || !year_value || !semester_value || !label || !value) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    await db.query(
      'INSERT INTO subjects (department_value, year_value, semester_value, label, value) VALUES (?, ?, ?, ?, ?)',
      [department_value, year_value, semester_value, label, value]
    );
    res.json({ message: 'Subject added' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Subject already exists for this dept/year/sem' });
    res.status(500).json({ message: 'Failed to add subject', error: e.message });
  }
});

router.delete('/subjects/:id', itAdminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM subjects WHERE id = ?', [req.params.id]);
    res.json({ message: 'Subject deleted' });
  } catch (e) {
    res.status(500).json({ message: 'Failed to delete subject', error: e.message });
  }
});

// ==================== PUBLIC ENDPOINTS (no auth - for dropdowns) ====================
router.get('/public/departments', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT label, value FROM departments ORDER BY label');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch departments' });
  }
});

router.get('/public/sections', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT label, value FROM sections ORDER BY label');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch sections' });
  }
});

router.get('/public/years', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT label, value FROM years ORDER BY value');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch years' });
  }
});

router.get('/public/semesters', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT label, value FROM semesters ORDER BY value');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch semesters' });
  }
});

router.get('/public/subjects', async (req, res) => {
  try {
    const { department, year, semester } = req.query;
    let query = 'SELECT label, value FROM subjects WHERE 1=1';
    const params = [];
    if (department) { query += ' AND department_value = ?'; params.push(department); }
    if (year) { query += ' AND year_value = ?'; params.push(year); }
    if (semester) { query += ' AND semester_value = ?'; params.push(semester); }
    query += ' ORDER BY label';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch subjects' });
  }
});

// ==================== SYSTEM SETTINGS ====================
router.get('/public/settings', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT setting_key, setting_value FROM system_settings');
    const settings = {};
    rows.forEach(r => {
      settings[r.setting_key] = r.setting_value;
    });
    res.json(settings);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch settings', error: e.message });
  }
});

router.get('/settings', itAdminAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT setting_key, setting_value FROM system_settings');
    const settings = {};
    rows.forEach(r => {
      settings[r.setting_key] = r.setting_value;
    });
    res.json(settings);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch settings', error: e.message });
  }
});

router.put('/settings', itAdminAuth, async (req, res) => {
  try {
    const settings = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ message: 'Invalid settings object' });
    }
    for (const [key, value] of Object.entries(settings)) {
      await db.query(
        'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [key, value, value]
      );
    }
    res.json({ message: 'Settings updated successfully' });
  } catch (e) {
    res.status(500).json({ message: 'Failed to update settings', error: e.message });
  }
});

module.exports = router;
