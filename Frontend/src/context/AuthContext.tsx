import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuthToken, setAuthToken } from '../api/client';
import type { AuthResponse } from '../types';

interface AuthContextType {
  user: AuthResponse | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (authData: AuthResponse) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(getAuthToken());
  const [user, setUser] = useState<AuthResponse | null>(() => {
    const saved = localStorage.getItem('kotoba_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = getAuthToken();
    if (savedToken && !user) {
      // Token exists, restore session or verify
      const saved = localStorage.getItem('kotoba_user');
      if (saved) {
        setUser(JSON.parse(saved));
      }
    }
    setIsLoading(false);
  }, []);

  const login = (authData: AuthResponse) => {
    setAuthToken(authData.token);
    setTokenState(authData.token);
    setUser(authData);
    localStorage.setItem('kotoba_user', JSON.stringify(authData));
  };

  const logout = () => {
    setAuthToken(null);
    setTokenState(null);
    setUser(null);
    localStorage.removeItem('kotoba_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        login,
        logout,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
