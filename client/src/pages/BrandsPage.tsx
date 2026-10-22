import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { api } from '../services/api';
import { Brand, Department, Designation, Company } from '../types';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import {
  Building2,
  Plus,
  MapPin,
  Clock,
  Briefcase,
  Edit2,
  Trash2,
  Power,
  AlertTriangle,
  Mail,
  Phone,
  CheckCircle2,
  Users,
  Search,
  Layers,
  Sparkles,
  AlertCircle,
  X,
  Tag,
  Building,
  ChevronRight
} from 'lucide-react';

export const BrandsPage: React.FC = () => {
  const { user } = useAuth();
  const { activeCompany, companies } = useCompany();

  const isAdmin = user?.role === 'ADMIN';
  const isHr = user?.role === 'HR';
  const canManage = isAdmin || isHr;

  // Active view tab
  const [activeTab, setActiveTab] = useState<'brands' | 'departments' | 'designations'>('brands');

  // Master Data State
  const [brands, setBrands] = useState<Brand[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('all');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Notification message
  const [notification, setNotification] = useState<{ text: string; isError?: boolean } | null>(null);

  // Modal states for Brand
  const [isCreateBrandModalOpen, setIsCreateBrandModalOpen] = useState(false);
  const [isEditBrandModalOpen, setIsEditBrandModalOpen] = useState(false);
  const [createBrandError, setCreateBrandError] = useState<string | null>(null);
  const [editBrandError, setEditBrandError] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [statusModalBrand, setStatusModalBrand] = useState<Brand | null>(null);

  // Modal states for Department
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptForm, setDeptForm] = useState({
    name: '',
    code: '',
    brandId: '',
    description: '',
    isActive: true
  });
  const [deptSubmitting, setDeptSubmitting] = useState(false);
  const [deptError, setDeptError] = useState<string | null>(null);

  // Modal states for Designation
  const [isDesigModalOpen, setIsDesigModalOpen] = useState(false);
  const [editingDesig, setEditingDesig] = useState<Designation | null>(null);
  const [desigForm, setDesigForm] = useState({
    title: '',
    code: '',
    brandId: '',
    departmentId: '',
    description: '',
    isActive: true
  });
  const [desigSubmitting, setDesigSubmitting] = useState(false);
  const [desigError, setDesigError] = useState<string | null>(null);

  // Delete confirmation modal (for department or designation)
  const [deleteItem, setDeleteItem] = useState<{
    type: 'department' | 'designation';
    id: string;
    name: string;
    brandName?: string;
    employeeCount?: number;
  } | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

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
  const [brandSubmitting, setBrandSubmitting] = useState(false);

  const showNotification = (text: string, isError = false) => {
    setNotification({ text, isError });
    setTimeout(() => setNotification(null), 5000);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [bData, dData, desigData] = await Promise.all([
        api.getBrands(),
        api.getDepartments(),
        api.getDesignations()
      ]);
      setBrands(bData);
      setDepartments(dData);
      setDesignations(desigData);
    } catch (err: any) {
      console.error('Failed to load organization data:', err);
      showNotification(err.message || 'Failed to load organization data', true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, activeCompany?.id]);

  useEffect(() => {
    const handleCompanyChange = () => loadData();
    window.addEventListener('hrms:company-changed', handleCompanyChange);
    return () => window.removeEventListener('hrms:company-changed', handleCompanyChange);
  }, [loadData]);

  // ==========================================
  // BRAND ACTIONS
  // ==========================================
  const handleOpenCreateBrand = () => {
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
    setCreateBrandError(null);
    setIsCreateBrandModalOpen(true);
  };

  const handleOpenEditBrand = (b: Brand) => {
    setSelectedBrand(b);
    setEditBrandError(null);
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
    setIsEditBrandModalOpen(true);
  };

  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateBrandError(null);
    try {
      setBrandSubmitting(true);
      const targetCompanyId = isAdmin ? (brandForm.companyId || activeCompany?.id) : activeCompany?.id;
      if (!targetCompanyId) {
        setCreateBrandError('Please select a company for this brand.');
        setBrandSubmitting(false);
        return;
      }
      const selectedComp = companies.find((c) => c.id === targetCompanyId);

      await api.createBrand({
        ...brandForm,
        companyId: targetCompanyId,
        companyName: brandForm.companyName || selectedComp?.name || activeCompany?.name || ''
      });

      setIsCreateBrandModalOpen(false);
      showNotification(`Brand "${brandForm.name}" created successfully with default department and designation.`);
      loadData();
    } catch (err: any) {
      setCreateBrandError(err.message || 'Failed to create brand.');
    } finally {
      setBrandSubmitting(false);
    }
  };

  const handleUpdateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrand) return;
    setEditBrandError(null);
    try {
      setBrandSubmitting(true);
      await api.updateBrand(selectedBrand.id, {
        name: brandForm.name,
        code: brandForm.code,
        companyName: brandForm.companyName,
        companyId: isAdmin ? brandForm.companyId : undefined,
        email: brandForm.email || null,
        phone: brandForm.phone || null,
        address: brandForm.address || null
      });

      setIsEditBrandModalOpen(false);
      setSelectedBrand(null);
      showNotification(`Brand "${brandForm.name}" updated successfully.`);
      loadData();
    } catch (err: any) {
      setEditBrandError(err.message || 'Failed to update brand.');
    } finally {
      setBrandSubmitting(false);
    }
  };

  const handleConfirmToggleStatus = async () => {
    if (!statusModalBrand) return;
    try {
      await api.toggleBrandStatus(statusModalBrand.id, !statusModalBrand.isActive);
      showNotification(`Brand "${statusModalBrand.name}" status updated.`);
      setStatusModalBrand(null);
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to update brand status', true);
    }
  };

  // ==========================================
  // DEPARTMENT ACTIONS
  // ==========================================
  const handleOpenAddDepartment = (preselectedBrandId?: string) => {
    setEditingDept(null);
    setDeptError(null);
    setDeptForm({
      name: '',
      code: '',
      brandId: preselectedBrandId || (brands[0]?.id ?? ''),
      description: '',
      isActive: true
    });
    setIsDeptModalOpen(true);
  };

  const handleOpenEditDepartment = (dept: Department) => {
    setEditingDept(dept);
    setDeptError(null);
    setDeptForm({
      name: dept.name,
      code: dept.code,
      brandId: dept.brandId,
      description: dept.description || '',
      isActive: dept.isActive
    });
    setIsDeptModalOpen(true);
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeptError(null);
    if (!deptForm.name.trim()) {
      setDeptError('Department name is required.');
      return;
    }
    if (!deptForm.brandId) {
      setDeptError('Please select a target brand.');
      return;
    }

    try {
      setDeptSubmitting(true);
      if (editingDept) {
        await api.updateDepartment(editingDept.id, {
          name: deptForm.name,
          code: deptForm.code || undefined,
          description: deptForm.description || null,
          isActive: deptForm.isActive
        });
        showNotification(`Department "${deptForm.name}" updated successfully.`);
      } else {
        await api.createDepartment({
          name: deptForm.name,
          code: deptForm.code || undefined,
          brandId: deptForm.brandId,
          description: deptForm.description || undefined
        });
        showNotification(`Custom department "${deptForm.name}" created successfully.`);
      }
      setIsDeptModalOpen(false);
      setEditingDept(null);
      loadData();
    } catch (err: any) {
      setDeptError(err.message || 'Failed to save department.');
    } finally {
      setDeptSubmitting(false);
    }
  };

  // ==========================================
  // DESIGNATION ACTIONS
  // ==========================================
  const handleOpenAddDesignation = (preselectedBrandId?: string, preselectedDeptId?: string) => {
    setEditingDesig(null);
    setDesigError(null);
    const targetBrandId = preselectedBrandId || (brands[0]?.id ?? '');
    setDesigForm({
      title: '',
      code: '',
      brandId: targetBrandId,
      departmentId: preselectedDeptId || '',
      description: '',
      isActive: true
    });
    setIsDesigModalOpen(true);
  };

  const handleOpenEditDesignation = (desig: Designation) => {
    setEditingDesig(desig);
    setDesigError(null);
    setDesigForm({
      title: desig.title,
      code: desig.code,
      brandId: desig.brandId,
      departmentId: desig.departmentId || '',
      description: desig.description || '',
      isActive: desig.isActive ?? true
    });
    setIsDesigModalOpen(true);
  };

  const handleSaveDesignation = async (e: React.FormEvent) => {
    e.preventDefault();
    setDesigError(null);
    if (!desigForm.title.trim()) {
      setDesigError('Designation title is required.');
      return;
    }
    if (!desigForm.brandId) {
      setDesigError('Please select a target brand.');
      return;
    }

    try {
      setDesigSubmitting(true);
      if (editingDesig) {
        await api.updateDesignation(editingDesig.id, {
          title: desigForm.title,
          code: desigForm.code || undefined,
          departmentId: desigForm.departmentId || null,
          description: desigForm.description || null,
          isActive: desigForm.isActive
        });
        showNotification(`Designation "${desigForm.title}" updated successfully.`);
      } else {
        await api.createDesignation({
          title: desigForm.title,
          code: desigForm.code || undefined,
          brandId: desigForm.brandId,
          departmentId: desigForm.departmentId || undefined,
          description: desigForm.description || undefined
        });
        showNotification(`Custom designation "${desigForm.title}" created successfully.`);
      }
      setIsDesigModalOpen(false);
      setEditingDesig(null);
      loadData();
    } catch (err: any) {
      setDesigError(err.message || 'Failed to save designation.');
    } finally {
      setDesigSubmitting(false);
    }
  };

  // ==========================================
  // DELETE CONFIRMATION HANDLER
  // ==========================================
  const handleConfirmDelete = async () => {
    if (!deleteItem) return;
    try {
      setDeleteSubmitting(true);
      if (deleteItem.type === 'department') {
        await api.deleteDepartment(deleteItem.id);
        showNotification(`Department "${deleteItem.name}" deleted successfully.`);
      } else {
        await api.deleteDesignation(deleteItem.id);
        showNotification(`Designation "${deleteItem.name}" deleted successfully.`);
      }
      setDeleteItem(null);
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete item', true);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Switch to brand's filtered view
  const handleFilterBrand = (brandId: string, tab: 'departments' | 'designations') => {
    setSelectedBrandFilter(brandId);
    setActiveTab(tab);
  };

  // Filtered lists
  const filteredDepartments = useMemo(() => {
    return departments.filter((d) => {
      const matchBrand = selectedBrandFilter === 'all' || d.brandId === selectedBrandFilter;
      const matchSearch =
        searchQuery === '' ||
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.brand?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchBrand && matchSearch;
    });
  }, [departments, selectedBrandFilter, searchQuery]);

  const filteredDesignations = useMemo(() => {
    return designations.filter((des) => {
      const matchBrand = selectedBrandFilter === 'all' || des.brandId === selectedBrandFilter;
      const matchDept = selectedDeptFilter === 'all' || des.departmentId === selectedDeptFilter;
      const matchSearch =
        searchQuery === '' ||
        des.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        des.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        des.department?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        des.brand?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchBrand && matchDept && matchSearch;
    });
  }, [designations, selectedBrandFilter, selectedDeptFilter, searchQuery]);

  // Departments available for selected brand in designation modal
  const departmentsForDesigBrand = useMemo(() => {
    if (!desigForm.brandId) return [];
    return departments.filter((d) => d.brandId === desigForm.brandId);
  }, [departments, desigForm.brandId]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Organization Structure</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
              <Briefcase className="w-3 h-3 text-brand-600" />
              {activeCompany?.name || 'All Companies'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage company brands, customized departments, and designations / job roles.
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => handleOpenAddDepartment()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-brand-600" />
              <span>Add Department</span>
            </button>

            <button
              onClick={() => handleOpenAddDesignation()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-600" />
              <span>Add Designation</span>
            </button>

            <button
              onClick={handleOpenCreateBrand}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Brand</span>
            </button>
          </div>
        )}
      </div>

      {/* Floating Notification */}
      {notification && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-xs font-medium shadow-xs transition-all ${
            notification.isError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {notification.isError ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          )}
          <span>{notification.text}</span>
          <button
            onClick={() => setNotification(null)}
            className="ml-auto text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 gap-4 flex-wrap">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('brands')}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'brands'
                ? 'border-brand-600 text-brand-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Brands ({brands.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('departments')}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'departments'
                ? 'border-brand-600 text-brand-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Departments ({departments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('designations')}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'designations'
                ? 'border-brand-600 text-brand-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Designations / Roles ({designations.length})</span>
          </button>
        </div>

        {/* Brand context pill */}
        <div className="pb-3 text-xs text-slate-500 flex items-center gap-2">
          <span className="font-medium text-slate-400">Total Setup:</span>
          <span className="font-semibold text-slate-700">{brands.length} Brands</span>
          <span>•</span>
          <span className="font-semibold text-slate-700">{departments.length} Depts</span>
          <span>•</span>
          <span className="font-semibold text-slate-700">{designations.length} Roles</span>
        </div>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: BRANDS OVERVIEW */}
      {/* ============================================================ */}
      {activeTab === 'brands' && (
        <div className="space-y-6">
          {brands.length === 0 && !loading ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
              <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-900">No brands found</h3>
              <p className="text-xs text-slate-500 mt-1">
                {activeCompany
                  ? `No brands registered under ${activeCompany.name}.`
                  : 'No brands available in this context.'}
              </p>
              {canManage && (
                <button
                  onClick={handleOpenCreateBrand}
                  className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Register First Brand
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {brands.map((b) => {
                const brandDepts = departments.filter((d) => d.brandId === b.id);
                const brandDesigs = designations.filter((des) => des.brandId === b.id);

                return (
                  <Card
                    key={b.id}
                    className={`hover:border-slate-300 transition-all flex flex-col justify-between ${
                      !b.isActive ? 'bg-slate-50/70 border-slate-200 opacity-90' : ''
                    }`}
                  >
                    <div>
                      {/* Brand Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div
                            className={`p-2.5 rounded-lg shrink-0 ${
                              b.isActive ? 'bg-brand-50 text-brand-600' : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-sm font-bold text-slate-900 leading-snug truncate">
                                {b.name}
                              </h3>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200 uppercase shrink-0">
                                {b.code}
                              </span>
                            </div>

                            {/* Company Name Badge */}
                            <div className="flex items-center gap-1 text-[11px] text-brand-700 font-medium mt-1 truncate">
                              <Briefcase className="w-3 h-3 text-brand-500 shrink-0" />
                              <span className="truncate">{b.company?.name || b.companyName || 'Company'}</span>
                            </div>
                          </div>
                        </div>

                        <Badge variant={b.isActive ? 'success' : 'neutral'}>
                          {b.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>

                      {/* Statistics 3-way */}
                      <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 text-center bg-slate-50/60 rounded-lg my-2">
                        <div>
                          <span className="text-sm font-bold text-slate-900">{b._count?.employees ?? 0}</span>
                          <span className="block text-[10px] text-slate-400 uppercase font-semibold">Staff</span>
                        </div>
                        <div>
                          <span className="text-sm font-bold text-slate-900">{brandDepts.length}</span>
                          <span className="block text-[10px] text-slate-400 uppercase font-semibold">Depts</span>
                        </div>
                        <div>
                          <span className="text-sm font-bold text-slate-900">{brandDesigs.length}</span>
                          <span className="block text-[10px] text-slate-400 uppercase font-semibold">Roles</span>
                        </div>
                      </div>

                      {/* Quick Department & Designation Snippet */}
                      <div className="my-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-medium">Departments:</span>
                          <button
                            onClick={() => handleFilterBrand(b.id, 'departments')}
                            className="text-brand-600 hover:underline font-semibold flex items-center gap-0.5"
                          >
                            <span>View {brandDepts.length}</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          {brandDepts.slice(0, 3).map((dept) => (
                            <span
                              key={dept.id}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                            >
                              {dept.name}
                            </span>
                          ))}
                          {brandDepts.length > 3 && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              +{brandDepts.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Contact and Address */}
                      <div className="text-[11px] text-slate-500 space-y-1 mt-3">
                        {b.email && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{b.email}</span>
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
                    </div>

                    {/* Management Actions */}
                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenAddDepartment(b.id)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          title="Add a custom department to this brand"
                        >
                          <Plus className="w-3 h-3 text-brand-600" /> +Dept
                        </button>
                        <button
                          onClick={() => handleOpenAddDesignation(b.id)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          title="Add a custom job title/designation to this brand"
                        >
                          <Plus className="w-3 h-3 text-indigo-600" /> +Role
                        </button>
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditBrand(b)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                            title="Edit Brand details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setStatusModalBrand(b)}
                            className={`p-1.5 rounded-md transition-colors ${
                              b.isActive
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={b.isActive ? 'Deactivate brand' : 'Activate brand'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: DEPARTMENTS MANAGEMENT */}
      {/* ============================================================ */}
      {activeTab === 'departments' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search departments by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Brand:</span>
                <select
                  value={selectedBrandFilter}
                  onChange={(e) => setSelectedBrandFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="all">All Brands ({brands.length})</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              {canManage && (
                <button
                  onClick={() => handleOpenAddDepartment(selectedBrandFilter !== 'all' ? selectedBrandFilter : undefined)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold shadow-xs transition-colors ml-auto md:ml-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ New Department</span>
                </button>
              )}
            </div>
          </div>

          {/* Departments Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    <th className="py-3 px-4">Department & Code</th>
                    <th className="py-3 px-4">Brand</th>
                    <th className="py-3 px-4">Staff & Roles</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredDepartments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400">
                        <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-slate-700">No departments found.</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Click "+ New Department" to add customized departments for your brands.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredDepartments.map((dept) => (
                      <tr key={dept.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{dept.name}</span>
                              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold uppercase">
                                {dept.code}
                              </span>
                            </div>
                            {dept.description && (
                              <span className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                {dept.description}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800">
                              {dept.brand?.name || 'Brand'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({dept.brand?.code})
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              {dept._count?.employees || 0} Staff
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <Tag className="w-2.5 h-2.5 text-indigo-600" />
                              {dept._count?.designations || dept.designations?.length || 0} Roles
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <Badge variant={dept.isActive ? 'success' : 'neutral'}>
                            {dept.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenAddDesignation(dept.brandId, dept.id)}
                              className="px-2 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                              title="Add designation under this department"
                            >
                              + Role
                            </button>

                            <button
                              onClick={() => handleOpenEditDepartment(dept)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                              title="Edit Department"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() =>
                                setDeleteItem({
                                  type: 'department',
                                  id: dept.id,
                                  name: dept.name,
                                  brandName: dept.brand?.name,
                                  employeeCount: dept._count?.employees || 0
                                })
                              }
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                              title="Delete Department"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
              {filteredDepartments.length === 0 ? (
                <div className="py-8 px-4 text-center text-slate-400">
                  <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700 text-sm">No departments found.</p>
                </div>
              ) : (
                filteredDepartments.map((dept) => (
                  <div key={dept.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 text-sm">{dept.name}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase font-semibold">
                            {dept.code}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Brand: <span className="font-medium text-slate-800">{dept.brand?.name}</span>
                        </div>
                      </div>
                      <Badge variant={dept.isActive ? 'success' : 'neutral'}>
                        {dept.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    {dept.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">{dept.description}</p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="flex items-center gap-1 font-medium">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {dept._count?.employees || 0} Staff
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-medium text-indigo-700">
                          <Tag className="w-3 h-3 text-indigo-600" />
                          {dept._count?.designations || dept.designations?.length || 0} Roles
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenAddDesignation(dept.brandId, dept.id)}
                          className="px-2 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                        >
                          + Role
                        </button>
                        <button
                          onClick={() => handleOpenEditDepartment(dept)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteItem({
                              type: 'department',
                              id: dept.id,
                              name: dept.name,
                              brandName: dept.brand?.name,
                              employeeCount: dept._count?.employees || 0
                            })
                          }
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: DESIGNATIONS MANAGEMENT */}
      {/* ============================================================ */}
      {activeTab === 'designations' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search designations by title or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Brand:</span>
                <select
                  value={selectedBrandFilter}
                  onChange={(e) => {
                    setSelectedBrandFilter(e.target.value);
                    setSelectedDeptFilter('all');
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="all">All Brands ({brands.length})</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Department:</span>
                <select
                  value={selectedDeptFilter}
                  onChange={(e) => setSelectedDeptFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="all">All Departments</option>
                  {departments
                    .filter((d) => selectedBrandFilter === 'all' || d.brandId === selectedBrandFilter)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.brand?.name || 'Brand'})
                      </option>
                    ))}
                </select>
              </div>

              {canManage && (
                <button
                  onClick={() =>
                    handleOpenAddDesignation(
                      selectedBrandFilter !== 'all' ? selectedBrandFilter : undefined,
                      selectedDeptFilter !== 'all' ? selectedDeptFilter : undefined
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold shadow-xs transition-colors ml-auto md:ml-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ New Designation</span>
                </button>
              )}
            </div>
          </div>

          {/* Designations Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    <th className="py-3 px-4">Designation / Role & Code</th>
                    <th className="py-3 px-4">Brand & Department</th>
                    <th className="py-3 px-4">Staff Count</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredDesignations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400">
                        <Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-slate-700">No designations found.</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Click "+ New Designation" to add customized job titles/roles for your brands.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredDesignations.map((desig) => (
                      <tr key={desig.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{desig.title}</span>
                              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold uppercase">
                                {desig.code}
                              </span>
                            </div>
                            {desig.description && (
                              <span className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                {desig.description}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800">
                              {desig.brand?.name || 'Brand'}
                            </span>
                            <span className="text-slate-300">•</span>
                            {desig.department ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200">
                                <Layers className="w-3 h-3 text-brand-600" />
                                {desig.department.name}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Brand-wide</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            {desig._count?.employees || 0} Staff
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <Badge variant={(desig.isActive ?? true) ? 'success' : 'neutral'}>
                            {(desig.isActive ?? true) ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditDesignation(desig)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                              title="Edit Designation"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() =>
                                setDeleteItem({
                                  type: 'designation',
                                  id: desig.id,
                                  name: desig.title,
                                  brandName: desig.brand?.name,
                                  employeeCount: desig._count?.employees || 0
                                })
                              }
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                              title="Delete Designation"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
              {filteredDesignations.length === 0 ? (
                <div className="py-8 px-4 text-center text-slate-400">
                  <Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700 text-sm">No designations found.</p>
                </div>
              ) : (
                filteredDesignations.map((desig) => (
                  <div key={desig.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 text-sm">{desig.title}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase font-semibold">
                            {desig.code}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                          <span>{desig.brand?.name}</span>
                          <span>•</span>
                          <span>{desig.department?.name || 'Brand-wide'}</span>
                        </div>
                      </div>
                      <Badge variant={(desig.isActive ?? true) ? 'success' : 'neutral'}>
                        {(desig.isActive ?? true) ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    {desig.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">{desig.description}</p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {desig._count?.employees || 0} Assigned Staff
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditDesignation(desig)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteItem({
                              type: 'designation',
                              id: desig.id,
                              name: desig.title,
                              brandName: desig.brand?.name,
                              employeeCount: desig._count?.employees || 0
                            })
                          }
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: ADD / EDIT CUSTOM DEPARTMENT */}
      {/* ============================================================ */}
      <Modal
        isOpen={isDeptModalOpen}
        onClose={() => {
          setIsDeptModalOpen(false);
          setEditingDept(null);
          setDeptError(null);
        }}
        title={editingDept ? `Edit Department: ${editingDept.name}` : 'Add Customized Department'}
        description="Configure customized department taxonomy scoped to this brand and company."
      >
        <form onSubmit={handleSaveDepartment} className="space-y-4 text-xs">
          {deptError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{deptError}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Target Brand *</label>
            <select
              required
              disabled={!!editingDept}
              value={deptForm.brandId}
              onChange={(e) => setDeptForm({ ...deptForm, brandId: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded-lg bg-white disabled:bg-slate-100 text-xs"
            >
              <option value="">-- Select Brand --</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code}) — {b.company?.name || b.companyName}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Department Name *</label>
              <input
                required
                type="text"
                placeholder="e.g. Quality Assurance, Sales"
                value={deptForm.name}
                onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Department Code <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="Auto-generated if blank"
                value={deptForm.code}
                onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs uppercase font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description (Optional)</label>
            <textarea
              rows={2}
              placeholder="Outline department duties, function, or location..."
              value={deptForm.description}
              onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          {editingDept && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="deptActive"
                checked={deptForm.isActive}
                onChange={(e) => setDeptForm({ ...deptForm, isActive: e.target.checked })}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="deptActive" className="font-semibold text-slate-700 cursor-pointer">
                Department is Active
              </label>
            </div>
          )}

          <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-white/95 backdrop-blur-xs border-t border-slate-200 flex items-center justify-end gap-2 shadow-xs z-10">
            <button
              type="button"
              disabled={deptSubmitting}
              onClick={() => {
                setIsDeptModalOpen(false);
                setEditingDept(null);
                setDeptError(null);
              }}
              className="px-3.5 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={deptSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              {deptSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Department...</span>
                </>
              ) : (
                <span>{editingDept ? 'Save Changes' : 'Create Department'}</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL: ADD / EDIT CUSTOM DESIGNATION */}
      {/* ============================================================ */}
      <Modal
        isOpen={isDesigModalOpen}
        onClose={() => {
          setIsDesigModalOpen(false);
          setEditingDesig(null);
          setDesigError(null);
        }}
        title={editingDesig ? `Edit Designation: ${editingDesig.title}` : 'Add Customized Designation / Role'}
        description="Register customized job titles and roles under this brand and department."
      >
        <form onSubmit={handleSaveDesignation} className="space-y-4 text-xs">
          {desigError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{desigError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Target Brand *</label>
              <select
                required
                disabled={!!editingDesig}
                value={desigForm.brandId}
                onChange={(e) =>
                  setDesigForm({ ...desigForm, brandId: e.target.value, departmentId: '' })
                }
                className="w-full p-2 border border-slate-200 rounded-lg bg-white disabled:bg-slate-100 text-xs"
              >
                <option value="">-- Select Brand --</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Parent Department <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <select
                value={desigForm.departmentId}
                onChange={(e) => setDesigForm({ ...desigForm, departmentId: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white text-xs"
              >
                <option value="">-- General / Brand-wide --</option>
                {departmentsForDesigBrand.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Job Title / Designation *</label>
              <input
                required
                type="text"
                placeholder="e.g. Senior QA Engineer, Store Manager"
                value={desigForm.title}
                onChange={(e) => setDesigForm({ ...desigForm, title: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Designation Code <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="Auto-generated if blank"
                value={desigForm.code}
                onChange={(e) => setDesigForm({ ...desigForm, code: e.target.value.toUpperCase() })}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs uppercase font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description (Optional)</label>
            <textarea
              rows={2}
              placeholder="Outline responsibilities or requirements for this designation..."
              value={desigForm.description}
              onChange={(e) => setDesigForm({ ...desigForm, description: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          {editingDesig && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="desigActive"
                checked={desigForm.isActive}
                onChange={(e) => setDesigForm({ ...desigForm, isActive: e.target.checked })}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="desigActive" className="font-semibold text-slate-700 cursor-pointer">
                Designation is Active
              </label>
            </div>
          )}

          <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-white/95 backdrop-blur-xs border-t border-slate-200 flex items-center justify-end gap-2 shadow-xs z-10">
            <button
              type="button"
              disabled={desigSubmitting}
              onClick={() => {
                setIsDesigModalOpen(false);
                setEditingDesig(null);
                setDesigError(null);
              }}
              className="px-3.5 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={desigSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              {desigSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Designation...</span>
                </>
              ) : (
                <span>{editingDesig ? 'Save Changes' : 'Create Designation'}</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL: DELETE CONFIRMATION */}
      {/* ============================================================ */}
      <Modal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        title={`Delete ${deleteItem?.type === 'department' ? 'Department' : 'Designation'}`}
        description={`Confirmation for "${deleteItem?.name}"`}
      >
        <div className="space-y-4 text-xs">
          {deleteItem && (deleteItem.employeeCount || 0) > 0 ? (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Active Staff Assigned</p>
                <p className="mt-1 leading-relaxed">
                  There are currently{' '}
                  <strong className="underline">{deleteItem.employeeCount} active employee(s)</strong> assigned to
                  this {deleteItem.type}. To maintain data integrity, you must reassign these employees to another{' '}
                  {deleteItem.type} before deleting.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Are you sure?</p>
                <p className="mt-1 leading-relaxed">
                  Are you sure you want to permanently delete{' '}
                  <strong>"{deleteItem?.name}"</strong> from brand <strong>"{deleteItem?.brandName}"</strong>? This action
                  cannot be undone.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={deleteSubmitting}
              onClick={() => setDeleteItem(null)}
              className="px-3.5 py-1.5 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>

            {deleteItem && (deleteItem.employeeCount || 0) === 0 && (
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                {deleteSubmitting ? 'Deleting...' : `Yes, Delete ${deleteItem.type === 'department' ? 'Department' : 'Designation'}`}
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL: REGISTER NEW BRAND */}
      {/* ============================================================ */}
      <Modal
        isOpen={isCreateBrandModalOpen}
        onClose={() => setIsCreateBrandModalOpen(false)}
        title="Register New Brand"
        description="Every brand must belong to a company. Create a brand within the specified enterprise company."
      >
        <form onSubmit={handleCreateBrand} className="space-y-4 text-xs">
          {createBrandError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{createBrandError}</div>
              <button
                type="button"
                onClick={() => setCreateBrandError(null)}
                className="text-rose-400 hover:text-rose-600 p-0.5 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Company Selector */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Parent Company *</label>
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
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="">-- Select Company --</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700">
                <Briefcase className="w-4 h-4 text-brand-600" />
                <span>{activeCompany?.name || 'Current Company'}</span>
                <span className="text-[10px] text-slate-400 ml-auto font-mono">
                  ({activeCompany?.code || 'ID'})
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Brand Name *</label>
              <input
                required
                type="text"
                placeholder="e.g. Apex Lifestyle"
                value={brandForm.name}
                onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Brand Code *</label>
              <input
                required
                type="text"
                placeholder="e.g. APL"
                value={brandForm.code}
                onChange={(e) => setBrandForm({ ...brandForm, code: e.target.value.toUpperCase() })}
                className="w-full p-2 border border-slate-200 rounded-lg uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Company Legal Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. Apex Lifestyle Retail Pvt. Ltd."
              value={brandForm.companyName}
              onChange={(e) => setBrandForm({ ...brandForm, companyName: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contact Email</label>
              <input
                type="email"
                placeholder="hr@brand.com"
                value={brandForm.email}
                onChange={(e) => setBrandForm({ ...brandForm, email: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="text"
                placeholder="+91 98765 43210"
                value={brandForm.phone}
                onChange={(e) => setBrandForm({ ...brandForm, phone: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Official Address</label>
            <textarea
              rows={2}
              placeholder="Brand HQ or corporate operations address..."
              value={brandForm.address}
              onChange={(e) => setBrandForm({ ...brandForm, address: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-white/95 backdrop-blur-xs border-t border-slate-200 flex items-center justify-end gap-2 shadow-xs z-10">
            <button
              type="button"
              disabled={brandSubmitting}
              onClick={() => setIsCreateBrandModalOpen(false)}
              className="px-3.5 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={brandSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {brandSubmitting ? 'Registering...' : 'Register Brand'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL: EDIT BRAND */}
      {/* ============================================================ */}
      <Modal
        isOpen={isEditBrandModalOpen}
        onClose={() => setIsEditBrandModalOpen(false)}
        title={`Edit Brand: ${selectedBrand?.name}`}
        description="Modify registered brand information."
      >
        <form onSubmit={handleUpdateBrand} className="space-y-4 text-xs">
          {editBrandError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{editBrandError}</div>
              <button
                type="button"
                onClick={() => setEditBrandError(null)}
                className="text-rose-400 hover:text-rose-600 p-0.5 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Brand Name *</label>
              <input
                required
                type="text"
                value={brandForm.name}
                onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Brand Code *</label>
              <input
                required
                type="text"
                value={brandForm.code}
                onChange={(e) => setBrandForm({ ...brandForm, code: e.target.value.toUpperCase() })}
                className="w-full p-2 border border-slate-200 rounded-lg uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Company Legal Name *</label>
            <input
              required
              type="text"
              value={brandForm.companyName}
              onChange={(e) => setBrandForm({ ...brandForm, companyName: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contact Email</label>
              <input
                type="email"
                value={brandForm.email}
                onChange={(e) => setBrandForm({ ...brandForm, email: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="text"
                value={brandForm.phone}
                onChange={(e) => setBrandForm({ ...brandForm, phone: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Registered Address</label>
            <textarea
              rows={2}
              value={brandForm.address}
              onChange={(e) => setBrandForm({ ...brandForm, address: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-white/95 backdrop-blur-xs border-t border-slate-200 flex items-center justify-end gap-2 shadow-xs z-10">
            <button
              type="button"
              disabled={brandSubmitting}
              onClick={() => setIsEditBrandModalOpen(false)}
              className="px-3.5 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={brandSubmitting}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {brandSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL: STATUS TOGGLE CONFIRMATION */}
      {/* ============================================================ */}
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
        <div className="space-y-4 text-xs">
          {statusModalBrand?.isActive ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-start gap-2.5">
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
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Reactivate Brand</p>
                <p className="mt-0.5 text-emerald-700">
                  This brand will be reactivated and available for all normal employee operations and attendance logging.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStatusModalBrand(null)}
              className="px-3.5 py-1.5 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmToggleStatus}
              className={`px-4 py-1.5 font-semibold text-white rounded-lg shadow-xs ${
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

export default BrandsPage;
