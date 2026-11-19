// ==================== TYPES ====================
export interface Question {
  id: number;
  department: string;
  section: string;
  year: string;
  semester: string;
  subject: string;
  question: string;
  // Legacy MCQ fields (still populated for 4-option MCQs)
  option_a?: string | null;
  option_b?: string | null;
  option_c?: string | null;
  option_d?: string | null;
  correct_option?: 'A' | 'B' | 'C' | 'D' | null;
  // New generic fields
  question_type?: 'mcq' | 'fill_blank';
  options?: string[] | null;               // dynamic option list for MCQ (2-6)
  correct_answer_index?: number | null;    // index into options[]
  accepted_answers?: string[] | null;      // list of acceptable answers for fill_blank
  image_url?: string;
  exam_date?: string;
}

export interface ExamConfig {
  id: number;
  department: string;
  section: string;
  year: string;
  semester: string;
  subject: string;
  time_limit: number; // in minutes
  is_active: boolean;
  shuffle_questions: boolean;
  exam_date?: string; // YYYY-MM-DD format
}

export interface Response {
  id: number;
  roll_number: string;
  name: string;
  department: string;
  section: string;
  year: string;
  semester: string;
  subject: string;
  score: number;
  total_marks: number;
  tab_switched: boolean;
  submitted_at: string;
  is_duplicate?: boolean;
}

// ==================== API CONFIG ====================
// Two backends supported:
//   1) College LAN server:  http://172.30.4.5:5000   (used when on intranet)
//   2) Render (HTTPS):      VITE_RENDER_API env var  (used when on public web)
const DEFAULT_CLOUD_API = 'https://hariquizexams.onrender.com';
const RENDER_API = (import.meta.env.VITE_RENDER_API as string | undefined)?.trim() || DEFAULT_CLOUD_API;
const LOCAL_API  = (import.meta.env.VITE_LOCAL_API  as string | undefined)?.trim() || 'http://172.30.4.5:5000';

export const BASE_SERVER_URL = (() => {
  const hostname = window.location.hostname;
  const isHttps  = window.location.protocol === 'https:';

  // 1. Dev on developer machine
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }

  // 2. On the college LAN (intranet IPs) → hit local express server directly
  if (/^172\.|^10\.|^192\.168\./.test(hostname)) {
    return LOCAL_API;
  }

  // 3. Public web (lovableproject.com, vercel.app, custom domain) MUST use HTTPS backend
  if (RENDER_API && /^https:\/\//i.test(RENDER_API)) {
    return RENDER_API.replace(/\/$/, '');
  }

  // 4. Mixed-content safety: fallback to live HTTPS cloud backend
  return DEFAULT_CLOUD_API;
})();

const API_BASE_URL = `${BASE_SERVER_URL}/api`;
console.log('[api] BASE_SERVER_URL =', BASE_SERVER_URL);

// ==================== GENERIC FETCH ====================
async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const isAdminEndpoint = endpoint.startsWith('/admin') || endpoint.startsWith('/it-admin');
  const token = isAdminEndpoint
    ? (localStorage.getItem('adminToken') || localStorage.getItem('itAdminToken'))
    : (localStorage.getItem('adminToken') || localStorage.getItem('studentToken'));

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // ⛔ DO NOT THROW → return backend message safely
  if (!response.ok) {
    const payload = await response.json().catch(() => ({
      message: 'Request failed',
    }));

    if (response.status === 401) {
      // Token expired/invalid → force logout everywhere
      localStorage.removeItem('adminToken');
      window.dispatchEvent(new CustomEvent('admin:logout', { detail: payload }));
    }

    return payload;
  }

  return response.json();
}

