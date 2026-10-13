import React from 'react';
import { Building2, ChevronDown, LogOut, User as UserIcon, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBrand } from '../../context/BrandContext';

export const Navbar: React.FC = () => {
  const { user, logout, canAccessAllBrands } = useAuth();
  const { brands, selectedBrandId, setSelectedBrandId } = useBrand();

  const roleLabels: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    GROUP_HR: 'Group HR',
    BRAND_HR: 'Brand HR',
    MANAGER: 'Manager',
    EMPLOYEE: 'Employee'
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 px-4 sm:px-6 py-2.5 flex items-center justify-between">
      {/* Brand Selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
          <Building2 className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-medium text-slate-500 hidden sm:inline">Active Brand:</span>
          {canAccessAllBrands ? (
            <select
              value={selectedBrandId}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-900 border-none focus:outline-none focus:ring-0 cursor-pointer pr-4"
            >
              <option value="all">All Brands (Consolidated Group)</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs font-semibold text-slate-900">
              {user?.brand?.name || (brands.length > 0 ? brands[0].name : 'Assigned Brand')}
            </span>
          )}
        </div>
      </div>

      {/* User profile & actions */}
      <div className="flex items-center gap-4">
        {/* Role Pill */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-md border border-slate-200 text-xs text-slate-600 font-medium">
          <Shield className="w-3.5 h-3.5 text-slate-500" />
          <span>{user?.role ? roleLabels[user.role] || user.role : 'User'}</span>
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-slate-900 leading-tight">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[11px] text-slate-500 leading-tight truncate max-w-[160px]">
              {user?.email}
            </p>
          </div>

          <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 font-semibold text-xs">
            {user?.firstName?.[0]}
            {user?.lastName?.[0]}
          </div>

          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
