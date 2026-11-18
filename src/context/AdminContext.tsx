import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface AdminContextType {
  isAuthenticated: boolean;
  department: string | null;
  login: (token: string) => void;
  logout: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

function decodeDept(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.department || null;
  } catch {
    return null;
  }
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('adminToken'));
  const [department, setDepartment] = useState<string | null>(() => decodeDept(localStorage.getItem('adminToken')));

  useEffect(() => {
    const handler = () => {
      localStorage.removeItem('adminToken');
      setIsAuthenticated(false);
      setDepartment(null);
    };
    window.addEventListener('admin:logout', handler as EventListener);
    return () => window.removeEventListener('admin:logout', handler as EventListener);
  }, []);

  const login = (token: string) => {
    localStorage.setItem('adminToken', token);
    setIsAuthenticated(true);
    setDepartment(decodeDept(token));
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
    setDepartment(null);
  };

  return (
    <AdminContext.Provider value={{ isAuthenticated, department, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