// ==================== STUDENT APIs ====================
export const studentAPI = {
  checkDuplicateAttempt: async (
    rollNumber: string,
    department: string,
    section: string,
    year: string,
    semester: string,
    subject: string,
    examDate?: string
  ) => {
    const params = new URLSearchParams({
      rollNumber,
      department,
      section,
      year,
      semester,
      subject,
    });

    if (examDate) params.append('examDate', examDate);

    const response = await fetch(
      `${API_BASE_URL}/check-attempt?${params.toString()}`,
      { cache: 'no-store' }
    );

    return response.json();
  },

  getQuestions: (department: string, section: string, year: string, semester: string, subject: string, examDate?: string) => {
    const normalizeDepartment = (d: string) =>
      (d || '').replace(/\s+/g, '').replace('(', '').replace(')', '');

    const normalizeSection = (s: string) => (s || '').replace('Section ', '');

    const params = new URLSearchParams({
      department: normalizeDepartment(department),
      section: normalizeSection(section),
      year: year || '',
      semester: semester || '',
      subject: subject || '',
    });
    
    if (examDate) {
      params.append('examDate', examDate);
    }

    return fetchAPI(`/questions?${params.toString()}`);
  },

  getCodingQuestions: async (
    type: string = 'practice',
    ctx?: { department?: string; section?: string; year?: string; semester?: string; subject?: string; examDate?: string }
  ) => {
    try {
      const params = new URLSearchParams({ type });
      if (ctx?.department) params.append('department', ctx.department);
      if (ctx?.section)    params.append('section',    ctx.section);
      if (ctx?.year)       params.append('year',       ctx.year);
      if (ctx?.semester)   params.append('semester',   ctx.semester);
      if (ctx?.subject)    params.append('subject',    ctx.subject);
      if (ctx?.examDate)   params.append('examDate',   ctx.examDate);
      const data = await fetchAPI(`/coding-questions?${params.toString()}`);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  runCode: async (payload: { code: string, language: string, stdin?: string }, signal?: AbortSignal) => {
    const url = `${BASE_SERVER_URL}/api/execute`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_code: payload.code,
          language: payload.language,   // send raw string — backend maps to Piston runtime
          stdin: payload.stdin || ''
        }),
        signal
      });

      const rawText = await response.text();

      if (!response.ok) {
        console.error('Backend returned non-OK status', response.status, rawText);
        try {
          const jsonErr = JSON.parse(rawText);
          return { error: true, status: response.status, ...jsonErr };
        } catch {
          return { error: true, message: `Execution failed with status ${response.status}` };
        }
      }

      try {
        return JSON.parse(rawText);
      } catch (parseError) {
        console.error('Invalid JSON response from /api/execute', rawText);
        throw new Error('Invalid JSON response from backend');
      }
    } catch (e: any) {
      console.error('Piston Integration Error:', e);
      return {
        error: true,
        message: e?.message || 'Execution Failed - Cannot reach Backend',
      };
    }
  },

  getExamConfig: (department: string, section: string, year: string, semester: string, subject: string, examDate?: string) => {
    const normalizeDepartment = (d: string) =>
      (d || '').replace(/\s+/g, '').replace('(', '').replace(')', '');

    const normalizeSection = (s: string) => (s || '').replace('Section ', '');

    const params = new URLSearchParams({
      department: normalizeDepartment(department),
      section: normalizeSection(section),
      year: year || '',
      semester: semester || '',
      subject: subject || '',
    });
    
    if (examDate) {
      params.append('examDate', examDate);
    }

    return fetchAPI(`/exam-config?${params.toString()}`);
  },

  submitExam: (data: {
    rollNumber: string;
    name: string;
    department: string;
    section: string;
    year: string;
    semester: string;
    subject: string;
    examDate?: string;
    answers: Record<number, string>;
    tabSwitched: boolean;
  }) =>
    fetchAPI('/submit-exam', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ==================== CODING PLATFORM APIs ====================
// All routes live at /api/coding/*
const CODING_BASE = `${BASE_SERVER_URL}/api/coding`;

async function codingFetch(path: string, opts: RequestInit = {}) {
  const isAdminPath = path.includes('/admin') || path.includes('/analytics');
  const token = isAdminPath
    ? (localStorage.getItem('adminToken') || localStorage.getItem('studentToken') || '')
    : (localStorage.getItem('studentToken') || localStorage.getItem('adminToken') || '');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...opts.headers,
  };
  const r = await fetch(`${CODING_BASE}${path}`, { ...opts, headers });

  if (!r.ok) {
    const payload = await r.json().catch(() => ({ message: 'Request failed' }));
    if (r.status === 401) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('studentToken');
      window.dispatchEvent(new CustomEvent('admin:logout', { detail: payload }));
      window.dispatchEvent(new CustomEvent('student:logout', { detail: payload }));
    }
    throw new Error(payload.message || 'Request failed');
  }

  return r.json();
}

