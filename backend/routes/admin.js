const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const baseAuthMiddleware = require('../middleware/auth');
const { scoreQuestionSet } = require('../utils/quizScoring');

// CSMCSD is the super-department: its admin can see ALL departments' data
// (treated like the master admin). Other dept admins remain scoped to their own.
const SUPER_DEPTS = ['CSMCSD', 'CS', 'ALL', 'ADMIN', 'SUPERADMIN', 'IT', 'MASTER']; // normalized (no spaces/parens, uppercase)
const isSuperDept = (d) =>
  !!d && SUPER_DEPTS.includes(String(d).replace(/[\s()._-]/g, '').toUpperCase());

// Wrap auth middleware to enforce department scope on dept-restricted admins.
// Forces `department` in req.query and req.body to the admin's own department,
// regardless of any value sent from the client — UNLESS the admin belongs to
// a super-department (CSMCSD), in which case scope is cleared.
const authMiddleware = (req, res, next) => {
  baseAuthMiddleware(req, res, (err) => {
    if (err) return next(err);
    if (req.admin && req.admin.department && !isSuperDept(req.admin.department)) {
      if (req.query) req.query.department = req.admin.department;
      if (req.body && typeof req.body === 'object') req.body.department = req.admin.department;
    }
    next();
  });
};

// Base route for health check
router.get('/', (req, res) => {
  res.json({ status: 'Admin API is running', timestamp: new Date().toISOString() });
});

// Get total response count across ALL departments (global count)
router.get('/global-responses-count', baseAuthMiddleware, async (req, res) => {
  try {
    let query = 'SELECT COUNT(*) as count FROM responses';
    const params = [];
    if (req.admin && req.admin.department && !isSuperDept(req.admin.department)) {
      query += ` WHERE REPLACE(REPLACE(REPLACE(department,' ',''),'(',''),')','') = ?`;
      params.push(req.admin.department.replace(/[\s()]/g, ''));
    }
    const [rows] = await db.query(query, params);
    const totalCount = rows[0]?.count || 0;
    res.json({ count: totalCount });
  } catch (error) {
    console.error('Error fetching global responses count:', error);
    res.status(500).json({ message: 'Failed to fetch global responses count' });
  }
});

// Department-scoped admin accounts. `department` null => master admin (sees all).
// To make matching robust, normalized department is also stored.
const normDept = (d) => (d || '').replace(/\s+/g, '').replace(/\(/g, '').replace(/\)/g, '').toUpperCase();

