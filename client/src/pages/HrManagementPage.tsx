import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Building2,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  ShieldAlert,
  ShieldCheck,
  Check,
  X,
  RefreshCw,
  Building,
  Briefcase
} from 'lucide-react';
import { api } from '../services/api';
import { HrUserSummary, Company, Role } from '../types';
import { useAuth } from '../context/AuthContext';

export const HrManagementPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [hrUsers, setHrUsers] = useState<HrUserSummary[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<HrUserSummary | null>(null);

  // Search filter inside company selectors
  const [companySearchCreate, setCompanySearchCreate] = useState<string>('');
  const [companySearchEdit, setCompanySearchEdit] = useState<string>('');

  // Form states for creation
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    role: 'HR' as Role,
    assignments: [] as Array<{ companyId: string; role: Role }>
  });
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state for assignment editing
  const [editAssignments, setEditAssignments] = useState<Array<{ companyId: string; role: Role }>>([]);
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, companiesData] = await Promise.all([
        api.getHrUsers(),
        api.getCompanies()
      ]);
      setHrUsers(usersData);
      setCompanies(companiesData);
    } catch (err: any) {
      console.error('Failed to load HR management data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered HR users
  const filteredUsers = useMemo(() => {
    return hrUsers.filter((u) => {
      const matchSearch =
        u.fullName.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());

      const matchCompany =
        selectedCompanyFilter === 'ALL'
          ? true
          : selectedCompanyFilter === 'UNASSIGNED'
          ? u.assignments.length === 0
          : u.assignments.some((a) => a.companyId === selectedCompanyFilter);

      const matchRole =
        roleFilter === 'ALL'
          ? true
          : u.role === roleFilter || u.assignments.some((a) => a.role === roleFilter);

      const matchStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'ACTIVE'
          ? u.isActive
          : !u.isActive;

      return matchSearch && matchCompany && matchRole && matchStatus;
    });
  }, [hrUsers, search, selectedCompanyFilter, roleFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = hrUsers.length;
    const active = hrUsers.filter((u) => u.isActive).length;
    const hrCount = hrUsers.filter((u) => u.role === 'HR').length;
    const viewerCount = hrUsers.filter((u) => u.role === 'ATTENDANCE_VIEWER').length;
    const multiComp = hrUsers.filter((u) => u.assignments.length > 1).length;
    const unassigned = hrUsers.filter((u) => u.assignments.length === 0).length;
    return { total, active, hrCount, viewerCount, multiComp, unassigned };
  }, [hrUsers]);

  // Create HR user submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);
    try {
      const primaryRole = formData.assignments.length > 0 ? formData.assignments[0].role : formData.role;
      await api.createHrUser({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone || undefined,
        role: primaryRole,
        assignments: formData.assignments
      });
      setIsCreateModalOpen(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        phone: '',
        role: 'HR',
        assignments: []
      });
      setCompanySearchCreate('');
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create user account.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open edit assignments modal
  const handleOpenEdit = (user: HrUserSummary) => {
    setEditingUser(user);
    setEditAssignments(
      user.assignments.map((a) => ({
        companyId: a.companyId,
        role: a.role || user.role || 'HR'
      }))
    );
    setCompanySearchEdit('');
    setEditError(null);
    setIsEditModalOpen(true);
  };

  // Save updated company assignments
  const handleSaveAssignments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      await api.updateHrCompanyAssignments(editingUser.id, {
        assignments: editAssignments
      });
      setIsEditModalOpen(false);
      setEditingUser(null);
      await loadData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update company assignments.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Toggle account status (Active / Inactive)
  const handleToggleStatus = async (user: HrUserSummary) => {
    try {
      await api.updateHrUser(user.id, { isActive: !user.isActive });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update status.');
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-rose-200">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900">Access Restricted</h3>
        <p className="text-sm text-slate-500 mt-1">
          Only Platform Administrators are authorized to manage HR users and company assignments.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-brand-600" />
            HR Management & Company Assignments
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Provision authorized HR users and configure their multi-company workspace access.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg transition-colors hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all shadow-brand-600/20"
          >
            <UserPlus className="w-4 h-4" />
            Add HR User
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Users</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">HR Personnel</p>
            <p className="text-2xl font-bold text-indigo-700 mt-0.5">{stats.hrCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Attendance Viewers</p>
            <p className="text-2xl font-bold text-amber-700 mt-0.5">{stats.viewerCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Accounts</p>
            <p className="text-2xl font-bold text-emerald-700 mt-0.5">{stats.active}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="ALL">All Roles</option>
              <option value="HR">HR Only</option>
              <option value="ATTENDANCE_VIEWER">Attendance Viewer Only</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Company:</span>
            <select
              value={selectedCompanyFilter}
              onChange={(e) => setSelectedCompanyFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="ALL">All Companies</option>
              <option value="UNASSIGNED">Unassigned Only</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table & Mobile Cards */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                <th className="py-3.5 px-4">User & Role</th>
                <th className="py-3.5 px-4">Company Assignments & Access</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading accounts...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No users found matching your search.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* User Profile & Primary Role */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center font-bold text-brand-700 text-xs shrink-0">
                          {user.firstName[0]}
                          {user.lastName[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-900 leading-tight">{user.fullName}</p>
                            <span
                              className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                                user.role === 'ATTENDANCE_VIEWER'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                              }`}
                            >
                              {user.role === 'ATTENDANCE_VIEWER' ? 'Viewer' : user.role}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Company Assignments & Roles */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap max-w-lg">
                        {user.assignments.length === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <ShieldAlert className="w-3 h-3 text-amber-600" />
                            No Company Assigned
                          </span>
                        ) : (
                          user.assignments.map((a) => (
                            <span
                              key={a.companyId}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-50 text-slate-800 border border-slate-200"
                            >
                              <Building2 className="w-3 h-3 text-indigo-600" />
                              <span className="font-semibold text-slate-900">{a.companyName}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                                  a.role === 'ATTENDANCE_VIEWER'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                }`}
                              >
                                {a.role === 'ATTENDANCE_VIEWER' ? 'Viewer' : a.role || 'HR'}
                              </span>
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {user.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          <XCircle className="w-3 h-3" />
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                          Manage Roles
                        </button>

                        <button
                          onClick={() => handleToggleStatus(user)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            user.isActive
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="sm:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading accounts...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              No users found matching your search.
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div key={user.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center font-bold text-brand-700 text-xs shrink-0">
                      {user.firstName[0]}
                      {user.lastName[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm">{user.fullName}</span>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                            user.role === 'ATTENDANCE_VIEWER'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {user.role === 'ATTENDANCE_VIEWER' ? 'Viewer' : user.role}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
                    </div>
                  </div>
                  {user.isActive ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                      <XCircle className="w-3 h-3" /> Inactive
                    </span>
                  )}
                </div>

                {/* Company assignments */}
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Assigned Companies</div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {user.assignments.length === 0 ? (
                      <span className="text-amber-700 text-xs flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> No company assigned
                      </span>
                    ) : (
                      user.assignments.map((a) => (
                        <span
                          key={a.companyId}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white text-slate-800 border border-slate-200 text-[11px]"
                        >
                          <Building2 className="w-3 h-3 text-indigo-600" />
                          <span className="font-medium">{a.companyName}</span>
                          <span className="text-[9px] font-bold text-indigo-700 uppercase">({a.role || 'HR'})</span>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenEdit(user)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-colors"
                  >
                    <Edit2 className="w-3 h-3 text-slate-500" /> Manage Roles
                  </button>
                  <button
                    onClick={() => handleToggleStatus(user)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                      user.isActive
                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ---------------- CREATE HR USER MODAL ---------------- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="shrink-0 px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add HR / User Account</h3>
                  <p className="text-[11px] text-slate-500">Add an HR Manager or Attendance Viewer account and assign companies</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                      placeholder="e.g. Maya"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                      placeholder="e.g. Patel"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="user@example.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Password *</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Phone (Optional)</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Default Account Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => {
                      const newRole = e.target.value as Role;
                      setFormData({
                        ...formData,
                        role: newRole,
                        assignments: formData.assignments.map((a) => ({ ...a, role: newRole }))
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="HR">HR Manager (Full company operations)</option>
                    <option value="ATTENDANCE_VIEWER">Attendance Viewer (Strictly read-only Attendance)</option>
                  </select>
                </div>

                {/* Company Assignment Checkbox List with Search & Per-Company Role */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Assign Companies &amp; Select Roles
                    </label>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {formData.assignments.length} assigned
                    </span>
                  </div>

                  {/* Company Search Filter */}
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={companySearchCreate}
                      onChange={(e) => setCompanySearchCreate(e.target.value)}
                      placeholder="Search companies by name or code..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    {companies.length === 0 ? (
                      <p className="text-xs text-slate-400 p-2">No active companies found.</p>
                    ) : (
                      companies
                        .filter((c) =>
                          c.name.toLowerCase().includes(companySearchCreate.toLowerCase()) ||
                          c.code.toLowerCase().includes(companySearchCreate.toLowerCase())
                        )
                        .map((c) => {
                          const existingAssoc = formData.assignments.find((a) => a.companyId === c.id);
                          const isChecked = !!existingAssoc;
                          const roleForCompany = existingAssoc ? existingAssoc.role : formData.role;

                          return (
                            <div
                              key={c.id}
                              className={`p-2 rounded-lg border transition-all ${
                                isChecked
                                  ? 'bg-indigo-50/60 border-indigo-200 shadow-xs'
                                  : 'bg-white border-slate-200/80 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setFormData({
                                          ...formData,
                                          assignments: [
                                            ...formData.assignments,
                                            { companyId: c.id, role: formData.role }
                                          ]
                                        });
                                      } else {
                                        setFormData({
                                          ...formData,
                                          assignments: formData.assignments.filter((a) => a.companyId !== c.id)
                                        });
                                      }
                                    }}
                                    className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                                  />
                                  <div className="min-w-0">
                                    <span className="text-xs font-semibold text-slate-900 block truncate">{c.name}</span>
                                    <span className="text-[10px] text-slate-400 font-mono uppercase">{c.code}</span>
                                  </div>
                                </label>

                                {isChecked && (
                                  <select
                                    value={roleForCompany}
                                    onChange={(e) => {
                                      const updatedRole = e.target.value as Role;
                                      setFormData({
                                        ...formData,
                                        assignments: formData.assignments.map((a) =>
                                          a.companyId === c.id ? { ...a, role: updatedRole } : a
                                        )
                                      });
                                    }}
                                    className="text-[11px] font-semibold py-1 px-2 rounded-md bg-white border border-indigo-200 text-indigo-900 focus:outline-none focus:ring-1 focus:ring-brand-500 shrink-0"
                                  >
                                    <option value="HR">HR Manager</option>
                                    <option value="ATTENDANCE_VIEWER">Attendance Viewer</option>
                                  </select>
                                )}
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>

              <div className="shrink-0 px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 z-10 shadow-xs">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {formSubmitting ? 'Adding HR User...' : 'Add HR User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- EDIT ASSIGNMENTS MODAL ---------------- */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="shrink-0 px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Manage Company Assignments</h3>
                  <p className="text-[11px] text-slate-500">Configure access for {editingUser.fullName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAssignments} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
                {editError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{editError}</span>
                  </div>
                )}

                <p className="text-xs text-slate-600 leading-relaxed">
                  Select the companies this account is authorized to access, and set the role for each company. Changes take effect immediately; removing a company revokes access in real-time.
                </p>

                {/* Company Search Filter */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={companySearchEdit}
                    onChange={(e) => setCompanySearchEdit(e.target.value)}
                    placeholder="Search companies by name or code..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                {/* Companies Multi-Select List with Roles */}
                <div className="max-h-60 overflow-y-auto p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  {companies
                    .filter((c) =>
                      c.name.toLowerCase().includes(companySearchEdit.toLowerCase()) ||
                      c.code.toLowerCase().includes(companySearchEdit.toLowerCase())
                    )
                    .map((c) => {
                      const currentAssignment = editAssignments.find((a) => a.companyId === c.id);
                      const isChecked = !!currentAssignment;
                      const role = currentAssignment ? currentAssignment.role : (editingUser.role || 'HR');

                      return (
                        <div
                          key={c.id}
                          className={`p-2.5 rounded-lg border transition-all ${
                            isChecked
                              ? 'bg-indigo-50/70 border-indigo-200 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEditAssignments([
                                      ...editAssignments,
                                      { companyId: c.id, role: editingUser.role || 'HR' }
                                    ]);
                                  } else {
                                    setEditAssignments(editAssignments.filter((a) => a.companyId !== c.id));
                                  }
                                }}
                                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                              />
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-slate-900 block truncate">{c.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono uppercase">{c.code}</span>
                              </div>
                            </label>

                            {isChecked && (
                              <select
                                value={role}
                                onChange={(e) => {
                                  const newRole = e.target.value as Role;
                                  setEditAssignments(
                                    editAssignments.map((a) =>
                                      a.companyId === c.id ? { ...a, role: newRole } : a
                                    )
                                  );
                                }}
                                className="text-[11px] font-semibold py-1 px-2.5 rounded-md bg-white border border-indigo-200 text-indigo-900 focus:outline-none focus:ring-1 focus:ring-brand-500 shrink-0"
                              >
                                <option value="HR">HR Manager</option>
                                <option value="ATTENDANCE_VIEWER">Attendance Viewer</option>
                              </select>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-500 space-y-1">
                  <div>
                    Assigned Companies: <strong className="text-slate-800">{editAssignments.length}</strong> (
                    <span className="text-indigo-700 font-semibold">
                      {editAssignments.filter((a) => a.role === 'HR').length} HR
                    </span>
                    ,{' '}
                    <span className="text-amber-700 font-semibold">
                      {editAssignments.filter((a) => a.role === 'ATTENDANCE_VIEWER').length} Viewer
                    </span>
                    )
                  </div>
                  {editAssignments.length === 0 && (
                    <span className="text-amber-600 block">
                      Warning: User will have zero company assignments and will see an unassigned account state until assigned to a company.
                    </span>
                  )}
                </div>
              </div>

              <div className="shrink-0 px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 z-10">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50 shadow-xs"
                >
                  {editSubmitting ? 'Saving...' : 'Save Assignments'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
