import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isCompanyAdmin: boolean;
  canAccessAllBrands: boolean;
  canManageEmployees: boolean;
  canManageAttendance: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('hrms_token'));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const userData = await api.getMe();
        setUser(userData);
        if (userData.activeCompany?.id && !localStorage.getItem('hrms_active_company_id')) {
          localStorage.setItem('hrms_active_company_id', userData.activeCompany.id);
        }
      } catch (err) {
        console.error('Failed to restore session:', err);
        localStorage.removeItem('hrms_token');
        localStorage.removeItem('hrms_active_company_id');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [token]);

  const login = async (email: string, password: string) => {
    const data = await api.login({ email, password });
    localStorage.setItem('hrms_token', data.token);
    if (data.activeCompany?.id) {
      localStorage.setItem('hrms_active_company_id', data.activeCompany.id);
    }
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('hrms_token');
    localStorage.removeItem('hrms_selected_brand');
    localStorage.removeItem('hrms_active_company_id');
    setToken(null);
    setUser(null);
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isCompanyAdmin = user?.role === 'COMPANY_ADMIN';
  const isCompanyHr = user?.role === 'COMPANY_HR' || user?.role === 'GROUP_HR';
  const canAccessAllBrands = isSuperAdmin || isCompanyAdmin || isCompanyHr;
  const canManageEmployees = isSuperAdmin || isCompanyAdmin || isCompanyHr || user?.role === 'BRAND_HR';
  const canManageAttendance = isSuperAdmin || isCompanyAdmin || isCompanyHr || user?.role === 'BRAND_HR';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
        isSuperAdmin,
        isCompanyAdmin,
        canAccessAllBrands,
        canManageEmployees,
        canManageAttendance
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
