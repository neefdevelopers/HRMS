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
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(() => {
    return localStorage.getItem('hrms_active_company_id');
  });
  const [loading, setLoading] = useState<boolean>(true);

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

      if (isAdmin) {
        list = await api.getCompanies();
      } else {
        const me = await api.getMe();
        list = me.companies || [];
      }

      setCompanies(list);

      // Determine active company
      const storedId = localStorage.getItem('hrms_active_company_id');
      let target: Company | undefined;

      if (storedId === 'all') {
        setActiveCompany(null);
        setActiveCompanyIdState('all');
        localStorage.setItem('hrms_active_company_id', 'all');
      } else if (storedId && list.some((c) => c.id === storedId)) {
        target = list.find((c) => c.id === storedId);
        setActiveCompany(target!);
        setActiveCompanyIdState(target!.id);
        localStorage.setItem('hrms_active_company_id', target!.id);
      } else if (user?.companyId && list.some((c) => c.id === user.companyId)) {
        target = list.find((c) => c.id === user.companyId);
        setActiveCompany(target!);
        setActiveCompanyIdState(target!.id);
        localStorage.setItem('hrms_active_company_id', target!.id);
      } else if (list.length > 0) {
        target = list[0];
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
  }, [isAuthenticated, isAdmin, user?.companyId]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const setActiveCompanyId = (id: string) => {
    if (id === 'all') {
      setActiveCompany(null);
      setActiveCompanyIdState('all');
      localStorage.setItem('hrms_active_company_id', 'all');
      // Reset selected brand to all when switching company
      localStorage.setItem('hrms_selected_brand', 'all');
      // Trigger event so dependent views refresh without stale cache
      window.dispatchEvent(new CustomEvent('hrms:company-changed', { detail: { companyId: 'all' } }));
      return;
    }

    const found = companies.find((c) => c.id === id);
    if (found) {
      setActiveCompany(found);
      setActiveCompanyIdState(id);
      localStorage.setItem('hrms_active_company_id', id);
      // Reset selected brand to all when switching company
      localStorage.setItem('hrms_selected_brand', 'all');
      // Trigger event so dependent views refresh without stale cache
      window.dispatchEvent(new CustomEvent('hrms:company-changed', { detail: { companyId: id } }));
    }
  };

  const canSwitchCompany = isAdmin || companies.length >= 1;

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