// Admin Login (master + department-scoped admins)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Master admin (env-based)
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
      const token = jwt.sign(
        { username, role: 'admin', department: null },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      return res.json({ token, message: 'Login successful' });
    }

    // Dynamic Department-scoped admins from DB
    const [depts] = await db.query(
      'SELECT value, admin_username, admin_password FROM departments WHERE admin_username = ? AND admin_password = ?',
      [username, password]
    );

    if (depts.length > 0) {
      const match = depts[0];
      const token = jwt.sign(
        { username: match.admin_username, role: 'admin', department: match.value },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      return res.json({ token, department: match.value, message: 'Login successful' });
    }

    res.status(401).json({ message: 'Invalid credentials' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Helper: if admin is dept-scoped (and NOT a super-dept), force department filter
// to their dept (overriding any client value). Super-dept admins get free access.
function enforceDeptScope(req) {
  const dept = req.admin && req.admin.department;
  if (!dept) return null;
  if (isSuperDept(dept)) return null;
  if (req.query) req.query.department = dept;
  if (req.body && typeof req.body === 'object') req.body.department = dept;
  return dept;
}

// --- helpers for MCQ/Fill-in-the-blank normalization ---
function normalizeQuestionPayload(body) {
  const questionType = (body.questionType === 'fill_blank') ? 'fill_blank' : 'mcq';
  let options = Array.isArray(body.options) ? body.options.map(s => (s == null ? '' : String(s))) : null;
  let correctIndex = (body.correctIndex == null) ? null : Number(body.correctIndex);
  let acceptedAnswers = Array.isArray(body.acceptedAnswers)
    ? body.acceptedAnswers.map(s => String(s || '').trim()).filter(Boolean)
    : null;

  if (questionType === 'mcq' && (!options || options.length === 0)) {
    const legacy = [body.optionA, body.optionB, body.optionC, body.optionD]
      .map(s => (s == null ? '' : String(s)));
    if (legacy.some(Boolean)) {
      options = legacy;
      if (correctIndex == null && body.correctOption) {
        correctIndex = 'ABCD'.indexOf(String(body.correctOption).toUpperCase());
        if (correctIndex < 0) correctIndex = 0;
      }
    }
  }

  let optionA = null, optionB = null, optionC = null, optionD = null, correctOption = null;
  if (questionType === 'mcq' && options && options.length) {
    optionA = options[0] || '';
    optionB = options[1] || '';
    optionC = options[2] || '';
    optionD = options[3] || '';
    if (correctIndex != null && correctIndex >= 0 && correctIndex <= 3) {
      correctOption = 'ABCD'[correctIndex];
    }
  }

  return { questionType, options, correctIndex, acceptedAnswers, optionA, optionB, optionC, optionD, correctOption };
}

function hydrateQuestionRow(q) {
  const type = q.question_type || 'mcq';
  let options = q.options;
  if (typeof options === 'string') { try { options = JSON.parse(options); } catch (_) { options = null; } }
  let accepted = q.accepted_answers;
  if (typeof accepted === 'string') { try { accepted = JSON.parse(accepted); } catch (_) { accepted = null; } }
  if ((!options || !options.length) && (q.option_a || q.option_b || q.option_c || q.option_d)) {
    options = [q.option_a, q.option_b, q.option_c, q.option_d].map(v => v == null ? '' : String(v));
  }
  let correctIndex = q.correct_answer_index;
  if (correctIndex == null && q.correct_option) {
    correctIndex = 'ABCD'.indexOf(String(q.correct_option).toUpperCase());
    if (correctIndex < 0) correctIndex = null;
  }
  return { ...q, question_type: type, options: options || null, correct_answer_index: correctIndex, accepted_answers: accepted || null };
}

// Get all questions (admin) - with normalized department matching
router.get('/questions', authMiddleware, async (req, res) => {
  try {
    let { department, section, year, semester, subject, examDate } = req.query;
    let query = 'SELECT * FROM questions WHERE 1=1';
    const params = [];

    if (department) {
      const normalizedDept = department.replace(/\s+/g, '').replace('(', '').replace(')', '');
      query += ` AND REPLACE(REPLACE(REPLACE(department, ' ', ''), '(', ''), ')', '') = ?`;
      params.push(normalizedDept);
    }
    if (section)  { query += ' AND section = ?';  params.push(section); }
    if (year)     { query += ' AND year = ?';     params.push(year); }
    if (semester) { query += ' AND semester = ?'; params.push(semester); }
    if (subject)  { query += ' AND subject = ?';  params.push(subject); }
    if (examDate) { query += ' AND DATE(exam_date) = ?'; params.push(examDate); }

    query += ' ORDER BY created_at DESC';

    const [rows] = await db.query(query, params);
    res.json(rows.map(hydrateQuestionRow));
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ message: 'Failed to fetch questions' });
  }
});

// Update question
router.put('/questions/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { department, section, year, semester, subject, question, imageUrl, examDate, timer } = req.body;

    if (!department || !section || !question) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const norm = normalizeQuestionPayload(req.body);
    if (norm.questionType === 'mcq' && (!norm.options || norm.options.length < 2)) {
      return res.status(400).json({ message: 'MCQ must have at least 2 options' });
    }
    if (norm.questionType === 'fill_blank' && (!norm.acceptedAnswers || norm.acceptedAnswers.length === 0)) {
      return res.status(400).json({ message: 'Fill-in-the-blank must have at least 1 accepted answer' });
    }

    let formattedDate = null;
    if (examDate) formattedDate = new Date(examDate).toISOString().split('T')[0];

    const setClause = `SET department = ?, section = ?, year = ?, semester = ?, subject = ?, question = ?,
        option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ?,
        question_type = ?, options = ?, correct_answer_index = ?, accepted_answers = ?,
        image_url = ?, exam_date = ?, time_limit = ?`;
    const baseParams = [
      department, section, year || '1', semester || '1', subject || '', question,
      norm.optionA, norm.optionB, norm.optionC, norm.optionD, norm.correctOption,
      norm.questionType, norm.options ? JSON.stringify(norm.options) : null,
      norm.correctIndex, norm.acceptedAnswers ? JSON.stringify(norm.acceptedAnswers) : null,
      imageUrl || null, formattedDate || null, timer || 15,
    ];

    if (req.admin && req.admin.department && !isSuperDept(req.admin.department)) {
      const dept = req.admin.department.replace(/[\s()]/g, '');
      await db.query(
        `UPDATE questions ${setClause}
         WHERE id = ? AND REPLACE(REPLACE(REPLACE(department,' ',''),'(',''),')','') = ?`,
        [...baseParams, id, dept]
      );
    } else {
      await db.query(`UPDATE questions ${setClause} WHERE id = ?`, [...baseParams, id]);
    }

    res.json({ message: 'Question updated successfully' });
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ message: 'Failed to update question', error: error.message });
  }
});

