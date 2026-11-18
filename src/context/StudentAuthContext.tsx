import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { StudentProfile } from '@/lib/student-auth-api';

interface StudentAuthContextType {
  isAuthenticated: boolean;
  student: StudentProfile | null;
  login: (token: string, student: StudentProfile) => void;
  updateStudent: (studentData: Partial<StudentProfile>) => void;
  logout: () => void;
}

const StudentAuthContext = createContext<StudentAuthContextType | undefined>(undefined);

export function StudentAuthProvider({ children }: { children: ReactNode }) {
  const [student, setStudent] = useState<StudentProfile | null>(() => {
    const saved = localStorage.getItem('studentData');
    return saved ? JSON.parse(saved) : null;
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('studentToken'));

  useEffect(() => {
    const handleLogout = () => {
      setStudent(null);
      setIsAuthenticated(false);
    };
    window.addEventListener('student:logout', handleLogout);
    return () => window.removeEventListener('student:logout', handleLogout);
  }, []);

  const login = (token: string, studentData: StudentProfile) => {
    localStorage.setItem('studentToken', token);
    localStorage.setItem('studentData', JSON.stringify(studentData));
    setStudent(studentData);
    setIsAuthenticated(true);
  };

  const updateStudent = (data: Partial<StudentProfile>) => {
    setStudent(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...data };
      localStorage.setItem('studentData', JSON.stringify(updated));
      return updated;
    });
  };

  const logout = () => {
    localStorage.removeItem('studentToken');
    localStorage.removeItem('studentData');
    setStudent(null);
    setIsAuthenticated(false);
  };

  return (
    <StudentAuthContext.Provider value={{ isAuthenticated, student, login, updateStudent, logout }}>
      {children}
    </StudentAuthContext.Provider>
  );
}

export function useStudentAuth() {
  const context = useContext(StudentAuthContext);
  if (!context) throw new Error('useStudentAuth must be used within StudentAuthProvider');
  return context;
}
