// ==================== STUDENT AUTH API ====================

import { BASE_SERVER_URL } from '@/lib/api';

// Correct path: BASE_SERVER_URL/api/student-auth/<endpoint>
const API_BASE_URL = `${BASE_SERVER_URL}/api`;

async function fetchStudentAuth(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('studentToken');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  // Add a 15-second timeout so login doesn't hang forever (Render.com cold starts)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_BASE_URL}/student-auth${endpoint}`, {
      ...options,
      headers,
      signal: options.signal ?? controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ message: 'Request failed' }));
      if (response.status === 401) {
        localStorage.removeItem('studentToken');
        localStorage.removeItem('studentData');
        window.dispatchEvent(new CustomEvent('student:logout'));
      }
      const backendError = payload.error || null;
      return { ...payload, error: true, backendError };
    }

    return response.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      const isCloud = BASE_SERVER_URL.includes('onrender.com') || BASE_SERVER_URL.includes('render.com') || BASE_SERVER_URL.includes('hf.space');
      return {
        error: true,
        message: isCloud
          ? 'Request timed out. The server may be starting up — please try again in a moment.'
          : 'Request timed out connecting to the college server. Please try again. If the issue persists, ensure the backend is running and the database is accessible.'
      };
    }
    throw err;
  }
}


export interface StudentProfile {
  id: number;
  rollNumber: string;
  email: string;
  fullName: string;
  roll_number?: string;
  full_name?: string;
  department: string;
  section: string;
  year: string;
  semester: string;
  isMaster?: boolean;
}

export interface AvailableExam {
  id: number;
  department: string;
  section: string;
  year: string;
  semester: string;
  subject: string;
  time_limit: number;
  is_active: boolean;
  exam_date: string;
  question_count: number;
  examType?: 'coding' | 'quiz';
}

export interface PreviousScore {
  id: number;
  subject: string;
  score: number | null;
  total_marks: number;
  tab_switched: boolean;
  submitted_at: string;
  department: string;
  section: string;
  year: string;
  semester: string;
  score_hidden?: boolean;
}

export interface ScoreDetail {
  response: PreviousScore;
  questions: {
    id: number;
    question: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: string;
    image_url?: string;
  }[];
  studentAnswers: Record<string, string>;
}

export const studentAuthAPI = {
  register: (data: {
    rollNumber: string;
    email: string;
    password: string;
    fullName: string;
    department: string;
    section: string;
    year: string;
    semester: string;
  }) => fetchStudentAuth('/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (rollNumber: string, password: string) =>
    fetchStudentAuth('/login', { method: 'POST', body: JSON.stringify({ rollNumber, password }) }),

  forgotPassword: (email: string) =>
    fetchStudentAuth('/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (data: { email: string; otp: string; newPassword: string }) =>
    fetchStudentAuth('/reset-password', { method: 'POST', body: JSON.stringify(data) }),

  updateEmail: (email: string) =>
    fetchStudentAuth('/update-email', { method: 'POST', body: JSON.stringify({ email }) }),

  getProfile: (): Promise<StudentProfile> => fetchStudentAuth('/profile'),

  getAvailableExams: (): Promise<AvailableExam[]> => fetchStudentAuth('/available-exams'),

  getAvailableCodingExams: (): Promise<AvailableExam[]> => fetchStudentAuth('/available-coding-exams'),

  getPreviousScores: (): Promise<PreviousScore[]> => fetchStudentAuth('/previous-scores'),

  getScoreDetails: (responseId: number): Promise<ScoreDetail> => fetchStudentAuth(`/score-details/${responseId}`),
  getCodingScoreDetails: (submissionId: number): Promise<any> => fetchStudentAuth(`/coding-score-details/${submissionId}`),
};
