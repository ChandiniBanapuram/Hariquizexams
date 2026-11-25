// Updated: 2026-07-30 - Exam Scoring & Isolated Student Responses
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isMasterRoll } = require('../utils/masterStudent');
const { scoreQuestionSet } = require('../utils/quizScoring');

// Normalize any incoming exam date ("2026-08-13", ISO datetime, Date) to YYYY-MM-DD
const normDate = (d) => {
  if (!d) return null;
  const s = d.toString().trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const dt = new Date(s);
  if (isNaN(dt.getTime())) return null;
  const ist = new Date(dt.getTime() + (5.5 * 3600 * 1000));
  return ist.toISOString().slice(0, 10);
};

// Generates candidate date strings (handles direct YYYY-MM-DD, UTC ISO, and IST offsets)
const getExamDateCandidates = (d) => {
  if (!d) return [];
  const s = d.toString().trim();
  const set = new Set();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) set.add(m[1]);
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    set.add(dt.toISOString().slice(0, 10));
    const ist = new Date(dt.getTime() + (5.5 * 3600 * 1000));
    set.add(ist.toISOString().slice(0, 10));
  }
  return Array.from(set);
};


// Base route for health check
router.get('/', (req, res) => {
  res.json({ status: 'Student API is running', timestamp: new Date().toISOString() });
});

// Check duplicate attempt - STRICT: only one attempt per EXACT exam (subject + exam date)
router.get('/check-attempt', async (req, res) => {
  try {
    const { rollNumber, department, section, year, semester, subject, examDate } = req.query;

    // Master student can attempt every exam any number of times.
    if (isMasterRoll(rollNumber)) {
      return res.json({ isDuplicate: false, attemptCount: 0 });
    }

    if (!rollNumber || !department || !section) {
      return res.json({ isDuplicate: false, attemptCount: 0 });
    }

    const normDept = (department || '').toString().replace(/\s+/g, '').replace('(', '').replace(')', '');
    const rawSection = (section || '').toString();

    let sql = `SELECT id FROM responses 
       WHERE roll_number = ? 
       AND REPLACE(REPLACE(REPLACE(department, ' ', ''), '(', ''), ')', '') = ?
       AND (REPLACE(section, 'Section ', '') = REPLACE(?, 'Section ', '') OR section = 'ALL' OR ? = 'ALL')
       AND year = ?
       AND semester = ?
       AND subject = ?`;
    const params = [rollNumber, normDept, rawSection, rawSection, year || '1', semester || '1', subject || ''];

    const dateCandidates = getExamDateCandidates(examDate);
    if (dateCandidates.length > 0) {
      sql += ` AND (
        (exam_date IS NOT NULL AND (DATE(exam_date) IN (?) OR CAST(exam_date AS CHAR) IN (?)))
        OR (DATE(submitted_at) IN (?) OR DATE(submitted_at) = DATE(?))
      )`;
      params.push(dateCandidates, dateCandidates, dateCandidates, dateCandidates[0]);
    } else {
      const today = normDate(new Date());
      sql += ` AND (DATE(submitted_at) = ? OR (exam_date IS NOT NULL AND DATE(exam_date) = ?))`;
      params.push(today, today);
    }

    const [rows] = await db.query(sql, params);

    res.json({ isDuplicate: rows.length > 0, attemptCount: rows.length });
  } catch (error) {
    console.error('Check attempt error:', error);
    res.json({ isDuplicate: false, attemptCount: 0 });
  }
});

