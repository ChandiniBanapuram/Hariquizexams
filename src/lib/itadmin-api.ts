// ==================== IT ADMIN API ====================

import { BASE_SERVER_URL } from '@/lib/api';

const API_BASE_URL = `${BASE_SERVER_URL}/api`;


async function fetchITAdmin(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('itAdminToken');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}/it-admin${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: 'Request failed' }));
    if (response.status === 401) {
      localStorage.removeItem('itAdminToken');
      window.dispatchEvent(new CustomEvent('itadmin:logout', { detail: payload }));
    }
    return payload;
  }

  return response.json();
}

export interface LookupItem {
  id: number;
  label: string;
  value: string;
  admin_username?: string;
  admin_password?: string;
}

export interface SubjectItem {
  id: number;
  department_value: string;
  year_value: string;
  semester_value: string;
  label: string;
  value: string;
}

export const itAdminAPI = {
  login: (username: string, password: string) =>
    fetchITAdmin('/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  // Departments
  getDepartments: () => fetchITAdmin('/departments'),
  addDepartment: (label: string, value: string, admin_username?: string, admin_password?: string) =>
    fetchITAdmin('/departments', { method: 'POST', body: JSON.stringify({ label, value, admin_username, admin_password }) }),
  updateDepartment: (id: number, label: string, value: string, admin_username?: string, admin_password?: string) =>
    fetchITAdmin(`/departments/${id}`, { method: 'PUT', body: JSON.stringify({ label, value, admin_username, admin_password }) }),
  deleteDepartment: (id: number) =>
    fetchITAdmin(`/departments/${id}`, { method: 'DELETE' }),

  // Sections
  getSections: () => fetchITAdmin('/sections'),
  addSection: (label: string, value: string) =>
    fetchITAdmin('/sections', { method: 'POST', body: JSON.stringify({ label, value }) }),
  deleteSection: (id: number) =>
    fetchITAdmin(`/sections/${id}`, { method: 'DELETE' }),

  // Years
  getYears: () => fetchITAdmin('/years'),
  addYear: (label: string, value: string) =>
    fetchITAdmin('/years', { method: 'POST', body: JSON.stringify({ label, value }) }),
  deleteYear: (id: number) =>
    fetchITAdmin(`/years/${id}`, { method: 'DELETE' }),

  // Semesters
  getSemesters: () => fetchITAdmin('/semesters'),
  addSemester: (label: string, value: string) =>
    fetchITAdmin('/semesters', { method: 'POST', body: JSON.stringify({ label, value }) }),
  deleteSemester: (id: number) =>
    fetchITAdmin(`/semesters/${id}`, { method: 'DELETE' }),

  // Subjects
  getSubjects: (department?: string, year?: string, semester?: string) => {
    const params = new URLSearchParams();
    if (department) params.append('department', department);
    if (year) params.append('year', year);
    if (semester) params.append('semester', semester);
    return fetchITAdmin(`/subjects?${params.toString()}`);
  },
  addSubject: (data: { department_value: string; year_value: string; semester_value: string; label: string; value: string }) =>
    fetchITAdmin('/subjects', { method: 'POST', body: JSON.stringify(data) }),
  deleteSubject: (id: number) =>
    fetchITAdmin(`/subjects/${id}`, { method: 'DELETE' }),

  // Students (uses student-auth route)
  getStudents: (department?: string, year?: string, semester?: string, section?: string) => {
    const params = new URLSearchParams();
    if (department) params.append('department', department);
    if (year) params.append('year', year);
    if (semester) params.append('semester', semester);
    if (section) params.append('section', section);
    return fetch(`${API_BASE_URL}/student-auth/all?${params.toString()}`).then(r => r.json()).catch(() => []);
  },
  deleteStudent: (id: number) => {
    return fetch(`${API_BASE_URL}/student-auth/${id}`, { method: 'DELETE' }).then(r => r.json());
  },
  promoteStudents: (data: { department?: string, fromYear: string, fromSem: string, toYear: string, toSem: string }) => {
    return fetch(`${API_BASE_URL}/student-auth/promote`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json());
  },
  getSettings: () => fetchITAdmin('/settings'),
  saveSettings: (settings: Record<string, string>) =>
    fetchITAdmin('/settings', { method: 'PUT', body: JSON.stringify(settings) }),
};

// ==================== PUBLIC LOOKUP API (no auth) ====================
const PUBLIC_BASE = API_BASE_URL + '/it-admin/public';

async function fetchPublic(endpoint: string) {
  const response = await fetch(`${PUBLIC_BASE}${endpoint}`);
  if (!response.ok) return [];
  return response.json();
}

export const lookupAPI = {
  getDepartments: (): Promise<{ label: string; value: string }[]> => fetchPublic('/departments'),
  getSections: (): Promise<{ label: string; value: string }[]> => fetchPublic('/sections'),
  getYears: (): Promise<{ label: string; value: string }[]> => fetchPublic('/years'),
  getSemesters: (): Promise<{ label: string; value: string }[]> => fetchPublic('/semesters'),
  getSubjects: (department?: string, year?: string, semester?: string): Promise<{ label: string; value: string }[]> => {
    const params = new URLSearchParams();
    if (department) params.append('department', department);
    if (year) params.append('year', year);
    if (semester) params.append('semester', semester);
    return fetchPublic(`/subjects?${params.toString()}`);
  },
  getSettings: async (): Promise<Record<string, string>> => {
    const response = await fetch(`${PUBLIC_BASE}/settings`);
    if (!response.ok) return {};
    return response.json().catch(() => ({}));
  },
};