// Add question
router.post('/questions', authMiddleware, async (req, res) => {
  try {
    const { department, section, year, semester, subject, question, imageUrl, examDate, timer } = req.body;

    if (!department || !section || !question) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const norm = normalizeQuestionPayload(req.body);
    if (norm.questionType === 'mcq' && (!norm.options || norm.options.length < 2)) {
      return res.status(400).json({ message: 'MCQ must have at least 2 options' });
    }
    if (norm.questionType === 'fill_blank' && (!norm.acceptedAnswers || norm.acceptedAnswers.length === 0)) {
      return res.status(400).json({ message: 'Fill-in-the-blank must have at least 1 accepted answer' });
    }

    let formattedDate = null;
    if (examDate) formattedDate = new Date(examDate).toISOString().split('T')[0];

    const [result] = await db.query(
      `INSERT INTO questions
         (department, section, year, semester, subject, question,
          option_a, option_b, option_c, option_d, correct_option,
          question_type, options, correct_answer_index, accepted_answers,
          image_url, exam_date, time_limit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        department, section, year || '1', semester || '1', subject || '', question,
        norm.optionA, norm.optionB, norm.optionC, norm.optionD, norm.correctOption,
        norm.questionType, norm.options ? JSON.stringify(norm.options) : null,
        norm.correctIndex, norm.acceptedAnswers ? JSON.stringify(norm.acceptedAnswers) : null,
        imageUrl || null, formattedDate || null, timer || 15,
      ]
    );

    res.json({ id: result.insertId, message: 'Question added successfully' });
  } catch (error) {
    console.error('Add question error:', error);
    res.status(500).json({ message: 'Failed to add question', error: error.message });
  }
});

// Delete question
router.delete('/questions/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.admin && req.admin.department && !isSuperDept(req.admin.department)) {
      const dept = req.admin.department.replace(/[\s()]/g, '');
      await db.query(
        `DELETE FROM questions WHERE id = ? AND REPLACE(REPLACE(REPLACE(department,' ',''),'(',''),')','') = ?`,
        [id, dept]
      );
    } else {
      await db.query('DELETE FROM questions WHERE id = ?', [id]);
    }
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ message: 'Failed to delete question' });
  }
});

// ==================== EXAM CONFIG ROUTES ====================

// Get exam configs
router.get('/exam-configs', authMiddleware, async (req, res) => {
  try {
    let { department, section, year, semester, subject, examDate } = req.query;
    let query = 'SELECT * FROM exam_configs WHERE 1=1';
    const params = [];

    if (department) {
      const normalizedDept = department.replace(/\s+/g, '').replace('(', '').replace(')', '');
      query += ` AND REPLACE(REPLACE(REPLACE(department, ' ', ''), '(', ''), ')', '') = ?`;
      params.push(normalizedDept);
    }
    if (section) {
      query += ' AND section = ?';
      params.push(section);
    }
    if (year) {
      query += ' AND year = ?';
      params.push(year);
    }
    if (semester) {
      query += ' AND semester = ?';
      params.push(semester);
    }
    if (subject) {
      query += ' AND subject = ?';
      params.push(subject);
    }
    if (examDate) {
      query += ' AND DATE(exam_date) = ?';
      params.push(examDate);
    }

    const [configs] = await db.query(query, params);
    res.json(configs);
  } catch (error) {
    console.error('Get exam configs error:', error);
    res.status(500).json({ message: 'Failed to fetch exam configs' });
  }
});

// Upsert exam config (FIXED: Added formattedDate definition)
router.post('/exam-config', authMiddleware, async (req, res) => {
  try {
    const { department, section, year, semester, subject, timeLimit, isActive, examDate } = req.body;

    if (!department || !section || !year || !semester || !subject) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // ✅ FIX: Define formattedDate
    let formattedDate = null;
    if (examDate) {
      formattedDate = new Date(examDate).toISOString().split('T')[0];
    }

    // Check if config exists (including exam_date in the lookup) with normalized department matching
    const normalizedDept = department.replace(/\s+/g, '').replace('(', '').replace(')', '');
    let existingQuery = `SELECT id FROM exam_configs 
      WHERE REPLACE(REPLACE(REPLACE(department, ' ', ''), '(', ''), ')', '') = ? 
      AND section = ? AND year = ? AND semester = ? AND subject = ?`;
    const existingParams = [normalizedDept, section, year, semester, subject];
    
    if (examDate) {
      existingQuery += ` AND DATE(exam_date) = ?`;
      existingParams.push(formattedDate);
    } else {
      existingQuery += ` AND exam_date IS NULL`;
    }

    const [existing] = await db.query(existingQuery, existingParams);

    if (existing.length > 0) {
      // Update existing
      await db.query(
        `UPDATE exam_configs SET time_limit = ?, is_active = ? WHERE id = ?`,
        [timeLimit || 15, isActive ? 1 : 0, existing[0].id]
      );
    } else {
      // Create new
      await db.query(
        `INSERT INTO exam_configs (department, section, year, semester, subject, time_limit, is_active, exam_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [department, section, year, semester, subject, timeLimit || 15, isActive ? 1 : 0, formattedDate || null]
      );
    }

    res.json({ message: 'Exam config saved successfully' });
  } catch (error) {
    console.error('Upsert exam config error:', error);
    res.status(500).json({ message: 'Failed to save exam config', error: error.message });
  }
});