// Get exam config for students (to check if exam is active and get time limit)
router.get('/exam-config', async (req, res) => {
  try {
    let { department, section, year, semester, subject, examDate } = req.query;

    const normDept = department?.replace(/\s+/g, '').replace('(', '').replace(')', '');
    const rawSection = section || '';

    let query = `SELECT * FROM exam_configs
       WHERE REPLACE(REPLACE(REPLACE(department, ' ', ''), '(', ''), ')', '') = ?
       AND (REPLACE(section, 'Section ', '') = REPLACE(?, 'Section ', '') OR section = 'ALL' OR ? = 'ALL')
       AND year = ?
       AND semester = ?
       AND subject = ?`;
    const params = [normDept, rawSection, rawSection, year || '1', semester || '1', subject || ''];

    // Add date filter if provided
    const dateCandidates = getExamDateCandidates(examDate);
    if (dateCandidates.length > 0) {
      query += ` AND (DATE(exam_date) IN (?) OR CAST(exam_date AS CHAR) IN (?) OR exam_date IN (?))`;
      params.push(dateCandidates, dateCandidates, dateCandidates);
    }

    let [rows] = await db.query(query, params);

    // Fallback without date filter if not found
    if (rows.length === 0 && dateCandidates.length > 0) {
      const [fallbackRows] = await db.query(
        `SELECT * FROM exam_configs
         WHERE REPLACE(REPLACE(REPLACE(department, ' ', ''), '(', ''), ')', '') = ?
         AND (REPLACE(section, 'Section ', '') = REPLACE(?, 'Section ', '') OR section = 'ALL' OR ? = 'ALL')
         AND year = ?
         AND semester = ?
         AND subject = ?
         ORDER BY id DESC LIMIT 1`,
        [normDept, rawSection, rawSection, year || '1', semester || '1', subject || '']
      );
      if (fallbackRows.length > 0) rows = fallbackRows;
    }

    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      // Return default config if not found (exam not configured = not active)
      res.json({ is_active: false, time_limit: 15 });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch exam config' });
  }
});

// Get questions for student (including image_url) - with shuffle support
router.get('/questions', async (req, res) => {
  let { department, section, year, semester, subject, examDate } = req.query;

  const normDept = department?.replace(/\s+/g, '').replace('(', '').replace(')', '');
  const rawSection = section || '';
  const dateCandidates = getExamDateCandidates(examDate);

  try {
    // Check if shuffle is enabled for this exam config
    let configQuery = `SELECT shuffle_questions FROM exam_configs
       WHERE REPLACE(REPLACE(REPLACE(department, ' ', ''), '(', ''), ')', '') = ?
       AND (REPLACE(section, 'Section ', '') = REPLACE(?, 'Section ', '') OR section = 'ALL' OR ? = 'ALL')
       AND year = ?
       AND semester = ?`;
    const configParams = [normDept, rawSection, rawSection, year || '1', semester || '1'];

    if (subject) {
      configQuery += ` AND subject = ?`;
      configParams.push(subject);
    }

    if (dateCandidates.length > 0) {
      configQuery += ` AND (DATE(exam_date) IN (?) OR CAST(exam_date AS CHAR) IN (?) OR exam_date IN (?))`;
      configParams.push(dateCandidates, dateCandidates, dateCandidates);
    }

    const [configRows] = await db.query(configQuery, configParams);
    const shouldShuffle = configRows.length > 0 && configRows[0].shuffle_questions === 1;

    let questionsQuery = `SELECT id, department, section, year, semester, subject, question,
       option_a, option_b, option_c, option_d, correct_option, image_url,
       question_type, options, correct_answer_index, accepted_answers
       FROM questions
       WHERE REPLACE(REPLACE(REPLACE(department, ' ', ''), '(', ''), ')', '') = ?
       AND (REPLACE(section, 'Section ', '') = REPLACE(?, 'Section ', '') OR section = 'ALL' OR ? = 'ALL')
       AND year = ?
       AND semester = ?`;
    const questionParams = [normDept, rawSection, rawSection, year || '1', semester || '1'];

    if (subject) {
      questionsQuery += ` AND subject = ?`;
      questionParams.push(subject);
    }

    // Filter by exam date if provided
    if (dateCandidates.length > 0) {
      questionsQuery += ` AND (DATE(exam_date) IN (?) OR CAST(exam_date AS CHAR) IN (?) OR exam_date IN (?))`;
      questionParams.push(dateCandidates, dateCandidates, dateCandidates);
    }

    let [rows] = await db.query(questionsQuery, questionParams);

    // Fallback: If date-specific search yielded 0 questions, query without date filter
    if (rows.length === 0 && dateCandidates.length > 0) {
      console.log(`[questions] Fallback to subject-level questions for ${subject} (${normDept}, ${rawSection})`);
      const fallbackQuery = `SELECT id, department, section, year, semester, subject, question,
         option_a, option_b, option_c, option_d, correct_option, image_url,
         question_type, options, correct_answer_index, accepted_answers
         FROM questions
         WHERE REPLACE(REPLACE(REPLACE(department, ' ', ''), '(', ''), ')', '') = ?
         AND (REPLACE(section, 'Section ', '') = REPLACE(?, 'Section ', '') OR section = 'ALL' OR ? = 'ALL')
         AND year = ?
         AND semester = ?
         AND subject = ?`;
      const [fallbackRows] = await db.query(fallbackQuery, [normDept, rawSection, rawSection, year || '1', semester || '1', subject]);
      if (fallbackRows.length > 0) {
        rows = fallbackRows;
      }
    }

    // Hydrate: parse JSON, fill options[] from legacy option_a..d, drop correct_option for security
    for (const q of rows) {
      if (typeof q.options === 'string') { try { q.options = JSON.parse(q.options); } catch { q.options = null; } }
      if (typeof q.accepted_answers === 'string') { try { q.accepted_answers = JSON.parse(q.accepted_answers); } catch { q.accepted_answers = null; } }
      if ((!q.options || !q.options.length) && (q.option_a || q.option_b || q.option_c || q.option_d)) {
        q.options = [q.option_a, q.option_b, q.option_c, q.option_d].map(v => v == null ? '' : String(v));
      }
      if (!q.question_type) q.question_type = 'mcq';
      // Never leak the correct answer to students
      delete q.correct_option;
      delete q.correct_answer_index;
      delete q.accepted_answers;
    }

    // Shuffle questions if enabled (Fisher-Yates algorithm)
    if (shouldShuffle && rows.length > 1) {
      for (let i = rows.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rows[i], rows[j]] = [rows[j], rows[i]];
      }
    }

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch questions' });
  }
});

