import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { api } from '../services/api';
import { Brand, Branch, Department, Shift, Company } from '../types';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import {
  Building2,
  Plus,
  MapPin,
  Clock,
  Briefcase,
  Edit2,
  Power,
  AlertTriangle,
  Mail,
  Phone,
  CheckCircle2
} from 'lucide-react';

export const BrandsPage: React.FC = () => {
  const { user } = useAuth();
  const { activeCompany, companies } = useCompany();

  const isAdmin = user?.role === 'ADMIN';
  const isHr = user?.role === 'HR';
  const canManageBrands = isAdmin || isHr;

  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);

  // Status toggle confirmation modal
  const [statusModalBrand, setStatusModalBrand] = useState<Brand | null>(null);

  // Brand form state
  const [brandForm, setBrandForm] = useState({
    name: '',
    code: '',
    companyId: '',
    companyName: '',
    email: '',
    phone: '',
    address: '',
    isActive: true
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [bData, brData, dData, sData] = await Promise.all([
        api.getBrands(),
        api.getBranches(),
        api.getDepartments(),
        api.getShifts()
      ]);
      setBrands(bData);
      setBranches(brData);
      setDepartments(dData);
      setShifts(sData);
    } catch (err) {
      console.error('Failed to load organization data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh when active company changes
  useEffect(() => {
    loadData();
  }, [loadData, activeCompany?.id]);

  // Listen for company change events across the app
  useEffect(() => {
    const handleCompanyChange = () => {
      loadData();
    };
    window.addEventListener('hrms:company-changed', handleCompanyChange);
    return () => window.removeEventListener('hrms:company-changed', handleCompanyChange);
  }, [loadData]);

  const handleOpenCreateModal = () => {
    setBrandForm({
      name: '',
      code: '',
      companyId: activeCompany?.id || (companies[0]?.id ?? ''),
      companyName: activeCompany?.name || companies[0]?.name || '',
      email: '',
      phone: '',
      address: '',
      isActive: true
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (b: Brand) => {
    setSelectedBrand(b);
    setBrandForm({
      name: b.name,
      code: b.code,
      companyId: b.companyId,
      companyName: b.companyName,
      email: b.email || '',
      phone: b.phone || '',
      address: b.address || '',
      isActive: b.isActive
    });
    setIsEditModalOpen(true);
  };

  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Determine the company id
      const targetCompanyId = isAdmin ? (brandForm.companyId || activeCompany?.id) : activeCompany?.id;
      if (!targetCompanyId) {
        alert('Please select a company for this brand.');
        return;
      }

      const selectedComp = companies.find((c) => c.id === targetCompanyId);

      await api.createBrand({
        ...brandForm,
        companyId: targetCompanyId,
        companyName: brandForm.companyName || selectedComp?.name || activeCompany?.name || ''
      });

      setIsCreateModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create brand');
    }
  };

  const handleUpdateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrand) return;
    try {
      await api.updateBrand(selectedBrand.id, {
        name: brandForm.name,
        code: brandForm.code,
        companyName: brandForm.companyName,
        companyId: isAdmin ? brandForm.companyId : undefined,
        email: brandForm.email || null,
        phone: brandForm.phone || null,
        address: brandForm.address || null
      });

      setIsEditModalOpen(false);
      setSelectedBrand(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update brand');
    }
  };

  const handleConfirmToggleStatus = async () => {
    if (!statusModalBrand) return;
    try {
      await api.toggleBrandStatus(statusModalBrand.id, !statusModalBrand.isActive);
      setStatusModalBrand(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update brand status');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Brand & Organization Management</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
              <Briefcase className="w-3 h-3 text-brand-600" />
              {activeCompany?.name || 'All Companies'}
            </span>
          </div>
        </div>

        {canManageBrands && (
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Brand
          </button>
        )}
      </div>

      {/* Brands Cards */}
      {brands.length === 0 && !loading ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900">No brands found</h3>
          <p className="text-xs text-slate-500 mt-1">
            {activeCompany ? `No brands registered under ${activeCompany.name}.` : 'No brands available in this context.'}
          </p>
          {canManageBrands && (
            <button
              onClick={handleOpenCreateModal}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-xs"
            >
              <Plus className="w-4 h-4" /> Register First Brand
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {brands.map((b) => (
            <Card
              key={b.id}
              className={`hover:border-slate-300 transition-all ${
                !b.isActive ? 'bg-slate-50/70 border-slate-200 opacity-90' : ''
              }`}
            >
              {/* Brand Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-2.5">
                  <div
                    className={`p-2.5 rounded-lg shrink-0 ${
                      b.isActive ? 'bg-brand-50 text-brand-600' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">{b.name}</h3>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                        {b.code}
                      </span>
                    </div>

                    {/* Company Name Badge */}
                    <div className="flex items-center gap-1 text-[11px] text-brand-700 font-medium mt-1">
                      <Briefcase className="w-3 h-3 text-brand-500 shrink-0" />
                      <span className="truncate max-w-[190px]">
                        {b.company?.name || b.companyName || 'Company'}
                      </span>
                    </div>
                  </div>
                </div>

                <Badge variant={b.isActive ? 'success' : 'neutral'}>
                  {b.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              {/* Legal Name */}
              <p className="text-xs text-slate-600 mb-3 line-clamp-1 italic">
                {b.companyName || b.company?.name}
              </p>

              {/* Statistics */}
              <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 text-center bg-slate-50/50 rounded-md my-2">
                <div>
                  <span className="text-sm font-bold text-slate-900">{b._count?.employees ?? 0}</span>
                  <span className="block text-[10px] text-slate-400 uppercase font-semibold">Staff</span>
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-900">{b._count?.branches ?? 0}</span>
                  <span className="block text-[10px] text-slate-400 uppercase font-semibold">Branches</span>
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-900">{b._count?.departments ?? 0}</span>
                  <span className="block text-[10px] text-slate-400 uppercase font-semibold">Depts</span>
                </div>
              </div>

              {/* Contact and Address */}
              <div className="text-[11px] text-slate-500 space-y-1 mt-2">
                {b.email && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{b.email}</span>
                  </div>
                )}
                {b.phone && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{b.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 truncate">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">{b.address || 'Address registered'}</span>
                </div>
              </div>

              {/* Management Actions */}
              {canManageBrands && (
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenEditModal(b)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                  >
                    <Edit2 className="w-3 h-3 text-slate-500" /> Edit
                  </button>

                  <button
                    onClick={() => setStatusModalBrand(b)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      b.isActive
                        ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                        : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                    }`}
                  >
                    <Power className="w-3 h-3" />
                    {b.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Branches & Shifts Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Branches */}
        <Card
          title="Operating Branches"
        >
          {branches.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No branches found for this company.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {branches.map((br) => (
                <div key={br.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="font-semibold text-slate-900">{br.name}</span>
                      <span className="block text-[11px] text-slate-400">
                        {br.city}, {br.state || 'India'} • Brand: {br.brand?.name}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    {br.code}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Standard Shifts */}
        <Card
          title="Shift Configurations"
        >
          {shifts.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No shifts configured for this company.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {shifts.map((s) => (
                <div key={s.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="font-semibold text-slate-900">{s.name}</span>
                      <span className="block text-[11px] text-slate-400">
                        Grace: {s.gracePeriodMinutes} mins • Brand: {s.brand?.name}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                    {s.startTime} - {s.endTime}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Register New Brand Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register New Brand"
        description="Every brand must belong to a company. Create a brand within the specified enterprise company."
      >
        <form onSubmit={handleCreateBrand} className="space-y-4">
          {/* Company Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Parent Company *
            </label>
            {isAdmin ? (
              <select
                required
                value={brandForm.companyId}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const c = companies.find((item) => item.id === selectedId);
                  setBrandForm({
                    ...brandForm,
                    companyId: selectedId,
                    companyName: brandForm.companyName || c?.name || ''
                  });
                }}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="">-- Select Company --</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
                <Briefcase className="w-4 h-4 text-brand-600" />
                <span>{activeCompany?.name || 'Current Company'}</span>
                <span className="text-[10px] text-slate-400 ml-auto font-mono">
                  ({activeCompany?.code || 'ID'})
                </span>
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              A brand cannot exist independently of a company.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Name *</label>
              <input
                required
                type="text"
                placeholder="e.g. Apex Lifestyle"
                value={brandForm.name}
                onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Code *</label>
              <input
                required
                type="text"
                placeholder="e.g. APL"
                value={brandForm.code}
                onChange={(e) => setBrandForm({ ...brandForm, code: e.target.value.toUpperCase() })}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company Legal Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. Apex Lifestyle Retail Pvt. Ltd."
              value={brandForm.companyName}
              onChange={(e) => setBrandForm({ ...brandForm, companyName: e.target.value })}
              className="w-full text-xs p-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Email</label>
              <input
                type="email"
                placeholder="hr@brand.com"
                value={brandForm.email}
                onChange={(e) => setBrandForm({ ...brandForm, email: e.target.value })}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="text"
                placeholder="+91 98765 43210"
                value={brandForm.phone}
                onChange={(e) => setBrandForm({ ...brandForm, phone: e.target.value })}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Registered Address</label>
            <textarea
              rows={2}
              placeholder="Office or headquarters address"
              value={brandForm.address}
              onChange={(e) => setBrandForm({ ...brandForm, address: e.target.value })}
              className="w-full text-xs p-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-xs"
            >
              Create Brand
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Brand Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Brand"
        description="Update brand details and organizational metadata."
      >
        <form onSubmit={handleUpdateBrand} className="space-y-4">
          {/* Company info */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Parent Company</label>
            {isAdmin ? (
              <select
                value={brandForm.companyId}
                onChange={(e) => setBrandForm({ ...brandForm, companyId: e.target.value })}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
                <Briefcase className="w-4 h-4 text-brand-600" />
                <span>{selectedBrand?.company?.name || selectedBrand?.companyName}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Name *</label>
              <input
                required
                type="text"
                value={brandForm.name}
                onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Code *</label>
              <input
                required
                type="text"
                value={brandForm.code}
                onChange={(e) => setBrandForm({ ...brandForm, code: e.target.value.toUpperCase() })}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company Legal Name *</label>
            <input
              required
              type="text"
              value={brandForm.companyName}
              onChange={(e) => setBrandForm({ ...brandForm, companyName: e.target.value })}
              className="w-full text-xs p-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Email</label>
              <input
                type="email"
                value={brandForm.email}
                onChange={(e) => setBrandForm({ ...brandForm, email: e.target.value })}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="text"
                value={brandForm.phone}
                onChange={(e) => setBrandForm({ ...brandForm, phone: e.target.value })}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Registered Address</label>
            <textarea
              rows={2}
              value={brandForm.address}
              onChange={(e) => setBrandForm({ ...brandForm, address: e.target.value })}
              className="w-full text-xs p-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-xs"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Deactivate/Activate Confirmation Modal */}
      <Modal
        isOpen={!!statusModalBrand}
        onClose={() => setStatusModalBrand(null)}
        title={statusModalBrand?.isActive ? 'Deactivate Brand' : 'Activate Brand'}
        description={
          statusModalBrand?.isActive
            ? `Are you sure you want to deactivate "${statusModalBrand?.name}"?`
            : `Are you sure you want to reactivate "${statusModalBrand?.name}"?`
        }
      >
        <div className="space-y-4">
          {statusModalBrand?.isActive ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Safe Deactivation Policy</p>
                <p className="mt-0.5 text-amber-700 leading-relaxed">
                  Deactivating this brand will disable brand-level operations. However, all{' '}
                  <span className="font-semibold underline">
                    {statusModalBrand._count?.employees ?? 0} employees
                  </span>
                  , attendance history, and payroll records are completely preserved. No data will be deleted.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Reactivate Brand</p>
                <p className="mt-0.5 text-emerald-700">
                  This brand will be reactivated and available for all normal employee operations and attendance logging.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStatusModalBrand(null)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmToggleStatus}
              className={`px-4 py-1.5 text-xs font-semibold text-white rounded-lg shadow-xs ${
                statusModalBrand?.isActive
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {statusModalBrand?.isActive ? 'Yes, Deactivate Brand' : 'Yes, Activate Brand'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
