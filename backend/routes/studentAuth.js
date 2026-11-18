const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { sendOTP } = require('../utils/email');
const {
  MASTER_ROLL_NUMBER,
  MASTER_PASSWORD,
  MASTER_PROFILE,
  isMasterRoll,
} = require('../utils/masterStudent');

const otpStore = {}; // Temporary memory store for OTPs

// ==================== STUDENT AUTH ====================

// Middleware: verify student token
const studentAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    if (decoded.role !== 'student') {
      return res.status(403).json({ message: 'Access denied' });
    }
    req.student = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { rollNumber, email, password, fullName, department, section, year, semester } = req.body;

    if (!rollNumber || !email || !password || !fullName || !department || !section || !year || !semester) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if student already exists
    const [existing] = await db.query('SELECT id FROM students WHERE roll_number = ?', [rollNumber]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Roll number already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      'INSERT INTO students (roll_number, email, password, plain_password, full_name, department, section, year, semester) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [rollNumber, email, hashedPassword, password, fullName, department, section, year, semester]
    );

    res.json({ message: 'Registration successful' });
  } catch (error) {
    console.error('Student registration error:', error);
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { rollNumber, password } = req.body;

    if (!rollNumber || !password) {
      return res.status(400).json({ message: 'Roll number and password are required' });
    }

    // ---- MASTER STUDENT (all-access, not stored in DB) ----
    if (isMasterRoll(rollNumber)) {
      if (password !== MASTER_PASSWORD) {
        return res.status(401).json({ message: 'Invalid roll number or password' });
      }
      const token = jwt.sign(
        { id: 0, rollNumber: MASTER_ROLL_NUMBER, role: 'student', isMaster: true },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      return res.json({
        token,
        student: MASTER_PROFILE,
        message: 'Login successful',
      });
    }

    const [rows] = await db.query('SELECT * FROM students WHERE roll_number = ?', [rollNumber]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid roll number or password' });
    }

    const student = rows[0];
    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid roll number or password' });
    }

    const token = jwt.sign(
      { id: student.id, rollNumber: student.roll_number, role: 'student' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      student: {
        id: student.id,
        rollNumber: student.roll_number,
        email: student.email,
        fullName: student.full_name,
        department: student.department,
        section: student.section,
        year: student.year,
        semester: student.semester,
      },
      message: 'Login successful',
    });
  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// Forgot Password -> Send OTP
router.post('/forgot-password', async (req, res) => {
  try {
    let { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    email = email.trim().toLowerCase();

    // Bypass for Test Mode
    if (email !== 'test@test.com') {
      const [rows] = await db.query('SELECT * FROM students WHERE email = ?', [email]);
      if (rows.length === 0) return res.status(404).json({ message: 'User not found with this email' });
    }

    const otp = (email === 'test@test.com') ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = { otp, expires: Date.now() + 10 * 60 * 1000 };

    // Wait for the email to be sent, and return clear details if it fails.
    const result = await sendOTP(email, otp);
    if (!result.success) {
      return res.status(400).json({ 
        message: 'Failed to deliver OTP email.', 
        details: result.error || 'Server configuration error or email was rejected.' 
      });
    }

    res.json({ message: 'OTP sent successfully. Please check your email inbox or spam folder.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Failed to process request' });
  }
});

// Verify OTP & Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    let { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ message: 'All fields are required' });
    email = email.trim().toLowerCase();

    const record = otpStore[email];
    if (!record || record.otp !== otp || record.expires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    
    delete otpStore[email];

    // Bypass for Test Mode
    if (email === 'test@test.com') {
      return res.json({ message: 'Password reset successfully (TEST MODE)' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE students SET password = ?, plain_password = ? WHERE email = ?', [hashedPassword, newPassword, email]);
    
    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

// Get student profile
router.get('/profile', studentAuth, async (req, res) => {
  try {
    if (req.student.isMaster) return res.json(MASTER_PROFILE);
    const [rows] = await db.query(
      'SELECT id, roll_number, email, full_name, department, section, year, semester FROM students WHERE roll_number = ?',
      [req.student.rollNumber]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Student not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// Get Quiz Exams (active exam configs matching student's dept/year/sem/section)
router.get('/available-exams', studentAuth, async (req, res) => {
  try {
    // Master student: return every active exam across all departments
    if (req.student.isMaster) {
      const [exams] = await db.query(
        `SELECT ec.*,
          (SELECT COUNT(*) FROM questions q
           WHERE REPLACE(REPLACE(REPLACE(q.department, ' ', ''), '(', ''), ')', '') = REPLACE(REPLACE(REPLACE(ec.department, ' ', ''), '(', ''), ')', '')
           AND q.section = ec.section AND q.year = ec.year AND q.semester = ec.semester
           AND q.subject = ec.subject AND (ec.exam_date IS NULL OR DATE(q.exam_date) = DATE(ec.exam_date))
          ) as question_count
         FROM exam_configs ec
         WHERE ec.is_active = 1
         ORDER BY ec.exam_date DESC`
      );
      return res.json(exams);
    }

    const [student] = await db.query(
      'SELECT department, section, year, semester FROM students WHERE roll_number = ?',
      [req.student.rollNumber]
    );
    if (student.length === 0) return res.status(404).json({ message: 'Student not found' });

    const s = student[0];
    const normalizedDept = s.department.replace(/\s+/g, '').replace('(', '').replace(')', '');

    const [exams] = await db.query(
      `SELECT ec.*, 
        (SELECT COUNT(*) FROM questions q 
         WHERE REPLACE(REPLACE(REPLACE(q.department, ' ', ''), '(', ''), ')', '') = REPLACE(REPLACE(REPLACE(ec.department, ' ', ''), '(', ''), ')', '')
         AND q.section = ec.section AND q.year = ec.year AND q.semester = ec.semester 
         AND q.subject = ec.subject AND (ec.exam_date IS NULL OR DATE(q.exam_date) = DATE(ec.exam_date))
        ) as question_count
       FROM exam_configs ec
       WHERE REPLACE(REPLACE(REPLACE(ec.department, ' ', ''), '(', ''), ')', '') = ?
       AND (ec.section = ? OR ec.section = 'ALL')
       AND ec.year = ?
       AND ec.semester = ?
       AND ec.is_active = 1
       ORDER BY ec.exam_date DESC`,
      [normalizedDept, s.section, s.year, s.semester]
    );

    res.json(exams);
  } catch (error) {
    console.error('Quiz Exams error:', error);
    res.status(500).json({ message: 'Failed to fetch Quiz Exams' });
  }
});

// Get Coding Exams (grouping active questions by exam_date and subject)
router.get('/available-coding-exams', studentAuth, async (req, res) => {
  try {
    let s;
    if (req.student.isMaster) {
      // Master student — no DB row, treat as "matches everything".
      s = { department: 'ALL', section: 'ALL', year: 'ALL', semester: 'ALL' };
    } else {
      const [student] = await db.query(
        'SELECT department, section, year, semester FROM students WHERE roll_number = ?',
        [req.student.rollNumber]
      );
      if (student.length === 0) return res.status(404).json({ message: 'Student not found' });
      s = student[0];
    }
    const normalizedStudentDept = (s.department || '').replace(/\s+/g, '').replace('(', '').replace(')', '').toLowerCase();

    console.log(`\n--- DEBUG CODING EXAMS FETCH FOR STUDENT: ${req.student.rollNumber} ---`);
    console.log(`Student Context: Dept=${s.department} (${normalizedStudentDept}), Year=${s.year}, Sem=${s.semester}, Sec=${s.section}`);

    // Fetch ALL coding questions to debug filtering
    const [questions] = await db.query(`SELECT id, department, section, year, semester, subject, exam_date, question FROM questions`);

    const examsMap = new Map();
    let debugStats = { totalQs: questions.length, parseErrors: 0, notExamType: 0, notLive: 0, contextMismatch: 0, validAdded: 0 };
    
    // Get today's Date at midnight UTC for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    questions.forEach(q => {
      try {
        const payload = JSON.parse(q.question);
        
        // 1. Check Targeted Assignment (PRIORITY)
        const studentRoll = String(req.student.rollNumber).trim().toUpperCase();
        const hasAssignedList = payload.assignedStudents && Array.isArray(payload.assignedStudents);
        const isExplicitlyAssigned = hasAssignedList && payload.assignedStudents.map(r => String(r).toUpperCase()).includes(studentRoll);

        if (hasAssignedList && !isExplicitlyAssigned) {
            // Admin explicitly assigned students, and this student is not one of them
            debugStats.contextMismatch++;
            return;
        }

        // 2. If not explicitly assigned via list, check general context
        //    Master student bypasses this check entirely.
        if (!isExplicitlyAssigned && !req.student.isMaster) {
            const normalizedQDept = (q.department || '').replace(/\s+/g, '').replace('(', '').replace(')', '').toLowerCase();
            const isDeptMatch = normalizedQDept === normalizedStudentDept;
            
            const normalizeStr = (val) => String(val || '').replace(/\s+/g, '').toLowerCase();
            const isSecMatch = normalizeStr(q.section) === normalizeStr(s.section);
            const isYearMatch = normalizeStr(q.year) === normalizeStr(s.year);
            const isSemMatch = normalizeStr(q.semester) === normalizeStr(s.semester);

            if (!isDeptMatch || !isYearMatch || !isSemMatch || !isSecMatch) {
              debugStats.contextMismatch++;
              return;
            }
        }

        // 3. Check if live
        const isLive = payload.isActive === true || payload.isLive === true;
        if (!isLive) {
          debugStats.notLive++;
          return;
        }

        // Check date logic
        let isValidDate = true;
        const rawDate = q.exam_date ? (typeof q.exam_date === 'string' ? q.exam_date : q.exam_date.toISOString()) : '';
        if (rawDate) {
           const examDateLocal = new Date(rawDate);
           examDateLocal.setHours(0,0,0,0);
           // Allow today and future
           if (examDateLocal < today) {
              isValidDate = true; 
           }
        }
        
        if (!isValidDate) return;

        // GROUP EXAMS by Date (Normalized) and Context
        debugStats.validAdded++;
        const dateOnly = rawDate.split('T')[0] || 'no-date';
        const key = `${dateOnly}_${q.department}_${q.section}_${q.year}_${q.semester}`;
        
        if (!examsMap.has(key)) {
            examsMap.set(key, {
                id: key, // Use the unique composite key as the exam ID for grouping
                department: q.department,
                section: q.section,
                year: q.year,
                semester: q.semester,
                subject: 'Coding Assessment',
                exam_date: q.exam_date,
                time_limit: payload.timer || 60,
                is_active: true,
                question_count: 0
            });
        }
        
        const exam = examsMap.get(key);
        exam.question_count += 1;
      } catch (e) {
        debugStats.parseErrors++;
      }
    });

    console.log(`Stats for Coding Exams logic:`, debugStats);
    if (examsMap.size === 0) {
      console.log(`[DEBUG] No exams found for student ${req.student.rollNumber}. Checking a few raw questions...`);
      const sample = questions.slice(0, 3).map(q => ({ id: q.id, dept: q.department, sec: q.section, date: q.exam_date }));
      console.log(`Sample Questions:`, sample);
    }

    const exams = Array.from(examsMap.values()).sort((a, b) => new Date(b.exam_date) - new Date(a.exam_date));
    
    console.log("Returned Exam Tiles:", exams);
    console.log(`------------------------------------------------------------------------\n`);

    res.json(exams);
  } catch (error) {
    console.error('Coding Exams error:', error);
    res.status(500).json({ message: 'Failed to fetch Coding Exams' });
  }
});

// Get previous exam scores (only if show_previous_scores is enabled for that exam)
router.get('/previous-scores', studentAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.id, r.subject, r.score, r.total_marks, r.tab_switched, r.submitted_at, r.exam_date,
              r.department, r.section, r.year, r.semester, 'mcq' as type, NULL as question_ids
       FROM responses r
       WHERE r.roll_number = ?
       UNION ALL
       SELECT MIN(cs.id) as id, COALESCE(MAX(q.subject), 'Coding Assessment') as subject, ROUND(AVG(cs.score)) as score, 
              100 as total_marks, MAX(cs.tab_switched) as tab_switched, MAX(cs.created_at) as submitted_at, MAX(cs.created_at) as exam_date,
              COALESCE(s.department, 'ALL') as department, COALESCE(s.section, 'ALL') as section, 
              COALESCE(s.year, 'ALL') as year, COALESCE(s.semester, 'ALL') as semester, 'coding' as type,
              GROUP_CONCAT(DISTINCT cs.question_id) as question_ids
       FROM code_submissions cs
       LEFT JOIN students s ON s.id = cs.student_id
       LEFT JOIN questions q ON q.id = cs.question_id
       WHERE (s.roll_number = ? OR (cs.student_id IN ('0', 0, '22251A6601') AND ? = '22251A6601')) AND cs.exam_id IS NOT NULL
       GROUP BY cs.exam_id, cs.student_id, FLOOR(UNIX_TIMESTAMP(cs.created_at) / 1800)
       ORDER BY submitted_at DESC`,
      [req.student.rollNumber, req.student.rollNumber, req.student.rollNumber]
    );

    // ---- Respect the admin "Show Previous Score" toggle ----
    const normKey = (v) => (v == null ? '' : v.toString().replace(/\s+/g, '').replace('(', '').replace(')', '').toLowerCase());
    const normDate = (d) => {
      if (!d) return null;
      const s = d.toString().trim();
      const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
      if (m) return m[1];
      const dt = new Date(s);
      return isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
    };

    const [configs] = await db.query(
      `SELECT department, section, year, semester, subject, show_previous_scores, exam_date FROM exam_configs`
    );

    // Coding exams store the flag inside each question's JSON settings.
    const codingQIds = [...new Set(
      rows.filter(r => r.type === 'coding' && r.question_ids)
        .flatMap(r => r.question_ids.split(',').map(x => parseInt(x, 10)).filter(n => !isNaN(n)))
    )];
    const codingShowPrev = new Map();
    if (codingQIds.length > 0) {
      const [cq] = await db.query(`SELECT id, question FROM questions WHERE id IN (?)`, [codingQIds]);
      cq.forEach(q => {
        let showPrev = true;
        try {
          const parsed = typeof q.question === 'string' ? JSON.parse(q.question) : q.question;
          if (parsed && parsed.showPrev === false) showPrev = false;
        } catch (e) { }
        codingShowPrev.set(q.id, showPrev);
      });
    }

    const filtered = rows.filter(row => {
      if (row.type === 'coding') {
        if (!row.question_ids) return true;
        const ids = row.question_ids.split(',').map(x => parseInt(x, 10)).filter(n => !isNaN(n));
        // Hide only when EVERY question of that coding exam has showPrev = false
        return ids.some(id => codingShowPrev.get(id) !== false);
      }
      // Quiz (mcq) rows: match exam_configs on dept/section/year/semester/subject
      const candidates = configs.filter(c =>
        normKey(c.department) === normKey(row.department) &&
        normKey(c.section) === normKey(row.section) &&
        normKey(c.year) === normKey(row.year) &&
        normKey(c.semester) === normKey(row.semester) &&
        normKey(c.subject) === normKey(row.subject)
      );
      if (candidates.length === 0) return true; // no config for this exam → legacy, keep showing
      const rowDate = normDate(row.exam_date);
      const dateMatched = rowDate
        ? candidates.filter(c => normDate(c.exam_date) === rowDate)
        : [];
      const pool = dateMatched.length > 0 ? dateMatched : candidates;
      // Hide the score only when the matching config(s) turned the toggle OFF
      return pool.some(c => Number(c.show_previous_scores) === 1);
    });

    filtered.forEach(r => { delete r.question_ids; });
    res.json(filtered);
  } catch (error) {
    console.error('Previous scores error:', error);
    res.status(500).json({ message: 'Failed to fetch previous scores' });
  }
});

// Debug submissions helper endpoint
router.get('/debug-submissions', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, student_id, question_id, exam_id, score, status, created_at FROM code_submissions ORDER BY created_at DESC LIMIT 50');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get detailed score with questions and answers for a specific response
router.get('/score-details/:responseId', studentAuth, async (req, res) => {
  try {
    // Get the response
    const [responses] = await db.query(
      `SELECT * FROM responses WHERE id = ? AND roll_number = ?`,
      [req.params.responseId, req.student.rollNumber]
    );
    if (responses.length === 0) return res.status(404).json({ message: 'Response not found' });

    const response = responses[0];
    const normalizedDept = response.department.replace(/\s+/g, '').replace('(', '').replace(')', '');

    // Parse stored answers FIRST - the keys are the exact question IDs this student attempted
    let studentAnswers = {};
    try {
      studentAnswers = response.answers ? (typeof response.answers === 'string' ? JSON.parse(response.answers) : response.answers) : {};
    } catch (e) { }

    const answeredIds = Object.keys(studentAnswers).map(k => parseInt(k, 10)).filter(n => !isNaN(n));

    const qSelect = `SELECT id, question, option_a, option_b, option_c, option_d, correct_option, image_url
       FROM questions
       WHERE REPLACE(REPLACE(REPLACE(department, ' ', ''), '(', ''), ')', '') = ?
       AND (section = ? OR section = 'ALL') AND year = ? AND semester = ? AND subject = ?`;
    const qParams = [normalizedDept, response.section, response.year, response.semester, response.subject];

    let finalQuestions = [];

    // 0) PRIMARY: use answered IDs only to identify the exact quiz's exam_date,
    // then fetch the full quiz set so unanswered questions are also shown.
    if (answeredIds.length > 0) {
      const [attemptedQuestions] = await db.query(
        `SELECT id, exam_date FROM questions WHERE id IN (?)`,
        [answeredIds]
      );

      const examDates = [...new Set(
        attemptedQuestions
          .map(q => q.exam_date ? new Date(q.exam_date).toISOString().split('T')[0] : null)
          .filter(Boolean)
      )];

      if (examDates.length === 1) {
        const [fullQuiz] = await db.query(
          qSelect + ` AND DATE(exam_date) = ? ORDER BY id ASC`,
          [...qParams, examDates[0]]
        );
        finalQuestions = fullQuiz;
      } else if (attemptedQuestions.length > 0) {
        const [legacyQuiz] = await db.query(qSelect + ` AND exam_date IS NULL ORDER BY id ASC`, qParams);
        finalQuestions = legacyQuiz.length >= response.total_marks ? legacyQuiz : [];
      }
    }

    // 1) Fallback: exact exam_date match
    if (finalQuestions.length === 0) {
      const [byExactDate] = await db.query(
        qSelect + ` AND DATE(exam_date) = DATE(?) ORDER BY id ASC`,
        [...qParams, response.submitted_at]
      );
      finalQuestions = byExactDate;
    }

    // 2) Fallback: closest exam_date on or before submission
    if (finalQuestions.length === 0) {
      const [dateRows] = await db.query(
        `SELECT DATE(exam_date) AS d FROM questions
         WHERE REPLACE(REPLACE(REPLACE(department, ' ', ''), '(', ''), ')', '') = ?
           AND section = ? AND year = ? AND semester = ? AND subject = ?
           AND exam_date IS NOT NULL AND DATE(exam_date) <= DATE(?)
         ORDER BY exam_date DESC LIMIT 1`,
        [...qParams, response.submitted_at]
      );
      if (dateRows.length > 0) {
        const [byDate] = await db.query(qSelect + ` AND DATE(exam_date) = ? ORDER BY id ASC`, [...qParams, dateRows[0].d]);
        finalQuestions = byDate;
      }
    }

    // 3) Last resort: legacy questions with no exam_date
    if (finalQuestions.length === 0 && answeredIds.length > 0) {
      const placeholders = answeredIds.map(() => '?').join(',');
      const [byIds] = await db.query(
        `SELECT id, question, option_a, option_b, option_c, option_d, correct_option, correct_answer_index, accepted_answers, question_type, image_url
         FROM questions WHERE id IN (${placeholders}) ORDER BY FIELD(id, ${placeholders})`,
        [...answeredIds, ...answeredIds]
      );
      finalQuestions = byIds;
    }

    if (finalQuestions.length === 0) {
      const [legacy] = await db.query(qSelect + ` AND exam_date IS NULL ORDER BY id ASC`, qParams);
      finalQuestions = legacy;
    }

    const { scoreQuestion, resolveCorrectIndex, getOptions } = require('../utils/quizScoring');

    const enrichedQuestions = finalQuestions.map((q) => {
      const studentAns = studentAnswers[q.id] ?? studentAnswers[String(q.id)];
      const isCorrect = scoreQuestion(q, studentAns);

      const options = getOptions(q);
      const correctIdx = resolveCorrectIndex(q, options);
      const correctLetter = correctIdx != null ? ['A', 'B', 'C', 'D'][correctIdx] : (q.correct_option || '');

      let studentLetter = '';
      if (studentAns != null && String(studentAns).trim() !== '') {
        const raw = String(studentAns).trim();
        if (/^\d+$/.test(raw)) {
          const num = Number(raw);
          studentLetter = ['A', 'B', 'C', 'D'][num] || raw;
        } else {
          studentLetter = raw.toUpperCase();
        }
      }

      return {
        ...q,
        is_correct: isCorrect,
        student_answer_letter: studentLetter,
        correct_option_letter: correctLetter
      };
    });

    res.json({ response, questions: enrichedQuestions, studentAnswers });
  } catch (error) {
    console.error('Score details error:', error);
    res.status(500).json({ message: 'Failed to fetch score details' });
  }
});

// Get coding score details (returns all questions in the same assessment session)
router.get('/coding-score-details/:id', studentAuth, async (req, res) => {
  try {
    const [target] = await db.query(
      `SELECT cs.exam_id, cs.student_id, cs.created_at FROM code_submissions cs 
       LEFT JOIN students s ON s.id = cs.student_id 
       WHERE cs.id = ? AND (s.roll_number = ? OR (cs.student_id IN ('0', 0, '22251A6601') AND ? = '22251A6601'))`,
      [req.params.id, req.student.rollNumber, req.student.rollNumber]
    );

    if (target.length === 0) return res.status(404).json({ message: 'Coding submission not found' });
    const { exam_id, student_id, created_at } = target[0];

    // Fetch all submissions for this student in this specific exam and attempt window
    const [rows] = await db.query(
      `SELECT cs.*, q.subject, q.question as question_raw
       FROM code_submissions cs
       JOIN questions q ON q.id = cs.question_id
       WHERE cs.exam_id = ? AND cs.student_id = ?
       AND FLOOR(UNIX_TIMESTAMP(cs.created_at) / 1800) = FLOOR(UNIX_TIMESTAMP(?) / 1800)`,
      [exam_id, student_id, created_at]
    );

    const submissions = rows.map(r => {
       let parsed = {};
       try { parsed = JSON.parse(r.question_raw); } catch {}
       return { ...r, question: parsed };
    });

    res.json({ submissions });
  } catch (error) {
    console.error('Coding score details error:', error);
    res.status(500).json({ message: 'Failed to fetch coding details' });
  }
});

// Update student email
router.post('/update-email', studentAuth, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const [existing] = await db.query('SELECT id FROM students WHERE email = ? AND roll_number != ?', [email, req.student.rollNumber]);
    if (existing.length > 0) return res.status(409).json({ message: 'This email is already registered to another account' });

    await db.query('UPDATE students SET email = ? WHERE roll_number = ?', [email, req.student.rollNumber]);
    res.json({ message: 'Email updated successfully', email });
  } catch (error) {
    console.error('Update email error:', error);
    res.status(500).json({ message: 'Failed to update email' });
  }
});

// ==================== IT ADMIN: MANAGE STUDENTS ====================

// Get all students (for IT Admin)
router.get('/all', async (req, res) => {
  try {
    const { department, year, semester, section } = req.query;
    let query = 'SELECT id, roll_number, plain_password, full_name, department, section, year, semester, created_at FROM students WHERE 1=1';
    const params = [];
    if (department) { query += ' AND department = ?'; params.push(department); }
    if (year) { query += ' AND year = ?'; params.push(year); }
    if (semester) { query += ' AND semester = ?'; params.push(semester); }
    if (section) { query += ' AND section = ?'; params.push(section); }
    query += ' ORDER BY roll_number';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch students' });
  }
});

// Delete student (for IT Admin)
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM students WHERE id = ?', [req.params.id]);
    res.json({ message: 'Student deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete student' });
  }
});

// Promote students (for IT Admin)
router.post('/promote', async (req, res) => {
  try {
    const { department, fromYear, fromSem, toYear, toSem } = req.body;
    if (!fromYear || !fromSem || !toYear || !toSem) {
      return res.status(400).json({ message: 'From and To Year/Semester are required' });
    }
    
    let query = 'UPDATE students SET year = ?, semester = ? WHERE year = ? AND semester = ?';
    const params = [toYear, toSem, fromYear, fromSem];
    
    if (department && department !== 'ALL') {
      query += ' AND department = ?';
      params.push(department);
    }
    
    const [result] = await db.query(query, params);
    res.json({ message: `Successfully promoted ${result.affectedRows} students` });
  } catch (error) {
    console.error('Promotion error:', error);
    res.status(500).json({ message: 'Failed to promote students' });
  }
});

module.exports = router;
