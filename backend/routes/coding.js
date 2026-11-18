/**
 * backend/routes/coding.js
 * Full-stack coding platform router: run-code, submit-code,
 * leaderboard, submission history, and custom-input.
 *
 * Mounted at:  /api/coding
 */
'use strict';
const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');
const authMiddleware = require('../middleware/auth');

const SUPER_DEPTS = ['CSMCSD', 'CS', 'ALL', 'ADMIN', 'SUPERADMIN', 'IT', 'MASTER'];
const isSuperDept = (d) =>
  !!d && SUPER_DEPTS.includes(String(d).replace(/[\s()._-]/g, '').toUpperCase());

// ─────────────────────────────────────────────────────────────────
// CONSTANTS  –  Judge0 CE (official community server, no API key!)
// ─────────────────────────────────────────────────────────────────
const JUDGE0_URL = 'https://ce.judge0.com/submissions?base64_encoded=false&wait=true';

// Judge0 language IDs — https://ce.judge0.com/languages
const LANG_MAP = {
  python : 71,  // Python 3.8.1
  java   : 62,  // Java 13
  cpp    : 54,  // C++ (GCC 9.2)
  c      : 50,  // C (GCC 9.2)
  js     : 63,  // Node.js 12
};

const MAX_CODE_BYTES = 64 * 1024;  // 64 KB code size guard
const CPU_TIME_LIMIT  = 5;         // seconds
const WALL_TIME_LIMIT = 10;        // seconds

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

/** Normalise output for comparison: trim lines, ignore blank lines */
function normalizeLines(text) {
  if (!text) return [];
  return text
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);
}

function outputsMatch(actual, expected) {
  const a = normalizeLines(actual);
  const e = normalizeLines(expected);
  if (a.length !== e.length) return false;
  return a.every((line, i) => line === e[i]);
}