// Advanced Exam Config (as requested)
router.post('/exam-config/advanced', authMiddleware, async (req, res) => {
  try {
    const { department, year, semester, section, subject, duration, questionCount, shuffle, showPreviousScore, enableCopyPaste, autoSubmitTabSwitch, is_active, examDate } = req.body;

    if (!department || !section || !year || !semester || !subject) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    let formattedDate = null;
    if (examDate) {
      formattedDate = new Date(examDate).toISOString().split('T')[0];
    }

    const normalizedDept = department.replace(/\s+/g, '').replace('(', '').replace(')', '');
    let existingQuery = `SELECT id FROM exam_configs 
      WHERE REPLACE(REPLACE(REPLACE(department, ' ', ''), '(', ''), ')', '') = ? 
      AND section = ? AND year = ? AND semester = ? AND subject = ?`;
    const existingParams = [normalizedDept, section, year, semester, subject];
    
    if (examDate) {
      existingQuery += ` AND DATE(exam_date) = ?`;
      existingParams.push(formattedDate);
    } else {
      existingQuery += ` AND exam_date IS NULL`;
    }

    const [existing] = await db.query(existingQuery, existingParams);

    // Default values if turning off and fields are missing
    const finalDuration = duration || 15;
    const finalQC = questionCount || null;
    const finalShuffle = shuffle ? 1 : 0;
    const finalShowPrev = showPreviousScore ? 1 : 0;
    const finalEnableCopyPaste = enableCopyPaste ? 1 : 0;
    const finalAutoSubmit = autoSubmitTabSwitch ? 1 : 0;
    const finalActive = is_active ? 1 : 0;

    if (existing.length > 0) {
      // Update existing
      if (!is_active && req.body.duration === undefined) {
         // just updating is_active to false
         await db.query(
           `UPDATE exam_configs SET is_active = 0 WHERE id = ?`,
           [existing[0].id]
         );
      } else {
         await db.query(
           `UPDATE exam_configs SET time_limit = ?, question_count = ?, is_active = ?, shuffle_questions = ?, show_previous_scores = ?, enable_copy_paste = ?, auto_submit_tab_switch = ? WHERE id = ?`,
           [finalDuration, finalQC, finalActive, finalShuffle, finalShowPrev, finalEnableCopyPaste, finalAutoSubmit, existing[0].id]
         );
      }
    } else {
      // Create new
      await db.query(
        `INSERT INTO exam_configs (department, section, year, semester, subject, time_limit, question_count, is_active, shuffle_questions, show_previous_scores, enable_copy_paste, auto_submit_tab_switch, exam_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [department, section, year, semester, subject, finalDuration, finalQC, finalActive, finalShuffle, finalShowPrev, finalEnableCopyPaste, finalAutoSubmit, formattedDate || null]
      );
    }

    res.json({ message: 'Exam config saved successfully' });
  } catch (error) {
    console.error('Advanced exam config error:', error);
    res.status(500).json({ message: 'Failed to save exam config', error: error.message });
  }
});


// Toggle exam status (Already correct - keeping as-is)
router.post('/exam-config/toggle', authMiddleware, async (req, res) => {
  try {
    const { department, section, year, semester, subject, isActive, examDate } = req.body;
    let formattedDate = null;
    if (examDate) {
      formattedDate = new Date(examDate).toISOString().split('T')[0];
    }

    if (!department || !section || !year || !semester || !subject) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if config exists (including exam_date) with normalized department matching
    const normalizedDept = department.replace(/\s+/g, '').replace('(', '').replace(')', '');
    let existingQuery = `SELECT id FROM exam_configs 
      WHERE REPLACE(REPLACE(REPLACE(department, ' ', ''), '(', ''), ')', '') = ? 
      AND section = ? AND year = ? AND semester = ? AND subject = ?`;
    const existingParams = [normalizedDept, section, year, semester, subject];
    
    if (examDate) {
      existingQuery += ` AND DATE(exam_date) = ?`;
      existingParams.push(formattedDate);
    } else {
      existingQuery += ` AND exam_date IS NULL`;
    }

    const [existing] = await db.query(existingQuery, existingParams);

    if (existing.length > 0) {
      await db.query(
        `UPDATE exam_configs SET is_active = ? WHERE id = ?`,
        [isActive ? 1 : 0, existing[0].id]
      );
    } else {
      // Create config with default time limit
      await db.query(
        `INSERT INTO exam_configs (department, section, year, semester, subject, time_limit, is_active, shuffle_questions, exam_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [department, section, year, semester, subject, 15, isActive ? 1 : 0, 0, formattedDate || null]
      );
    }

    res.json({ message: `Exam ${isActive ? 'enabled' : 'disabled'} successfully` });
  } catch (error) {
    console.error('Toggle exam status error:', error);
    res.status(500).json({ message: 'Failed to toggle exam status', error: error.message });
  }
});

// Toggle shuffle questions status (FIXED: Added formattedDate definition)
router.post('/exam-config/toggle-shuffle', authMiddleware, async (req, res) => {
  try {
    const { department, section, year, semester, subject, shuffleQuestions, examDate } = req.body;

    if (!department || !section || !year || !semester || !subject) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // ✅ FIX: Define formattedDate
    let formattedDate = null;
    if (examDate) {
      formattedDate = new Date(examDate).toISOString().split('T')[0];
    }

    // Check if config exists (including exam_date) with normalized department matching
    const normalizedDept = department.replace(/\s+/g, '').replace('(', '').replace(')', '');
    let existingQuery = `SELECT id FROM exam_configs 
      WHERE REPLACE(REPLACE(REPLACE(department, ' ', ''), '(', ''), ')', '') = ? 
      AND section = ? AND year = ? AND semester = ? AND subject = ?`;
    const existingParams = [normalizedDept, section, year, semester, subject];
    
    if (examDate) {
      existingQuery += ` AND DATE(exam_date) = ?`;
      existingParams.push(formattedDate);
    } else {
      existingQuery += ` AND exam_date IS NULL`;
    }
    const [existing] = await db.query(existingQuery, existingParams);

    if (existing.length > 0) {
      await db.query(
        `UPDATE exam_configs SET shuffle_questions = ? WHERE id = ?`,
        [shuffleQuestions ? 1 : 0, existing[0].id]
      );
    } else {
      // Create config with default values
      await db.query(
        `INSERT INTO exam_configs (department, section, year, semester, subject, time_limit, is_active, shuffle_questions, exam_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [department, section, year, semester, subject, 15, 0, shuffleQuestions ? 1 : 0, formattedDate || null]
      );
    }

    res.json({ message: `Shuffle ${shuffleQuestions ? 'enabled' : 'disabled'} successfully` });
  } catch (error) {
    console.error('Toggle shuffle status error:', error);
    res.status(500).json({ message: 'Failed to toggle shuffle status', error: error.message });
  }
});

async function autoRescoreResponses(responses) {
  if (!Array.isArray(responses) || responses.length === 0) return responses;

  for (const r of responses) {
    if (!r.answers) continue;
    let parsedAnswers = {};
    try {
      parsedAnswers = typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers;
    } catch (_) {
      continue;
    }

    if (!parsedAnswers || typeof parsedAnswers !== 'object' || Object.keys(parsedAnswers).length === 0) {
      continue;
    }

    const qIds = Object.keys(parsedAnswers).map(Number).filter(Number.isFinite);
    if (qIds.length === 0) continue;

    const placeholders = qIds.map(() => '?').join(',');
    const [qRows] = await db.query(
      `SELECT id, correct_option, question_type, correct_answer_index, accepted_answers,
              options, option_a, option_b, option_c, option_d
       FROM questions WHERE id IN (${placeholders})`,
      qIds
    );

    if (!qRows || qRows.length === 0) continue;

    const recalculatedScore = scoreQuestionSet(qRows, parsedAnswers);
    const newTotal = qRows.length;

    if (r.score !== recalculatedScore || r.total_marks !== newTotal) {
      r.score = recalculatedScore;
      r.total_marks = newTotal;
      await db.query('UPDATE responses SET score = ?, total_marks = ? WHERE id = ?', [
        recalculatedScore,
        newTotal,
        r.id,
      ]).catch((err) => console.error('Failed to update response score in DB:', err));
    }
  }

  return responses;
}

// Get responses with duplicate detection (same roll + same subject + same day)
router.get('/responses', authMiddleware, async (req, res) => {
  try {
    let { date, department, section, year, semester, subject } = req.query;

    // Debug logging
    console.log('[GET /responses] Filters received:', { date, department, section, year, semester, subject });

    // SELECT responses without expensive correlated subqueries
    let query = `
      SELECT r.id, r.roll_number, r.name, r.department, r.section, r.subject, 
             r.score, r.total_marks, r.tab_switched, r.submitted_at
      FROM responses r 
      WHERE 1=1
    `;
    const params = [];

    // Helpers to normalize strings for fuzzy filter comparison
    const stripAll = (s) => String(s || '').toLowerCase().replace(/[\s()._\-]/g, '');
    const stripWord = (s, words) => {
      let out = String(s || '').toLowerCase();
      for (const w of words) out = out.replace(new RegExp(w, 'gi'), '');
      return out.replace(/[\s()._\-]/g, '');
    };

    if (date) {
      query += ' AND DATE(r.submitted_at) = ?';
      params.push(date);
    }
    if (department) {
      const normalizedDept = stripAll(department);
      query += ` AND (r.department = ? OR LOWER(REPLACE(r.department, ' ', '')) = ?)`;
      params.push(department, normalizedDept);
    }
    if (section) {
      const normalizedSection = stripWord(section, ['section']);
      query += ` AND r.section IS NOT NULL AND r.section != '' AND (r.section = ? OR LOWER(REPLACE(r.section, ' ', '')) = ?)`;
      params.push(section, normalizedSection);
    }
    if (year) {
      const normalizedYear = stripWord(year, ['year', 'st', 'nd', 'rd', 'th']);
      query += ` AND (r.year = ? OR LOWER(REPLACE(r.year, ' ', '')) = ?)`;
      params.push(year, normalizedYear);
    }
    if (semester) {
      const normalizedSem = stripWord(semester, ['semester', 'sem']);
      query += ` AND (r.semester = ? OR LOWER(REPLACE(r.semester, ' ', '')) = ?)`;
      params.push(semester, normalizedSem);
    }
    if (subject) {
      const normalizedSubject = stripAll(subject);
      query += ` AND (r.subject = ? OR LOWER(REPLACE(r.subject, ' ', '')) = ?)`;
      params.push(subject, normalizedSubject);
    }

    query += ' ORDER BY r.submitted_at DESC';

    const [responses] = await db.query(query, params);

    // Compute duplicates ultra-fast in linear O(N) memory
    const seenSet = new Set();
    const sortedOldest = [...responses].sort((a, b) => a.id - b.id);
    const dupMap = new Map();
    sortedOldest.forEach(r => {
      const dateStr = r.submitted_at ? String(r.submitted_at).split('T')[0] : '';
      const key = `${String(r.roll_number).toLowerCase()}_${String(r.subject).toLowerCase()}_${dateStr}`;
      if (seenSet.has(key)) {
        dupMap.set(r.id, true);
      } else {
        seenSet.add(key);
        dupMap.set(r.id, false);
      }
    });

    const finalResponses = responses.map(r => ({
      ...r,
      is_duplicate: dupMap.get(r.id) ? 1 : 0
    }));

    res.json(finalResponses);
  } catch (error) {
    console.error('Get responses error:', error);
    res.status(500).json({ message: 'Failed to fetch responses' });
  }
});

// Explicit endpoint to rescore all responses
router.post('/responses/rescore', authMiddleware, async (req, res) => {
  try {
    const [responses] = await db.query('SELECT * FROM responses');
    await autoRescoreResponses(responses);
    res.json({ success: true, message: `Successfully rescored ${responses.length} responses.` });
  } catch (error) {
    console.error('Rescore responses error:', error);
    res.status(500).json({ message: 'Failed to rescore responses', error: error.message });
  }
});


// Delete single response
router.delete('/responses/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.admin && req.admin.department && !isSuperDept(req.admin.department)) {
      const dept = req.admin.department.replace(/[\s()]/g, '');
      await db.query(
        `DELETE FROM responses WHERE id = ? AND REPLACE(REPLACE(REPLACE(department,' ',''),'(',''),')','') = ?`,
        [id, dept]
      );
    } else {
      await db.query('DELETE FROM responses WHERE id = ?', [id]);
    }
    res.json({ message: 'Response deleted successfully' });
  } catch (error) {
    console.error('Delete response error:', error);
    res.status(500).json({ message: 'Failed to delete response' });
  }
});

// Delete responses by date
router.delete('/responses/by-date/:date', authMiddleware, async (req, res) => {
  try {
    const { date } = req.params;
    let result;
    if (req.admin && req.admin.department && !isSuperDept(req.admin.department)) {
      const dept = req.admin.department.replace(/[\s()]/g, '');
      [result] = await db.query(
        `DELETE FROM responses WHERE DATE(submitted_at) = ? AND REPLACE(REPLACE(REPLACE(department,' ',''),'(',''),')','') = ?`,
        [date, dept]
      );
    } else {
      [result] = await db.query('DELETE FROM responses WHERE DATE(submitted_at) = ?', [date]);
    }
    res.json({ message: `Deleted ${result.affectedRows} responses` });
  } catch (error) {
    console.error('Delete by date error:', error);
    res.status(500).json({ message: 'Failed to delete responses' });
  }
});

// Get questions & correct answers for a specific response (for admin to review)
router.get('/response-details/:id', authMiddleware, async (req, res) => {
  try {
    const [responses] = await db.query('SELECT * FROM responses WHERE id = ?', [req.params.id]);
    if (responses.length === 0) return res.status(404).json({ message: 'Response not found' });
    // Block dept-scoped admins from reading other depts' responses
    if (req.admin && req.admin.department && !isSuperDept(req.admin.department)) {
      const a = req.admin.department.replace(/[\s()]/g, '').toUpperCase();
      const b = (responses[0].department || '').replace(/[\s()]/g, '').toUpperCase();
      if (a !== b) return res.status(403).json({ message: 'Forbidden' });
    }

    const response = responses[0];
    const normalizedDept = (response.department || '').replace(/\s+/g, '').replace('(', '').replace(')', '');

    let qQuery = `SELECT id, question, option_a, option_b, option_c, option_d, correct_option, image_url 
       FROM questions 
       WHERE REPLACE(REPLACE(REPLACE(department, ' ', ''), '(', ''), ')', '') = ?
       AND section = ? AND year = ? AND semester = ? AND subject = ?`;
    const qParams = [normalizedDept, response.section, response.year, response.semester, response.subject];

    // First try: match by submitted_at date
    const [questions] = await db.query(qQuery + ` AND DATE(exam_date) = DATE(?)`, [...qParams, response.submitted_at]);
    
    // If no questions found, try without date filter
    let finalQuestions = questions;
    if (questions.length === 0) {
      const [fallbackQuestions] = await db.query(qQuery + ` ORDER BY exam_date DESC`, qParams);
      finalQuestions = fallbackQuestions;
    }

    // Parse stored answers
    let studentAnswers = {};
    try {
      studentAnswers = response.answers ? (typeof response.answers === 'string' ? JSON.parse(response.answers) : response.answers) : {};
    } catch (e) {}

    res.json({ response, questions: finalQuestions, studentAnswers });
  } catch (error) {
    console.error('Response details error:', error);
    res.status(500).json({ message: 'Failed to fetch response details' });
  }
});

// Toggle show_previous_scores
router.post('/exam-config/toggle-previous-scores', authMiddleware, async (req, res) => {
  try {
    const { department, section, year, semester, subject, showPreviousScores, examDate } = req.body;

    if (!department || !section || !year || !semester || !subject) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    let formattedDate = null;
    if (examDate) {
      formattedDate = new Date(examDate).toISOString().split('T')[0];
    }

    const normalizedDept = department.replace(/\s+/g, '').replace('(', '').replace(')', '');
    let existingQuery = `SELECT id FROM exam_configs 
      WHERE REPLACE(REPLACE(REPLACE(department, ' ', ''), '(', ''), ')', '') = ? 
      AND section = ? AND year = ? AND semester = ? AND subject = ?`;
    const existingParams = [normalizedDept, section, year, semester, subject];
    
    if (examDate) {
      existingQuery += ` AND DATE(exam_date) = ?`;
      existingParams.push(formattedDate);
    } else {
      existingQuery += ` AND exam_date IS NULL`;
    }

    const [existing] = await db.query(existingQuery, existingParams);

    if (existing.length > 0) {
      await db.query(
        `UPDATE exam_configs SET show_previous_scores = ? WHERE id = ?`,
        [showPreviousScores ? 1 : 0, existing[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO exam_configs (department, section, year, semester, subject, time_limit, is_active, shuffle_questions, show_previous_scores, exam_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [department, section, year, semester, subject, 15, 0, 0, showPreviousScores ? 1 : 0, formattedDate || null]
      );
    }

    res.json({ message: `Previous scores ${showPreviousScores ? 'enabled' : 'disabled'} successfully` });
  } catch (error) {
    console.error('Toggle previous scores error:', error);
    res.status(500).json({ message: 'Failed to toggle previous scores', error: error.message });
  }
});

// Seed sample questions
router.post('/seed-questions', async (req, res) => {
  try {
    const sampleQuestions = [
      { department: 'CSE(AI&ML)', section: 'A', year: '1', semester: '1', subject: 'Programming for Problem Solving', question: 'What is the primary goal of Machine Learning?', option_a: 'To make computers faster', option_b: 'To enable computers to learn from data', option_c: 'To replace humans', option_d: 'To create robots', correct_option: 'B' },
      { department: 'CSE(AI&ML)', section: 'A', year: '1', semester: '1', subject: 'Introduction to AI', question: 'Which is a subfield of AI?', option_a: 'Database', option_b: 'Networking', option_c: 'Machine Learning', option_d: 'Operating System', correct_option: 'C' },
      { department: 'CSE(AI&ML)', section: 'A', year: '1', semester: '2', subject: 'Data Structures', question: 'Which data structure uses FIFO?', option_a: 'Stack', option_b: 'Queue', option_c: 'Array', option_d: 'Tree', correct_option: 'B' },
      { department: 'CSE(AI&ML)', section: 'A', year: '2', semester: '1', subject: 'Machine Learning I', question: 'Which algorithm is used for classification problems?', option_a: 'Linear Regression', option_b: 'K-Means', option_c: 'Decision Tree', option_d: 'PCA', correct_option: 'C' },
      { department: 'CSE(AI&ML)', section: 'B', year: '2', semester: '1', subject: 'Machine Learning I', question: 'What does CNN stand for in Deep Learning?', option_a: 'Computer Neural Network', option_b: 'Convolutional Neural Network', option_c: 'Connected Node Network', option_d: 'Central Nervous Network', correct_option: 'B' },
      { department: 'CSE(DataScience)', section: 'A', year: '2', semester: '2', subject: 'Data Handling Visualization', question: 'What is the purpose of data normalization?', option_a: 'To increase data size', option_b: 'To scale features to a similar range', option_c: 'To delete outliers', option_d: 'To add more features', correct_option: 'B' },
      { department: 'CSE(DataScience)', section: 'A', year: '1', semester: '1', subject: 'Introduction to Data Science', question: 'What is the first step in data analysis?', option_a: 'Model Building', option_b: 'Data Collection', option_c: 'Visualization', option_d: 'Reporting', correct_option: 'B' },
    ];

    let insertedCount = 0;
    for (const q of sampleQuestions) {
      const [existing] = await db.query(
        'SELECT id FROM questions WHERE department = ? AND section = ? AND year = ? AND semester = ? AND subject = ? AND question = ?',
        [q.department, q.section, q.year, q.semester, q.subject, q.question]
      );
      
      if (existing.length === 0) {
        await db.query(
          `INSERT INTO questions (department, section, year, semester, subject, question, option_a, option_b, option_c, option_d, correct_option) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [q.department, q.section, q.year, q.semester, q.subject, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option]
        );
        insertedCount++;
      }
    }

    res.json({ message: `Seeded ${insertedCount} new questions`, total: sampleQuestions.length });
  } catch (error) {
    console.error('Seed questions error:', error);
    res.status(500).json({ message: 'Failed to seed questions', error: error.message });
  }
});

