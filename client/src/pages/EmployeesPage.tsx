import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Badge, BadgeVariant } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { api } from '../services/api';
import {
  Employee,
  Brand,
  Department,
  Designation,
  Shift,
  EmployeeCompleteProfile,
  EmployeeDocument
} from '../types';
import { useBrand } from '../context/BrandContext';
import { useCompany } from '../context/CompanyContext';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  Plus,
  Filter,
  User,
  Mail,
  Phone,
  Building,
  Calendar,
  Clock,
  Banknote,
  FileText,
  Download,
  Trash2,
  Edit2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  FileUp,
  Briefcase,
  Coffee,
  Check,
  RefreshCw,
  FileCheck2,
  CalendarDays,
  X
} from 'lucide-react';

export const EmployeesPage: React.FC = () => {
  const { id: routeEmployeeId } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const { activeCompanyId, activeCompany } = useCompany();
  const { selectedBrandId } = useBrand();
  const { canManageEmployees, user } = useAuth();
  const isHrOrAdmin = user?.role === 'ADMIN' || user?.role === 'HR';

  // Master List State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Selected Employee Details State
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(routeEmployeeId || null);
  const [profileData, setProfileData] = useState<EmployeeCompleteProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<'profile' | 'attendance' | 'leave' | 'salary' | 'documents'>('profile');
  const [attendanceSubView, setAttendanceSubView] = useState<'daily' | 'punches'>('daily');

  // Form options
  const [brands, setBrands] = useState<Brand[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  // Add Employee Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmployeeForm, setNewEmployeeForm] = useState({
    employeeId: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    brandId: '',
    departmentId: '',
    designationId: '',
    shiftId: '',
    joiningDate: new Date().toISOString().split('T')[0],
    biometricId: '',
    gender: 'MALE',
    dateOfBirth: '',
    monthlySalary: ''
  });

  // Edit Employee Profile Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});

  // Document Upload Modal
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docForm, setDocForm] = useState({
    title: '',
    category: 'GENERAL',
    description: '',
    fileName: '',
    fileType: '',
    fileSize: 0,
    fileUrl: ''
  });

  // Feedback notifications
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // In-modal error and loading states
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);

  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [isUpdatingEmployee, setIsUpdatingEmployee] = useState(false);

  const [docFormError, setDocFormError] = useState<string | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Quick Add Custom Department / Designation States
  const [isQuickDeptModalOpen, setIsQuickDeptModalOpen] = useState(false);
  const [quickDeptName, setQuickDeptName] = useState('');
  const [quickDeptCode, setQuickDeptCode] = useState('');
  const [quickDeptSubmitting, setQuickDeptSubmitting] = useState(false);
  const [quickDeptError, setQuickDeptError] = useState<string | null>(null);

  const [isQuickDesigModalOpen, setIsQuickDesigModalOpen] = useState(false);
  const [quickDesigTitle, setQuickDesigTitle] = useState('');
  const [quickDesigCode, setQuickDesigCode] = useState('');
  const [quickDesigSubmitting, setQuickDesigSubmitting] = useState(false);
  const [quickDesigError, setQuickDesigError] = useState<string | null>(null);

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 5000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  // Sync selectedEmpId with route param if URL changes
  useEffect(() => {
    if (routeEmployeeId) {
      setSelectedEmpId(routeEmployeeId);
    } else {
      setSelectedEmpId(null);
    }
  }, [routeEmployeeId]);

  // Load employee directory
  const loadEmployees = async () => {
    try {
      setLoading(true);
      const effectiveBrand = brandFilter || (selectedBrandId !== 'all' ? selectedBrandId : undefined);
      const targetCompany = activeCompanyId !== 'all' ? (activeCompanyId || activeCompany?.id || undefined) : undefined;
      const data = await api.getEmployees({
        companyId: targetCompany,
        brandId: effectiveBrand,
        departmentId: departmentFilter || undefined,
        search,
        status: statusFilter || undefined,
        limit: 100
      });
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load employees:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load dropdown options
  const loadFormOptions = async () => {
    try {
      const targetCompany = activeCompanyId !== 'all' ? (activeCompanyId || activeCompany?.id || undefined) : undefined;
      const [brs, depts, desigs, shfts] = await Promise.all([
        api.getBrands(targetCompany ? { companyId: targetCompany } : undefined),
        api.getDepartments(),
        api.getDesignations(),
        api.getShiftsList ? api.getShiftsList() : api.getShifts()
      ]);
      setBrands(brs);
      setDepartments(depts);
      setDesignations(desigs);
      setShifts(shfts);

      if (brs.length > 0) {
        const initialBrand = brs[0];
        const brandDepts = depts.filter(d => d.brandId === initialBrand.id);
        const brandDesigs = desigs.filter(d => d.brandId === initialBrand.id);
        const brandShifts = shfts.filter(s => !s.brandId || s.brandId === initialBrand.id);

        setNewEmployeeForm(prev => ({
          ...prev,
          brandId: initialBrand.id,
          departmentId: brandDepts[0]?.id || depts[0]?.id || '',
          designationId: brandDesigs[0]?.id || desigs[0]?.id || '',
          shiftId: brandShifts[0]?.id || ''
        }));
      }
    } catch (err) {
      console.error('Failed to load form options:', err);
    }
  };

  // Dynamically filter department, designation, and shift options by selected Brand
  const formDepartments = useMemo(() => {
    if (!newEmployeeForm.brandId) return departments;
    return departments.filter(d => d.brandId === newEmployeeForm.brandId);
  }, [departments, newEmployeeForm.brandId]);

  const formDesignations = useMemo(() => {
    if (!newEmployeeForm.brandId) return designations;
    return designations.filter(d => d.brandId === newEmployeeForm.brandId);
  }, [designations, newEmployeeForm.brandId]);

  const formShifts = useMemo(() => {
    if (!newEmployeeForm.brandId) return shifts;
    return shifts.filter(s => !s.brandId || s.brandId === newEmployeeForm.brandId);
  }, [shifts, newEmployeeForm.brandId]);

  const handleBrandChange = (brandId: string) => {
    const brandDepts = departments.filter(d => d.brandId === brandId);
    const brandDesigs = designations.filter(d => d.brandId === brandId);
    const brandShifts = shifts.filter(s => !s.brandId || s.brandId === brandId);

    setNewEmployeeForm(prev => ({
      ...prev,
      brandId,
      departmentId: brandDepts[0]?.id || '',
      designationId: brandDesigs[0]?.id || '',
      shiftId: brandShifts[0]?.id || ''
    }));
  };

  // Load single employee complete profile
  const loadProfile = async (empId: string) => {
    try {
      setLoadingProfile(true);
      setErrorMsg(null);
      const profile = await api.getEmployeeProfile(empId);
      setProfileData(profile);
    } catch (err: any) {
      showNotification(err.message || 'Failed to load employee profile', true);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [activeCompanyId, selectedBrandId, brandFilter, departmentFilter, statusFilter, search]);

  useEffect(() => {
    setBrandFilter('');
    setDepartmentFilter('');
    loadFormOptions();
  }, [activeCompanyId]);

  useEffect(() => {
    const handleCompanyChange = () => {
      loadEmployees();
      loadFormOptions();
    };
    window.addEventListener('hrms:company-changed', handleCompanyChange);
    return () => window.removeEventListener('hrms:company-changed', handleCompanyChange);
  }, []);

  useEffect(() => {
    if (selectedEmpId) {
      loadProfile(selectedEmpId);
    } else {
      setProfileData(null);
    }
  }, [selectedEmpId]);

  // Handle View Profile
  const handleViewProfile = (emp: Employee) => {
    setSelectedEmpId(emp.id);
    navigate(`/employees/${emp.id}`);
  };

  // Handle Back to List
  const handleBackToList = () => {
    setSelectedEmpId(null);
    setProfileData(null);
    navigate('/employees');
    loadEmployees();
  };

  // Handle Open Edit Profile Modal
  const handleOpenEditModal = () => {
    if (!profileData?.employee) return;
    const emp = profileData.employee;
    setEditFormData({
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      phone: emp.phone || '',
      dateOfBirth: emp.dateOfBirth || '',
      address: emp.address || '',
      emergencyContactName: emp.emergencyContactName || '',
      emergencyContactPhone: emp.emergencyContactPhone || '',
      employeeId: emp.employeeId,
      joiningDate: emp.joiningDate,
      exitDate: emp.exitDate || '',
      employmentType: emp.employmentType,
      employeeStatus: emp.employeeStatus,
      biometricId: emp.biometricId || '',
      monthlySalary: emp.monthlySalary?.toString() || '0',
      brandId: emp.brandId,
      gender: emp.gender || 'MALE',
      departmentId: emp.departmentId,
      designationId: emp.designationId,
      shiftId: emp.shiftId || ''
    });
    setIsEditModalOpen(true);
  };

  // Save Profile Edits
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) return;
    setEditFormError(null);
    setIsUpdatingEmployee(true);

    try {
      await api.updateEmployee(selectedEmpId, {
        ...editFormData,
        monthlySalary: parseFloat(editFormData.monthlySalary) || 0,
        shiftId: editFormData.shiftId || null,
        exitDate: editFormData.exitDate || null
      });

      showNotification('Employee profile updated successfully.');
      setIsEditModalOpen(false);
      loadProfile(selectedEmpId);
    } catch (err: any) {
      setEditFormError(err.message || 'Failed to update employee');
    } finally {
      setIsUpdatingEmployee(false);
    }
  };

  // Handle Document Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setDocForm(prev => ({
        ...prev,
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        fileUrl: reader.result as string,
        title: prev.title || file.name.replace(/\.[^/.]+$/, '')
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId || !docForm.fileUrl) {
      setDocFormError('Please select a file to upload.');
      return;
    }
    setDocFormError(null);
    setIsUploadingDoc(true);

    try {
      await api.uploadEmployeeDocument(selectedEmpId, docForm);
      showNotification(`Document "${docForm.title}" uploaded successfully.`);
      setIsDocModalOpen(false);
      setDocForm({
        title: '',
        category: 'GENERAL',
        description: '',
        fileName: '',
        fileType: '',
        fileSize: 0,
        fileUrl: ''
      });
      loadProfile(selectedEmpId);
    } catch (err: any) {
      setDocFormError(err.message || 'Failed to upload document');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  // Handle Delete Document
  const handleDeleteDocument = async (docId: string, docTitle: string) => {
    if (!selectedEmpId) return;
    if (!confirm(`Are you sure you want to delete document "${docTitle}"?`)) return;

    try {
      await api.deleteEmployeeDocument(selectedEmpId, docId);
      showNotification(`Document "${docTitle}" removed.`);
      loadProfile(selectedEmpId);
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete document', true);
    }
  };

  // Create New Employee
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddFormError(null);
    setIsAddingEmployee(true);

    try {
      await api.createEmployee({
        ...newEmployeeForm,
        monthlySalary: newEmployeeForm.monthlySalary ? parseFloat(newEmployeeForm.monthlySalary) : 0
      });
      showNotification('New employee added successfully.');
      setIsAddModalOpen(false);
      setAddFormError(null);
      setNewEmployeeForm({
        employeeId: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        brandId: brands[0]?.id || '',
        departmentId: '',
        designationId: '',
        shiftId: '',
        joiningDate: new Date().toISOString().split('T')[0],
        biometricId: '',
        gender: 'MALE',
        dateOfBirth: '',
        monthlySalary: ''
      });
      loadEmployees();
    } catch (err: any) {
      setAddFormError(err.message || 'Failed to create employee');
    } finally {
      setIsAddingEmployee(false);
    }
  };

  // Quick Add Custom Department Handlers
  const handleQuickAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickDeptName.trim()) {
      setQuickDeptError('Department name is required');
      return;
    }
    const targetBrandId = newEmployeeForm.brandId || brands[0]?.id;
    if (!targetBrandId) {
      setQuickDeptError('Please select a brand first');
      return;
    }
    try {
      setQuickDeptSubmitting(true);
      setQuickDeptError(null);
      const newDept = await api.createDepartment({
        name: quickDeptName.trim(),
        code: quickDeptCode.trim() || undefined,
        brandId: targetBrandId
      });
      const dData = await api.getDepartments(targetBrandId);
      setDepartments(dData);
      setNewEmployeeForm(prev => ({ ...prev, departmentId: newDept.id }));
      setIsQuickDeptModalOpen(false);
      setQuickDeptName('');
      setQuickDeptCode('');
      showNotification(`Custom department "${newDept.name}" created and selected.`);
    } catch (err: any) {
      setQuickDeptError(err.message || 'Failed to create department');
    } finally {
      setQuickDeptSubmitting(false);
    }
  };

  // Quick Add Custom Designation Handlers
  const handleQuickAddDesig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickDesigTitle.trim()) {
      setQuickDesigError('Designation title is required');
      return;
    }
    const targetBrandId = newEmployeeForm.brandId || brands[0]?.id;
    if (!targetBrandId) {
      setQuickDesigError('Please select a brand first');
      return;
    }
    try {
      setQuickDesigSubmitting(true);
      setQuickDesigError(null);
      const newDesig = await api.createDesignation({
        title: quickDesigTitle.trim(),
        code: quickDesigCode.trim() || undefined,
        brandId: targetBrandId,
        departmentId: newEmployeeForm.departmentId || undefined
      });
      const desData = await api.getDesignations(targetBrandId);
      setDesignations(desData);
      setNewEmployeeForm(prev => ({ ...prev, designationId: newDesig.id }));
      setIsQuickDesigModalOpen(false);
      setQuickDesigTitle('');
      setQuickDesigCode('');
      showNotification(`Custom designation "${newDesig.title}" created and selected.`);
    } catch (err: any) {
      setQuickDesigError(err.message || 'Failed to create designation');
    } finally {
      setQuickDesigSubmitting(false);
    }
  };

  // Document Categories
  const docCategories = [
    { value: 'ID_PROOF', label: 'Identity Proof (Passport, Aadhaar, PAN)' },
    { value: 'CONTRACT', label: 'Employment Contract / Offer Letter' },
    { value: 'ACADEMIC', label: 'Academic & Degree Certificates' },
    { value: 'CERTIFICATE', label: 'Professional Certifications' },
    { value: 'TAX', label: 'Tax & Financial Documents' },
    { value: 'GENERAL', label: 'General / Other Document' }
  ];

  // ==========================================
  // VIEW: DETAILED EMPLOYEE PROFILE
  // ==========================================
  if (selectedEmpId && profileData) {
    const emp = profileData.employee;
    const summary = profileData.attendanceSummary;

    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackToList}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Employee List</span>
            </button>
            <div className="h-4 w-px bg-slate-300 hidden sm:block" />
            <div>
              <span className="text-xs text-slate-400 font-medium">Employee Profile Management</span>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>{emp.firstName} {emp.lastName}</span>
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {emp.employeeId}
                </span>
              </h1>
            </div>
          </div>

          {isHrOrAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenEditModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Profile & Salary</span>
              </button>
              <button
                onClick={() => loadProfile(emp.id)}
                className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg shadow-2xs transition-colors"
                title="Refresh Profile"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingProfile ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {/* Alerts */}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="ml-auto text-rose-600 hover:underline">Dismiss</button>
          </div>
        )}

        {/* Quick Summary Banner */}
        <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-xl shadow-2xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <span className="text-slate-400 font-medium block">Brand</span>
            <span className="font-bold text-slate-800 block truncate">{emp.brand?.name}</span>
          </div>

          <div>
            <span className="text-slate-400 font-medium block">Department</span>
            <span className="font-bold text-slate-800 block truncate">{emp.department?.name || '—'}</span>
            <span className="text-[11px] text-slate-500 block truncate">{emp.designation?.title || '—'}</span>
          </div>

          <div>
            <span className="text-slate-400 font-medium block">Fixed Monthly Salary</span>
            <span className="font-bold text-slate-900 text-sm block">
              ₹{(emp.monthlySalary || 0).toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.2 rounded inline-block">
              Payroll Active
            </span>
          </div>

          <div>
            <span className="text-slate-400 font-medium block">Assigned Shift</span>
            <span className="font-bold text-slate-800 block truncate">
              {emp.shift?.name || 'General Shift'}
            </span>
            <span className="text-[11px] text-slate-500 font-mono block">
              {emp.shift ? `${emp.shift.startTime} – ${emp.shift.endTime}` : '09:00 – 18:00'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 font-medium block">Employment Status</span>
            <Badge variant={emp.employeeStatus === 'ACTIVE' ? 'success' : 'neutral'} className="mt-1">
              {emp.employeeStatus}
            </Badge>
            <span className="text-[11px] text-slate-400 block mt-0.5">Joined {emp.joiningDate}</span>
          </div>

          <div>
            <span className="text-slate-400 font-medium block">Biometric ID</span>
            <span className="font-mono font-semibold text-slate-800 block mt-1">
              {emp.biometricId ? (
                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                  {emp.biometricId}
                </span>
              ) : (
                <span className="text-slate-400">Unmapped</span>
              )}
            </span>
          </div>
        </div>

        {/* Profile Tabs (5 Clear Sections per Requirement 3) */}
        <div className="flex border-b border-slate-200 gap-2 sm:gap-6 overflow-x-auto pb-0.5">
          <button
            onClick={() => setActiveProfileTab('profile')}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap shrink-0 ${
              activeProfileTab === 'profile'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>1. Profile Details</span>
          </button>

          <button
            onClick={() => setActiveProfileTab('attendance')}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap shrink-0 ${
              activeProfileTab === 'attendance'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>2. Attendance & Punch History</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-full font-bold">
              {profileData.attendanceHistory.length}
            </span>
          </button>

          <button
            onClick={() => setActiveProfileTab('leave')}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap shrink-0 ${
              activeProfileTab === 'leave'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>3. Leave & Leave Balance</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-full font-bold">
              {profileData.leaveBalances.length}
            </span>
          </button>

          <button
            onClick={() => setActiveProfileTab('salary')}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap shrink-0 ${
              activeProfileTab === 'salary'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>4. Salary & Payslips</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-full font-bold">
              {profileData.payrolls.length}
            </span>
          </button>

          <button
            onClick={() => setActiveProfileTab('documents')}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap shrink-0 ${
              activeProfileTab === 'documents'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>5. Documents</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-full font-bold">
              {profileData.documents.length}
            </span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* SECTION 1: PROFILE DETAILS */}
        {/* ============================================================ */}
        {activeProfileTab === 'profile' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Panel A: Official Employment Details */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-brand-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Official Employment Details</h3>
                </div>
                {isHrOrAdmin && (
                  <button
                    onClick={handleOpenEditModal}
                    className="text-xs text-brand-600 hover:text-brand-800 font-semibold"
                  >
                    Edit
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-400 font-medium block">Employee ID</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">{emp.employeeId}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Joining Date</span>
                  <span className="font-semibold text-slate-800">{emp.joiningDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Employment Type</span>
                  <span className="font-semibold text-slate-800">{emp.employmentType.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Employment Status</span>
                  <span className="font-semibold text-slate-800">{emp.employeeStatus}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Brand Placement</span>
                  <span className="font-semibold text-slate-800">{emp.brand?.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Department</span>
                  <span className="font-semibold text-slate-800">{emp.department?.name || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Designation</span>
                  <span className="font-semibold text-slate-800">{emp.designation?.title || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Biometric Scanner ID</span>
                  <span className="font-mono font-semibold text-slate-800">{emp.biometricId || 'Unmapped'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Reporting Manager</span>
                  <span className="font-semibold text-slate-800">
                    {emp.reportingManager ? `${emp.reportingManager.firstName} ${emp.reportingManager.lastName}` : 'Direct Report'}
                  </span>
                </div>
              </div>

              {/* Fixed Salary & Shift Card */}
              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-600">Fixed Monthly Salary:</span>
                  <span className="text-base font-bold text-slate-900">
                    ₹{(emp.monthlySalary || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                  <span>Assigned Shift: <strong>{emp.shift?.name || 'General Shift'}</strong></span>
                  <span>Weekly Off: <strong>{emp.shift?.weeklyOff || 'SUNDAY'}</strong></span>
                </div>
              </div>
            </div>

            {/* Panel B: Personal & Contact Information */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-brand-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Personal & Contact Details</h3>
                </div>
                {isHrOrAdmin && (
                  <button
                    onClick={handleOpenEditModal}
                    className="text-xs text-brand-600 hover:text-brand-800 font-semibold"
                  >
                    Edit
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-400 font-medium block">Full Name</span>
                  <span className="font-semibold text-slate-900 text-sm">{emp.firstName} {emp.lastName}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Work Email</span>
                  <span className="font-semibold text-slate-800 break-all">{emp.email}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Contact Number</span>
                  <span className="font-semibold text-slate-800">{emp.phone || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Gender</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${emp.gender === 'FEMALE' ? 'bg-pink-500' : emp.gender === 'MALE' ? 'bg-blue-600' : 'bg-slate-400'}`}></span>
                    {emp.gender ? emp.gender.charAt(0) + emp.gender.slice(1).toLowerCase() : 'Male'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Date of Birth</span>
                  <span className="font-semibold text-slate-800">{emp.dateOfBirth || '—'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 font-medium block">Residential Address</span>
                  <span className="font-semibold text-slate-800">{emp.address || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Emergency Contact Name</span>
                  <span className="font-semibold text-slate-800">{emp.emergencyContactName || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Emergency Contact Phone</span>
                  <span className="font-semibold text-slate-800">{emp.emergencyContactPhone || '—'}</span>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  All employee personal information and records are strictly isolated to <strong>{emp.brand?.name}</strong>.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* SECTION 2: ATTENDANCE & PUNCH HISTORY */}
        {/* ============================================================ */}
        {activeProfileTab === 'attendance' && (
          <div className="space-y-4">
            {/* Monthly Attendance Summary Metrics */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <h3 className="font-bold text-slate-800 text-xs mb-3 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-600" />
                <span>Monthly Summary ({summary.month})</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 text-[10px] block">Days Logged</span>
                  <span className="text-sm font-bold text-slate-800">{summary.totalLoggedDays}</span>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                  <span className="text-emerald-700 text-[10px] block">Present</span>
                  <span className="text-sm font-bold text-emerald-800">{summary.presentDays}</span>
                </div>
                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                  <span className="text-amber-700 text-[10px] block">Late Arrivals</span>
                  <span className="text-sm font-bold text-amber-800">{summary.lateDays}</span>
                </div>
                <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-100">
                  <span className="text-rose-700 text-[10px] block">Absent</span>
                  <span className="text-sm font-bold text-rose-800">{summary.absentDays}</span>
                </div>
                <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-100">
                  <span className="text-purple-700 text-[10px] block">On Leave</span>
                  <span className="text-sm font-bold text-purple-800">{summary.leaveDays}</span>
                </div>
                <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                  <span className="text-blue-700 text-[10px] block">Working Hours</span>
                  <span className="text-sm font-bold text-blue-900">{summary.totalWorkingHours}h</span>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                  <span className="text-emerald-700 text-[10px] block">Overtime Hours</span>
                  <span className="text-sm font-bold text-emerald-800">+{summary.totalOvertimeHours}h</span>
                </div>
                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                  <span className="text-amber-700 text-[10px] block">Shortfall Hours</span>
                  <span className="text-sm font-bold text-amber-800">-{summary.totalIncompleteHours}h</span>
                </div>
              </div>
            </div>

            {/* Sub-view switcher */}
            <div className="flex items-center justify-between">
              <div className="inline-flex p-1 bg-slate-100 rounded-lg">
                <button
                  onClick={() => setAttendanceSubView('daily')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    attendanceSubView === 'daily'
                      ? 'bg-white text-brand-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Date-Wise Attendance</span>
                </button>
                <button
                  onClick={() => setAttendanceSubView('punches')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    attendanceSubView === 'punches'
                      ? 'bg-white text-brand-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>Biometric Punch Logs ({profileData.punchHistory.length})</span>
                </button>
              </div>
            </div>

            {/* Table A: Date-Wise Attendance */}
            {attendanceSubView === 'daily' && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[780px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase">
                      <tr>
                        <th className="py-3 px-4 whitespace-nowrap">Date</th>
                        <th className="py-3 px-4 whitespace-nowrap">Shift Timing</th>
                        <th className="py-3 px-4 whitespace-nowrap">Punch In & Out</th>
                        <th className="py-3 px-4 whitespace-nowrap">Late Arrival</th>
                        <th className="py-3 px-4 whitespace-nowrap">Working Hours</th>
                        <th className="py-3 px-4 whitespace-nowrap">Shortfall Hours</th>
                        <th className="py-3 px-4 whitespace-nowrap">Overtime</th>
                        <th className="py-3 px-4 whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {profileData.attendanceHistory.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400">
                            No attendance history logged for this employee.
                          </td>
                        </tr>
                      ) : (
                        profileData.attendanceHistory.map((att) => {
                          const formatTime = (iso?: string | null) => {
                            if (!iso) return '—';
                            try {
                              return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            } catch {
                              return '—';
                            }
                          };

                          const shiftThreshold = (att.shift as any)?.fullDayThresholdHours || 8.0;

                          return (
                            <tr key={att.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-4 font-mono font-medium text-slate-900">{att.date}</td>
                              <td className="py-3 px-4">
                                <span className="font-medium text-slate-800">{att.shift?.name || 'General Shift'}</span>
                                <span className="block text-[11px] text-slate-500 font-mono">
                                  {att.shift ? `${att.shift.startTime} – ${att.shift.endTime}` : '09:00 – 18:00'}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono font-medium">
                                <span className={att.checkIn ? 'text-slate-900' : 'text-slate-400'}>{formatTime(att.checkIn)}</span>
                                <span className="text-slate-400 mx-1">→</span>
                                <span className={att.checkOut ? 'text-slate-900' : 'text-slate-400'}>{formatTime(att.checkOut)}</span>
                              </td>
                              <td className="py-3 px-4">
                                {att.lateMinutes > 0 ? (
                                  <span className="text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[10px]">
                                    {att.lateMinutes}m Late
                                  </span>
                                ) : att.checkIn ? (
                                  <span className="text-emerald-700 font-medium text-[10px]">On Time</span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-900">
                                {att.workingHours || 0} hrs
                              </td>
                              <td className="py-3 px-4">
                                {att.workingHours < shiftThreshold && att.status !== 'WEEK_OFF' && att.status !== 'ON_LEAVE' ? (
                                  <span className="text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px]">
                                    {Number((shiftThreshold - (att.workingHours || 0)).toFixed(1))}h short
                                  </span>
                                ) : (
                                  <span className="text-slate-400">0.0h</span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                {att.workingHours > shiftThreshold ? (
                                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
                                    +{Number(((att.workingHours || 0) - shiftThreshold).toFixed(1))}h OT
                                  </span>
                                ) : (
                                  <span className="text-slate-400">0.0h</span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <Badge
                                  variant={
                                    att.status === 'PRESENT'
                                      ? 'success'
                                      : att.status === 'LATE'
                                      ? 'warning'
                                      : att.status === 'WEEK_OFF'
                                      ? 'info'
                                      : att.status === 'ON_LEAVE'
                                      ? 'neutral'
                                      : 'danger'
                                  }
                                >
                                  {att.status}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Table B: Raw Punch Logs */}
            {attendanceSubView === 'punches' && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase">
                      <tr>
                        <th className="py-3 px-4 whitespace-nowrap">Punch Timestamp</th>
                        <th className="py-3 px-4 whitespace-nowrap">Type</th>
                        <th className="py-3 px-4 whitespace-nowrap">Verification Method</th>
                        <th className="py-3 px-4 whitespace-nowrap">Biometric ID</th>
                        <th className="py-3 px-4 whitespace-nowrap">Device Name</th>
                        <th className="py-3 px-4 whitespace-nowrap">Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {profileData.punchHistory.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            No raw punch records captured for this employee.
                          </td>
                        </tr>
                      ) : (
                        profileData.punchHistory.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4 font-mono font-medium text-slate-900">
                              {new Date(p.punchTime).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-800">
                              {p.punchType}
                            </td>
                            <td className="py-3 px-4">
                              <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700">
                                {p.verificationType}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600">{p.biometricId}</td>
                            <td className="py-3 px-4 text-slate-700">{p.device?.deviceName || 'Network Device'}</td>
                            <td className="py-3 px-4 text-slate-500">{p.device?.location || 'Main Gate'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* SECTION 3: LEAVE & LEAVE BALANCE */}
        {/* ============================================================ */}
        {activeProfileTab === 'leave' && (
          <div className="space-y-6 text-xs">
            {/* Leave Balances Grid */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-brand-600" />
                <span>Leave Balances by Leave Type</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {profileData.leaveBalances.length === 0 ? (
                  <div className="col-span-4 text-center py-4 text-slate-400">
                    No leave balance allocations initialized for this employee.
                  </div>
                ) : (
                  profileData.leaveBalances.map((lb) => (
                    <div key={lb.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{lb.leaveType?.name}</span>
                        <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                          {lb.leaveType?.code}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between pt-1">
                        <div>
                          <span className="text-xl font-bold text-slate-900">{lb.remaining}</span>
                          <span className="text-[11px] text-slate-400 ml-1">days left</span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {lb.used} used of {lb.totalAllocated}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-brand-600 h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.round(((lb.used || 0) / (lb.totalAllocated || 1)) * 100))}%`
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Leave Requests History */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">Leave Requests & History</h3>
                <span className="text-slate-400 text-xs">{profileData.leaveRequests.length} requests</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase">
                    <tr>
                      <th className="py-3 px-4 whitespace-nowrap">Leave Type</th>
                      <th className="py-3 px-4 whitespace-nowrap">Duration</th>
                      <th className="py-3 px-4 whitespace-nowrap">Reason</th>
                      <th className="py-3 px-4 whitespace-nowrap">Applied Date</th>
                      <th className="py-3 px-4 whitespace-nowrap">Reviewed Date</th>
                      <th className="py-3 px-4 whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {profileData.leaveRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No leave applications on file for this employee.
                        </td>
                      </tr>
                    ) : (
                      profileData.leaveRequests.map((lr) => (
                        <tr key={lr.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-900">{lr.leaveType?.name}</span>
                            <span className="text-[11px] text-slate-400 ml-1">({lr.leaveType?.code})</span>
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-slate-800">
                            {lr.startDate} {lr.startDate !== lr.endDate && `– ${lr.endDate}`}
                          </td>
                          <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{lr.reason}</td>
                          <td className="py-3 px-4 text-slate-500 font-mono">
                            {new Date(lr.appliedAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-slate-500 font-mono">
                            {lr.reviewedAt ? new Date(lr.reviewedAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={
                                lr.status === 'APPROVED'
                                  ? 'success'
                                  : lr.status === 'PENDING'
                                  ? 'warning'
                                  : 'danger'
                              }
                            >
                              {lr.status}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* SECTION 4: SALARY & PAYSLIPS */}
        {/* ============================================================ */}
        {activeProfileTab === 'salary' && (
          <div className="space-y-4 text-xs">
            {/* Fixed Salary Banner */}
            <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-emerald-900">Current Fixed Monthly Salary:</span>
                <div className="text-xl font-bold text-emerald-950 mt-0.5">
                  ₹{(emp.monthlySalary || 0).toLocaleString('en-IN')}
                </div>
                <span className="text-[11px] text-emerald-700">
                  Automatically fetched from employee details for monthly calculations.
                </span>
              </div>
              {isHrOrAdmin && (
                <button
                  onClick={handleOpenEditModal}
                  className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-lg font-semibold text-xs transition-colors"
                >
                  Update Fixed Salary
                </button>
              )}
            </div>

            {/* Monthly Payroll & Payslip Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">Month-Wise Salary Records & Payslips</h3>
                <span className="text-slate-400 text-xs">{profileData.payrolls.length} payroll periods</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[780px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase">
                    <tr>
                      <th className="py-3 px-4 whitespace-nowrap">Period</th>
                      <th className="py-3 px-4 whitespace-nowrap">Fixed Salary</th>
                      <th className="py-3 px-4 whitespace-nowrap">Overtime Amount</th>
                      <th className="py-3 px-4 whitespace-nowrap">Shortfall Deduction</th>
                      <th className="py-3 px-4 whitespace-nowrap">Incentives</th>
                      <th className="py-3 px-4 whitespace-nowrap">Net Payable Salary</th>
                      <th className="py-3 px-4 whitespace-nowrap">Status</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Payslip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {profileData.payrolls.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No payroll statements generated yet for this employee.
                        </td>
                      </tr>
                    ) : (
                      profileData.payrolls.map((pr) => (
                        <tr key={pr.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {pr.payrollPeriod?.period || '—'}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800">
                            ₹{(pr.baseSalary || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-emerald-700 font-medium">
                            +₹{(pr.otPayment || 0).toLocaleString('en-IN')}
                            <span className="block text-[10px] text-slate-400">({pr.approvedOtHours || 0}h OT)</span>
                          </td>
                          <td className="py-3 px-4 text-amber-800 font-medium">
                            -₹{(pr.incompleteDeductionAmount || 0).toLocaleString('en-IN')}
                            <span className="block text-[10px] text-slate-400">({pr.incompleteHours || 0}h short)</span>
                          </td>
                          <td className="py-3 px-4 text-purple-700 font-medium">
                            +₹{(pr.approvedIncentivesAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                            ₹{(pr.netSalary || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={
                                pr.status === 'FINALIZED'
                                  ? 'success'
                                  : pr.status === 'APPROVED'
                                  ? 'info'
                                  : 'warning'
                              }
                            >
                              {pr.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {pr.receipt ? (
                              <button
                                onClick={() => api.downloadReceiptPdf(pr.receipt!.id, pr.receipt!.receiptNumber)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg font-semibold text-xs border border-brand-200 transition-colors"
                                title="Download PDF Payslip"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Payslip</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* SECTION 5: DOCUMENTS */}
        {/* ============================================================ */}
        {activeProfileTab === 'documents' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Employee Documents</h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  Identity proofs, contracts, academic qualifications, and tax records.
                </p>
              </div>

              {isHrOrAdmin && (
                <button
                  onClick={() => setIsDocModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold text-xs shadow-xs transition-colors"
                >
                  <FileUp className="w-4 h-4" />
                  <span>Upload Document</span>
                </button>
              )}
            </div>

            {/* Documents List Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase">
                    <tr>
                      <th className="py-3 px-4 whitespace-nowrap">Document Title</th>
                      <th className="py-3 px-4 whitespace-nowrap">Category</th>
                      <th className="py-3 px-4 whitespace-nowrap">File Name</th>
                      <th className="py-3 px-4 whitespace-nowrap">Size</th>
                      <th className="py-3 px-4 whitespace-nowrap">Uploaded Date</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {profileData.documents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No documents uploaded yet for this employee. Click "Upload Document" to add files.
                        </td>
                      </tr>
                    ) : (
                      profileData.documents.map((doc) => {
                        const formatSize = (bytes: number | null | undefined) => {
                          if (!bytes) return '—';
                          if (bytes < 1024) return `${bytes} B`;
                          if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                          return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                        };

                        return (
                          <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-brand-600 shrink-0" />
                                <span>{doc.title}</span>
                              </div>
                              {doc.description && (
                                <p className="text-[11px] text-slate-400 mt-0.5 ml-6">{doc.description}</p>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                {doc.category.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-700">{doc.fileName}</td>
                            <td className="py-3 px-4 text-slate-500 font-mono">{formatSize(doc.fileSize)}</td>
                            <td className="py-3 px-4 text-slate-500 font-mono">
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-2">
                                <a
                                  href={doc.fileUrl}
                                  download={doc.fileName}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md font-semibold text-xs transition-colors"
                                  title="Download / View"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Download</span>
                                </a>

                                {isHrOrAdmin && (
                                  <button
                                    onClick={() => handleDeleteDocument(doc.id, doc.title)}
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                                    title="Delete Document"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
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
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL: EDIT EMPLOYEE PROFILE & FIXED SALARY */}
        {/* ============================================================ */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditFormError(null);
          }}
          title={`Edit Profile: ${emp.firstName} ${emp.lastName}`}
          description="Update employee personal details, placement, shift, and fixed monthly salary."
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            {/* Form-level Error Alert */}
            {editFormError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{editFormError}</div>
                <button
                  type="button"
                  onClick={() => setEditFormError(null)}
                  className="text-rose-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {/* Name & Contact */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={editFormData.firstName || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  value={editFormData.lastName || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Work Email *</label>
                <input
                  type="email"
                  required
                  value={editFormData.email || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={editFormData.phone || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Gender *</label>
                <select
                  value={editFormData.gender || 'MALE'}
                  onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={editFormData.dateOfBirth || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, dateOfBirth: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            {/* Employment details & Fixed Salary */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <span className="font-bold text-slate-800 block text-xs">Official Employment & Fixed Salary</span>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fixed Monthly Salary (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    required
                    value={editFormData.monthlySalary || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, monthlySalary: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Used for payroll calculations</span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Shift</label>
                  <select
                    value={editFormData.shiftId || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, shiftId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="">Default General Shift</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.startTime}–{s.endTime})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={editFormData.departmentId || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, departmentId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Designation</label>
                  <select
                    value={editFormData.designationId || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, designationId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    {designations.map((desig) => (
                      <option key={desig.id} value={desig.id}>{desig.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Employment Type</label>
                  <select
                    value={editFormData.employmentType || 'FULL_TIME'}
                    onChange={(e) => setEditFormData({ ...editFormData, employmentType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="INTERN">Intern</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editFormData.employeeStatus || 'ACTIVE'}
                    onChange={(e) => setEditFormData({ ...editFormData, employeeStatus: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="PROBATION">Probation</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="TERMINATED">Terminated</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Biometric ID</label>
                  <input
                    type="text"
                    value={editFormData.biometricId || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, biometricId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Address & Emergency Contact */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={editFormData.dateOfBirth || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, dateOfBirth: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Emergency Contact Phone</label>
                <input
                  type="text"
                  value={editFormData.emergencyContactPhone || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, emergencyContactPhone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Residential Address</label>
              <input
                type="text"
                value={editFormData.address || ''}
                onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-white/95 backdrop-blur-xs border-t border-slate-200 flex items-center justify-end gap-2 shadow-xs z-10">
              <button
                type="button"
                disabled={isUpdatingEmployee}
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditFormError(null);
                }}
                className="px-3.5 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingEmployee}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                {isUpdatingEmployee ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </form>
        </Modal>

        {/* ============================================================ */}
        {/* MODAL: UPLOAD DOCUMENT */}
        {/* ============================================================ */}
        <Modal
          isOpen={isDocModalOpen}
          onClose={() => {
            setIsDocModalOpen(false);
            setDocFormError(null);
          }}
          title={`Upload Document for ${emp.firstName} ${emp.lastName}`}
          description="Upload identity proof, contracts, certificates, or tax files."
          maxWidth="max-w-md"
        >
          <form onSubmit={handleUploadDocument} className="space-y-4 text-xs">
            {/* Form-level Error Alert */}
            {docFormError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{docFormError}</div>
                <button
                  type="button"
                  onClick={() => setDocFormError(null)}
                  className="text-rose-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Document Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Passport Copy, Employment Contract"
                value={docForm.title}
                onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category *</label>
              <select
                value={docForm.category}
                onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
              >
                {docCategories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Select File (PDF, PNG, JPG, DOCX) *</label>
              <input
                type="file"
                required
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-slate-50 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700"
              />
              {docForm.fileName && (
                <span className="text-[11px] text-emerald-700 font-mono mt-1 block">
                  ✓ Selected: {docForm.fileName} ({Math.round(docForm.fileSize / 1024)} KB)
                </span>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Description (Optional)</label>
              <textarea
                rows={2}
                placeholder="Add any notes about this document..."
                value={docForm.description}
                onChange={(e) => setDocForm({ ...docForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-white/95 backdrop-blur-xs border-t border-slate-200 flex items-center justify-end gap-2 shadow-xs z-10">
              <button
                type="button"
                disabled={isUploadingDoc}
                onClick={() => {
                  setIsDocModalOpen(false);
                  setDocFormError(null);
                }}
                className="px-3.5 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploadingDoc}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                {isUploadingDoc ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <span>Upload Document</span>
                )}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // ==========================================
  // VIEW: EMPLOYEE LIST (Requirement 1)
  // ==========================================
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Employee Directory</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Briefcase className="w-3 h-3 text-indigo-600" />
              {activeCompany?.name || (activeCompanyId === 'all' ? 'All Companies' : 'All Companies')}
            </span>
          </div>
        </div>

        {isHrOrAdmin && (
          <button
            onClick={() => {
              setAddFormError(null);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Employee
          </button>
        )}
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto text-rose-600 hover:underline">Dismiss</button>
        </div>
      )}

      <Card>
        {/* Filters Bar per Requirement 1 */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 mb-4 text-xs">
          {/* Search by Name or Employee ID */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or employee ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Brand Filter */}
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All Brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            {/* Department Filter */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PROBATION">Probation</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            <button
              onClick={loadEmployees}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
              title="Refresh Directory"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Desktop / Tablet Table View */}
        <div className="hidden sm:block overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">Employee</th>
                <th className="py-3 px-4 whitespace-nowrap">Role &amp; Organization</th>
                <th className="py-3 px-4 whitespace-nowrap">Contact</th>
                <th className="py-3 px-4 whitespace-nowrap">Status</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Loading employee directory...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No employee records match the search criteria.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const initials = `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`.toUpperCase() || 'E';
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Combined Employee Details */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span className="truncate">{emp.firstName} {emp.lastName}</span>
                              {emp.gender && (
                                <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full whitespace-nowrap ${
                                  emp.gender === 'FEMALE' ? 'bg-pink-50 text-pink-700 border border-pink-200' :
                                  emp.gender === 'MALE' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {emp.gender === 'FEMALE' ? '♀' : emp.gender === 'MALE' ? '♂' : ''} {emp.gender}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                              <span className="font-semibold text-slate-700">{emp.employeeId}</span>
                              {emp.email && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-400 truncate max-w-[180px]">{emp.email}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Combined Role & Organization */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          {emp.designation?.title || 'Team Member'}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span>{emp.department?.name || 'Department'}</span>
                          <span>•</span>
                          <span className="font-medium text-slate-700">{emp.brand?.name}</span>
                          {(!activeCompanyId || activeCompanyId === 'all') && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {emp.company?.name || (emp.brand as any)?.company?.name || 'Company'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {emp.phone ? (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{emp.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge variant={emp.employeeStatus === 'ACTIVE' ? 'success' : 'neutral'}>
                          {emp.employeeStatus}
                        </Badge>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleViewProfile(emp)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg text-xs font-semibold border border-brand-200 transition-colors shadow-2xs whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5 shrink-0" />
                          <span>View Profile</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View (< sm) */}
        <div className="sm:hidden space-y-3">
          {loading ? (
            <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
              Loading employee directory...
            </div>
          ) : employees.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
              No employee records match the search criteria.
            </div>
          ) : (
            employees.map((emp) => {
              const initials = `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`.toUpperCase() || 'E';
              return (
                <div
                  key={emp.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate text-sm">
                          {emp.firstName} {emp.lastName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {emp.employeeId}
                        </div>
                      </div>
                    </div>
                    <Badge variant={emp.employeeStatus === 'ACTIVE' ? 'success' : 'neutral'}>
                      {emp.employeeStatus}
                    </Badge>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg space-y-1 text-xs">
                    <div className="font-semibold text-slate-800">
                      {emp.designation?.title || 'Team Member'}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                      <span>{emp.department?.name || 'Department'}</span>
                      <span>•</span>
                      <span className="font-medium text-slate-700">{emp.brand?.name}</span>
                    </div>
                    {emp.phone && (
                      <div className="text-[11px] text-slate-600 font-mono flex items-center gap-1 pt-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{emp.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleViewProfile(emp)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg text-xs font-semibold border border-brand-200 transition-colors shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5 shrink-0" />
                      <span>View Profile</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Add Employee Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddFormError(null);
        }}
        title="Add New Employee"
        description="Register employee profile, organization placement, and biometric ID mapping."
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateEmployee} className="space-y-4 text-xs">
          {/* In-Modal Form Error Alert */}
          {addFormError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{addFormError}</div>
              <button
                type="button"
                onClick={() => setAddFormError(null)}
                className="text-rose-400 hover:text-rose-600 p-0.5 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Employee ID *</label>
              <input
                required
                type="text"
                placeholder="e.g. APEX-1005"
                value={newEmployeeForm.employeeId}
                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, employeeId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Biometric ID</label>
              <input
                type="text"
                placeholder="Device scanner ID"
                value={newEmployeeForm.biometricId}
                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, biometricId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">First Name *</label>
              <input
                required
                type="text"
                value={newEmployeeForm.firstName}
                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, firstName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Last Name *</label>
              <input
                required
                type="text"
                value={newEmployeeForm.lastName}
                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, lastName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email *</label>
              <input
                required
                type="email"
                value={newEmployeeForm.email}
                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="text"
                value={newEmployeeForm.phone}
                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Gender *</label>
              <select
                required
                value={newEmployeeForm.gender || 'MALE'}
                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, gender: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Date of Birth</label>
              <input
                type="date"
                value={newEmployeeForm.dateOfBirth}
                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, dateOfBirth: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Brand *</label>
              <select
                required
                value={newEmployeeForm.brandId}
                onChange={(e) => handleBrandChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700">Department *</label>
                <button
                  type="button"
                  onClick={() => {
                    setQuickDeptError(null);
                    setQuickDeptName('');
                    setQuickDeptCode('');
                    setIsQuickDeptModalOpen(true);
                  }}
                  className="text-[11px] font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-0.5 cursor-pointer"
                  title="Add custom department for this brand"
                >
                  <Plus className="w-3 h-3" /> Add Custom
                </button>
              </div>
              <select
                value={newEmployeeForm.departmentId}
                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, departmentId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                {formDepartments.length === 0 ? (
                  <option value="">General (Auto-provisioned)</option>
                ) : (
                  formDepartments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))
                )}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700">Designation *</label>
                <button
                  type="button"
                  onClick={() => {
                    setQuickDesigError(null);
                    setQuickDesigTitle('');
                    setQuickDesigCode('');
                    setIsQuickDesigModalOpen(true);
                  }}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                  title="Add custom designation for this brand"
                >
                  <Plus className="w-3 h-3" /> Add Custom
                </button>
              </div>
              <select
                value={newEmployeeForm.designationId}
                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, designationId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                {formDesignations.length === 0 ? (
                  <option value="">General Staff (Auto-provisioned)</option>
                ) : (
                  formDesignations.map((desig) => (
                    <option key={desig.id} value={desig.id}>{desig.title}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Fixed Monthly Salary (₹)</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 50000"
                value={newEmployeeForm.monthlySalary}
                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, monthlySalary: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Assigned Shift</label>
              <select
                value={newEmployeeForm.shiftId}
                onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, shiftId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Default Shift</option>
                {formShifts.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-white/95 backdrop-blur-xs border-t border-slate-200 flex items-center justify-end gap-2 shadow-xs z-10">
            <button
              type="button"
              disabled={isAddingEmployee}
              onClick={() => {
                setIsAddModalOpen(false);
                setAddFormError(null);
              }}
              className="px-3.5 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAddingEmployee}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              {isAddingEmployee ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Adding Employee...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Employee</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Add Custom Department Modal */}
      <Modal
        isOpen={isQuickDeptModalOpen}
        onClose={() => setIsQuickDeptModalOpen(false)}
        title="Add Custom Department"
        description="Creates a customized department for this brand. It will be immediately selected."
      >
        <form onSubmit={handleQuickAddDept} className="space-y-4 text-xs">
          {quickDeptError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{quickDeptError}</span>
            </div>
          )}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Department Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. Sales, Marketing, Operations, Quality"
              value={quickDeptName}
              onChange={(e) => setQuickDeptName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Department Code <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="Auto-generated if left blank"
              value={quickDeptCode}
              onChange={(e) => setQuickDeptCode(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono uppercase"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={quickDeptSubmitting}
              onClick={() => setIsQuickDeptModalOpen(false)}
              className="px-3.5 py-1.5 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={quickDeptSubmitting}
              className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {quickDeptSubmitting ? 'Creating...' : 'Create & Select'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Add Custom Designation Modal */}
      <Modal
        isOpen={isQuickDesigModalOpen}
        onClose={() => setIsQuickDesigModalOpen(false)}
        title="Add Custom Designation / Role"
        description="Creates a customized job title for this brand and department. It will be immediately selected."
      >
        <form onSubmit={handleQuickAddDesig} className="space-y-4 text-xs">
          {quickDesigError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{quickDesigError}</span>
            </div>
          )}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Designation Title *</label>
            <input
              required
              type="text"
              placeholder="e.g. Sales Executive, Lead Architect, QA Specialist"
              value={quickDesigTitle}
              onChange={(e) => setQuickDesigTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Designation Code <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="Auto-generated if left blank"
              value={quickDesigCode}
              onChange={(e) => setQuickDesigCode(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono uppercase"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={quickDesigSubmitting}
              onClick={() => setIsQuickDesigModalOpen(false)}
              className="px-3.5 py-1.5 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={quickDesigSubmitting}
              className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {quickDesigSubmitting ? 'Creating...' : 'Create & Select'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default EmployeesPage;