/** Call Judge0 CE community server (no API key needed) */
async function runJudge0(sourceCode, langId, stdin) {
  if (langId === 62) {
    // ── Java Execution: Judge0 CE requires the main class to be 'Main' ──
    // Since the frontend enforces 'public class Solution', we dynamically rename it 
    // to 'public class Main' behind the scenes to satisfy Judge0's compiler requirements.
    sourceCode = sourceCode.replace(/public\s+class\s+[A-Za-z0-9_]+/g, 'public class Main');
  }

  // ── Execute via Judge0 CE ──
  const body = {
    source_code     : sourceCode,
    language_id     : langId,
    stdin           : stdin || '',
    cpu_time_limit  : CPU_TIME_LIMIT,
    wall_time_limit : WALL_TIME_LIMIT,
  };

  const response = await fetch(JUDGE0_URL, {
    method  : 'POST',
    headers : { 'Content-Type': 'application/json' },
    body    : JSON.stringify(body),
    // 30s timeout to prevent hanging student sessions during peak load but allow slow Judge0 instances
    signal  : AbortSignal.timeout(30000), 
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Judge0 CE HTTP ${response.status}: ${text}`);
  }

  const data = await response.json();
  // Judge0 response: { stdout, stderr, compile_output, status: { id, description } }
  return {
    stdout       : (data.stdout || '').trimEnd(),
    stderr       : data.stderr || '',
    compileError : data.compile_output || '',
    statusId     : data.status?.id || 0,
    statusDesc   : data.status?.description || 'Unknown',
  };
}

/** Parse test-case array from question JSON field */
function parseTestCases(questionData, key) {
  const raw = questionData[key];
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

/** Resolve test-cases to run: visible + hidden on submit */
function resolveTestCases(questionData, isSubmit) {
  const visible = parseTestCases(questionData, 'testCases')
    .concat(parseTestCases(questionData, 'cases'))
    // de-dup – prefer testCases over cases if both exist
    .filter((tc, idx, arr) => arr.findIndex(x => x.input === tc.input) === idx);

  const hidden = parseTestCases(questionData, 'hiddenCases')
    .map(tc => ({ ...tc, isHidden: true }));

  const all = isSubmit ? [...visible, ...hidden] : visible;
  return all.length ? all : [{ input: '', output: '' }];
}

// ─────────────────────────────────────────────────────────────────
// 1.  RUN / SUBMIT CODE
//     POST /api/coding/run-code and POST /api/execute
//
//  Body: { code, source_code, language, language_id, questionId, isSubmit=false,
//          studentId?, examId?, customInput?, stdin? }
// ─────────────────────────────────────────────────────────────────

function normalizeRunPayload(body = {}) {
  const normalized = {
    code: body.code || body.source_code || '',
    language: body.language || '',
    questionId: body.questionId || null,
    isSubmit: body.isSubmit || false,
    studentId: body.studentId || null,
    examId: body.examId || null,
    customInput: body.customInput ?? body.stdin ?? null,
  };

  // resolve language string if only language_id is given (legacy support)
  if (!normalized.language && body.language_id) {
    const legacyMap = { 71: 'python', 62: 'java', 54: 'cpp', 50: 'c', 63: 'js' };
    normalized.language = legacyMap[Number(body.language_id)] || '';
  }

  return normalized;
}

async function runCodeHandler(req, res) {
  try {
    const payload = normalizeRunPayload(req.body);
    const { code, language, questionId, isSubmit, customInput, studentId, examId } = payload;

    if (!code || !language) {
      return res.status(400).json({ error: 'code and language are required' });
    }

    if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) {
      return res.status(400).json({ error: 'Code exceeds 64 KB limit.' });
    }

    const lang   = language.toLowerCase();
    const langId = LANG_MAP[lang];
    if (!langId) {
      return res.status(400).json({ error: `Unsupported language: ${language}` });
    }

    // ── Custom / Run mode (no questionId supplied) ──
    if (customInput !== null && customInput !== undefined || !questionId) {
      const data = await runJudge0(code, langId, customInput || '');
      return res.json({
        customMode   : true,
        stdout       : data.stdout       || '',
        stderr       : data.stderr       || '',
        compileError : data.compileError || '',
        time         : '0',
        memory       : '0',
        status       : data.statusDesc,
      });
    }

    // ── Normal test-case mode (requires questionId)
    const [rows] = await db.query(
      'SELECT question FROM questions WHERE id = ?',
      [questionId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Question not found' });
    }

    let questionData = {};
    try { questionData = JSON.parse(rows[0].question); } catch { /**/ }

    const testCases = resolveTestCases(questionData, isSubmit);
    const total     = testCases.length;

    let passed            = 0;
    let score             = 0;
    let totalScore        = 0;
    let isExecutionHalted = false;
    const detailedResults = [];
    let totalTime         = 0;
    let maxMemory         = 0;

    for (let i = 0; i < testCases.length; i++) {
      if (isExecutionHalted) break;

      const tc     = testCases[i];
      const weight = tc.weight || 1;
      totalScore  += weight;

      let data;
      try {
        data = await runJudge0(code, langId, tc.input || '');
      } catch (fetchErr) {
        detailedResults.push({
          testCase      : i + 1,
          status        : 'API Error',
          passed        : false,
          error         : fetchErr.message,
          input         : tc.input  || '',
          expectedOutput: tc.output || '',
          actualOutput  : '',
          isHidden      : !!tc.isHidden,
        });
        isExecutionHalted = true;
        break;
      }

      const compilerError = data.compileError || '';
      const runtimeError  = data.stderr       || '';
      const stdout        = data.stdout        || '';
      const statusId      = data.statusId      || 0;

      // ── Error classification (Judge0 status IDs) ──
      let displayStatus = 'Accepted';
      let currentPass   = false;

      if (statusId === 5) {
        displayStatus     = 'Time Limit Exceeded';
        isExecutionHalted = true;
      } else if (compilerError) {
        displayStatus     = 'Compilation Error';
        isExecutionHalted = true;
      } else if (runtimeError || (statusId > 3 && statusId !== 4)) {
        displayStatus     = 'Runtime Error';
        isExecutionHalted = true;
      } else {
        // ── Strict multi-line normalised comparison ──
        const hasExpected = (tc.output || '').trim().length > 0;
        if (!hasExpected || outputsMatch(stdout, tc.output)) {
          currentPass   = true;
          displayStatus = 'Accepted';
          passed++;
          score += weight;
        } else {
          displayStatus = 'Wrong Answer';
        }
      }

      detailedResults.push({
        testCase      : i + 1,
        status        : displayStatus,
        passed        : currentPass,
        input         : tc.isHidden ? '(hidden)' : (tc.input  || ''),
        expectedOutput: tc.isHidden ? '(hidden)' : (tc.output || ''),
        actualOutput  : tc.isHidden && !currentPass ? '(hidden)' : stdout,
        compileError  : compilerError,
        runtimeError  : runtimeError,
        time          : '0',
        memory        : 0,
        weight,
        isHidden      : !!tc.isHidden,
      });
    }

    const finalResult = (passed === total && !isExecutionHalted)
      ? 'Accepted'
      : (isExecutionHalted
          ? detailedResults[detailedResults.length - 1]?.status || 'Error'
          : 'Wrong Answer');

    return res.json({
      success       : true,
      passed,
      total,
      score,
      totalScore,
      result        : finalResult,
      execTime      : totalTime.toFixed(3).toString(), // Ensure string for consistency
      memory        : maxMemory,
      detailedResults,
    });

  } catch (err) {
    console.error('[coding/run-code]', err);
    return res.status(500).json({ error: err.message });
  }
}

router.post('/run-code', runCodeHandler);
router.post('/execute', runCodeHandler);

// ── POST /api/coding/submissions ──
function evaluateCodeFlow(code = '', language = 'java', questionSubject = '') {
  if (!code || code.trim().length === 0) return 0;
  const lines = code.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 3) return 10;

  let score = 0;
  const lang = String(language).toLowerCase();
  const codeLower = code.toLowerCase();

  if (lang.includes('java')) {
    if (codeLower.includes('class ')) score += 15;
    if (codeLower.includes('extends ') || codeLower.includes('implements ')) score += 10;
    if (codeLower.includes('public static void main') || codeLower.includes('void ') || codeLower.includes('int ')) score += 10;
  } else if (lang.includes('python')) {
    if (codeLower.includes('def ')) score += 15;
    if (codeLower.includes('class ')) score += 10;
    if (codeLower.includes('import ')) score += 10;
  } else {
    if (codeLower.includes('#include') || codeLower.includes('function') || codeLower.includes('class')) score += 15;
    if (codeLower.includes('int main') || codeLower.includes('void ') || codeLower.includes('def')) score += 15;
  }

  if (codeLower.includes('scanner') || codeLower.includes('cin') || codeLower.includes('input(') || codeLower.includes('sys.stdin')) score += 10;
  if (codeLower.includes('system.out.print') || codeLower.includes('cout') || codeLower.includes('print(') || codeLower.includes('console.log')) score += 10;
  if (codeLower.includes('for') || codeLower.includes('while') || codeLower.includes('if')) score += 15;
  
  const subj = (questionSubject || '').toLowerCase();
  if (subj.includes('inheritance') && (codeLower.includes('extends') || codeLower.includes('super'))) score += 15;
  else if (subj.includes('polymorphism') && (codeLower.includes('override') || codeLower.includes('@override') || codeLower.includes('virtual'))) score += 15;
  else if (lines.length >= 15) score += 15;
  else if (lines.length >= 8) score += 10;

  return Math.min(75, Math.max(15, score));
}

// Save submission result after frontend evaluation
router.post('/submissions', async (req, res) => {
  try {
    let { 
      studentId, questionId, examId, code, language, status, 
      passedTestCases, totalTestCases, score, executionTime, memory,
      tabSwitched, stdout, stderr
    } = req.body;

    if (!studentId || !questionId) {
      return res.status(400).json({ error: 'studentId and questionId are required' });
    }

    let finalScore = score || 0;
    if (finalScore < 100 && code) {
      const flowScore = evaluateCodeFlow(code, language, '');
      finalScore = Math.max(finalScore, flowScore);
    }

    // Check for existing best submission for this student/problem/exam
    const isMaster = parseInt(studentId) === 0;
    const [existing] = isMaster ? [[]] : await db.query(
      `SELECT id, score FROM code_submissions 
       WHERE student_id = ? AND question_id = ? AND (exam_id = ? OR (exam_id IS NULL AND ? IS NULL))`,
      [studentId, questionId, examId || null, examId || null]
    );

    if (!isMaster && existing.length > 0) {
      if (finalScore >= existing[0].score) {
        await db.query(
          `UPDATE code_submissions 
           SET code = ?, language = ?, status = ?, 
               passed_test_cases = ?, total_test_cases = ?, 
               score = ?, execution_time = ?, memory = ?, 
               tab_switched = ?, stdout = ?, stderr = ?,
               created_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [
            code, language, status, 
            passedTestCases || 0, totalTestCases || 0, finalScore, 
            executionTime || 0, memory || 0,
            tabSwitched ? 1 : 0,
            stdout || null, stderr || null,
            existing[0].id
          ]
        );
        return res.json({ success: true, updated: true, submissionId: existing[0].id });
      } else {
        return res.json({ success: true, updated: false, message: 'Higher score already exists' });
      }
    }

    // New submission
    const [result] = await db.query(
      `INSERT INTO code_submissions 
        (student_id, question_id, exam_id, code, language, status, 
         passed_test_cases, total_test_cases, score, execution_time, memory, tab_switched, stdout, stderr) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        studentId, questionId, examId || null, code, language, status, 
        passedTestCases || 0, totalTestCases || 0, finalScore, 
        executionTime || 0, memory || 0,
        tabSwitched ? 1 : 0,
        stdout || null, stderr || null
      ]
    );

    res.json({ success: true, submissionId: result.insertId });
  } catch (err) {
    console.error('[coding/submissions/post]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// 2.  SUBMISSION HISTORY
//     GET /api/coding/submissions?studentId=&questionId=
// ─────────────────────────────────────────────────────────────────
router.get('/submissions', async (req, res) => {
  try {
    const { studentId, questionId, examId, limit = 20 } = req.query;
    if (!studentId) return res.status(400).json({ error: 'studentId required' });

    let sql = `SELECT id, question_id, language, status, score, 
                      passed_test_cases, total_test_cases, execution_time, memory, created_at, code
               FROM code_submissions WHERE student_id = ?`;
    const params = [studentId];

    if (questionId) { sql += ' AND question_id = ?'; params.push(questionId); }
    if (examId) { sql += ' AND exam_id = ?'; params.push(examId); }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const [rows] = await db.query(sql, params);
    res.json({ submissions: rows });
  } catch (err) {
    console.error('[coding/submissions/get]', err);
    res.status(500).json({ error: err.message });
  }
});
// 3.  LEADERBOARD
//     GET /api/coding/leaderboard?examId=&limit=50
// ─────────────────────────────────────────────────────────────────
router.get('/leaderboard', async (req, res) => {
  try {
    const { examId, limit = 50 } = req.query;
    const maxLimit = Math.min(parseInt(limit, 10), 200);

    // Enforce department scoping for standard administrators
    let adminDept = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role === 'admin' && decoded.department && !isSuperDept(decoded.department)) {
          adminDept = decoded.department;
        }
      } catch (err) {}
    }

    // Enhanced Ranking logic: 
    // Highest Total Score -> Most Passed Cases -> Fastest Total Execution Time
    let sql = `
      SELECT 
        student_id, 
        s.full_name as name, 
        s.roll_number, 
        s.department,
        SUM(score) as total_score,
        SUM(execution_time) as total_time,
        COUNT(cs.id) as problems_solved,
        MAX(cs.created_at) as last_submitted
      FROM code_submissions cs
      JOIN students s ON (s.id = cs.student_id OR s.roll_number = cs.student_id)
      WHERE 1=1
    `;
    const params = [];

    if (examId && examId !== 'ALL') {
      sql += ' AND cs.exam_id = ?';
      params.push(examId);
    } else {
      sql += ' AND cs.exam_id IS NULL'; // Practice leaderboard
    }

    if (adminDept) {
      sql += ` AND LOWER(REPLACE(REPLACE(REPLACE(s.department, ' ', ''), '(', ''), ')', '')) = ?`;
      params.push(adminDept.replace(/[\s()]/g, '').toLowerCase());
    }

    sql += ' GROUP BY student_id ORDER BY total_score DESC, total_time ASC LIMIT ?';
    params.push(maxLimit);

    const [rows] = await db.query(sql, params);
    const ranked = rows.map((r, i) => ({ rank: i + 1, ...r }));
    res.json({ leaderboard: ranked });
  } catch (err) {
    console.error('[coding/leaderboard]', err);
    res.status(500).json({ error: err.message });
  }
});

let cachedExamQuestions = null;
let lastExamQuestionsCacheTime = 0;

async function getCachedExamQuestions() {
  const now = Date.now();
  if (cachedExamQuestions && (now - lastExamQuestionsCacheTime < 30000)) {
    return cachedExamQuestions;
  }
  const [qRows] = await db.query("SELECT id, department, section, year, semester, question, exam_date FROM questions");
  const examQuestions = [];
  qRows.forEach(q => {
    try {
      const parsed = JSON.parse(q.question);
      if (parsed && parsed.usageType === 'exam') {
        examQuestions.push({
          id: q.id,
          department: q.department,
          section: q.section,
          year: q.year,
          semester: q.semester,
          exam_date: q.exam_date,
          assignedStudents: Array.isArray(parsed.assignedStudents) ? parsed.assignedStudents.map(r => String(r).toUpperCase().trim()) : []
        });
      }
    } catch (e) {}
  });
  cachedExamQuestions = examQuestions;
  lastExamQuestionsCacheTime = now;
  return examQuestions;
}

// ─────────────────────────────────────────────────────────────────
// 4.  ADMIN: ALL SUBMISSIONS
//     GET /api/coding/admin/submissions
// ─────────────────────────────────────────────────────────────────
router.get('/admin/submissions', authMiddleware, async (req, res) => {
  try {
    let { 
      examId, studentId, questionId, status, 
      date, department, year, semester, subject,
      section, language,
      limit = 50 
    } = req.query;

    const adminDept = req.admin && req.admin.department;
    if (adminDept && !isSuperDept(adminDept)) {
      department = adminDept;
    }
    
    const includeCode = req.query.includeCode === 'true';
    let sql = `
      SELECT 
        cs.id, cs.student_id, cs.question_id, cs.exam_id, cs.language, 
        cs.status, cs.score, cs.passed_test_cases, cs.total_test_cases, 
        cs.execution_time, cs.memory, cs.tab_switched, cs.created_at,
        ${includeCode ? 'cs.code,' : ''}
        COALESCE(s.full_name, 'Master Student') as student_name,
        COALESCE(s.roll_number, cs.student_id) as roll_number,
        q.subject as question_subject
      FROM code_submissions cs
      LEFT JOIN students s ON (s.id = cs.student_id OR s.roll_number = cs.student_id)
      LEFT JOIN questions q ON q.id = cs.question_id
      WHERE 1=1
    `;
    const params = [];

    if (examId === 'Practice') {
      sql += ' AND cs.exam_id IS NULL';
    } else if (examId === 'Exams') {
      sql += ' AND cs.exam_id IS NOT NULL';
    } else if (examId && examId !== 'ALL') { 
      sql += ' AND cs.exam_id = ?'; 
      params.push(examId); 
    }
    
    if (studentId) { sql += ' AND cs.student_id = ?'; params.push(studentId); }
    if (questionId) { sql += ' AND cs.question_id = ?'; params.push(questionId); }
    if (status && status !== 'ALL') { sql += ' AND cs.status = ?'; params.push(status); }

    // Normalization helpers for year and semester to match students table
    const normalizeYear = (y) => {
      if (!y) return '';
      return String(y).toLowerCase().replace(/[\s()._\-]/g, '').replace(/year|st|nd|rd|th/g, '');
    };

    const normalizeSemester = (s) => {
      if (!s) return '';
      const clean = String(s).toLowerCase().replace(/[\s()._\-]/g, '').replace(/semester|sem/g, '');
      if (clean === 'i' || clean === '1') return '1';
      if (clean === 'ii' || clean === '2') return '2';
      return clean;
    };

    // Academic Filters (with exam_id fallback matching)
    if (date) {
      sql += ' AND (DATE(cs.created_at) = ? OR cs.exam_id LIKE ?)';
      params.push(date, `${date}%`);
    }
    if (department && department !== 'ALL') {
      const normDept = department.replace(/[\s()]/g, '').toLowerCase();
      sql += ` AND (
        LOWER(REPLACE(REPLACE(REPLACE(s.department, ' ', ''), '(', ''), ')', '')) = ?
        OR LOWER(REPLACE(REPLACE(REPLACE(cs.exam_id, ' ', ''), '(', ''), ')', '')) LIKE ?
      )`;
      params.push(normDept, `%${normDept}%`);
    }
    if (year && year !== 'ALL') {
      const normYr = normalizeYear(year);
      sql += ` AND (
        s.year = ?
        OR cs.exam_id LIKE ?
      )`;
      params.push(normYr, `%_${normYr}_%`);
    }
    if (semester && semester !== 'ALL') {
      const normSem = normalizeSemester(semester);
      sql += ` AND (
        s.semester = ?
        OR cs.exam_id LIKE ?
      )`;
      params.push(normSem, `%_${normSem}`);
    }
    if (subject && subject !== 'ALL') { sql += ' AND q.subject = ?'; params.push(subject); }
    if (section && section !== 'ALL') {
      const normSec = section.replace(/[\s()]/g, '').toLowerCase();
      sql += ` AND (
        LOWER(REPLACE(s.section, ' ', '')) = ?
        OR LOWER(cs.exam_id) LIKE ?
      )`;
      params.push(normSec, `%_${normSec}_%`);
    }
    if (language && language !== 'ALL') { sql += ' AND cs.language = ?'; params.push(language); }

    sql += ' ORDER BY cs.created_at DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const [rows] = await db.query(sql, params);

    // Calculate assigned questions count per student dynamically using cached questions
    try {
      const examQuestions = await getCachedExamQuestions();

      const getAssignedCount = (rollNumber, studentDept, studentSec, studentYear, studentSem, examId) => {
        const roll = rollNumber ? String(rollNumber).toUpperCase().trim() : '';
        const normDept = studentDept ? studentDept.replace(/[\s()]/g, '').toLowerCase() : '';
        const normSec = studentSec ? studentSec.toLowerCase().trim() : '';
        const normYr = studentYear ? String(studentYear).toLowerCase().replace(/[\s()._\-]/g, '').replace(/year|st|nd|rd|th/g, '') : '';
        
        let normSem = '';
        if (studentSem) {
          const clean = String(studentSem).toLowerCase().replace(/[\s()._\-]/g, '').replace(/semester|sem/g, '');
          if (clean === 'i' || clean === '1') normSem = '1';
          else if (clean === 'ii' || clean === '2') normSem = '2';
          else normSem = clean;
        }

        const examDateStr = examId ? examId.split('_')[0] : '';

        return examQuestions.filter(q => {
          if (examDateStr && q.exam_date) {
            const qDate = typeof q.exam_date === 'string' ? q.exam_date : new Date(q.exam_date).toISOString().split('T')[0];
            if (qDate !== examDateStr) return false;
          }

          const qDept = q.department ? q.department.replace(/[\s()]/g, '').toLowerCase() : '';
          if (qDept !== normDept) return false;

          const qSec = q.section ? q.section.toLowerCase().trim() : '';
          if (qSec !== normSec && qSec !== 'all') return false;

          const qYr = q.year ? String(q.year).toLowerCase().replace(/[\s()._\-]/g, '').replace(/year|st|nd|rd|th/g, '') : '';
          if (qYr !== normYr) return false;

          let qSem = '';
          if (q.semester) {
            const clean = String(q.semester).toLowerCase().replace(/[\s()._\-]/g, '').replace(/semester|sem/g, '');
            if (clean === 'i' || clean === '1') qSem = '1';
            else if (clean === 'ii' || clean === '2') qSem = '2';
            else qSem = clean;
          }
          if (qSem !== normSem) return false;

          if (q.assignedStudents.length > 0) {
            if (!roll || !q.assignedStudents.includes(roll)) {
              return false;
            }
          }
          return true;
        }).length;
      };

      const countCache = new Map();
      rows.forEach(row => {
        const cacheKey = `${row.roll_number || ''}_${row.department || ''}_${row.section || ''}_${row.year || ''}_${row.semester || ''}_${row.exam_id || ''}`;
        if (!countCache.has(cacheKey)) {
          countCache.set(cacheKey, getAssignedCount(
            row.roll_number,
            row.department || 'ALL',
            row.section || 'ALL',
            row.year || '2',
            row.semester || '1',
            row.exam_id
          ) || 1);
        }
        row.assigned_questions_count = countCache.get(cacheKey);
      });
    } catch (err) {
      console.error('[coding/admin/submissions] Error calculating assigned counts:', err);
    }

    res.json({ submissions: rows });
  } catch (err) {
    console.error('[coding/admin/submissions]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// 5.  ADMIN: SUBMISSION DETAIL
//     GET /api/coding/admin/submission/:id
// ─────────────────────────────────────────────────────────────────
router.get('/admin/submission/:id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        cs.*, 
        COALESCE(s.full_name, 'Master Student') as student_name, 
        COALESCE(s.roll_number, cs.student_id) as roll_number, 
        s.department
      FROM code_submissions cs
      LEFT JOIN students s ON (s.id = cs.student_id OR s.roll_number = cs.student_id)
      WHERE cs.id = ?
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ error: 'Submission not found' });

    // Block dept-scoped admins from reading other depts' submissions
    if (req.admin && req.admin.department && !isSuperDept(req.admin.department)) {
      const a = req.admin.department.replace(/[\s()]/g, '').toUpperCase();
      const b = (rows[0].department || '').replace(/[\s()]/g, '').toUpperCase();
      if (a !== b) return res.status(403).json({ error: 'Forbidden: You do not have access to submissions from other departments' });
    }

    res.json({ submission: rows[0] });
  } catch (err) {
    console.error('[coding/admin/submission]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN: UPDATE SUBMISSION SCORE (MANUAL GRADING)
// ─────────────────────────────────────────────────────────────────
router.put('/admin/submission/:id/score', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { score } = req.body;

    // Fetch student's department first
    const [subRows] = await db.query(`
      SELECT s.department FROM code_submissions cs
      LEFT JOIN students s ON (s.id = cs.student_id OR s.roll_number = cs.student_id)
      WHERE cs.id = ?
    `, [id]);
    if (!subRows.length) return res.status(404).json({ error: 'Submission not found' });

    if (req.admin && req.admin.department && !isSuperDept(req.admin.department)) {
      const a = req.admin.department.replace(/[\s()]/g, '').toUpperCase();
      const b = (subRows[0].department || '').replace(/[\s()]/g, '').toUpperCase();
      if (a !== b) return res.status(403).json({ error: 'Forbidden: You do not have access to submissions from other departments' });
    }

    await db.query('UPDATE code_submissions SET score = ?, status = ? WHERE id = ?', [score, 'Manual Grade', id]);
    res.json({ success: true, message: 'Score updated manually' });
  } catch (err) {
    console.error('[coding/admin/submission/score/put]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// 6.  PROBLEM LIST
//     GET /api/coding/problems?department=&year=&semester=
// ─────────────────────────────────────────────────────────────────
router.get('/problems', async (req, res) => {
  try {
    let { department, year, semester, usageType } = req.query;
    const params = [];
    let sql = `SELECT id, department, section, year, semester, subject, question
               FROM questions WHERE 1=1`;

    if (department) {
      sql += ` AND REPLACE(REPLACE(REPLACE(department,' ',''),'(',''),')','') = ?`;
      params.push(department.replace(/[\s()]/g, ''));
    }
    if (year)     { sql += ' AND year = ?';     params.push(year);     }
    if (semester) { sql += ' AND semester = ?'; params.push(semester); }

    const [rows] = await db.query(sql, params);

    const problems = rows
      .map(r => {
        try {
          const p = JSON.parse(r.question);
          if (usageType && p.usageType !== usageType) return null;
          return {
            id         : r.id,
            title      : p.title      || '(Untitled)',
            difficulty : p.difficulty || 'Medium',
            usageType  : p.usageType  || 'practice',
            department : r.department,
            year       : r.year,
            semester   : r.semester,
          };
        } catch { return null; }
      })
      .filter(Boolean);

    res.json({ problems });
  } catch (err) {
    console.error('[coding/problems]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// 7.  ADMIN STATS
// ─────────────────────────────────────────────────────────────────
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const adminDept = req.admin && req.admin.department;
    let totalSql = 'SELECT COUNT(*) AS total FROM code_submissions';
    let acceptedSql = "SELECT COUNT(*) AS accepted FROM code_submissions WHERE status='Accepted'";
    let studentsSql = 'SELECT COUNT(DISTINCT student_id) AS students FROM code_submissions';
    const params = [];

    if (adminDept && !isSuperDept(adminDept)) {
      const normalizedDept = adminDept.replace(/[\s()]/g, '');
      totalSql = `
        SELECT COUNT(*) AS total FROM code_submissions cs
        LEFT JOIN students s ON (s.id = cs.student_id OR s.roll_number = cs.student_id)
        WHERE REPLACE(REPLACE(REPLACE(s.department, ' ', ''), '(', ''), ')', '') = ?
      `;
      acceptedSql = `
        SELECT COUNT(*) AS accepted FROM code_submissions cs
        LEFT JOIN students s ON (s.id = cs.student_id OR s.roll_number = cs.student_id)
        WHERE cs.status='Accepted' 
        AND REPLACE(REPLACE(REPLACE(s.department, ' ', ''), '(', ''), ')', '') = ?
      `;
      studentsSql = `
        SELECT COUNT(DISTINCT cs.student_id) AS students FROM code_submissions cs
        LEFT JOIN students s ON (s.id = cs.student_id OR s.roll_number = cs.student_id)
        WHERE REPLACE(REPLACE(REPLACE(s.department, ' ', ''), '(', ''), ')', '') = ?
      `;
      params.push(normalizedDept);
    }

    const [[{ total }]]   = await db.query(totalSql, params);
    const [[{ accepted }]]= await db.query(acceptedSql, params);
    const [[{ students }]]= await db.query(studentsSql, params);

    res.json({
      total_submissions : total,
      accepted_count    : accepted,
      success_rate      : total > 0 ? ((accepted / total) * 100).toFixed(1) : '0',
      active_students   : students,
    });
  } catch (err) {
    console.error('[coding/stats]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// 8.  GLOBAL CODING PRACTICE QUESTIONS
// ─────────────────────────────────────────────────────────────────

// POST /api/coding/practice/questions -> Save question
router.post('/practice/questions', async (req, res) => {
  try {
    const { 
      title, description, difficulty, topic, 
      input_format, output_format, visible_test_cases, hidden_test_cases 
    } = req.body;

    if (!title || !description || !difficulty || !topic) {
      return res.status(400).json({ error: 'title, description, difficulty, and topic are required' });
    }

    const [result] = await db.query(
      `INSERT INTO coding_practice_questions 
        (title, description, difficulty, topic, input_format, output_format, visible_test_cases, hidden_test_cases) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title, description, difficulty, topic, 
        input_format || '', output_format || '', 
        JSON.stringify(visible_test_cases || []), 
        JSON.stringify(hidden_test_cases || [])
      ]
    );

    res.json({ success: true, id: result.insertId, message: 'Practice question added successfully' });
  } catch (err) {
    console.error('[coding/practice/questions/post]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/coding/practice/topics?difficulty=Easy -> Fetch unique topics
router.get('/practice/topics', async (req, res) => {
  try {
    const { difficulty } = req.query;
    if (!difficulty) return res.status(400).json({ error: 'difficulty is required' });

    const [rows] = await db.query(
      'SELECT DISTINCT topic FROM coding_practice_questions WHERE difficulty = ? AND is_deleted = FALSE ORDER BY topic ASC',
      [difficulty]
    );

    const topics = rows.map(r => r.topic);
    res.json(topics);
  } catch (err) {
    console.error('[coding/practice/topics/get]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/coding/practice/questions?difficulty=&topic= -> Fetch filtered
router.get('/practice/questions', async (req, res) => {
  try {
    const { difficulty, topic } = req.query;
    
    let sql = 'SELECT * FROM coding_practice_questions WHERE is_deleted = FALSE';
    const params = [];

    if (difficulty) {
      sql += ' AND difficulty = ?';
      params.push(difficulty);
    }
    if (topic) {
      sql += ' AND topic = ?';
      params.push(topic);
    }

    // If both specified, return ONLY the first one (no randomization)
    if (difficulty && topic) {
      sql += ' ORDER BY id ASC LIMIT 1';
    } else {
      sql += ' ORDER BY created_at DESC';
    }

    const [rows] = await db.query(sql, params);
    
    if (rows.length === 0 && difficulty && topic) {
      return res.json({ data: [], message: 'No questions available' });
    }

    const formatted = rows.map(r => ({
      ...r,
      visible_test_cases: typeof r.visible_test_cases === 'string' ? JSON.parse(r.visible_test_cases) : r.visible_test_cases,
      hidden_test_cases: typeof r.hidden_test_cases === 'string' ? JSON.parse(r.hidden_test_cases) : r.hidden_test_cases
    }));

    // Backwards compatibility for Admin list (questions) vs Student strict (data)
    res.json({ questions: formatted, data: formatted });
  } catch (err) {
    console.error('[coding/practice/questions/get]', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/coding/practice/questions/:id -> Update question
router.put('/practice/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, description, difficulty, topic, 
      input_format, output_format, visible_test_cases, hidden_test_cases 
    } = req.body;

    if (!title || !description || !difficulty || !topic) {
      return res.status(400).json({ error: 'title, description, difficulty, and topic are required' });
    }

    await db.query(
      `UPDATE coding_practice_questions 
       SET title = ?, description = ?, difficulty = ?, topic = ?, 
           input_format = ?, output_format = ?, 
           visible_test_cases = ?, hidden_test_cases = ?
       WHERE id = ?`,
      [
        title, description, difficulty, topic, 
        input_format || '', output_format || '', 
        JSON.stringify(visible_test_cases || []), 
        JSON.stringify(hidden_test_cases || []),
        id
      ]
    );

    res.json({ success: true, message: 'Practice question updated successfully' });
  } catch (err) {
    console.error('[coding/practice/questions/put]', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/coding/practice/questions/:id -> Delete question
router.delete('/practice/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Optional Safety Check: Is it in use?
    // We'll check if there are any submissions for this question in the last 30 minutes
    const [activeSubmissions] = await db.query(
      'SELECT id FROM code_submissions WHERE question_id = ? AND created_at > NOW() - INTERVAL 30 MINUTE LIMIT 1',
      [id]
    );

    if (activeSubmissions.length > 0) {
      return res.status(400).json({ 
        error: "Cannot delete question: It has been recently submitted by a student and may be part of an active session." 
      });
    }

    // SOFT DELETE
    await db.query('UPDATE coding_practice_questions SET is_deleted = TRUE WHERE id = ?', [id]);
    res.json({ success: true, message: 'Practice question deleted successfully (Soft Delete)' });
  } catch (err) {
    console.error('[coding/practice/questions/delete]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// 9.  ANALYTICS: STUDENT
// ─────────────────────────────────────────────────────────────────
router.get('/analytics/student', async (req, res) => {
  try {
    const { studentId } = req.query;
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    // 1. Coding Practice stats
    const [[{ practiceTotal }]] = await db.query(
      'SELECT COUNT(*) as practiceTotal FROM coding_practice_questions WHERE is_deleted = FALSE'
    );
    const [[practiceExecuted]] = await db.query(
      `SELECT COUNT(DISTINCT question_id) as executed, 
              COUNT(CASE WHEN status = 'Accepted' THEN 1 END) as passed,
              COUNT(*) as totalSubmissions
       FROM code_submissions WHERE student_id = ? AND exam_id IS NULL`,
      [studentId]
    );

    // 2. Coding Exams stats
    // Note: Available exams is an estimate based on all "exam" type questions
    const [[{ examTotal }]] = await db.query(
      "SELECT COUNT(*) as examTotal FROM questions WHERE JSON_VALID(question) AND JSON_EXTRACT(question, '$.usageType') = 'exam'"
    );
    const [[examExecuted]] = await db.query(
      `SELECT COUNT(DISTINCT question_id) as executed, 
              COUNT(CASE WHEN status = 'Accepted' THEN 1 END) as passed,
              COUNT(*) as totalSubmissions
       FROM code_submissions WHERE student_id = ? AND exam_id IS NOT NULL`,
      [studentId]
    );

    // 3. Performance Trend (last 10 submissions)
    const [trend] = await db.query(
      `SELECT created_at as date, score FROM code_submissions 
       WHERE student_id = ? ORDER BY created_at DESC LIMIT 10`,
      [studentId]
    );

    res.json({
      practice: {
        executed: practiceExecuted.executed || 0,
        available: practiceTotal || 0,
        passRate: practiceExecuted.totalSubmissions > 0 
          ? ((practiceExecuted.passed / practiceExecuted.totalSubmissions) * 100).toFixed(1) 
          : 0
      },
      exams: {
        executed: examExecuted.executed || 0,
        available: examTotal || 0,
        passRate: examExecuted.totalSubmissions > 0 
          ? ((examExecuted.passed / examExecuted.totalSubmissions) * 100).toFixed(1) 
          : 0
      },
      stats: {
        totalExams: examExecuted.executed || 0,
        avgScore: practiceExecuted.totalSubmissions > 0 ? 85 : 0, // mock fallback
        accuracy: examExecuted.totalSubmissions > 0 
          ? ((examExecuted.passed / examExecuted.totalSubmissions) * 100).toFixed(0) 
          : 0
      },
      performanceTrend: trend.reverse(),
      topics: [] // Placeholder for future topic-wise analysis
    });
  } catch (err) {
    console.error('[coding/analytics/student]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/coding/analytics/exam/:examId -> Admin Analytics
router.get('/analytics/exam/:examId', authMiddleware, async (req, res) => {
  try {
    const { examId } = req.params;
    const adminDept = req.admin && req.admin.department;
    const params = [examId];
    let deptFilter = '';
    if (adminDept && !isSuperDept(adminDept)) {
      deptFilter = ` AND LOWER(REPLACE(REPLACE(REPLACE(s.department, ' ', ''), '(', ''), ')', '')) = ?`;
      params.push(adminDept.replace(/[\s()]/g, '').toLowerCase());
    }
    
    // Summary
    const [[summary]] = await db.query(
      `SELECT 
        COUNT(DISTINCT cs.student_id) as participants,
        AVG(cs.score) as avgScore,
        COUNT(CASE WHEN cs.status = 'Accepted' THEN 1 END) as passed,
        COUNT(*) as total
       FROM code_submissions cs
       LEFT JOIN students s ON (s.id = cs.student_id OR s.roll_number = cs.student_id)
       WHERE cs.exam_id = ?` + deptFilter,
      params
    );

    // Score distribution
    const [scores] = await db.query(
      `SELECT cs.score, COUNT(*) as count FROM code_submissions cs
       LEFT JOIN students s ON (s.id = cs.student_id OR s.roll_number = cs.student_id)
       WHERE cs.exam_id = ?` + deptFilter + ` GROUP BY cs.score ORDER BY cs.score ASC`,
      params
    );

    res.json({
      summary: {
        participants: summary.participants || 0,
        avgScore: parseFloat(summary.avgScore || 0).toFixed(1),
        successRate: summary.total > 0 ? ((summary.passed / summary.total) * 100).toFixed(1) : 0
      },
      distribution: scores.map(s => ({ range: `${s.score}`, count: s.count })),
      passFail: [
        { name: 'Passed', value: summary.passed || 0 },
        { name: 'Failed', value: (summary.total || 0) - (summary.passed || 0) }
      ]
    });
  } catch (err) {
    console.error('[coding/analytics/exam]', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/coding/admin/submission/:id -> Admin: Delete submission
router.delete('/admin/submission/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch student's department first
    const [subRows] = await db.query(`
      SELECT s.department FROM code_submissions cs
      LEFT JOIN students s ON (s.id = cs.student_id OR s.roll_number = cs.student_id)
      WHERE cs.id = ?
    `, [id]);
    if (!subRows.length) return res.status(404).json({ error: 'Submission not found' });

    if (req.admin && req.admin.department && !isSuperDept(req.admin.department)) {
      const a = req.admin.department.replace(/[\s()]/g, '').toUpperCase();
      const b = (subRows[0].department || '').replace(/[\s()]/g, '').toUpperCase();
      if (a !== b) return res.status(403).json({ error: 'Forbidden: You do not have access to submissions from other departments' });
    }

    await db.query('DELETE FROM code_submissions WHERE id = ?', [id]);
    res.json({ success: true, message: 'Submission deleted successfully' });
  } catch (err) {
    console.error('[coding/admin/submission/delete]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, runCodeHandler };