export const codingAPI = {
  /** Run code against test cases (or custom input) */
  runCode: (payload: {
    code: string;
    language: string;
    questionId?: number | string;
    isSubmit?: boolean;
    studentId?: number | string;
    examId?: number | string;
    customInput?: string;
  }, signal?: AbortSignal) =>
    codingFetch('/run-code', { method: 'POST', body: JSON.stringify(payload), signal }),

  /** Save submission result after evaluation */
  saveSubmission: (data: {
    studentId: string;
    questionId: string;
    examId?: string | null;
    code: string;
    language: string;
    status: string;
    passedTestCases: number;
    totalTestCases: number;
    score: number;
    executionTime: number;
    memory: number;
    tabSwitched?: boolean;
  }) => codingFetch('/submissions', { method: 'POST', body: JSON.stringify(data) }),

  /** Get submission history */
  getSubmissions: (studentId: number | string, questionId?: number | string, examId?: number | string) => {
    const q = new URLSearchParams({ studentId: String(studentId) });
    if (questionId) q.set('questionId', String(questionId));
    if (examId) q.set('examId', String(examId));
    return codingFetch(`/submissions?${q}`);
  },

  /** Leaderboard */
  getLeaderboard: (examId?: number | string, limit = 50) => {
    const q = new URLSearchParams({ limit: String(limit) });
    if (examId && examId !== 'ALL') q.set('examId', String(examId));
    return codingFetch(`/leaderboard?${q}`);
  },

  /** Admin: All submissions history */
  getAdminSubmissions: (params: { 
    examId?: string; 
    studentId?: string; 
    questionId?: string; 
    status?: string; 
    date?: string;
    department?: string;
    year?: string;
    semester?: string;
    subject?: string;
    section?: string;
    limit?: number; 
  }) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== 'ALL') {
            q.set(k, String(v));
        }
    });
    return codingFetch(`/admin/submissions?${q}`);
  },

  /** Admin: Get single submission detail (including code) */
  getSubmissionDetail: (id: number | string) => codingFetch(`/admin/submission/${id}`),

  /** Admin: Update submission score manually */
  updateSubmissionScore: (id: number | string, score: number) => 
    codingFetch(`/admin/submission/${id}/score`, { method: 'PUT', body: JSON.stringify({ score }) }),

  /** Admin: Delete submission */
  deleteSubmission: (id: number | string) =>
    codingFetch(`/admin/submission/${id}`, { method: 'DELETE' }),

  /** Admin stats */
  getStats: () => codingFetch('/stats'),

  /** Problem list */
  getProblems: (params: { department?: string; year?: string; semester?: string; usageType?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>);
    return codingFetch(`/problems?${q}`);
  },

  /** Global Practice Questions */
  savePracticeQuestion: (data: any) =>
    codingFetch('/practice/questions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getPracticeQuestions: (difficulty?: string, topic?: string) => {
    const params = new URLSearchParams();
    if (difficulty) params.append('difficulty', difficulty);
    if (topic) params.append('topic', topic);
    return codingFetch(`/practice/questions?${params.toString()}`);
  },

  getPracticeTopics: (difficulty: string) => 
    codingFetch(`/practice/topics?difficulty=${difficulty}`),

  updatePracticeQuestion: (id: number | string, data: any) =>
    codingFetch(`/practice/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deletePracticeQuestion: (id: number | string) =>
    codingFetch(`/practice/questions/${id}`, {
      method: 'DELETE',
    }),

  /** Anti-Cheat: Log violation */
  logCheat: (data: { studentId: string; examId: string; eventType: string; description?: string }) =>
    codingFetch('/cheat-log', { method: 'POST', body: JSON.stringify(data) }),

  /** Analytics: Student */
  getStudentAnalytics: (studentId: string | number) =>
    codingFetch(`/analytics/student?studentId=${studentId}`),

  /** Analytics: Admin Exam */
  getExamAnalytics: (examId: string | number) =>
    codingFetch(`/analytics/exam/${examId}`),
};


// ==================== ML EXECUTION APIs ====================
// All routes live at /api/ml-exec/*
const ML_EXEC_BASE = `${BASE_SERVER_URL}/api/ml-exec`;

async function mlExecFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('studentToken') || localStorage.getItem('adminToken') || '';
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...opts.headers,
  };
  const r = await fetch(`${ML_EXEC_BASE}${path}`, { ...opts, headers });
  return r.json();
}

export const mlExecAPI = {
  /**
   * Run ML/CVPR/RL code.
   * Returns: { stdout, stderr, graphs, images, metrics, executionTimeMs, executionId }
   */
  runCode: (payload: {
    code: string;
    language: string;
    domain?: string;
    stdin?: string;
    studentId?: number | string;
    questionId?: number | string;
    examId?: number | string;
    isSubmit?: boolean;
    datasetType?: 'csv' | 'image' | 'rl';
  }, signal?: AbortSignal) =>
    mlExecFetch('/run', { method: 'POST', body: JSON.stringify(payload), signal }),

  /** Execution history for a student */
  getHistory: (studentId: number | string, params?: { limit?: number; examId?: string; questionId?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit)      q.set('limit',      String(params.limit));
    if (params?.examId)     q.set('examId',     params.examId);
    if (params?.questionId) q.set('questionId', params.questionId);
    return mlExecFetch(`/history/${studentId}?${q}`);
  },

  /** Single execution detail (with graphs, images, metrics, logs) */
  getExecutionDetail: (studentId: number | string, execId: number | string) =>
    mlExecFetch(`/history/${studentId}/${execId}`),

  /** Graph outputs for an execution */
  getGraphs: (execId: number | string) =>
    mlExecFetch(`/graphs/${execId}`),

  /** Student metrics */
  getMetrics: (studentId: number | string, params?: { examId?: string; domain?: string }) => {
    const q = new URLSearchParams();
    if (params?.examId) q.set('examId', params.examId);
    if (params?.domain) q.set('domain', params.domain);
    return mlExecFetch(`/metrics/${studentId}?${q}`);
  },

  /** Check plagiarism for an exam+question */
  checkPlagiarism: (examId: string, questionId?: string, threshold?: number) =>
    mlExecFetch('/plagiarism/check', { method: 'POST', body: JSON.stringify({ examId, questionId, threshold }) }),

  /** Admin analytics */
  getAdminAnalytics: (params?: { examId?: string; domain?: string; date?: string }) => {
    const q = new URLSearchParams();
    if (params?.examId) q.set('examId', params.examId);
    if (params?.domain) q.set('domain', params.domain);
    if (params?.date)   q.set('date',   params.date);
    return mlExecFetch(`/admin/analytics?${q}`);
  },

  /** Datasets for a question */
  getDatasets: (questionId: number | string) =>
    mlExecFetch(`/datasets/${questionId}`),

  /** Check if a question is already submitted/locked */
  getSubmissionStatus: (studentId: number | string, questionId: number | string, examId?: string) => {
    const q = new URLSearchParams();
    if (examId) q.set('examId', examId);
    return mlExecFetch(`/submission/status/${studentId}/${questionId}?${q}`);
  },

  /** Queue stats */
  getQueueStats: () => mlExecFetch('/queue/stats'),

  /** Admin: Fetch latest ML execution result (stdout, graphs, images, metrics) for any student+question */
  getAdminExecution: (studentId: number | string, questionId: number | string, examId?: string | null) => {
    const q = new URLSearchParams({ studentId: String(studentId), questionId: String(questionId) });
    if (examId) q.set('examId', String(examId));
    return mlExecFetch(`/admin/execution?${q}`);
  },
};

// ─── Health API ───────────────────────────────────────────────────────────────
const HEALTH_BASE = ML_EXEC_BASE.replace('/api/ml-exec', '/api/health');

export const healthAPI = {
  ping:     () => fetch(`${HEALTH_BASE}/`).then(r => r.json()),
  runtime:  () => fetch(`${HEALTH_BASE}/runtime`).then(r => r.json()),
  docker:   () => fetch(`${HEALTH_BASE}/docker`).then(r => r.json()),
  database: () => fetch(`${HEALTH_BASE}/database`).then(r => r.json()),
  queue:    () => fetch(`${HEALTH_BASE}/queue`).then(r => r.json()),
  all:      () => fetch(`${HEALTH_BASE}/all`).then(r => r.json()),
};


// ==================== ADMIN APIs ====================
export const adminAPI = {
  login: (username: string, password: string) =>
    fetchAPI('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getQuestions: (department?: string, section?: string, year?: string, semester?: string, subject?: string, examDate?: string) => {
    const params = new URLSearchParams();
    if (department) params.append('department', department);
    if (section) params.append('section', section);
    if (year) params.append('year', year);
    if (semester) params.append('semester', semester);
    if (subject) params.append('subject', subject);
    if (examDate) params.append('examDate', examDate);

    return fetchAPI(`/admin/questions?${params.toString()}`);
  },

  addQuestion: (data: {
    department: string;
    section: string;
    year: string;
    semester: string;
    subject: string;
    question: string;
    questionType?: 'mcq' | 'fill_blank';
    options?: string[];
    correctIndex?: number;
    acceptedAnswers?: string[];
    // Legacy (auto-derived for 4-option MCQ)
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    correctOption?: string;
    imageUrl?: string;
    examDate?: string;
  }) =>
    fetchAPI('/admin/questions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteQuestion: (id: number) =>
    fetchAPI(`/admin/questions/${id}`, { method: 'DELETE' }),

  updateQuestion: (id: number, data: {
    department: string;
    section: string;
    year: string;
    semester: string;
    subject: string;
    question: string;
    questionType?: 'mcq' | 'fill_blank';
    options?: string[];
    correctIndex?: number;
    acceptedAnswers?: string[];
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    correctOption?: string;
    imageUrl?: string;
    examDate?: string;
  }) =>
    fetchAPI(`/admin/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Exam Config APIs
  getExamConfigs: (department?: string, section?: string, year?: string, semester?: string, subject?: string, examDate?: string) => {
    const params = new URLSearchParams();
    if (department) params.append('department', department);
    if (section) params.append('section', section);
    if (year) params.append('year', year);
    if (semester) params.append('semester', semester);
    if (subject) params.append('subject', subject);
    if (examDate) params.append('examDate', examDate);

    return fetchAPI(`/admin/exam-configs?${params.toString()}`);
  },

  getStudentsByContext: (department: string, year: string, semester: string, section: string) => {
    const params = new URLSearchParams();
    if (department) params.append('department', department);
    if (section) params.append('section', section);
    if (year) params.append('year', year);
    if (semester) params.append('semester', semester);

    // Call the studentAuth/all endpoint which returns students
    return fetchAPI(`/student-auth/all?${params.toString()}`);
  },

  upsertExamConfig: (data: {
    department: string;
    section: string;
    year: string;
    semester: string;
    subject: string;
    timeLimit: number;
    isActive: boolean;
    examDate?: string;
  }) =>
    fetchAPI('/admin/exam-config', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  saveAdvancedExamConfig: (data: {
    department: string;
    section: string;
    year: string;
    semester: string;
    subject: string;
    duration?: number;
    questionCount?: number;
    shuffle?: boolean;
    showPreviousScore?: boolean;
    enableCopyPaste?: boolean;
    autoSubmitTabSwitch?: boolean;
    is_active: boolean;
    examDate?: string;
  }) =>
    fetchAPI('/admin/exam-config/advanced', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  toggleExamStatus: (department: string, section: string, year: string, semester: string, subject: string, isActive: boolean, examDate?: string) =>
    fetchAPI('/admin/exam-config/toggle', {
      method: 'POST',
      body: JSON.stringify({ department, section, year, semester, subject, isActive, examDate }),
    }),

  toggleShuffleQuestions: (department: string, section: string, year: string, semester: string, subject: string, shuffleQuestions: boolean, examDate?: string) =>
    fetchAPI('/admin/exam-config/toggle-shuffle', {
      method: 'POST',
      body: JSON.stringify({ department, section, year, semester, subject, shuffleQuestions, examDate }),
    }),

  getResponses: (filters?: {
    date?: string;
    department?: string;
    section?: string;
    year?: string;
    semester?: string;
    subject?: string;
  }) => {
    const params = new URLSearchParams();

    if (filters?.date) params.append('date', filters.date);
    if (filters?.department) params.append('department', filters.department);
    if (filters?.section) params.append('section', filters.section);
    if (filters?.year) params.append('year', filters.year);
    if (filters?.semester) params.append('semester', filters.semester);
    if (filters?.subject) params.append('subject', filters.subject);

    const query = params.toString();
    return fetchAPI(`/admin/responses${query ? `?${query}` : ''}`);
  },

  deleteResponse: (id: number) =>
    fetchAPI(`/admin/responses/${id}`, { method: 'DELETE' }),

  rescoreResponses: () =>
    fetchAPI('/admin/responses/rescore', { method: 'POST' }),

  getResponseDetails: (id: number) =>
    fetchAPI(`/admin/response-details/${id}`),

  getGlobalResponsesCount: () =>
    fetchAPI('/admin/global-responses-count'),

  deleteResponsesByDate: (date: string) =>
    fetchAPI(`/admin/responses/by-date/${date}`, { method: 'DELETE' }),

  togglePreviousScores: (department: string, section: string, year: string, semester: string, subject: string, showPreviousScores: boolean, examDate?: string) =>
    fetchAPI('/admin/exam-config/toggle-previous-scores', {
      method: 'POST',
      body: JSON.stringify({ department, section, year, semester, subject, showPreviousScores, examDate }),
    }),

  seedQuestions: () =>
    fetchAPI('/admin/seed-questions', { method: 'POST' }),

  // Fetch distinct filter values (dept/section/year/semester/subject) that
  // actually exist in MySQL — used to populate filter dropdowns so they only
  // show values present in the data.
  getFilterOptions: (params?: {
    source?: 'responses' | 'questions' | 'students';
    department?: string;
    year?: string;
    semester?: string;
  }): Promise<{
    departments: { label: string; value: string }[];
    sections: { label: string; value: string }[];
    years: { label: string; value: string }[];
    semesters: { label: string; value: string }[];
    subjects: { label: string; value: string }[];
  }> => {
    const q = new URLSearchParams();
    if (params?.source) q.append('source', params.source);
    if (params?.department) q.append('department', params.department);
    if (params?.year) q.append('year', params.year);
    if (params?.semester) q.append('semester', params.semester);
    const qs = q.toString();
    return fetchAPI(`/admin/filter-options${qs ? `?${qs}` : ''}`);
  },
};


