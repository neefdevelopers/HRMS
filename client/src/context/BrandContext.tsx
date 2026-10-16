import React, { createContext, useContext, useState, useEffect } from 'react';
import { Brand } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import { useCompany } from './CompanyContext';

interface BrandContextType {
  brands: Brand[];
  selectedBrandId: string;
  setSelectedBrandId: (id: string) => void;
  selectedBrand: Brand | null;
  loading: boolean;
  refreshBrands: () => Promise<void>;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export const BrandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, canAccessAllBrands } = useAuth();
  const { activeCompanyId } = useCompany();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandIdState] = useState<string>(() => {
    return localStorage.getItem('hrms_selected_brand') || 'all';
  });
  const [loading, setLoading] = useState<boolean>(true);

  const fetchBrands = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await api.getBrands();
      setBrands(data);

      // If user has a locked single brand, lock selection to their brand
      if (!canAccessAllBrands && user.brandId && brands.length <= 1) {
        setSelectedBrandIdState(user.brandId);
        localStorage.setItem('hrms_selected_brand', user.brandId);
      } else if (selectedBrandId !== 'all' && !data.find(b => b.id === selectedBrandId)) {
        // If stored brandId no longer exists in current context
        setSelectedBrandIdState('all');
        localStorage.setItem('hrms_selected_brand', 'all');
      }
    } catch (err) {
      console.error('Failed to load brands:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchBrands();
    }
  }, [user, activeCompanyId]);

  const setSelectedBrandId = (id: string) => {
    if (!canAccessAllBrands && brands.length <= 1 && id === 'all') return;
    setSelectedBrandIdState(id);
    localStorage.setItem('hrms_selected_brand', id);
    window.dispatchEvent(new CustomEvent('hrms:brand-changed', { detail: { brandId: id } }));
  };

  const selectedBrand = brands.find((b) => b.id === selectedBrandId) || null;

  return (
    <BrandContext.Provider
      value={{
        brands,
        selectedBrandId,
        setSelectedBrandId,
        selectedBrand,
        loading,
        refreshBrands: fetchBrands
      }}
    >
      {children}
    </BrandContext.Provider>
  );
};

export const useBrand = () => {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
};
