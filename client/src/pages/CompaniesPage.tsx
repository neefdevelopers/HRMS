import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { api } from '../services/api';
import { Company } from '../types';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import {
  Building2,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Power,
  ShieldCheck,
  Users,
  Building,
  Mail,
  Phone,
  MapPin,
  FileText,
  Calendar,
  ExternalLink,
  UserPlus,
  CheckCircle2,
  XCircle,
  Cpu
} from 'lucide-react';

export const CompaniesPage: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const { setActiveCompanyId, activeCompanyId, refreshCompanies } = useCompany();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isOverviewOpen, setIsOverviewOpen] = useState<boolean>(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [overviewData, setOverviewData] = useState<any | null>(null);
  const [overviewLoading, setOverviewLoading] = useState<boolean>(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    address: '',
    registrationNumber: '',
    taxNumber: '',
    adminEmail: '',
    adminPassword: '',
    adminFirstName: '',
    adminLastName: ''
  });

  const [editForm, setEditForm] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    address: '',
    registrationNumber: '',
    taxNumber: ''
  });

  const [adminForm, setAdminForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'COMPANY_ADMIN'
  });

  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const data = await api.getCompanies();
      setCompanies(data);
    } catch (err: any) {
      console.error('Failed to load companies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && c.isActive) ||
        (statusFilter === 'INACTIVE' && !c.isActive);
      return matchSearch && matchStatus;
    });
  }, [companies, search, statusFilter]);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.createCompany(createForm);
      setIsCreateModalOpen(false);
      setCreateForm({
        name: '',
        code: '',
        email: '',
        phone: '',
        address: '',
        registrationNumber: '',
        taxNumber: '',
        adminEmail: '',
        adminPassword: '',
        adminFirstName: '',
        adminLastName: ''
      });
      await loadCompanies();
      await refreshCompanies();
    } catch (err: any) {
      alert(err.message || 'Failed to create company');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (c: Company) => {
    setSelectedCompany(c);
    setEditForm({
      name: c.name,
      code: c.code,
      email: c.email,
      phone: c.phone || '',
      address: c.address || '',
      registrationNumber: c.registrationNumber || '',
      taxNumber: c.taxNumber || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;
    try {
      setSubmitting(true);
      await api.updateCompany(selectedCompany.id, editForm);
      setIsEditModalOpen(false);
      await loadCompanies();
      await refreshCompanies();
    } catch (err: any) {
      alert(err.message || 'Failed to update company');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (c: Company) => {
    const nextStatus = !c.isActive;
    const confirmMsg = nextStatus
      ? `Activate company "${c.name}"?`
      : `Deactivate company "${c.name}"? Users belonging to this company will not be able to log in.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.toggleCompanyStatus(c.id, nextStatus);
      await loadCompanies();
      await refreshCompanies();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleOpenOverview = async (c: Company) => {
    setSelectedCompany(c);
    setIsOverviewOpen(true);
    try {
      setOverviewLoading(true);
      const data = await api.getCompanyOverview(c.id);
      setOverviewData(data);
    } catch (err: any) {
      console.error('Failed to load overview:', err);
    } finally {
      setOverviewLoading(false);
    }
  };

  const handleOpenAdminModal = (c: Company) => {
    setSelectedCompany(c);
    setAdminForm({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      role: 'COMPANY_ADMIN'
    });
    setIsAdminModalOpen(true);
  };

  const handleAssignAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;
    try {
      setSubmitting(true);
      await api.assignCompanyAdmin(selectedCompany.id, adminForm);
      setIsAdminModalOpen(false);
      alert('Company administrator assigned successfully');
      if (isOverviewOpen) {
        handleOpenOverview(selectedCompany);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to assign administrator');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchToCompany = (c: Company) => {
    setActiveCompanyId(c.id);
    alert(`Switched workspace context to: ${c.name}`);
  };

  if (!isSuperAdmin) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white border border-slate-200 rounded-2xl text-center shadow-xs">
        <ShieldCheck className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900">Restricted Access</h2>
        <p className="text-xs text-slate-500 mt-1">
          Company Management is strictly reserved for Platform Super Administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Companies Management</h1>
            <Badge variant="info">Multi-Tenant Platform</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage independent customer companies, administrative accounts, and tenant isolation parameters.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Company
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Registered Companies</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{companies.length}</p>
            </div>
            <div className="p-3 bg-brand-50 text-brand-600 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Active Companies</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {companies.filter((c) => c.isActive).length}
              </p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Inactive Companies</p>
              <p className="text-2xl font-bold text-slate-500 mt-1">
                {companies.filter((c) => !c.isActive).length}
              </p>
            </div>
            <div className="p-3 bg-slate-100 text-slate-500 rounded-xl">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Active Context</p>
              <p className="text-xs font-bold text-brand-700 mt-1 truncate max-w-[150px]">
                {companies.find((c) => c.id === activeCompanyId)?.name || 'Default Context'}
              </p>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search company by name, code, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:bg-white focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Companies Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Company</th>
                <th className="px-5 py-3">Code & IDs</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Capacity</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading companies...
                  </td>
                </tr>
              ) : filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    No companies found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((company) => {
                  const isCurrent = company.id === activeCompanyId;
                  return (
                    <tr
                      key={company.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isCurrent ? 'bg-brand-50/20' : ''
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
                            {company.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">{company.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-brand-100 text-brand-700 border border-brand-200">
                                  Current
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400">{company.email}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-mono text-[11px] font-semibold text-slate-800">
                          {company.code}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">
                          {company.id}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="text-slate-700">{company.phone || '—'}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                          {company.address || '—'}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3 text-[11px] text-slate-600">
                          <span title="Brands" className="flex items-center gap-1">
                            <Building className="w-3.5 h-3.5 text-slate-400" />
                            {company._count?.brands || 0}
                          </span>
                          <span title="Employees" className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            {company._count?.employees || 0}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <Badge variant={company.isActive ? 'success' : 'neutral'}>
                          {company.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>

                      <td className="px-5 py-3.5 text-[11px] text-slate-400">
                        {new Date(company.createdAt).toLocaleDateString()}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleSwitchToCompany(company)}
                            className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                            title="Switch Workspace Context"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenOverview(company)}
                            className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                            title="View Overview"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenAdminModal(company)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Assign Admin"
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(company)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit Details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(company)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              company.isActive
                                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={company.isActive ? 'Deactivate' : 'Activate'}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- CREATE COMPANY MODAL ---------------- */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register New Company (Tenant)"
        description="Creates an isolated tenant company with separate brands, employees, attendance, and payroll."
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateCompany} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name *</label>
              <input
                type="text"
                required
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="e.g. Acme Corporation"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company Code *</label>
              <input
                type="text"
                required
                value={createForm.code}
                onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
                placeholder="e.g. ACME_CORP"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company Email *</label>
              <input
                type="email"
                required
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="info@acme.com"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                placeholder="+1 555-0199"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Registered Address</label>
              <textarea
                rows={2}
                value={createForm.address}
                onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                placeholder="HQ street address, city, country..."
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Registration No. (Optional)</label>
              <input
                type="text"
                value={createForm.registrationNumber}
                onChange={(e) => setCreateForm({ ...createForm, registrationNumber: e.target.value })}
                placeholder="e.g. REG-88273"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tax / VAT ID (Optional)</label>
              <input
                type="text"
                value={createForm.taxNumber}
                onChange={(e) => setCreateForm({ ...createForm, taxNumber: e.target.value })}
                placeholder="e.g. TAX-US-991"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
          </div>

          {/* Optional Admin creation block */}
          <div className="pt-4 mt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-brand-600" />
              Initial Company Administrator (Optional)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200/80">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">First Name</label>
                <input
                  type="text"
                  value={createForm.adminFirstName}
                  onChange={(e) => setCreateForm({ ...createForm, adminFirstName: e.target.value })}
                  placeholder="John"
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Last Name</label>
                <input
                  type="text"
                  value={createForm.adminLastName}
                  onChange={(e) => setCreateForm({ ...createForm, adminLastName: e.target.value })}
                  placeholder="Doe"
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Admin Email</label>
                <input
                  type="email"
                  value={createForm.adminEmail}
                  onChange={(e) => setCreateForm({ ...createForm, adminEmail: e.target.value })}
                  placeholder="admin@acme.com"
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Password</label>
                <input
                  type="password"
                  value={createForm.adminPassword}
                  onChange={(e) => setCreateForm({ ...createForm, adminPassword: e.target.value })}
                  placeholder="••••••••"
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Creating...' : 'Register Company'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ---------------- EDIT COMPANY MODAL ---------------- */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Company Details"
        description="Update contact and organizational information."
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleUpdateCompany} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name *</label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company Code *</label>
              <input
                type="text"
                required
                value={editForm.code}
                onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
              <input
                type="email"
                required
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
              <textarea
                rows={2}
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Registration No.</label>
              <input
                type="text"
                value={editForm.registrationNumber}
                onChange={(e) => setEditForm({ ...editForm, registrationNumber: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tax / VAT ID</label>
              <input
                type="text"
                value={editForm.taxNumber}
                onChange={(e) => setEditForm({ ...editForm, taxNumber: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ---------------- ASSIGN ADMIN MODAL ---------------- */}
      <Modal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        title={`Assign Administrator for ${selectedCompany?.name}`}
        description="Creates or assigns an administrator role within this isolated company."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAssignAdmin} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Email *</label>
              <input
                type="email"
                required
                value={adminForm.email}
                onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                placeholder="admin@company.com"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">First Name</label>
                <input
                  type="text"
                  value={adminForm.firstName}
                  onChange={(e) => setAdminForm({ ...adminForm, firstName: e.target.value })}
                  placeholder="Jane"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={adminForm.lastName}
                  onChange={(e) => setAdminForm({ ...adminForm, lastName: e.target.value })}
                  placeholder="Doe"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password (required if creating new user)
              </label>
              <input
                type="password"
                value={adminForm.password}
                onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                placeholder="••••••••"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
              <select
                value={adminForm.role}
                onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              >
                <option value="COMPANY_ADMIN">Company Administrator</option>
                <option value="COMPANY_HR">Company HR Lead</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAdminModalOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Assigning...' : 'Assign Role'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ---------------- OVERVIEW DRAWER / MODAL ---------------- */}
      <Modal
        isOpen={isOverviewOpen}
        onClose={() => setIsOverviewOpen(false)}
        title={`Company Overview: ${selectedCompany?.name}`}
        description={`Tenant ID: ${selectedCompany?.id}`}
        maxWidth="max-w-3xl"
      >
        {overviewLoading || !overviewData ? (
          <div className="p-8 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading company overview metrics...
          </div>
        ) : (
          <div className="space-y-5">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <span className="text-[11px] font-medium text-slate-500 block">Brands</span>
                <span className="text-xl font-bold text-slate-900">
                  {overviewData.brands?.length || 0}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <span className="text-[11px] font-medium text-slate-500 block">Employees</span>
                <span className="text-xl font-bold text-slate-900">
                  {overviewData.employeeCount || 0}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <span className="text-[11px] font-medium text-slate-500 block">Punch Devices</span>
                <span className="text-xl font-bold text-slate-900">
                  {overviewData.punchingDeviceCount || 0}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <span className="text-[11px] font-medium text-slate-500 block">Active Exits</span>
                <span className="text-xl font-bold text-slate-900">
                  {overviewData.activeExitCount || 0}
                </span>
              </div>
            </div>

            {/* Brands in this Company */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-brand-600" />
                Company Brands ({overviewData.brands?.length || 0})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {overviewData.brands?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No brands configured yet.</p>
                ) : (
                  overviewData.brands.map((b: any) => (
                    <div
                      key={b.id}
                      className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-xs text-slate-900">{b.name}</span>
                        <span className="text-[10px] font-mono text-slate-400 ml-1.5">
                          ({b.code})
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {b._count?.branches || 0} branches • {b._count?.employees || 0} staff
                        </div>
                      </div>
                      <Badge variant={b.isActive ? 'success' : 'neutral'}>
                        {b.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Company Administrators */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  Assigned Company Administrators ({overviewData.adminMemberships?.length || 0})
                </h4>
                <button
                  onClick={() => selectedCompany && handleOpenAdminModal(selectedCompany)}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Assign Admin</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
                {overviewData.adminMemberships?.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 italic">
                    No administrators explicitly assigned yet. Platform Super Admins can administer this company.
                  </div>
                ) : (
                  overviewData.adminMemberships.map((m: any) => (
                    <div key={m.id} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-slate-900">
                          {m.user?.firstName} {m.user?.lastName}
                        </span>
                        <span className="text-slate-400 ml-2">{m.user?.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold text-[10px]">
                          {m.role}
                        </span>
                        <Badge variant={m.isActive ? 'success' : 'neutral'}>
                          {m.isActive ? 'Active' : 'Suspended'}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Actions footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                onClick={() => selectedCompany && handleSwitchToCompany(selectedCompany)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Switch workspace to this company</span>
              </button>

              <button
                type="button"
                onClick={() => setIsOverviewOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
