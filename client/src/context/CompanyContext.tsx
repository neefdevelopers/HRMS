import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Company } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface CompanyContextType {
  companies: Company[];
  activeCompany: Company | null;
  activeCompanyId: string | null;
  setActiveCompanyId: (id: string) => void;
  loading: boolean;
  refreshCompanies: () => Promise<void>;
  canSwitchCompany: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(() => {
    return localStorage.getItem('hrms_active_company_id');
  });
  const [loading, setLoading] = useState<boolean>(true);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const fetchCompanies = useCallback(async () => {
    if (!isAuthenticated) {
      setCompanies([]);
      setActiveCompany(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let list: Company[] = [];

      if (isSuperAdmin) {
        list = await api.getCompanies();
      } else {
        const me = await api.getMe();
        list = me.companies || [];
      }

      setCompanies(list);

      // Determine active company
      const storedId = localStorage.getItem('hrms_active_company_id');
      let target: Company | undefined;

      if (storedId && list.some((c) => c.id === storedId)) {
        target = list.find((c) => c.id === storedId);
      } else if (user?.companyId && list.some((c) => c.id === user.companyId)) {
        target = list.find((c) => c.id === user.companyId);
      } else if (list.length > 0) {
        target = list[0];
      }

      if (target) {
        setActiveCompany(target);
        setActiveCompanyIdState(target.id);
        localStorage.setItem('hrms_active_company_id', target.id);
      } else {
        setActiveCompany(null);
        setActiveCompanyIdState(null);
        localStorage.removeItem('hrms_active_company_id');
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isSuperAdmin, user?.companyId]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const setActiveCompanyId = (id: string) => {
    const found = companies.find((c) => c.id === id);
    if (found) {
      setActiveCompany(found);
      setActiveCompanyIdState(id);
      localStorage.setItem('hrms_active_company_id', id);
      // Reset selected brand to all when switching company
      localStorage.setItem('hrms_selected_brand', 'all');
      // Trigger a soft reload or window event so dependent components refresh
      window.dispatchEvent(new CustomEvent('hrms:company-changed', { detail: { companyId: id } }));
    }
  };

  const canSwitchCompany = isSuperAdmin || companies.length > 1;

  return (
    <CompanyContext.Provider
      value={{
        companies,
        activeCompany,
        activeCompanyId,
        setActiveCompanyId,
        loading,
        refreshCompanies: fetchCompanies,
        canSwitchCompany
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};
