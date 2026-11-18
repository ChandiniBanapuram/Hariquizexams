import { Navigate } from 'react-router-dom';
import { useStudentAuth } from '@/context/StudentAuthContext';
import { ReactNode } from 'react';

export function StudentProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useStudentAuth();
  if (!isAuthenticated) return <Navigate to="/student/login" replace />;
  return <>{children}</>;
}
