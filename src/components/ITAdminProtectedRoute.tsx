import { Navigate } from 'react-router-dom';
import { useITAdmin } from '@/context/ITAdminContext';
import { ReactNode } from 'react';

export function ITAdminProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useITAdmin();
  if (!isAuthenticated) {
    return <Navigate to="/it-admin" replace />;
  }
  return <>{children}</>;
}
