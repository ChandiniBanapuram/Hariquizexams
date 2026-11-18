import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface ITAdminContextType {
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const ITAdminContext = createContext<ITAdminContextType | undefined>(undefined);

export function ITAdminProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('itAdminToken');
  });

  useEffect(() => {
    const handler = () => {
      localStorage.removeItem('itAdminToken');
      setIsAuthenticated(false);
    };
    window.addEventListener('itadmin:logout', handler as EventListener);
    return () => window.removeEventListener('itadmin:logout', handler as EventListener);
  }, []);

  const login = (token: string) => {
    localStorage.setItem('itAdminToken', token);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('itAdminToken');
    setIsAuthenticated(false);
  };

  return (
    <ITAdminContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </ITAdminContext.Provider>
  );
}

export function useITAdmin() {
  const context = useContext(ITAdminContext);
  if (context === undefined) {
    throw new Error('useITAdmin must be used within an ITAdminProvider');
  }
  return context;
}