// Get distinct filter values that actually exist in MySQL.
// Optional query: ?source=responses|questions|students (defaults to responses)
// Subjects can be narrowed by department/year/semester.
router.get('/filter-options', authMiddleware, async (req, res) => {
  try {
    const allowed = { responses: 'responses', questions: 'questions', students: 'students' };
    const table = allowed[(req.query.source || 'responses').toLowerCase()] || 'responses';
    const { department, year, semester } = req.query;

    const scope = [];
    const scopeParams = [];
    if (department) { scope.push('department = ?'); scopeParams.push(department); }

    const distinct = async (col, extraWhere = [], extraParams = []) => {
      const whereParts = [...scope, ...extraWhere, `${col} IS NOT NULL`, `${col} <> ''`];
      const sql = `SELECT DISTINCT ${col} AS v FROM ${table} WHERE ${whereParts.join(' AND ')} ORDER BY ${col} ASC`;
      const [rows] = await db.query(sql, [...scopeParams, ...extraParams]);
      return rows.map(r => ({ label: String(r.v), value: String(r.v) }));
    };

    const [departments, sections, years, semesters] = await Promise.all([
      distinct('department'),
      distinct('section'),
      distinct('year'),
      distinct('semester'),
    ]);

    const subjExtra = [];
    const subjParams = [];
    if (year) { subjExtra.push('year = ?'); subjParams.push(year); }
    if (semester) { subjExtra.push('semester = ?'); subjParams.push(semester); }
    const subjects = await distinct('subject', subjExtra, subjParams);

    res.json({ departments, sections, years, semesters, subjects });
  } catch (error) {
    console.error('filter-options error:', error);
    res.status(500).json({ message: 'Failed to fetch filter options', error: error.message });
  }
});

module.exports = router;