// Get practice/exam questions directly by extracting their JSON usageType
// STRICT section-aware filtering at SQL level
router.get('/coding-questions', async (req, res) => {
  try {
    const { type, department, section, year, semester, subject, examDate } = req.query;

    const norm = (v) => String(v || '').replace(/\s+/g, '').replace(/\(/g, '').replace(/\)/g, '').toLowerCase();

    const params = [];
    let sql = `SELECT * FROM questions WHERE section IS NOT NULL AND section <> ''`;

    if (department && department.toUpperCase() !== 'ALL') {
      sql += ` AND LOWER(REPLACE(REPLACE(REPLACE(department,' ',''),'(',''),')','')) = ?`;
      params.push(norm(department));
    }
    if (section && section.toUpperCase() !== 'ALL')  { sql += ` AND LOWER(REPLACE(section,' ','')) = ?`;  params.push(norm(section)); }
    if (year && year.toUpperCase() !== 'ALL')     { sql += ` AND LOWER(REPLACE(year,' ',''))    = ?`;  params.push(norm(year)); }
    if (semester && semester.toUpperCase() !== 'ALL') { sql += ` AND LOWER(REPLACE(semester,' ','')) = ?`; params.push(norm(semester)); }
    if (subject)  { sql += ` AND subject = ?`;                          params.push(subject); }
    if (examDate) { sql += ` AND DATE(exam_date) = ?`;                  params.push(examDate); }

    console.log('[coding-questions] filter:', { type, department, section, year, semester, subject, examDate });

    const [rows] = await db.query(sql, params);

    const filteredQs = rows.filter(q => {
      try {
        const parsed = JSON.parse(q.question);
        return !type || parsed.usageType === type;
      } catch (err) {
        return false;
      }
    });

    console.log(`[coding-questions] returned=${filteredQs.length} (raw=${rows.length}) section=${section || 'ANY'}`);

    res.json(filteredQs);
  } catch (err) {
    console.error('coding practice questions query error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Run Code and Auto Evaluate Test Cases via Judge0 API
router.post('/run-code', async (req, res) => {
  try {
    const { code, language, questionId, isSubmit } = req.body;

    if (!questionId || !code || !language) {
      return res.status(400).json({ error: "Missing required parameters: code, language, questionId" });
    }

    // 1. Get test cases from DB
    const [rows] = await db.query(
      "SELECT question FROM questions WHERE id = ?",
      [questionId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Question context not found in database." });
    }

    let questionData = {};
    try {
      questionData = JSON.parse(rows[0].question);
    } catch (e) {
      console.warn("Could not structure question json payload.");
    }

    // Parse visible testCases
    let testCases = [];
    if (Array.isArray(questionData.testCases)) testCases = questionData.testCases;
    else if (Array.isArray(questionData.cases)) testCases = questionData.cases;
    else if (typeof questionData.testCases === 'string' && questionData.testCases.startsWith('[')) {
      try { testCases = JSON.parse(questionData.testCases); } catch (e) { }
    } else if (typeof questionData.cases === 'string' && questionData.cases.startsWith('[')) {
      try { testCases = JSON.parse(questionData.cases); } catch (e) { }
    }

    // Parse hidden testCases
    let hiddenCases = [];
    if (Array.isArray(questionData.hiddenCases)) hiddenCases = questionData.hiddenCases;
    else if (typeof questionData.hiddenCases === 'string' && questionData.hiddenCases.startsWith('[')) {
      try { hiddenCases = JSON.parse(questionData.hiddenCases); } catch (e) { }
    }

    // If it's a real submission, evaluate BOTH visible and hidden tests
    if (isSubmit === true && hiddenCases.length > 0) {
      testCases = testCases.concat(hiddenCases.map(hc => ({ ...hc, isHidden: true })));
    } else if (isSubmit === false && testCases.length > 3) {
      // If it's just a run, and there are many visible test cases, they might want to only run the first 2-3.
      // But let's just run all explicitly defined visible ones for 'Run Code'. The user can define hidden.
    }

    // Default to at least one run if missing
    if (testCases.length === 0) {
      testCases = [{ input: "", output: "" }];
    }

    const languageMap = {
      python: 71, // python 3.8.1
      java: 62, // java 13.0.1
      cpp: 54, // cpp 17
      c: 50 // gcc 9.2.0
    };

    const langId = languageMap[language.toLowerCase()] || 71;

    let passed = 0;
    let total = testCases.length;
    let detailedResults = [];
    let isExecutionHalted = false;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const response = await fetch(
        "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true",
        {
          method: 'POST',
          headers: {
            "Content-Type": "application/json",
            "X-RapidAPI-Key": process.env.JUDGE0_API_KEY || "87ac070c9dmsha6adab0e3719b04p1aa794jsn03cbeba309b6",
            "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com"
          },
          body: JSON.stringify({
            source_code: code,
            language_id: langId,
            stdin: tc.input || "",
            expected_output: tc.output || "",
            cpu_time_limit: 2,
            wall_time_limit: 5
          })
        }
      );

      const data = await response.json();

      if (data.error || data.message) {
        detailedResults.push({
          testCase: i + 1,
          status: "API Error",
          error: data.message || data.error,
          input: tc.input || "",
          expectedOutput: tc.output || "",
          passed: false
        });
        isExecutionHalted = true;
        break; // Stop early if API configuration error
      }

      // Check status from Judge0
      const statusId = data.status ? data.status.id : null;
      const statusDescription = data.status ? data.status.description : "Unknown Error";

      let outString = data.stdout || "";
      let compilerError = data.compile_output || "";
      let runtimeError = data.stderr || "";

      // Check for Timeout
      if (statusId === 5) {
        runtimeError = "Time Limit Exceeded";
      }

      let currentPass = false;
      let displayStatus = "Running";
      let errorDetail = "";

      if (compilerError) {
        displayStatus = "Compilation Error";
        currentPass = false;
        isExecutionHalted = true;
        errorDetail = compilerError;
      } else if (runtimeError) {
        displayStatus = "Runtime Error";
        currentPass = false;
        isExecutionHalted = true;
        errorDetail = runtimeError;
      } else {
        // Normal execution -> MULTILINE NORMALIZATION
        function normalizeLines(text) {
          if (!text) return [];
          return text.trim().split("\n").map(line => line.trim());
        }

        const actualLines = normalizeLines(outString);
        const expectedLines = normalizeLines(tc.output || "");

        const isEqual =
          actualLines.length === expectedLines.length &&
          actualLines.every((line, idx) => line === expectedLines[idx]);

        if (isEqual || (!tc.output || tc.output.trim() === '')) {
          // Accept if output exactly matches expected, OR if no explicit expected output was given.
          currentPass = true;
          displayStatus = "Accepted";
          passed++;
        } else {
          currentPass = false;
          displayStatus = "Wrong Answer";
        }
      }

      detailedResults.push({
        testCase: i + 1,
        status: displayStatus,
        passed: currentPass,
        input: tc.input || "",
        expectedOutput: tc.output || "",
        actualOutput: outString,
        compileError: compilerError,
        runtimeError: runtimeError,
        time: data.time || "0",
        memory: data.memory || "0"
      });

      // Stop on compilation error
      if (isExecutionHalted) {
        break;
      }
    }

    let finalResult = "Accepted";
    if (isExecutionHalted) {
      finalResult = detailedResults[detailedResults.length - 1].status;
    } else if (passed !== total) {
      finalResult = "Wrong Answer";
    }

    res.json({
      success: true,
      passed,
      total,
      result: finalResult,
      detailedResults
    });

  } catch (err) {
    console.error('Judge0 compilation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Submit exam - STRICT: 1 attempt per subject per day
router.post('/submit-exam', async (req, res) => {
  try {
    const { rollNumber, name, department, section, year, semester, subject, examDate, answers, tabSwitched } = req.body;

    if (!rollNumber || !name || !department || !section) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Block duplicate attempts for THIS EXACT exam only (master student is exempt)
    if (!isMasterRoll(rollNumber)) {
      const dupDept = (department || '').toString().replace(/\s+/g, '').replace('(', '').replace(')', '');
      const rawSection = (section || '').toString();
      let dupSql = `SELECT id FROM responses 
         WHERE roll_number = ? 
         AND REPLACE(REPLACE(REPLACE(department, ' ', ''), '(', ''), ')', '') = ?
         AND (REPLACE(section, 'Section ', '') = REPLACE(?, 'Section ', '') OR section = 'ALL' OR ? = 'ALL')
         AND year = ? AND semester = ? AND subject = ?`;
      const dupParams = [rollNumber, dupDept, rawSection, rawSection, year || '1', semester || '1', subject || ''];
      const dateCandidates = getExamDateCandidates(examDate);
      if (dateCandidates.length > 0) {
        dupSql += ` AND (
          (exam_date IS NOT NULL AND (DATE(exam_date) IN (?) OR CAST(exam_date AS CHAR) IN (?)))
          OR (DATE(submitted_at) IN (?) OR DATE(submitted_at) = DATE(?))
        )`;
        dupParams.push(dateCandidates, dateCandidates, dateCandidates, dateCandidates[0]);
      } else {
        const today = normDate(new Date());
        dupSql += ` AND (DATE(submitted_at) = ? OR (exam_date IS NOT NULL AND DATE(exam_date) = ?))`;
        dupParams.push(today, today);
      }

      const [dupRows] = await db.query(dupSql, dupParams);
      if (dupRows.length > 0) {
        return res.status(409).json({ message: 'You have already submitted this exam. Only one attempt per exam is allowed.' });
      }
    }

    // Get correct answers (date-aware + normalized department/section match)
    const normalizedDept = (department || '')
      .toString()
      .replace(/\s+/g, '')
      .replace('(', '')
      .replace(')', '');
    const rawSection = (section || '').toString();
    const normalizedSection = rawSection.replace('Section ', '').trim();
    const today = normDate(new Date());
    const examDay = normDate(examDate) || today;

    let qQuery = `SELECT id, correct_option, question_type, correct_answer_index, accepted_answers,
      options, option_a, option_b, option_c, option_d
      FROM questions
      WHERE REPLACE(REPLACE(REPLACE(department, ' ', ''), '(', ''), ')', '') = ?
      AND (REPLACE(section, 'Section ', '') = REPLACE(?, 'Section ', '') OR section = 'ALL' OR ? = 'ALL')
      AND year = ? AND semester = ? AND subject = ?`;
    const qParams = [normalizedDept, rawSection, rawSection, year || '1', semester || '1', subject || ''];

    const dateCandidates = getExamDateCandidates(examDate);
    if (dateCandidates.length > 0) {
      qQuery += ` AND exam_date IS NOT NULL AND (DATE(exam_date) IN (?) OR CAST(exam_date AS CHAR) IN (?))`;
      qParams.push(dateCandidates, dateCandidates);
    }

    let [questions] = await db.query(qQuery, qParams);

    // If date-specific search returned nothing, fall back to matching by dept/sec/year/sem/subject
    if (questions.length === 0) {
      const [allDeptQuestions] = await db.query(
        `SELECT id, correct_option, question_type, correct_answer_index, accepted_answers,
          options, option_a, option_b, option_c, option_d
          FROM questions
          WHERE REPLACE(REPLACE(REPLACE(department, ' ', ''), '(', ''), ')', '') = ?
          AND (REPLACE(section, 'Section ', '') = REPLACE(?, 'Section ', '') OR section = 'ALL' OR ? = 'ALL')
          AND year = ? AND semester = ? AND subject = ?`,
        [normalizedDept, rawSection, rawSection, year || '1', semester || '1', subject || '']
      );
      if (allDeptQuestions.length > 0) {
        questions = allDeptQuestions;
      }
    }

    // Safety fallback: if still no questions found, score the question ids present in answers
    if (questions.length === 0 && answers && Object.keys(answers).length > 0) {
      const answeredIds = Object.keys(answers).map(Number).filter(Number.isFinite);
      if (answeredIds.length > 0) {
        const placeholders = answeredIds.map(() => '?').join(',');
        const [answeredQuestions] = await db.query(
          `SELECT id, correct_option, question_type, correct_answer_index, accepted_answers,
            options, option_a, option_b, option_c, option_d
           FROM questions WHERE id IN (${placeholders})`,
          answeredIds
        );
        questions = answeredQuestions;
      }
    }

    // Calculate score with robust MCQ/fill-blank matching.
    const parsedAnswers = typeof answers === 'string' ? JSON.parse(answers || '{}') : (answers || {});
    let score = scoreQuestionSet(questions, parsedAnswers);
    let totalMarks = questions.length;

    // Ensure totalMarks matches the full exam question count for THIS SPECIFIC EXAM
    try {
      let maxSql = `SELECT MAX(total_marks) as max_m FROM responses 
         WHERE REPLACE(REPLACE(REPLACE(department, ' ', ''), '(', ''), ')', '') = ?
           AND (REPLACE(section, 'Section ', '') = REPLACE(?, 'Section ', '') OR section = 'ALL' OR ? = 'ALL')
           AND year = ? AND semester = ? AND subject = ?`;
      const maxParams = [normalizedDept, rawSection, rawSection, year || '1', semester || '1', subject || ''];
      if (examDay) {
        maxSql += ` AND (
          (exam_date IS NOT NULL AND (DATE(exam_date) = ? OR CAST(exam_date AS CHAR) = ?))
          OR (DATE(submitted_at) = ?)
        )`;
        maxParams.push(examDay, examDay, examDay);
      } else {
        maxSql += ` AND DATE(submitted_at) = CURDATE()`;
      }

      const [maxRow] = await db.query(maxSql, maxParams);
      if (maxRow && maxRow[0] && maxRow[0].max_m > totalMarks) {
        totalMarks = maxRow[0].max_m;
      }
    } catch (e) {}


    // Insert response (allow all attempts) - store answers as JSON
    try {
      await db.query(
        `INSERT INTO responses (roll_number, name, department, section, year, semester, subject, score, total_marks, tab_switched, answers, exam_date) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [rollNumber, name, department, normalizedSection, year || '1', semester || '1', subject || '', score, totalMarks, tabSwitched ? 1 : 0, JSON.stringify(parsedAnswers), examDay || null]
      );
    } catch (insertErr) {
      // Legacy databases without responses.exam_date
      await db.query(
        `INSERT INTO responses (roll_number, name, department, section, year, semester, subject, score, total_marks, tab_switched, answers) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [rollNumber, name, department, normalizedSection, year || '1', semester || '1', subject || '', score, totalMarks, tabSwitched ? 1 : 0, JSON.stringify(parsedAnswers)]
      );
    }

    res.json({
      success: true,
      score,
      totalMarks,
      message: 'Exam submitted successfully'
    });
  } catch (error) {
    console.error('Submit exam error:', error);
    res.status(500).json({ message: 'Failed to submit exam', error: error.message });
  }
});

module.exports = router;
