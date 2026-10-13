import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Modal } from '../components/common/Modal';
import { api } from '../services/api';
import {
  SystemSettingsData,
  CompanySettings,
  AttendanceRules,
  LeavePolicies,
  ShiftRules,
  PayrollSettings,
  PunchingDeviceSetting,
  ApiSettings,
  Brand,
  LeaveType,
  Shift
} from '../types';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  Tag,
  Clock,
  Calendar,
  CalendarRange,
  Banknote,
  Cpu,
  Key,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Plus,
  Edit,
  Trash2,
  ShieldCheck,
  Send,
  Check,
  X,
  Lock,
  Upload,
  Globe,
  Mail,
  Phone,
  MapPin,
  HelpCircle,
  Power
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdminOrGroupHr = user?.role === 'SUPER_ADMIN' || user?.role === 'GROUP_HR';

  // Active section tab:
  // 1: company, 2: brands, 3: attendance, 4: leave, 5: shift, 6: payroll, 7: devices, 8: api
  const [activeTab, setActiveTab] = useState<
    'company' | 'brands' | 'attendance' | 'leave' | 'shift' | 'payroll' | 'devices' | 'api'
  >('company');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  // Loaded Settings Data
  const [settingsData, setSettingsData] = useState<SystemSettingsData | null>(null);

  // Form states per section
  const [companyForm, setCompanyForm] = useState<CompanySettings>({
    companyName: '',
    companyLogo: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    taxRegistrationNumber: ''
  });

  const [attendanceForm, setAttendanceForm] = useState<AttendanceRules>({
    requiredDailyHours: 8.0,
    defaultMaleDailyHours: 9.0,
    defaultFemaleDailyHours: 8.0,
    lateGracePeriodMinutes: 15,
    halfDayThresholdHours: 4.0,
    incompleteHoursDeductionEnabled: true,
    minHoursForPresent: 4.0,
    autoMarkAbsentIfNoCheckIn: true,
    brandRules: []
  });

  const [leavePoliciesForm, setLeavePoliciesForm] = useState<LeavePolicies>({
    maxCarryForwardDays: 15,
    accrualFrequency: 'YEARLY',
    allowNegativeBalance: false,
    probationLeaveAllowed: false
  });

  const [shiftRulesForm, setShiftRulesForm] = useState<ShiftRules>({
    defaultShiftId: '',
    defaultBreakMinutes: 60,
    allowOvernightShifts: true,
    defaultWeeklyOff: 'SUNDAY',
    maxConsecutiveWorkingDays: 6
  });

  const [payrollForm, setPayrollForm] = useState<PayrollSettings>({
    defaultOtMultiplier: 1.5,
    otCalculationMethod: 'STANDARD_MULTIPLIER',
    customOtRatePerHour: 0,
    incompleteDeductionMethod: 'HOURLY_PRORATED',
    customIncompleteRatePerHour: 0,
    incentiveApprovalRule: 'REQUIRE_HR_APPROVAL',
    payrollCutoffDay: 25,
    payrollCycle: 'CALENDAR_MONTH',
    standardWorkingDaysPerMonth: 26
  });

  const [apiForm, setApiForm] = useState<ApiSettings>({
    biometricWebhookUrl: '',
    biometricApiKey: '',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPassword: '',
    smtpSecure: false,
    notificationWebhookUrl: ''
  });

  // Modals
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [brandForm, setBrandForm] = useState({
    name: '',
    code: '',
    companyName: '',
    phone: '',
    email: '',
    address: '',
    website: '',
    isActive: true
  });

  const [isLeaveTypeModalOpen, setIsLeaveTypeModalOpen] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);
  const [leaveTypeForm, setLeaveTypeForm] = useState({
    name: '',
    code: '',
    brandId: '',
    daysPerYear: 12,
    isPaid: true,
    carryForward: false,
    maxCarryForwardDays: 0,
    accrualRule: 'YEARLY',
    requiresApproval: true,
    description: ''
  });

  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<PunchingDeviceSetting | null>(null);
  const [deviceForm, setDeviceForm] = useState({
    deviceName: '',
    serialNumber: '',
    ipAddress: '',
    port: 4370,
    location: '',
    brandId: '',
    branchId: '',
    status: 'ONLINE',
    isActive: true,
    apiSecret: ''
  });

  // Confirmation Dialog
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  // Connection Test states
  const [testingType, setTestingType] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ type: string; success: boolean; message: string } | null>(null);

  const showNotification = (text: string, isError = false) => {
    setFeedback({ text, isError });
    setTimeout(() => setFeedback(null), 5000);
  };

  useEffect(() => {
    loadAllSettings();
  }, []);

  const loadAllSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getSystemSettings();
      setSettingsData(data);

      setCompanyForm(data.company);
      setAttendanceForm({
        ...data.attendance,
        defaultMaleDailyHours: data.attendance.defaultMaleDailyHours ?? 9.0,
        defaultFemaleDailyHours: data.attendance.defaultFemaleDailyHours ?? 8.0,
        requiredDailyHours: data.attendance.requiredDailyHours ?? 8.0,
        brandRules: data.attendance.brandRules || []
      });
      setLeavePoliciesForm(data.leave.policies);
      setShiftRulesForm(data.shift.rules);
      setPayrollForm(data.payroll);
      setApiForm(data.api);
    } catch (err: any) {
      showNotification(err.message || 'Failed to load system settings', true);
    } finally {
      setLoading(false);
    }
  };

  const handleBrandHoursChange = (brandId: string, field: 'maleDailyHours' | 'femaleDailyHours', val: number) => {
    setAttendanceForm(prev => {
      const brandRules = prev.brandRules ? [...prev.brandRules] : [];
      const index = brandRules.findIndex(b => b.brandId === brandId);
      if (index >= 0) {
        brandRules[index] = {
          ...brandRules[index],
          [field]: val
        };
      } else {
        brandRules.push({
          brandId,
          maleDailyHours: field === 'maleDailyHours' ? val : (prev.defaultMaleDailyHours || 9.0),
          femaleDailyHours: field === 'femaleDailyHours' ? val : (prev.defaultFemaleDailyHours || 8.0)
        });
      }
      return { ...prev, brandRules };
    });
  };

  const handleResetBrandHours = (brandId: string) => {
    setAttendanceForm(prev => {
      const brandRules = (prev.brandRules || []).map(b => {
        if (b.brandId === brandId) {
          return {
            ...b,
            maleDailyHours: prev.defaultMaleDailyHours || 9.0,
            femaleDailyHours: prev.defaultFemaleDailyHours || 8.0
          };
        }
        return b;
      });
      return { ...prev, brandRules };
    });
  };

  // ==========================================
  // SAVE HANDLERS
  // ==========================================
  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateCompanySettings(companyForm);
      showNotification('Company settings saved successfully.');
      loadAllSettings();
    } catch (err: any) {
      showNotification(err.message || 'Failed to save company settings', true);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    // Ask confirmation before changing important attendance rules
    setConfirmModal({
      isOpen: true,
      title: 'Update Attendance Rules?',
      description:
        'Modifying required working hours, grace period, or deduction rules will affect upcoming attendance regularizations and calculations. Are you sure you want to proceed?',
      onConfirm: async () => {
        setSaving(true);
        try {
          await api.updateAttendanceRules(attendanceForm);
          showNotification('Attendance rules updated successfully.');
          loadAllSettings();
        } catch (err: any) {
          showNotification(err.message || 'Failed to update attendance rules', true);
        } finally {
          setSaving(false);
        }
      }
    });
  };

  const handleSaveLeavePolicies = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateLeavePolicies(leavePoliciesForm);
      showNotification('Leave policies updated successfully.');
      loadAllSettings();
    } catch (err: any) {
      showNotification(err.message || 'Failed to update leave policies', true);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveShiftRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateShiftRules(shiftRulesForm);
      showNotification('Shift rules saved successfully.');
      loadAllSettings();
    } catch (err: any) {
      showNotification(err.message || 'Failed to save shift rules', true);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    // Ask confirmation before changing critical payroll rules
    setConfirmModal({
      isOpen: true,
      title: 'Update Core Payroll Settings?',
      description:
        'Modifying the default overtime rate multiplier, incomplete-hours deduction rule, or payroll cutoff day will apply to all upcoming salary calculations. Existing historical records will remain untouched. Continue?',
      onConfirm: async () => {
        setSaving(true);
        try {
          await api.updatePayrollSettings(payrollForm);
          showNotification('Payroll settings saved successfully.');
          loadAllSettings();
        } catch (err: any) {
          showNotification(err.message || 'Failed to save payroll settings', true);
        } finally {
          setSaving(false);
        }
      }
    });
  };

  const handleSaveApi = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateApiSettings(apiForm);
      showNotification('API settings and integration secrets updated securely.');
      loadAllSettings();
    } catch (err: any) {
      showNotification(err.message || 'Failed to save API settings', true);
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // BRAND MODAL HANDLERS
  // ==========================================
  const openCreateBrandModal = () => {
    setEditingBrand(null);
    setBrandForm({
      name: '',
      code: '',
      companyName: companyForm.companyName || '',
      phone: '',
      email: '',
      address: '',
      website: '',
      isActive: true
    });
    setIsBrandModalOpen(true);
  };

  const openEditBrandModal = (brand: Brand) => {
    setEditingBrand(brand);
    setBrandForm({
      name: brand.name,
      code: brand.code,
      companyName: brand.companyName || '',
      phone: brand.phone || '',
      email: brand.email || '',
      address: brand.address || '',
      website: brand.website || '',
      isActive: brand.isActive !== undefined ? brand.isActive : true
    });
    setIsBrandModalOpen(true);
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBrand) {
        await api.updateBrandSetting(editingBrand.id, brandForm);
        showNotification(`Brand "${brandForm.name}" updated successfully.`);
      } else {
        await api.createBrandSetting(brandForm);
        showNotification(`Brand "${brandForm.name}" added successfully.`);
      }
      setIsBrandModalOpen(false);
      loadAllSettings();
    } catch (err: any) {
      showNotification(err.message || 'Failed to save brand', true);
    }
  };

  // ==========================================
  // LEAVE TYPE MODAL HANDLERS
  // ==========================================
  const openCreateLeaveTypeModal = () => {
    setEditingLeaveType(null);
    setLeaveTypeForm({
      name: '',
      code: '',
      brandId: settingsData?.brands[0]?.id || '',
      daysPerYear: 12,
      isPaid: true,
      carryForward: false,
      maxCarryForwardDays: 0,
      accrualRule: 'YEARLY',
      requiresApproval: true,
      description: ''
    });
    setIsLeaveTypeModalOpen(true);
  };

  const openEditLeaveTypeModal = (lt: LeaveType) => {
    setEditingLeaveType(lt);
    setLeaveTypeForm({
      name: lt.name,
      code: lt.code,
      brandId: lt.brandId,
      daysPerYear: lt.daysPerYear || 12,
      isPaid: lt.isPaid,
      carryForward: Boolean(lt.carryForward),
      maxCarryForwardDays: (lt as any).maxCarryForwardDays || 0,
      accrualRule: (lt as any).accrualRule || 'YEARLY',
      requiresApproval: lt.requiresApproval !== undefined ? lt.requiresApproval : true,
      description: lt.description || ''
    });
    setIsLeaveTypeModalOpen(true);
  };

  const handleSaveLeaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingLeaveType) {
        await api.updateLeaveTypeSetting(editingLeaveType.id, leaveTypeForm);
        showNotification(`Leave type "${leaveTypeForm.name}" updated.`);
      } else {
        await api.createLeaveTypeSetting(leaveTypeForm);
        showNotification(`Leave type "${leaveTypeForm.name}" created.`);
      }
      setIsLeaveTypeModalOpen(false);
      loadAllSettings();
    } catch (err: any) {
      showNotification(err.message || 'Failed to save leave type', true);
    }
  };

  const handleDeleteLeaveType = async (lt: LeaveType) => {
    if (!confirm(`Are you sure you want to delete leave type "${lt.name}"?`)) return;
    try {
      await api.deleteLeaveTypeSetting(lt.id);
      showNotification(`Leave type "${lt.name}" deleted.`);
      loadAllSettings();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete leave type', true);
    }
  };

  // ==========================================
  // PUNCHING DEVICE HANDLERS
  // ==========================================
  const openCreateDeviceModal = () => {
    setEditingDevice(null);
    setDeviceForm({
      deviceName: '',
      serialNumber: '',
      ipAddress: '192.168.1.201',
      port: 4370,
      location: 'Main Gate / Reception',
      brandId: settingsData?.brands[0]?.id || '',
      branchId: settingsData?.brands[0]?.branches?.[0]?.id || '',
      status: 'ONLINE',
      isActive: true,
      apiSecret: ''
    });
    setIsDeviceModalOpen(true);
  };

  const openEditDeviceModal = (dev: PunchingDeviceSetting) => {
    setEditingDevice(dev);
    setDeviceForm({
      deviceName: dev.deviceName,
      serialNumber: dev.serialNumber,
      ipAddress: dev.ipAddress || '',
      port: dev.port || 4370,
      location: dev.location || '',
      brandId: dev.brandId,
      branchId: dev.branchId,
      status: dev.status,
      isActive: dev.isActive,
      apiSecret: dev.apiSecret || ''
    });
    setIsDeviceModalOpen(true);
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDevice) {
        await api.updateDeviceSetting(editingDevice.id, deviceForm);
        showNotification(`Device "${deviceForm.deviceName}" updated.`);
      } else {
        await api.createDeviceSetting(deviceForm);
        showNotification(`Device "${deviceForm.deviceName}" registered successfully.`);
      }
      setIsDeviceModalOpen(false);
      loadAllSettings();
    } catch (err: any) {
      showNotification(err.message || 'Failed to save device', true);
    }
  };

  const handleToggleDevice = async (dev: PunchingDeviceSetting) => {
    try {
      await api.updateDeviceSetting(dev.id, { isActive: !dev.isActive });
      showNotification(`Device "${dev.deviceName}" ${!dev.isActive ? 'enabled' : 'disabled'}.`);
      loadAllSettings();
    } catch (err: any) {
      showNotification(err.message || 'Failed to toggle device status', true);
    }
  };

  const handleDeleteDevice = async (dev: PunchingDeviceSetting) => {
    if (!confirm(`Are you sure you want to delete device "${dev.deviceName}" (${dev.serialNumber})?`)) return;
    try {
      await api.deleteDeviceSetting(dev.id);
      showNotification(`Device "${dev.deviceName}" removed.`);
      loadAllSettings();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete device', true);
    }
  };

  // ==========================================
  // CONNECTION TEST HANDLER
  // ==========================================
  const handleTestConnection = async (type: 'BIOMETRIC' | 'SMTP' | 'DEVICE', payload?: any) => {
    setTestingType(type);
    setTestResult(null);
    try {
      const res = await api.testSettingsConnection(type, payload);
      setTestResult({ type, success: res.success, message: res.message });
      showNotification(res.message, !res.success);
    } catch (err: any) {
      setTestResult({ type, success: false, message: err.message || 'Connection test failed.' });
      showNotification(err.message || 'Connection test failed.', true);
    } finally {
      setTestingType(null);
    }
  };

  // Navigation tabs list
  const navTabs = [
    { id: 'company', label: 'Company Settings', icon: Building2, desc: 'Name, logo & contact info' },
    { id: 'brands', label: 'Brand Settings', icon: Tag, desc: 'Add & manage business brands' },
    { id: 'attendance', label: 'Attendance Rules', icon: Clock, desc: 'Hours, grace period & status' },
    { id: 'leave', label: 'Leave Policies', icon: Calendar, desc: 'Allowance, carry-forward & types' },
    { id: 'shift', label: 'Shift Rules', icon: CalendarRange, desc: 'Default shift, breaks & timing' },
    { id: 'payroll', label: 'Payroll Settings', icon: Banknote, desc: 'OT rate, deductions & cutoff' },
    { id: 'devices', label: 'Punching Devices', icon: Cpu, desc: 'Hardware terminals & sync' },
    { id: 'api', label: 'API Settings', icon: Key, desc: 'Secrets, webhook & SMTP gateway' }
  ];

  if (!isSuperAdminOrGroupHr) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <ShieldCheck className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-800">Restricted Administration Access</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          System Settings can only be accessed and modified by Super Admin and Group HR administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Settings</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure company profile, multi-brand records, attendance rules, leave policies, shifts, and payroll rules.
          </p>
        </div>

        <button
          onClick={loadAllSettings}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          <span>Reload Settings</span>
        </button>
      </div>

      {/* Floating Notification */}
      {feedback && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-xs font-medium shadow-sm transition-all ${
            feedback.isError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {feedback.isError ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Main Settings Layout: Sidebar Tabs + Active Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 p-2 shadow-xs space-y-1">
          {navTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors ${
                  isActive
                    ? 'bg-brand-50/80 text-brand-800 border-l-4 border-brand-600 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                }`}
              >
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                <div>
                  <div className="text-xs leading-none">{tab.label}</div>
                  <div className="text-[10px] text-slate-400 mt-1">{tab.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-xs">
              <RefreshCw className="w-6 h-6 animate-spin text-brand-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">Loading system settings...</p>
            </div>
          ) : (
            <>
              {/* ============================================================ */}
              {/* 1. COMPANY SETTINGS */}
              {/* ============================================================ */}
              {activeTab === 'company' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-brand-600" />
                      <span>Company Profile & Branding</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Enter company identification details displayed on documents and system headers.
                    </p>
                  </div>

                  <form onSubmit={handleSaveCompany} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Company Name *</label>
                        <input
                          type="text"
                          required
                          value={companyForm.companyName}
                          onChange={e => setCompanyForm({ ...companyForm, companyName: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Company Logo URL / Data</label>
                        <input
                          type="text"
                          placeholder="https://... or base64 data"
                          value={companyForm.companyLogo || ''}
                          onChange={e => setCompanyForm({ ...companyForm, companyLogo: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Official Address</label>
                      <input
                        type="text"
                        value={companyForm.address || ''}
                        onChange={e => setCompanyForm({ ...companyForm, address: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                        <input
                          type="text"
                          value={companyForm.phone || ''}
                          onChange={e => setCompanyForm({ ...companyForm, phone: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Contact Email</label>
                        <input
                          type="email"
                          value={companyForm.email || ''}
                          onChange={e => setCompanyForm({ ...companyForm, email: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Website</label>
                        <input
                          type="text"
                          value={companyForm.website || ''}
                          onChange={e => setCompanyForm({ ...companyForm, website: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Tax / Company Registration Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. GSTIN / CIN / Registration Code"
                        value={companyForm.taxRegistrationNumber || ''}
                        onChange={e => setCompanyForm({ ...companyForm, taxRegistrationNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{saving ? 'Saving...' : 'Save Company Settings'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ============================================================ */}
              {/* 2. BRAND SETTINGS */}
              {/* ============================================================ */}
              {activeTab === 'brands' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-brand-600" />
                        <span>Brands Management</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Manage corporate brands integrated with employee profiles, shifts, and attendance records.
                      </p>
                    </div>

                    <button
                      onClick={openCreateBrandModal}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Brand</span>
                    </button>
                  </div>

                  {/* Brands Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Brand Name</th>
                          <th className="py-2.5 px-3">Code</th>
                          <th className="py-2.5 px-3">Legal Company</th>
                          <th className="py-2.5 px-3">Employees</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {settingsData?.brands.map(b => (
                          <tr key={b.id} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-3 font-semibold text-slate-900">{b.name}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                              <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px]">
                                {b.code}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{b.companyName}</td>
                            <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">
                              {(b as any)._count?.employees || 0}
                            </td>
                            <td className="py-2.5 px-3">
                              {b.isActive ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => openEditBrandModal(b)}
                                className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded-md"
                                title="Edit Brand Details"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* 3. ATTENDANCE RULES */}
              {/* ============================================================ */}
              {activeTab === 'attendance' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-brand-600" />
                      <span>Attendance & Working Hour Rules</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Set daily expected hours, late arrival grace duration, half-day thresholds, and attendance rules.
                    </p>
                  </div>

                  <form onSubmit={handleSaveAttendance} className="space-y-6 text-xs">
                    {/* SECTION 1: Company-Wide Default Working Hours by Gender */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-brand-600" />
                            Default Daily Working Hours (By Gender) *
                          </span>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Company-wide standard working hours for male and female employees. Individual brands can override these below.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                          <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
                            <span>Male Required Hours *</span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.5"
                              min="1"
                              max="24"
                              required
                              value={attendanceForm.defaultMaleDailyHours || 9.0}
                              onChange={e =>
                                setAttendanceForm({
                                  ...attendanceForm,
                                  defaultMaleDailyHours: parseFloat(e.target.value) || 9.0
                                })
                              }
                              className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                            />
                            <span className="absolute right-3 top-2 text-slate-400 font-medium text-[11px]">hrs</span>
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            Default male daily working duration (e.g. 9.0)
                          </span>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                          <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-pink-500 inline-block"></span>
                            <span>Female Required Hours *</span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.5"
                              min="1"
                              max="24"
                              required
                              value={attendanceForm.defaultFemaleDailyHours || 8.0}
                              onChange={e =>
                                setAttendanceForm({
                                  ...attendanceForm,
                                  defaultFemaleDailyHours: parseFloat(e.target.value) || 8.0
                                })
                              }
                              className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                            />
                            <span className="absolute right-3 top-2 text-slate-400 font-medium text-[11px]">hrs</span>
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            Default female daily working duration (e.g. 8.0)
                          </span>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                          <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-slate-400 inline-block"></span>
                            <span>General Fallback Hours *</span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.5"
                              min="1"
                              max="24"
                              required
                              value={attendanceForm.requiredDailyHours || 8.0}
                              onChange={e =>
                                setAttendanceForm({
                                  ...attendanceForm,
                                  requiredDailyHours: parseFloat(e.target.value) || 8.0
                                })
                              }
                              className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                            />
                            <span className="absolute right-3 top-2 text-slate-400 font-medium text-[11px]">hrs</span>
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            Fallback if gender is unassigned (e.g. 8.0)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: Brand-Specific Working Hours Table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-brand-600" />
                            Brand-Wise Required Daily Working Hours
                          </span>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Configure distinct working hours for each brand for Female and Male employees. Overrides default hours.
                          </p>
                        </div>
                        <span className="text-[10px] bg-brand-50 text-brand-700 font-bold px-2 py-0.5 rounded-full border border-brand-200">
                          {attendanceForm.brandRules?.length || 0} Brands Configured
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100/75 text-slate-600 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-2.5">Brand</th>
                              <th className="px-4 py-2.5">
                                <span className="flex items-center gap-1 text-blue-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                                  Male Daily Hours *
                                </span>
                              </th>
                              <th className="px-4 py-2.5">
                                <span className="flex items-center gap-1 text-pink-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
                                  Female Daily Hours *
                                </span>
                              </th>
                              <th className="px-4 py-2.5">Summary</th>
                              <th className="px-4 py-2.5 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(attendanceForm.brandRules && attendanceForm.brandRules.length > 0) ? (
                              attendanceForm.brandRules.map((br) => {
                                const isCustom =
                                  br.maleDailyHours !== attendanceForm.defaultMaleDailyHours ||
                                  br.femaleDailyHours !== attendanceForm.defaultFemaleDailyHours;

                                return (
                                  <tr key={br.brandId} className="hover:bg-slate-50/70 transition-colors">
                                    <td className="px-4 py-3">
                                      <div className="font-bold text-slate-800">{br.brandName || 'Brand'}</div>
                                      <div className="font-mono text-[10px] text-slate-400">{br.brandCode || br.brandId}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          step="0.5"
                                          min="1"
                                          max="24"
                                          required
                                          value={br.maleDailyHours}
                                          onChange={(e) =>
                                            handleBrandHoursChange(
                                              br.brandId,
                                              'maleDailyHours',
                                              parseFloat(e.target.value) || 9.0
                                            )
                                          }
                                          className="w-20 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-blue-700 bg-white"
                                        />
                                        <span className="text-[10px] text-slate-400">hrs</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          step="0.5"
                                          min="1"
                                          max="24"
                                          required
                                          value={br.femaleDailyHours}
                                          onChange={(e) =>
                                            handleBrandHoursChange(
                                              br.brandId,
                                              'femaleDailyHours',
                                              parseFloat(e.target.value) || 8.0
                                            )
                                          }
                                          className="w-20 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-pink-700 bg-white"
                                        />
                                        <span className="text-[10px] text-slate-400">hrs</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                                          isCustom ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                          {isCustom ? 'Brand Custom' : 'Default Ratio'}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono">
                                          ♂ {br.maleDailyHours}h / ♀ {br.femaleDailyHours}h
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <button
                                        type="button"
                                        onClick={() => handleResetBrandHours(br.brandId)}
                                        title="Reset this brand's hours to default male/female hours"
                                        className="text-[11px] text-slate-500 hover:text-brand-600 font-medium hover:underline"
                                      >
                                        Reset to Default
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                                  No brands registered. Register brands in the Brands tab to configure brand-wise hours.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* SECTION 3: General Thresholds & Grace Periods */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Late-Arrival Grace Period (Minutes) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="120"
                          required
                          value={attendanceForm.lateGracePeriodMinutes}
                          onChange={e =>
                            setAttendanceForm({
                              ...attendanceForm,
                              lateGracePeriodMinutes: parseInt(e.target.value, 10) || 0
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                        />
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          Punches within grace period are not marked late (e.g. 15 mins)
                        </span>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Half-Day Threshold Hours *
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="12"
                          required
                          value={attendanceForm.halfDayThresholdHours}
                          onChange={e =>
                            setAttendanceForm({
                              ...attendanceForm,
                              halfDayThresholdHours: parseFloat(e.target.value) || 4.0
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                        />
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          Working less than this is flagged as absent / half-day
                        </span>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Minimum Hours For Present Status *
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="12"
                          required
                          value={attendanceForm.minHoursForPresent}
                          onChange={e =>
                            setAttendanceForm({
                              ...attendanceForm,
                              minHoursForPresent: parseFloat(e.target.value) || 4.0
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                        />
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          Minimum duration required to record attendance as Present
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={attendanceForm.incompleteHoursDeductionEnabled}
                          onChange={e =>
                            setAttendanceForm({
                              ...attendanceForm,
                              incompleteHoursDeductionEnabled: e.target.checked
                            })
                          }
                          className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                        />
                        <div>
                          <span className="font-semibold text-slate-800">
                            Enable Incomplete Hours Calculation Rule
                          </span>
                          <p className="text-[11px] text-slate-400">
                            Calculate incomplete hours when total working hours fall below expected daily threshold for their brand and gender.
                          </p>
                        </div>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={attendanceForm.autoMarkAbsentIfNoCheckIn}
                          onChange={e =>
                            setAttendanceForm({
                              ...attendanceForm,
                              autoMarkAbsentIfNoCheckIn: e.target.checked
                            })
                          }
                          className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                        />
                        <div>
                          <span className="font-semibold text-slate-800">
                            Auto-Mark Absent if No Punch Recorded
                          </span>
                          <p className="text-[11px] text-slate-400">
                            Automatically treat employees with no check-in punch on working days as Absent.
                          </p>
                        </div>
                      </label>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{saving ? 'Saving...' : 'Save Attendance Rules'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ============================================================ */}
              {/* 4. LEAVE POLICIES */}
              {/* ============================================================ */}
              {activeTab === 'leave' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-brand-600" />
                      <span>Leave Policies & Allowances</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure company-wide carry-forward limits, accrual frequency, and manage leave types.
                    </p>
                  </div>

                  {/* General Policy Rules Form */}
                  <form onSubmit={handleSaveLeavePolicies} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Max Carry-Forward Days Allowance
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="90"
                          value={leavePoliciesForm.maxCarryForwardDays}
                          onChange={e =>
                            setLeavePoliciesForm({
                              ...leavePoliciesForm,
                              maxCarryForwardDays: parseInt(e.target.value, 10) || 0
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                        />
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          Maximum accumulated days carried over into the next calendar year
                        </span>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Leave Accrual / Allocation Rule
                        </label>
                        <select
                          value={leavePoliciesForm.accrualFrequency}
                          onChange={e =>
                            setLeavePoliciesForm({
                              ...leavePoliciesForm,
                              accrualFrequency: e.target.value
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                        >
                          <option value="YEARLY">Annual Upfront Allocation (Yearly)</option>
                          <option value="MONTHLY">Monthly Pro-Rated Accrual</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={leavePoliciesForm.allowNegativeBalance}
                          onChange={e =>
                            setLeavePoliciesForm({
                              ...leavePoliciesForm,
                              allowNegativeBalance: e.target.checked
                            })
                          }
                          className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                        />
                        <div>
                          <span className="font-semibold text-slate-800">Allow Negative Balance</span>
                          <p className="text-[11px] text-slate-400">
                            Allow employees to request leave in advance beyond currently accrued balance.
                          </p>
                        </div>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={leavePoliciesForm.probationLeaveAllowed}
                          onChange={e =>
                            setLeavePoliciesForm({
                              ...leavePoliciesForm,
                              probationLeaveAllowed: e.target.checked
                            })
                          }
                          className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                        />
                        <div>
                          <span className="font-semibold text-slate-800">Leave Allowed on Probation</span>
                          <p className="text-[11px] text-slate-400">
                            Permit employees under probation status to apply for paid leaves.
                          </p>
                        </div>
                      </label>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Leave Rules</span>
                      </button>
                    </div>
                  </form>

                  {/* Leave Types Management Table */}
                  <div className="pt-6 border-t border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900 text-xs">Configured Leave Types</h3>
                        <p className="text-slate-400 text-[11px]">
                          Define annual days per leave category and carry-forward permissions.
                        </p>
                      </div>

                      <button
                        onClick={openCreateLeaveTypeModal}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-lg text-xs font-semibold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Leave Type</span>
                      </button>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase">
                          <tr>
                            <th className="py-2.5 px-3">Type Name</th>
                            <th className="py-2.5 px-3">Code</th>
                            <th className="py-2.5 px-3">Brand</th>
                            <th className="py-2.5 px-3">Annual Allowance</th>
                            <th className="py-2.5 px-3">Paid / Unpaid</th>
                            <th className="py-2.5 px-3">Carry Forward</th>
                            <th className="py-2.5 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {settingsData?.leave.types.map(lt => (
                            <tr key={lt.id} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-3 font-semibold text-slate-900">{lt.name}</td>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                                <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px]">
                                  {lt.code}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">{lt.brand?.name || 'General'}</td>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                                {lt.daysPerYear} days/yr
                              </td>
                              <td className="py-2.5 px-3">
                                {lt.isPaid ? (
                                  <span className="text-emerald-700 font-semibold">Paid</span>
                                ) : (
                                  <span className="text-slate-500">Unpaid</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                {lt.carryForward ? (
                                  <span className="text-blue-700 font-semibold">Yes</span>
                                ) : (
                                  <span className="text-slate-400">No</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    onClick={() => openEditLeaveTypeModal(lt)}
                                    className="p-1 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded"
                                    title="Edit"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLeaveType(lt)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* 5. SHIFT RULES */}
              {/* ============================================================ */}
              {activeTab === 'shift' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <CalendarRange className="w-4 h-4 text-brand-600" />
                      <span>Shift Rules & Timing Configuration</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure global shift defaults, break duration, and overnight shift handling.
                    </p>
                  </div>

                  <form onSubmit={handleSaveShiftRules} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Default Shift
                        </label>
                        <select
                          value={shiftRulesForm.defaultShiftId || ''}
                          onChange={e =>
                            setShiftRulesForm({
                              ...shiftRulesForm,
                              defaultShiftId: e.target.value
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                        >
                          <option value="">-- Auto Resolve from Brand / Branch --</option>
                          {settingsData?.shift.shifts.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.startTime}–{s.endTime}) - {s.brand?.name || 'General'}
                            </option>
                          ))}
                        </select>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          Fallback shift applied when no specific employee assignment exists
                        </span>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Default Break Duration (Minutes) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="180"
                          required
                          value={shiftRulesForm.defaultBreakMinutes}
                          onChange={e =>
                            setShiftRulesForm({
                              ...shiftRulesForm,
                              defaultBreakMinutes: parseInt(e.target.value, 10) || 60
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Default Weekly-Off Day *
                        </label>
                        <select
                          value={shiftRulesForm.defaultWeeklyOff}
                          onChange={e =>
                            setShiftRulesForm({
                              ...shiftRulesForm,
                              defaultWeeklyOff: e.target.value
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
                        >
                          <option value="SUNDAY">Sunday</option>
                          <option value="SATURDAY">Saturday</option>
                          <option value="FRIDAY">Friday</option>
                          <option value="MONDAY">Monday</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Max Consecutive Working Days *
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="14"
                          required
                          value={shiftRulesForm.maxConsecutiveWorkingDays}
                          onChange={e =>
                            setShiftRulesForm({
                              ...shiftRulesForm,
                              maxConsecutiveWorkingDays: parseInt(e.target.value, 10) || 6
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={shiftRulesForm.allowOvernightShifts}
                          onChange={e =>
                            setShiftRulesForm({
                              ...shiftRulesForm,
                              allowOvernightShifts: e.target.checked
                            })
                          }
                          className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                        />
                        <div>
                          <span className="font-semibold text-slate-800">
                            Support Overnight / Cross-Midnight Shifts
                          </span>
                          <p className="text-[11px] text-slate-400">
                            Allow shift end times to cross midnight into the subsequent calendar day.
                          </p>
                        </div>
                      </label>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{saving ? 'Saving...' : 'Save Shift Rules'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ============================================================ */}
              {/* 6. PAYROLL SETTINGS */}
              {/* ============================================================ */}
              {activeTab === 'payroll' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-brand-600" />
                      <span>Payroll & Salary Calculation Settings</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure default overtime calculation rate multiplier, incomplete deductions, and cutoff day.
                    </p>
                  </div>

                  <form onSubmit={handleSavePayroll} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Default Overtime Multiplier *
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          min="1.0"
                          max="4.0"
                          required
                          value={payrollForm.defaultOtMultiplier}
                          onChange={e =>
                            setPayrollForm({
                              ...payrollForm,
                              defaultOtMultiplier: parseFloat(e.target.value) || 1.5
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                        />
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          e.g. 1.5x of hourly base rate (or 1.25x / 2.0x)
                        </span>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Overtime Calculation Method
                        </label>
                        <select
                          value={payrollForm.otCalculationMethod}
                          onChange={e =>
                            setPayrollForm({
                              ...payrollForm,
                              otCalculationMethod: e.target.value
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                        >
                          <option value="STANDARD_MULTIPLIER">
                            Standard Multiplier (Hourly Rate × Multiplier)
                          </option>
                          <option value="CUSTOM_RATE">Fixed Custom Rate Per Hour</option>
                          <option value="NONE">Disabled (No Overtime Pay)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Incomplete-Hours Deduction Rule
                        </label>
                        <select
                          value={payrollForm.incompleteDeductionMethod}
                          onChange={e =>
                            setPayrollForm({
                              ...payrollForm,
                              incompleteDeductionMethod: e.target.value
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                        >
                          <option value="HOURLY_PRORATED">
                            Hourly Pro-Rated (Fixed Salary ÷ Working Hours)
                          </option>
                          <option value="CUSTOM_RATE">Fixed Rate Per Incomplete Hour</option>
                          <option value="NONE">Do Not Deduct Incomplete Hours</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Incentive Handling Rule
                        </label>
                        <select
                          value={payrollForm.incentiveApprovalRule}
                          onChange={e =>
                            setPayrollForm({
                              ...payrollForm,
                              incentiveApprovalRule: e.target.value
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                        >
                          <option value="REQUIRE_HR_APPROVAL">
                            Require HR Review & Approval Before Inclusion
                          </option>
                          <option value="AUTO_APPROVED">
                            Automatically Include Approved Incentives
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Monthly Payroll Cutoff Day *
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          required
                          value={payrollForm.payrollCutoffDay}
                          onChange={e =>
                            setPayrollForm({
                              ...payrollForm,
                              payrollCutoffDay: parseInt(e.target.value, 10) || 25
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                        />
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          Day of the month attendance closes (e.g. 25th)
                        </span>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Payroll Cycle Format
                        </label>
                        <select
                          value={payrollForm.payrollCycle}
                          onChange={e =>
                            setPayrollForm({
                              ...payrollForm,
                              payrollCycle: e.target.value
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                        >
                          <option value="CALENDAR_MONTH">Full Calendar Month (1st to 30/31st)</option>
                          <option value="26_TO_25">Staggered Cycle (26th to 25th)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Standard Working Days / Month *
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          required
                          value={payrollForm.standardWorkingDaysPerMonth}
                          onChange={e =>
                            setPayrollForm({
                              ...payrollForm,
                              standardWorkingDaysPerMonth: parseInt(e.target.value, 10) || 26
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                        />
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          Typically 26 days (excluding weekly offs)
                        </span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{saving ? 'Saving...' : 'Save Payroll Settings'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ============================================================ */}
              {/* 7. PUNCHING DEVICE SETTINGS */}
              {/* ============================================================ */}
              {activeTab === 'devices' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-brand-600" />
                        <span>Biometric & Punching Device Terminals</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Configure hardware attendance machines, network IPs, and connection health status.
                      </p>
                    </div>

                    <button
                      onClick={openCreateDeviceModal}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Device</span>
                    </button>
                  </div>

                  {/* Devices Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Device Name</th>
                          <th className="py-2.5 px-3">Serial / ID</th>
                          <th className="py-2.5 px-3">IP Address : Port</th>
                          <th className="py-2.5 px-3">Location</th>
                          <th className="py-2.5 px-3">Brand & Branch</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {settingsData?.devices.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-slate-400">
                              No biometric hardware devices configured yet.
                            </td>
                          </tr>
                        ) : (
                          settingsData?.devices.map(dev => (
                            <tr key={dev.id} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-900">{dev.deviceName}</div>
                                {!dev.isActive && (
                                  <span className="text-[10px] text-rose-600 font-semibold">Disabled</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                                {dev.serialNumber}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600">
                                {dev.ipAddress || 'LAN DHCP'}:{dev.port || 4370}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500">{dev.location || '—'}</td>
                              <td className="py-2.5 px-3">
                                <div className="font-medium text-slate-800">{dev.brand?.name}</div>
                                <div className="text-[10px] text-slate-400">{dev.branch?.name}</div>
                              </td>
                              <td className="py-2.5 px-3">
                                {dev.status === 'ONLINE' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Online
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                    Offline
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="inline-flex items-center gap-1">
                                  {/* Test Connection Button */}
                                  <button
                                    onClick={() => handleTestConnection('DEVICE', { deviceId: dev.id })}
                                    disabled={testingType === 'DEVICE'}
                                    className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                                    title="Test Connection"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Toggle Active Switch */}
                                  <button
                                    onClick={() => handleToggleDevice(dev)}
                                    className={`p-1 rounded ${
                                      dev.isActive
                                        ? 'text-emerald-600 hover:bg-emerald-50'
                                        : 'text-slate-400 hover:bg-slate-100'
                                    }`}
                                    title={dev.isActive ? 'Disable Device' : 'Enable Device'}
                                  >
                                    <Power className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => openEditDeviceModal(dev)}
                                    className="p-1 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded"
                                    title="Edit Device"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => handleDeleteDevice(dev)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded"
                                    title="Delete Device"
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
                </div>
              )}

              {/* ============================================================ */}
              {/* 8. API SETTINGS */}
              {/* ============================================================ */}
              {activeTab === 'api' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Key className="w-4 h-4 text-brand-600" />
                      <span>API & Integration Credentials</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure biometric API sync gateways and email delivery credentials. All secret keys are masked
                      and never exposed.
                    </p>
                  </div>

                  <form onSubmit={handleSaveApi} className="space-y-6 text-xs">
                    {/* Biometric Integration API */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 flex items-center gap-2 text-xs">
                          <Cpu className="w-4 h-4 text-brand-600" />
                          <span>Biometric Hardware Webhook / API</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleTestConnection('BIOMETRIC', { url: apiForm.biometricWebhookUrl })}
                          disabled={testingType === 'BIOMETRIC'}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-[11px] font-semibold"
                        >
                          <Send className={`w-3 h-3 ${testingType === 'BIOMETRIC' ? 'animate-spin' : ''}`} />
                          <span>Test Gateway</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Webhook URL Endpoint</label>
                          <input
                            type="text"
                            placeholder="http://localhost:5000/api/attendance/sync"
                            value={apiForm.biometricWebhookUrl}
                            onChange={e => setApiForm({ ...apiForm, biometricWebhookUrl: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Biometric API Secret Key (Masked)
                          </label>
                          <input
                            type="password"
                            placeholder={apiForm.hasBiometricKey ? '••••••••••••••••' : 'Enter secret key'}
                            value={apiForm.biometricApiKey || ''}
                            onChange={e => setApiForm({ ...apiForm, biometricApiKey: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                          />
                          <span className="text-[10px] text-slate-400 mt-0.5 block">
                            Leave as-is to keep existing configured secret.
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Email SMTP Gateway */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 flex items-center gap-2 text-xs">
                          <Mail className="w-4 h-4 text-brand-600" />
                          <span>Email SMTP Delivery Gateway</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleTestConnection('SMTP', apiForm)}
                          disabled={testingType === 'SMTP'}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-[11px] font-semibold"
                        >
                          <Send className={`w-3 h-3 ${testingType === 'SMTP' ? 'animate-spin' : ''}`} />
                          <span>Test SMTP</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">SMTP Host</label>
                          <input
                            type="text"
                            placeholder="smtp.ethereal.email or smtp.gmail.com"
                            value={apiForm.smtpHost}
                            onChange={e => setApiForm({ ...apiForm, smtpHost: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">SMTP Port</label>
                          <input
                            type="number"
                            placeholder="587"
                            value={apiForm.smtpPort}
                            onChange={e => setApiForm({ ...apiForm, smtpPort: parseInt(e.target.value, 10) || 587 })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                          />
                        </div>

                        <div className="flex items-center pt-5">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={apiForm.smtpSecure}
                              onChange={e => setApiForm({ ...apiForm, smtpSecure: e.target.checked })}
                              className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                            />
                            <span className="font-semibold text-slate-800">Use SSL / TLS</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">SMTP Username / Email</label>
                          <input
                            type="text"
                            placeholder="user@example.com"
                            value={apiForm.smtpUser || ''}
                            onChange={e => setApiForm({ ...apiForm, smtpUser: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            SMTP Password (Masked)
                          </label>
                          <input
                            type="password"
                            placeholder={apiForm.hasSmtpPassword ? '••••••••••••••••' : 'Enter password'}
                            value={apiForm.smtpPassword || ''}
                            onChange={e => setApiForm({ ...apiForm, smtpPassword: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Notification Webhook */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Outbound HR Notification Webhook URL (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="https://hooks.slack.com/... or corporate webhook"
                        value={apiForm.notificationWebhookUrl || ''}
                        onChange={e => setApiForm({ ...apiForm, notificationWebhookUrl: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{saving ? 'Saving...' : 'Save API Settings'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL: ADD / EDIT BRAND */}
      {/* ============================================================ */}
      <Modal
        isOpen={isBrandModalOpen}
        onClose={() => setIsBrandModalOpen(false)}
        title={editingBrand ? `Edit Brand: ${editingBrand.name}` : 'Add New Corporate Brand'}
        description="Configure brand name, unique code, legal entity name, and status."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveBrand} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Brand Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Apex Retail Group"
              value={brandForm.name}
              onChange={e => setBrandForm({ ...brandForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Brand Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. APEX"
                value={brandForm.code}
                onChange={e => setBrandForm({ ...brandForm, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={brandForm.isActive ? 'true' : 'false'}
                onChange={e => setBrandForm({ ...brandForm, isActive: e.target.value === 'true' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Company / Legal Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Apex Retail Enterprises Pvt. Ltd."
              value={brandForm.companyName}
              onChange={e => setBrandForm({ ...brandForm, companyName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                placeholder="+91..."
                value={brandForm.phone}
                onChange={e => setBrandForm({ ...brandForm, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                placeholder="brand@example.com"
                value={brandForm.email}
                onChange={e => setBrandForm({ ...brandForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsBrandModalOpen(false)}
              className="px-3.5 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-xs"
            >
              {editingBrand ? 'Save Changes' : 'Create Brand'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL: ADD / EDIT LEAVE TYPE */}
      {/* ============================================================ */}
      <Modal
        isOpen={isLeaveTypeModalOpen}
        onClose={() => setIsLeaveTypeModalOpen(false)}
        title={editingLeaveType ? `Edit Leave Type: ${editingLeaveType.name}` : 'Add Leave Type Category'}
        description="Configure annual allowance and carry-forward rules for this leave category."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveLeaveType} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Leave Type Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Casual Leave, Sick Leave, Annual Privilege"
              value={leaveTypeForm.name}
              onChange={e => setLeaveTypeForm({ ...leaveTypeForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. CL, SL, AL"
                value={leaveTypeForm.code}
                onChange={e => setLeaveTypeForm({ ...leaveTypeForm, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Brand *</label>
              <select
                value={leaveTypeForm.brandId}
                onChange={e => setLeaveTypeForm({ ...leaveTypeForm, brandId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
              >
                {settingsData?.brands.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Annual Allowance (Days) *</label>
              <input
                type="number"
                min="0"
                max="365"
                step="0.5"
                required
                value={leaveTypeForm.daysPerYear}
                onChange={e =>
                  setLeaveTypeForm({ ...leaveTypeForm, daysPerYear: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Paid or Unpaid</label>
              <select
                value={leaveTypeForm.isPaid ? 'true' : 'false'}
                onChange={e => setLeaveTypeForm({ ...leaveTypeForm, isPaid: e.target.value === 'true' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
              >
                <option value="true">Paid Leave</option>
                <option value="false">Unpaid Leave</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Carry Forward Option</label>
              <select
                value={leaveTypeForm.carryForward ? 'true' : 'false'}
                onChange={e =>
                  setLeaveTypeForm({ ...leaveTypeForm, carryForward: e.target.value === 'true' })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
              >
                <option value="false">No Carry Forward</option>
                <option value="true">Carry Forward Enabled</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Accrual Frequency</label>
              <select
                value={leaveTypeForm.accrualRule}
                onChange={e => setLeaveTypeForm({ ...leaveTypeForm, accrualRule: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
              >
                <option value="YEARLY">Annual Upfront</option>
                <option value="MONTHLY">Monthly Pro-Rata</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsLeaveTypeModalOpen(false)}
              className="px-3.5 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-xs"
            >
              {editingLeaveType ? 'Save Changes' : 'Create Leave Type'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL: ADD / EDIT PUNCHING DEVICE */}
      {/* ============================================================ */}
      <Modal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
        title={editingDevice ? `Edit Device: ${editingDevice.deviceName}` : 'Add Punching Device Terminal'}
        description="Register a hardware biometric machine or API connection."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveDevice} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Device Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Mumbai HQ Main Entrance Biometric"
              value={deviceForm.deviceName}
              onChange={e => setDeviceForm({ ...deviceForm, deviceName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Device Serial / Unique ID *</label>
              <input
                type="text"
                required
                placeholder="e.g. ZK-BIO-9021"
                value={deviceForm.serialNumber}
                onChange={e => setDeviceForm({ ...deviceForm, serialNumber: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">IP Address</label>
              <input
                type="text"
                placeholder="e.g. 192.168.1.201"
                value={deviceForm.ipAddress}
                onChange={e => setDeviceForm({ ...deviceForm, ipAddress: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Port</label>
              <input
                type="number"
                value={deviceForm.port}
                onChange={e => setDeviceForm({ ...deviceForm, port: parseInt(e.target.value, 10) || 4370 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Location / Zone</label>
              <input
                type="text"
                placeholder="e.g. Reception, 2nd Floor Gate"
                value={deviceForm.location}
                onChange={e => setDeviceForm({ ...deviceForm, location: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Assigned Brand *</label>
              <select
                value={deviceForm.brandId}
                onChange={e => {
                  const b = settingsData?.brands.find(brand => brand.id === e.target.value);
                  setDeviceForm({
                    ...deviceForm,
                    brandId: e.target.value,
                    branchId: b?.branches?.[0]?.id || ''
                  });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
              >
                {settingsData?.brands.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Assigned Branch</label>
              <select
                value={deviceForm.branchId}
                onChange={e => setDeviceForm({ ...deviceForm, branchId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
              >
                {settingsData?.brands
                  .find(b => b.id === deviceForm.brandId)
                  ?.branches?.map((br: any) => (
                    <option key={br.id} value={br.id}>
                      {br.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={deviceForm.isActive}
                onChange={e => setDeviceForm({ ...deviceForm, isActive: e.target.checked })}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
              />
              <span className="font-semibold text-slate-800">Device Enabled & Actively Syncing</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsDeviceModalOpen(false)}
              className="px-3.5 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-xs"
            >
              {editingDevice ? 'Save Changes' : 'Register Device'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* CONFIRMATION MODAL */}
      {/* ============================================================ */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        title={confirmModal.title}
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-snug">{confirmModal.description}</p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
              className="px-3.5 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmModal({ ...confirmModal, isOpen: false });
                confirmModal.onConfirm();
              }}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-xs"
            >
              Yes, Apply Changes
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SettingsPage;
