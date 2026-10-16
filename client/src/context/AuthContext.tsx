import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isHr: boolean;
  isAttendanceViewer: boolean;
  isSuperAdmin: boolean; // Alias to isAdmin for backward compatibility
  isCompanyAdmin: boolean; // Alias to isAdmin
  canAccessAllBrands: boolean;
  canManageEmployees: boolean;
  canManageAttendance: boolean;
  canManageCompanies: boolean;
  canManageHrUsers: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('hrms_token'));
  const [loading, setLoading] = useState<boolean>(true);

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

  useEffect(() => {
    fetchUser();
  }, [token]);

  // Recalculate user role immediately when active company changes
  useEffect(() => {
    const handleCompanyChange = (e: any) => {
      const targetCompanyId = e.detail?.companyId;
      if (targetCompanyId && user?.companies) {
        const targetComp = user.companies.find((c: any) => c.id === targetCompanyId);
        if (targetComp && targetComp.role && user.role !== 'ADMIN') {
          setUser((prev) => (prev ? { ...prev, role: targetComp.role! } : null));
        }
      }
      fetchUser();
    };

    window.addEventListener('hrms:company-changed', handleCompanyChange);
    return () => {
      window.removeEventListener('hrms:company-changed', handleCompanyChange);
    };
  }, [user?.companies, user?.role]);

  const login = async (email: string, password: string) => {
    const data = await api.login({ email, password });
    localStorage.setItem('hrms_token', data.token);
    if (data.activeCompany?.id) {
      localStorage.setItem('hrms_active_company_id', data.activeCompany.id);
    }
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('hrms_token');
    localStorage.removeItem('hrms_selected_brand');
    localStorage.removeItem('hrms_active_company_id');
    setToken(null);
    setUser(null);
  };

  const isAdmin = user?.role === 'ADMIN';
  const isHr = user?.role === 'HR';
  const isAttendanceViewer = user?.role === 'ATTENDANCE_VIEWER';
  const isSuperAdmin = isAdmin;
  const isCompanyAdmin = isAdmin;
  const canAccessAllBrands = isAdmin || (isHr && !user?.brandId) || (isAttendanceViewer && !user?.brandId);
  const canManageEmployees = isAdmin || isHr;
  const canManageAttendance = isAdmin || isHr;
  const canManageCompanies = isAdmin;
  const canManageHrUsers = isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        refreshUser: fetchUser,
        isAuthenticated: !!user,
        isAdmin,
        isHr,
        isAttendanceViewer,
        isSuperAdmin,
        isCompanyAdmin,
        canAccessAllBrands,
        canManageEmployees,
        canManageAttendance,
        canManageCompanies,
        canManageHrUsers
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
