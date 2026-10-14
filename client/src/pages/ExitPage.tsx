import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Clock,
  Calendar,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Filter,
  RefreshCw,
  X,
  Check,
  ChevronRight,
  Download,
  Eye,
  AlertTriangle,
  RotateCcw,
  Building,
  User,
  ShieldCheck,
  Printer,
  FileCheck,
  Send,
  CalendarDays
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';
import { api } from '../services/api';
import {
  ExitRequest,
  ExitMetrics,
  ExitRequestStatus,
  RelievingLetterPreview,
  Asset,
  Employee
} from '../types';

export const ExitPage: React.FC = () => {
  const { user } = useAuth();
  const { selectedBrandId } = useBrand();

  const isHrOrAdmin =
    user?.role === 'SUPER_ADMIN' || user?.role === 'GROUP_HR' || user?.role === 'BRAND_HR';
  const isManager = user?.role === 'MANAGER';
  const isEmployee = user?.role === 'EMPLOYEE';

  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<ExitMetrics>({
    totalRequests: 0,
    pendingApprovals: 0,
    servingNotice: 0,
    pendingAssetClearance: 0,
    exitsCompleted: 0
  });
  const [requests, setRequests] = useState<ExitRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modals & Active Selections
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [selectedExit, setSelectedExit] = useState<ExitRequest | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'checklist' | 'assets' | 'letter'>('overview');

  // Submit Resignation Form State
  const [activeEmployees, setActiveEmployees] = useState<Employee[]>([]);
  const [submitForm, setSubmitForm] = useState({
    employeeId: user?.employeeId || '',
    resignationDate: new Date().toISOString().split('T')[0],
    reason: '',
    proposedLastWorkingDay: '',
    employeeRemarks: ''
  });

  // Action Modals State
  const [isApproveModalOpen, setIsApproveModalOpen] = useState<boolean>(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState<boolean>(false);
  const [isLwdModalOpen, setIsLwdModalOpen] = useState<boolean>(false);
  const [actionRemarks, setActionRemarks] = useState<string>('');
  const [updatedLwd, setUpdatedLwd] = useState<string>('');

  // Asset Clearance Data for selected exit
  const [assetsData, setAssetsData] = useState<{
    assignedAssets: Asset[];
    assetHistory: any[];
    assetClearanceCompleted: boolean;
    assetClearanceNotes?: string;
  } | null>(null);

  // Relieving Letter Preview State
  const [letterPreview, setLetterPreview] = useState<RelievingLetterPreview | null>(null);

  // Helper for auto-calculating proposed LWD (30 days from resignation date)
  const calculateDefaultLwd = (resDate: string) => {
    if (!resDate) return '';
    const date = new Date(resDate);
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
  };

  // Fetch Dashboard Data
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await api.getExitDashboard({
        brandId: selectedBrandId !== 'all' ? selectedBrandId : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        search: searchTerm
      });
      setMetrics(data.metrics);
      setRequests(data.requests);

      // Keep selectedExit up to date if open
      if (selectedExit) {
        const refreshed = data.requests.find((r) => r.id === selectedExit.id);
        if (refreshed) setSelectedExit(refreshed);
      }
    } catch (err: any) {
      console.error('Failed to load exit dashboard:', err);
      setMessage({ text: err.message || 'Failed to load exit requests', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Load active employees list for HR resignation submission
  const loadEmployees = async () => {
    if (!isHrOrAdmin) return;
    try {
      const data = await api.getEmployees({
        brandId: selectedBrandId !== 'all' ? selectedBrandId : undefined,
        status: 'ACTIVE',
        limit: 200
      });
      setActiveEmployees(data);
    } catch (err) {
      console.error('Failed to load employees for exit modal:', err);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedBrandId, statusFilter]);

  useEffect(() => {
    loadEmployees();
  }, [selectedBrandId, isHrOrAdmin]);

  // Load assets when tab switches to 'assets'
  const loadExitAssets = async (exitId: string) => {
    try {
      const data = await api.getExitAssets(exitId);
      setAssetsData(data);
    } catch (err: any) {
      console.error('Failed to load assigned assets:', err);
    }
  };

  // Load relieving letter preview when tab switches to 'letter'
  const loadLetterPreview = async (exitId: string) => {
    try {
      const data = await api.previewRelievingLetter(exitId);
      setLetterPreview(data);
    } catch (err: any) {
      console.error('Failed to load letter preview:', err);
    }
  };

  // Open Exit Details Modal
  const handleOpenDetailModal = (exit: ExitRequest, tab: 'overview' | 'checklist' | 'assets' | 'letter' = 'overview') => {
    setSelectedExit(exit);
    setActiveTab(tab);
    setUpdatedLwd(exit.lastWorkingDay);
    if (tab === 'assets') loadExitAssets(exit.id);
    if (tab === 'letter') loadLetterPreview(exit.id);
  };

  const handleTabChange = (tab: 'overview' | 'checklist' | 'assets' | 'letter') => {
    setActiveTab(tab);
    if (!selectedExit) return;
    if (tab === 'assets') loadExitAssets(selectedExit.id);
    if (tab === 'letter') loadLetterPreview(selectedExit.id);
  };

  // Submit Resignation Handler
  const handleOpenSubmitModal = () => {
    const today = new Date().toISOString().split('T')[0];
    const targetEmpId = isEmployee && user?.employeeId ? user.employeeId : '';
    setSubmitForm({
      employeeId: targetEmpId,
      resignationDate: today,
      reason: '',
      proposedLastWorkingDay: calculateDefaultLwd(today),
      employeeRemarks: ''
    });
    setIsSubmitModalOpen(true);
  };

  const handleSubmitResignation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitForm.reason.trim()) {
      setMessage({ text: 'Please provide a valid resignation reason.', type: 'error' });
      return;
    }
    if (!submitForm.employeeId) {
      setMessage({ text: 'Please select an employee.', type: 'error' });
      return;
    }

    try {
      setActionLoading(true);
      await api.submitResignation({
        employeeId: submitForm.employeeId,
        resignationDate: submitForm.resignationDate,
        reason: submitForm.reason,
        proposedLastWorkingDay: submitForm.proposedLastWorkingDay,
        employeeRemarks: submitForm.employeeRemarks
      });

      setMessage({ text: 'Resignation request submitted successfully.', type: 'success' });
      setIsSubmitModalOpen(false);
      loadDashboardData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to submit resignation.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Approve Resignation
  const handleApproveResignation = async () => {
    if (!selectedExit) return;
    try {
      setActionLoading(true);
      const updated = await api.approveResignation(selectedExit.id, {
        hrRemarks: actionRemarks,
        confirmedLastWorkingDay: updatedLwd || selectedExit.lastWorkingDay
      });
      setSelectedExit(updated);
      setIsApproveModalOpen(false);
      setActionRemarks('');
      setMessage({ text: 'Resignation approved. Notice period commenced.', type: 'success' });
      loadDashboardData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to approve resignation.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Reject Resignation
  const handleRejectResignation = async () => {
    if (!selectedExit) return;
    if (!actionRemarks.trim()) {
      setMessage({ text: 'Rejection remarks are required.', type: 'error' });
      return;
    }
    try {
      setActionLoading(true);
      const updated = await api.rejectResignation(selectedExit.id, { hrRemarks: actionRemarks });
      setSelectedExit(updated);
      setIsRejectModalOpen(false);
      setActionRemarks('');
      setMessage({ text: 'Resignation request rejected.', type: 'success' });
      loadDashboardData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to reject resignation.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Update Last Working Day
  const handleUpdateLwd = async () => {
    if (!selectedExit || !updatedLwd) return;
    try {
      setActionLoading(true);
      const updated = await api.updateLastWorkingDay(selectedExit.id, {
        lastWorkingDay: updatedLwd,
        hrRemarks: actionRemarks
      });
      setSelectedExit(updated);
      setIsLwdModalOpen(false);
      setActionRemarks('');
      setMessage({ text: 'Last working day updated successfully.', type: 'success' });
      loadDashboardData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update last working day.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Withdraw Resignation
  const handleWithdrawResignation = async () => {
    if (!selectedExit) return;
    if (!actionRemarks.trim()) {
      setMessage({ text: 'Please specify the withdrawal reason.', type: 'error' });
      return;
    }
    try {
      setActionLoading(true);
      const updated = await api.withdrawResignation(selectedExit.id, { reason: actionRemarks });
      setSelectedExit(updated);
      setIsWithdrawModalOpen(false);
      setActionRemarks('');
      setMessage({ text: 'Resignation withdrawn successfully.', type: 'success' });
      loadDashboardData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to withdraw resignation.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Checklist Item Toggle
  const handleToggleChecklistItem = async (key: 'handoverCompleted' | 'tasksHandedOver' | 'docsHandedOver' | 'hrClearanceCompleted') => {
    if (!selectedExit || !isHrOrAdmin) return;
    try {
      const nextVal = !selectedExit[key];
      const updated = await api.updateExitChecklist(selectedExit.id, {
        [key]: nextVal
      });
      setSelectedExit(updated);
      loadDashboardData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update checklist item.', type: 'error' });
    }
  };

  // Asset Return Action
  const handleClearAsset = async (assetId: string, action: 'RETURNED' | 'DAMAGED') => {
    if (!selectedExit) return;
    try {
      setActionLoading(true);
      await api.clearExitAsset(selectedExit.id, assetId, action);
      await loadExitAssets(selectedExit.id);
      setMessage({ text: `Asset marked as ${action.toLowerCase()} successfully.`, type: 'success' });
      loadDashboardData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to clear asset.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Manual Asset Clearance Toggle
  const handleToggleManualAssetClearance = async (completed: boolean) => {
    if (!selectedExit) return;
    try {
      setActionLoading(true);
      const updated = await api.toggleManualAssetClearance(selectedExit.id, {
        completed,
        notes: completed ? 'Manually verified: No pending company assets' : ''
      });
      setSelectedExit(updated);
      await loadExitAssets(selectedExit.id);
      setMessage({ text: 'Asset clearance status updated.', type: 'success' });
      loadDashboardData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update asset clearance.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Issue Relieving Letter
  const handleIssueRelievingLetter = async () => {
    if (!selectedExit) return;
    try {
      setActionLoading(true);
      const res = await api.issueRelievingLetter(selectedExit.id);
      setSelectedExit(res.exitRequest);
      await loadLetterPreview(selectedExit.id);
      setMessage({ text: 'Relieving letter generated, issued, and saved to Employee Documents.', type: 'success' });
      loadDashboardData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to issue relieving letter.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Download Relieving Letter PDF
  const handleDownloadRelievingLetterPdf = (exitId: string) => {
    const token = localStorage.getItem('hrms_token');
    const url = `/api/exit/${exitId}/relieving-letter/pdf`;
    // Trigger direct download via fetch to include auth token
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to download PDF');
        return res.blob();
      })
      .then((blob) => {
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = `Relieving_Letter_${selectedExit?.employee?.employeeId || exitId}.pdf`;
        link.click();
      })
      .catch((err) => {
        setMessage({ text: err.message || 'Download failed.', type: 'error' });
      });
  };

  // Complete Employee Exit
  const handleCompleteExit = async () => {
    if (!selectedExit) return;
    if (
      !selectedExit.handoverCompleted ||
      !selectedExit.tasksHandedOver ||
      !selectedExit.docsHandedOver ||
      !selectedExit.hrClearanceCompleted
    ) {
      setMessage({ text: 'Please ensure all 4 Exit Checklist items are completed first.', type: 'error' });
      return;
    }
    if (!selectedExit.assetClearanceCompleted) {
      setMessage({ text: 'Asset clearance is pending. All company assets must be cleared.', type: 'error' });
      return;
    }

    try {
      setActionLoading(true);
      const updated = await api.completeExit(selectedExit.id);
      setSelectedExit(updated);
      setMessage({ text: 'Employee exit completed successfully! Employee status updated to Inactive.', type: 'success' });
      loadDashboardData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to complete exit.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Status Badge Component
  const renderStatusBadge = (status: ExitRequestStatus, remainingDays?: number) => {
    switch (status) {
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            Pending Approval
          </span>
        );
      case 'NOTICE_PERIOD':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            Serving Notice ({remainingDays !== undefined ? `${remainingDays}d left` : 'Active'})
          </span>
        );
      case 'NOTICE_COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
            Notice Completed
          </span>
        );
      case 'EXIT_COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            Exit Completed
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <X className="w-3.5 h-3.5 text-rose-500" />
            Rejected
          </span>
        );
      case 'WITHDRAWN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            Withdrawn
          </span>
        );
      default:
        return <span className="text-xs text-slate-500">{status}</span>;
    }
  };

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const empName = `${req.employee?.firstName || ''} ${req.employee?.lastName || ''}`.toLowerCase();
        const empId = (req.employee?.employeeId || '').toLowerCase();
        const brandName = (req.brand?.name || '').toLowerCase();
        return empName.includes(term) || empId.includes(term) || brandName.includes(term);
      }
      return true;
    });
  }, [requests, statusFilter, searchTerm]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Alert */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-sm transition-all ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="text-xs font-medium">{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-600" />
            Exit Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track employee resignation workflow from submission through notice tracking, clearance, and relieving letters.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenSubmitModal}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Submit Resignation</span>
          </button>
        </div>
      </div>

      {/* 1. Exit Management Dashboard: 5 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Total Exit Requests */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Exits
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{metrics.totalRequests}</div>
          <div className="text-[11px] text-slate-400 mt-1">All recorded requests</div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">
              Pending Approval
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700">{metrics.pendingApprovals}</div>
          <div className="text-[11px] text-slate-400 mt-1">Awaiting HR decision</div>
        </div>

        {/* Serving Notice */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">
              Serving Notice
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-700">{metrics.servingNotice}</div>
          <div className="text-[11px] text-slate-400 mt-1">Active notice periods</div>
        </div>

        {/* Pending Asset Clearances */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-orange-600 uppercase tracking-wider">
              Asset Clearance
            </span>
            <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center text-orange-700">
              <Laptop className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-orange-700">
            {metrics.pendingAssetClearance}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Hardware return pending</div>
        </div>

        {/* Exits Completed */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
              Exits Completed
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{metrics.exitsCompleted}</div>
          <div className="text-[11px] text-slate-400 mt-1">Relieved & Inactivated</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search employee, ID, or brand..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'PENDING_APPROVAL', label: 'Pending' },
            { id: 'NOTICE_PERIOD', label: 'Notice Period' },
            { id: 'NOTICE_COMPLETED', label: 'Notice Done' },
            { id: 'EXIT_COMPLETED', label: 'Completed' },
            { id: 'WITHDRAWN', label: 'Withdrawn' },
            { id: 'REJECTED', label: 'Rejected' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Simple Exit Requests Table */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <span className="text-xs font-semibold text-slate-500">Loading exit requests...</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">No exit requests found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              There are currently no resignation or exit records matching your search or status filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Brand / Org</th>
                  <th className="py-3 px-4">Resignation Date</th>
                  <th className="py-3 px-4">Last Working Day</th>
                  <th className="py-3 px-4">Exit Status</th>
                  <th className="py-3 px-4 text-center">Checklist & Assets</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRequests.map((exit) => {
                  const checklistCount = [
                    exit.handoverCompleted,
                    exit.tasksHandedOver,
                    exit.docsHandedOver,
                    exit.hrClearanceCompleted
                  ].filter(Boolean).length;

                  return (
                    <tr
                      key={exit.id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => handleOpenDetailModal(exit)}
                    >
                      {/* Employee Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center font-bold text-brand-700 text-xs">
                            {exit.employee?.firstName?.[0] || 'E'}
                            {exit.employee?.lastName?.[0] || ''}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block group-hover:text-brand-700 transition-colors">
                              {exit.employee?.firstName} {exit.employee?.lastName}
                            </span>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                              <span className="font-mono">{exit.employee?.employeeId}</span>
                              <span>•</span>
                              <span>{exit.employee?.designation?.title || 'Staff'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Brand */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800 block">
                          {exit.brand?.name}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {exit.employee?.branch?.name || 'Main Office'}
                        </span>
                      </td>

                      {/* Resignation Date */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                          <span>{exit.resignationDate}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Notice: {exit.noticePeriodDays} days
                        </span>
                      </td>

                      {/* Last Working Day & Remaining Days */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                          <span>{exit.lastWorkingDay}</span>
                        </div>
                        {exit.status === 'NOTICE_PERIOD' && (
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                            {exit.remainingNoticeDays} days remaining
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {renderStatusBadge(
                          (exit.effectiveStatus || exit.status) as ExitRequestStatus,
                          exit.remainingNoticeDays
                        )}
                      </td>

                      {/* Quick Checklist & Assets Indicator */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span
                            title="Exit Checklist completion"
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              checklistCount === 4
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            Tasks: {checklistCount}/4
                          </span>

                          <span
                            title="Asset return clearance"
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              exit.assetClearanceCompleted
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            Assets: {exit.assetClearanceCompleted ? 'Cleared' : 'Pending'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenDetailModal(exit)}
                            className="px-2.5 py-1 text-xs font-semibold text-brand-700 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 rounded-md transition-colors"
                          >
                            Manage Exit
                          </button>

                          {exit.relievingLetterIssued && (
                            <button
                              onClick={() => handleDownloadRelievingLetterPdf(exit.id)}
                              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                              title="Download Relieving Letter PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: SUBMIT RESIGNATION MODAL */}
      {/* ------------------------------------------------------------- */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Submit Resignation</h3>
                <p className="text-xs text-slate-500">Initiate official employee exit request</p>
              </div>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitResignation} className="p-6 space-y-4">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Exiting Employee <span className="text-rose-500">*</span>
                </label>
                {isEmployee ? (
                  <input
                    type="text"
                    disabled
                    value={`${user?.firstName} ${user?.lastName} (${user?.employeeId || 'Current User'})`}
                    className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-600 cursor-not-allowed"
                  />
                ) : (
                  <select
                    value={submitForm.employeeId}
                    onChange={(e) => setSubmitForm({ ...submitForm, employeeId: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  >
                    <option value="">Select Employee...</option>
                    {activeEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.employeeId}) - {emp.brand?.name || 'Company'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Resignation Date & Proposed LWD */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Resignation Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={submitForm.resignationDate}
                    onChange={(e) => {
                      const resDate = e.target.value;
                      setSubmitForm({
                        ...submitForm,
                        resignationDate: resDate,
                        proposedLastWorkingDay: calculateDefaultLwd(resDate)
                      });
                    }}
                    required
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Proposed Last Working Day <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={submitForm.proposedLastWorkingDay}
                    onChange={(e) =>
                      setSubmitForm({ ...submitForm, proposedLastWorkingDay: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-lg flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-[11px] text-blue-800 leading-relaxed">
                  <span className="font-semibold">Company Notice Policy:</span> Standard notice period is{' '}
                  <span className="font-semibold">30 calendar days</span>. Authorized HR users can confirm or adjust the official last working day during approval.
                </div>
              </div>

              {/* Resignation Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Resignation <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={submitForm.reason}
                  onChange={(e) => setSubmitForm({ ...submitForm, reason: e.target.value })}
                  placeholder="e.g. Better opportunity, relocation, higher studies, personal reasons..."
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              {/* Optional Remarks */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Additional Remarks / Handover Notes (Optional)
                </label>
                <input
                  type="text"
                  value={submitForm.employeeRemarks}
                  onChange={(e) =>
                    setSubmitForm({ ...submitForm, employeeRemarks: e.target.value })
                  }
                  placeholder="Any brief comments regarding handover or transition"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                >
                  {actionLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Submit Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: COMPLETE EXIT WORKFLOW MODAL (OVERVIEW, CHECKLIST, ASSETS, LETTER) */}
      {/* ------------------------------------------------------------- */}
      {selectedExit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  {selectedExit.employee?.firstName?.[0]}
                  {selectedExit.employee?.lastName?.[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      {selectedExit.employee?.firstName} {selectedExit.employee?.lastName}
                    </h3>
                    <span className="text-xs font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {selectedExit.employee?.employeeId}
                    </span>
                    {renderStatusBadge(
                      (selectedExit.effectiveStatus || selectedExit.status) as ExitRequestStatus,
                      selectedExit.remainingNoticeDays
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedExit.brand?.name} • {selectedExit.employee?.department?.name || 'Department'} •{' '}
                    {selectedExit.employee?.designation?.title || 'Designation'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedExit(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Workflow Progress Steps Bar */}
            <div className="px-6 py-2.5 bg-slate-100/70 border-b border-slate-200/80 flex items-center justify-between overflow-x-auto text-[11px] font-medium">
              {[
                { title: '1. Resignation', done: true, current: selectedExit.status === 'PENDING_APPROVAL' },
                {
                  title: '2. HR Approval',
                  done: selectedExit.status !== 'PENDING_APPROVAL' && selectedExit.status !== 'REJECTED',
                  current: selectedExit.status === 'PENDING_APPROVAL'
                },
                {
                  title: '3. Notice Period',
                  done: selectedExit.status === 'NOTICE_COMPLETED' || selectedExit.status === 'EXIT_COMPLETED',
                  current: selectedExit.status === 'NOTICE_PERIOD'
                },
                {
                  title: '4. Checklist & Clearance',
                  done:
                    selectedExit.handoverCompleted &&
                    selectedExit.tasksHandedOver &&
                    selectedExit.docsHandedOver &&
                    selectedExit.hrClearanceCompleted &&
                    selectedExit.assetClearanceCompleted,
                  current: selectedExit.status === 'NOTICE_PERIOD' || selectedExit.status === 'NOTICE_COMPLETED'
                },
                {
                  title: '5. Relieving Letter',
                  done: selectedExit.relievingLetterIssued,
                  current: selectedExit.status === 'NOTICE_COMPLETED' && !selectedExit.relievingLetterIssued
                },
                {
                  title: '6. Exit Completed',
                  done: selectedExit.status === 'EXIT_COMPLETED',
                  current: selectedExit.status === 'EXIT_COMPLETED'
                }
              ].map((step, idx) => (
                <div key={idx} className="flex items-center gap-1.5 whitespace-nowrap px-2">
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      step.done
                        ? 'bg-emerald-600 text-white'
                        : step.current
                        ? 'bg-blue-600 text-white ring-2 ring-blue-200'
                        : 'bg-slate-300 text-slate-600'
                    }`}
                  >
                    {step.done ? '✓' : idx + 1}
                  </div>
                  <span
                    className={
                      step.done
                        ? 'text-emerald-800 font-semibold'
                        : step.current
                        ? 'text-blue-700 font-bold'
                        : 'text-slate-400'
                    }
                  >
                    {step.title}
                  </span>
                  {idx < 5 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 ml-1" />}
                </div>
              ))}
            </div>

            {/* Modal Tabs Navigation */}
            <div className="px-6 border-b border-slate-200 flex items-center gap-6">
              {[
                { id: 'overview', label: 'Resignation & Notice', icon: Calendar },
                { id: 'checklist', label: 'Exit Checklist (4 items)', icon: FileCheck },
                { id: 'assets', label: 'Asset Return Clearance', icon: Laptop },
                { id: 'letter', label: 'Relieving Letter', icon: FileText }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id as any)}
                    className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-brand-600 text-brand-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Body: Active Tab Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* ----------------- TAB 1: OVERVIEW & NOTICE ----------------- */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Resignation Details Box */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4.5 space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Resignation Particulars
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Resignation Date</span>
                        <span className="font-semibold text-slate-800 mt-0.5 block">
                          {selectedExit.resignationDate}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Notice Duration</span>
                        <span className="font-semibold text-slate-800 mt-0.5 block">
                          {selectedExit.noticePeriodDays} Days
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Proposed LWD</span>
                        <span className="font-semibold text-slate-800 mt-0.5 block">
                          {selectedExit.proposedLastWorkingDay}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Confirmed LWD</span>
                        <span className="font-semibold text-brand-700 mt-0.5 block">
                          {selectedExit.lastWorkingDay}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60">
                      <span className="text-slate-400 text-[11px] block">Reason for Resignation:</span>
                      <p className="text-xs text-slate-800 font-medium mt-1 bg-white p-2.5 rounded-lg border border-slate-200/70">
                        {selectedExit.reason}
                      </p>
                    </div>

                    {selectedExit.employeeRemarks && (
                      <div className="text-[11px] text-slate-600">
                        <span className="font-semibold">Employee Remarks:</span> {selectedExit.employeeRemarks}
                      </div>
                    )}

                    {selectedExit.hrRemarks && (
                      <div className="text-[11px] text-brand-900 bg-brand-50 p-2.5 rounded-lg border border-brand-200">
                        <span className="font-semibold">HR Remarks:</span> {selectedExit.hrRemarks}
                      </div>
                    )}
                  </div>

                  {/* Notice Period Tracking Box */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4.5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-brand-600" />
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Notice Period Tracking
                        </h4>
                      </div>

                      {isHrOrAdmin &&
                        !['REJECTED', 'WITHDRAWN', 'EXIT_COMPLETED'].includes(selectedExit.status) && (
                          <button
                            onClick={() => {
                              setUpdatedLwd(selectedExit.lastWorkingDay);
                              setIsLwdModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-brand-700 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 rounded-md transition-colors"
                          >
                            Update Last Working Day
                          </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-[11px] text-slate-400 block">Notice Start Date</span>
                        <span className="text-sm font-bold text-slate-800 mt-1 block">
                          {selectedExit.resignationDate}
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-[11px] text-slate-400 block">Confirmed Last Working Day</span>
                        <span className="text-sm font-bold text-brand-700 mt-1 block">
                          {selectedExit.lastWorkingDay}
                        </span>
                      </div>

                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <span className="text-[11px] text-blue-600 font-semibold block">Remaining Days</span>
                        <span className="text-sm font-bold text-blue-900 mt-1 block">
                          {selectedExit.remainingNoticeDays !== undefined
                            ? `${selectedExit.remainingNoticeDays} Days Remaining`
                            : '0 Days'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pending Decision / Approval Actions */}
                  {selectedExit.status === 'PENDING_APPROVAL' && isHrOrAdmin && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                        <div>
                          <h4 className="text-xs font-bold text-amber-900">
                            Awaiting HR Approval
                          </h4>
                          <p className="text-[11px] text-amber-700 mt-0.5">
                            Review the resignation reason and notice duration before approving or rejecting.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setActionRemarks('');
                            setIsRejectModalOpen(true);
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-white border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => {
                            setActionRemarks('');
                            setUpdatedLwd(selectedExit.lastWorkingDay);
                            setIsApproveModalOpen(true);
                          }}
                          className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
                        >
                          Approve Resignation
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Resignation Withdrawal */}
                  {!['REJECTED', 'WITHDRAWN', 'EXIT_COMPLETED'].includes(selectedExit.status) && (
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => {
                          setActionRemarks('');
                          setIsWithdrawModalOpen(true);
                        }}
                        className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Withdraw Resignation Request</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ----------------- TAB 2: EXIT CHECKLIST (4 ITEMS) ----------------- */}
              {activeTab === 'checklist' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Exit Handover & Department Clearance Checklist
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        All 4 clearance items must be signed off before final exit completion.
                      </p>
                    </div>

                    {isHrOrAdmin && (
                      <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-md border border-brand-200">
                        Interactive Toggle Enabled
                      </span>
                    )}
                  </div>

                  {/* 4 Standard Checklist Items */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {[
                      {
                        key: 'handoverCompleted' as const,
                        label: 'Work Handover Completed',
                        desc: 'Current project duties and operational responsibilities successfully transitioned to team.'
                      },
                      {
                        key: 'tasksHandedOver' as const,
                        label: 'Pending Tasks Handed Over',
                        desc: 'Outstanding tickets, code repositories, access tokens, and task schedules reassigned.'
                      },
                      {
                        key: 'docsHandedOver' as const,
                        label: 'Company Documents Handed Over',
                        desc: 'ID badge, company records, physical keys, confidentiality agreements, and files surrendered.'
                      },
                      {
                        key: 'hrClearanceCompleted' as const,
                        label: 'HR Clearance Completed',
                        desc: 'Exit formalities, policy briefings, final attendance review, and records verified by HR.'
                      }
                    ].map((item) => {
                      const isChecked = selectedExit[item.key];
                      return (
                        <div
                          key={item.key}
                          onClick={() => isHrOrAdmin && handleToggleChecklistItem(item.key)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-emerald-50/70 border-emerald-200'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                isChecked
                                  ? 'bg-emerald-600 text-white'
                                  : 'border-2 border-slate-300 bg-white'
                              }`}
                            >
                              {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <div>
                              <span
                                className={`text-xs font-bold block ${
                                  isChecked ? 'text-emerald-950' : 'text-slate-900'
                                }`}
                              >
                                {item.label}
                              </span>
                              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                {item.desc}
                              </p>
                              <div className="mt-2 text-[10px] font-semibold">
                                {isChecked ? (
                                  <span className="text-emerald-700">Completed & Verified</span>
                                ) : (
                                  <span className="text-amber-600">Pending Handover</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Checklist Completion Status Banner */}
                  {selectedExit.handoverCompleted &&
                  selectedExit.tasksHandedOver &&
                  selectedExit.docsHandedOver &&
                  selectedExit.hrClearanceCompleted ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>All 4 exit checklist clearances have been marked complete.</span>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5 text-xs text-slate-600">
                      <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>
                        Pending checklist items remaining. Click on any card above to toggle completion.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ----------------- TAB 3: ASSET RETURN CLEARANCE ----------------- */}
              {activeTab === 'assets' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Company Hardware & Device Return Clearance
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Directly integrated with Assets Management. Clear all assigned hardware items.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadExitAssets(selectedExit.id)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                        title="Refresh Assets"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>

                      {/* Manual Clearance Toggle (e.g. employee has no physical assets) */}
                      {isHrOrAdmin && (
                        <button
                          onClick={() =>
                            handleToggleManualAssetClearance(!selectedExit.assetClearanceCompleted)
                          }
                          className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                            selectedExit.assetClearanceCompleted
                              ? 'bg-slate-100 text-slate-700 border-slate-300'
                              : 'bg-emerald-600 text-white border-transparent hover:bg-emerald-700'
                          }`}
                        >
                          {selectedExit.assetClearanceCompleted
                            ? 'Mark Clearance Incomplete'
                            : 'Sign Off Asset Clearance'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Assets List */}
                  {assetsData?.assignedAssets && assetsData.assignedAssets.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            <th className="py-2.5 px-4">Asset Name</th>
                            <th className="py-2.5 px-4">Asset Tag</th>
                            <th className="py-2.5 px-4">Type</th>
                            <th className="py-2.5 px-4">Serial Number</th>
                            <th className="py-2.5 px-4">Status</th>
                            <th className="py-2.5 px-4 text-right">Clearance Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {assetsData.assignedAssets.map((asset) => (
                            <tr key={asset.id} className="hover:bg-slate-50/60">
                              <td className="py-3 px-4 font-semibold text-slate-900">
                                <div className="flex items-center gap-2">
                                  <Laptop className="w-4 h-4 text-brand-600" />
                                  <span>{asset.name}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-600">{asset.assetTag}</td>
                              <td className="py-3 px-4 text-slate-600">{asset.type}</td>
                              <td className="py-3 px-4 font-mono text-slate-500">
                                {asset.serialNumber || 'N/A'}
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  Assigned
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                {(isHrOrAdmin || isManager) && (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      disabled={actionLoading}
                                      onClick={() => handleClearAsset(asset.id, 'RETURNED')}
                                      className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
                                    >
                                      Mark Returned
                                    </button>
                                    <button
                                      disabled={actionLoading}
                                      onClick={() => handleClearAsset(asset.id, 'DAMAGED')}
                                      className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors"
                                    >
                                      Damaged
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl">
                      <Laptop className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <h4 className="text-xs font-bold text-slate-700">No active assets assigned</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm mx-auto">
                        This employee has no active company devices or hardware records checked out in the system.
                      </p>
                      {isHrOrAdmin && !selectedExit.assetClearanceCompleted && (
                        <button
                          onClick={() => handleToggleManualAssetClearance(true)}
                          className="mt-3 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                        >
                          Confirm Zero Assets & Mark Cleared
                        </button>
                      )}
                    </div>
                  )}

                  {/* Asset Return History for Transparency */}
                  {assetsData?.assetHistory && assetsData.assetHistory.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                        Recent Return History
                      </span>
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                              <th className="py-2 px-3">Asset</th>
                              <th className="py-2 px-3">Returned Date</th>
                              <th className="py-2 px-3">Condition</th>
                              <th className="py-2 px-3">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {assetsData.assetHistory.map((hist, idx) => (
                              <tr key={idx}>
                                <td className="py-2 px-3 font-medium text-slate-800">
                                  {hist.asset?.name || 'Device'} ({hist.asset?.assetTag})
                                </td>
                                <td className="py-2 px-3 text-slate-600">{hist.returnedDate}</td>
                                <td className="py-2 px-3">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                      hist.conditionOnReturn === 'DAMAGED'
                                        ? 'bg-rose-50 text-rose-700'
                                        : 'bg-emerald-50 text-emerald-700'
                                    }`}
                                  >
                                    {hist.conditionOnReturn}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-500">{hist.returnNotes}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ----------------- TAB 4: RELIEVING LETTER ----------------- */}
              {activeTab === 'letter' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Relieving & Experience Certification Letter
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Preview template, issue official document, and download PDF format.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isHrOrAdmin && !selectedExit.relievingLetterIssued && (
                        <button
                          disabled={actionLoading}
                          onClick={handleIssueRelievingLetter}
                          className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
                        >
                          {actionLoading ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span>Issue Official Letter</span>
                        </button>
                      )}

                      {(selectedExit.relievingLetterIssued || letterPreview) && (
                        <button
                          onClick={() => handleDownloadRelievingLetterPdf(selectedExit.id)}
                          className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5 text-brand-600" />
                          <span>Download PDF</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Issuance Status Banner */}
                  {selectedExit.relievingLetterIssued ? (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <span className="font-bold">Official Relieving Letter Issued</span>
                          <p className="text-[11px] text-emerald-700 mt-0.5">
                            Saved to employee documents records. You can download or re-issue anytime.
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono font-semibold bg-white px-2.5 py-1 rounded border border-emerald-200">
                        {letterPreview?.referenceNumber || `REL/${selectedExit.employee?.employeeId}`}
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-900">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Letter has not been issued yet. Review the live template preview below, then click &apos;Issue Official Letter&apos;.
                      </span>
                    </div>
                  )}

                  {/* Template Live Preview Card */}
                  <div className="p-8 bg-white border border-slate-300 rounded-xl shadow-md text-slate-800 space-y-6 max-w-2xl mx-auto font-serif">
                    {/* Header */}
                    <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 tracking-tight font-sans">
                          {letterPreview?.brandName.toUpperCase() || 'COMPANY NAME'}
                        </h2>
                        <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                          {letterPreview?.companyName}
                        </p>
                        <p className="text-[10px] text-slate-400 font-sans">
                          {letterPreview?.brandAddress || 'Corporate Headquarters'}
                        </p>
                      </div>
                      <div className="text-right text-[11px] font-sans text-slate-600">
                        <span className="font-mono block">{letterPreview?.referenceNumber}</span>
                        <span className="block mt-1">Date: {letterPreview?.issueDate}</span>
                      </div>
                    </div>

                    {/* Title */}
                    <div className="text-center pt-2">
                      <h3 className="text-sm font-bold tracking-wide text-slate-900 uppercase underline underline-offset-4 font-sans">
                        Relieving & Service Certificate
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-700 mt-2 font-sans">
                        TO WHOMSOEVER IT MAY CONCERN
                      </p>
                    </div>

                    {/* Particulars Table */}
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded text-xs font-sans grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-500 font-medium">Employee Name:</span>{' '}
                        <span className="font-bold text-slate-900">{letterPreview?.employeeName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Employee ID:</span>{' '}
                        <span className="font-mono font-bold text-slate-900">
                          {letterPreview?.employeeId}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Designation:</span>{' '}
                        <span className="font-bold text-slate-900">{letterPreview?.designation}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Department:</span>{' '}
                        <span className="font-bold text-slate-900">{letterPreview?.department}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Joining Date:</span>{' '}
                        <span className="font-bold text-slate-900">{letterPreview?.joiningDate}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Relieving Date:</span>{' '}
                        <span className="font-bold text-brand-700">
                          {letterPreview?.lastWorkingDay}
                        </span>
                      </div>
                    </div>

                    {/* Body Text */}
                    <div className="text-xs leading-relaxed text-justify space-y-3 font-sans">
                      <p>
                        This is to certify that <span className="font-bold">{letterPreview?.employeeName}</span> was employed with{' '}
                        <span className="font-bold">{letterPreview?.brandName}</span> as {letterPreview?.designation} at our {letterPreview?.branch} office from {letterPreview?.joiningDate} to {letterPreview?.lastWorkingDay}.
                      </p>
                      <p>
                        During their tenure with us, they demonstrated diligence, professionalism, and commitment in discharging their duties. Their conduct and character were found to be satisfactory throughout.
                      </p>
                      <p>
                        All company assets, documents, access credentials, and departmental handovers have been duly returned, inspected, and cleared. There are no outstanding liabilities against them.
                      </p>
                      <p>
                        We appreciate their contributions and wish them success in their future endeavors.
                      </p>
                    </div>

                    {/* Signoff */}
                    <div className="pt-6 font-sans text-xs">
                      <span className="font-bold block text-slate-900">For {letterPreview?.brandName}</span>
                      <div className="mt-8 border-t border-slate-300 w-44 pt-1">
                        <span className="font-bold block text-slate-900">Authorized Signatory</span>
                        <span className="text-[11px] text-slate-500">Human Resources Department</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer: Final Exit Review & Complete Action */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-700">Exit Status:</span>
                {renderStatusBadge(
                  (selectedExit.effectiveStatus || selectedExit.status) as ExitRequestStatus,
                  selectedExit.remainingNoticeDays
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedExit(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>

                {isHrOrAdmin && selectedExit.status !== 'EXIT_COMPLETED' && (
                  <button
                    disabled={
                      actionLoading ||
                      !selectedExit.handoverCompleted ||
                      !selectedExit.tasksHandedOver ||
                      !selectedExit.docsHandedOver ||
                      !selectedExit.hrClearanceCompleted ||
                      !selectedExit.assetClearanceCompleted
                    }
                    onClick={handleCompleteExit}
                    className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg shadow-sm flex items-center gap-2 transition-colors"
                    title={
                      !selectedExit.handoverCompleted || !selectedExit.assetClearanceCompleted
                        ? 'Ensure all checklist items and asset clearances are done first'
                        : 'Finalize exit and set employee status to Inactive'
                    }
                  >
                    {actionLoading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    <span>Complete Employee Exit</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: APPROVE RESIGNATION DIALOG */}
      {/* ------------------------------------------------------------- */}
      {isApproveModalOpen && selectedExit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Approve Resignation</h3>
            <p className="text-xs text-slate-500">
              Approve resignation for {selectedExit.employee?.firstName} {selectedExit.employee?.lastName}.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirmed Last Working Day
              </label>
              <input
                type="date"
                value={updatedLwd}
                onChange={(e) => setUpdatedLwd(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                HR Remarks / Approval Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={actionRemarks}
                onChange={(e) => setActionRemarks(e.target.value)}
                placeholder="e.g. Resignation approved. Please serve notice until confirmed date."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsApproveModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleApproveResignation}
                className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: REJECT RESIGNATION DIALOG */}
      {/* ------------------------------------------------------------- */}
      {isRejectModalOpen && selectedExit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Reject Resignation</h3>
            <p className="text-xs text-slate-500">
              Provide formal reason for rejecting resignation for {selectedExit.employee?.firstName} {selectedExit.employee?.lastName}.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rejection Remarks <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={actionRemarks}
                onChange={(e) => setActionRemarks(e.target.value)}
                placeholder="State the justification or agreed retention conditions..."
                required
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleRejectResignation}
                className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 5: UPDATE LAST WORKING DAY DIALOG */}
      {/* ------------------------------------------------------------- */}
      {isLwdModalOpen && selectedExit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Update Last Working Day</h3>
            <p className="text-xs text-slate-500">
              Adjust the official relieving date and recalculate remaining notice days.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Last Working Day <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={updatedLwd}
                onChange={(e) => setUpdatedLwd(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason / Remarks for Date Adjustment
              </label>
              <input
                type="text"
                value={actionRemarks}
                onChange={(e) => setActionRemarks(e.target.value)}
                placeholder="e.g. Early release approved by manager"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsLwdModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleUpdateLwd}
                className="px-5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm"
              >
                Save Date
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 6: WITHDRAW RESIGNATION DIALOG */}
      {/* ------------------------------------------------------------- */}
      {isWithdrawModalOpen && selectedExit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Withdraw Resignation</h3>
            <p className="text-xs text-slate-500">
              Confirm cancellation of exit request. Records will be updated to Withdrawn status.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Withdrawal Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={actionRemarks}
                onChange={(e) => setActionRemarks(e.target.value)}
                placeholder="e.g. Retained with mutual agreement; personal circumstances resolved."
                required
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsWithdrawModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleWithdrawResignation}
                className="px-5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-sm"
              >
                Confirm Withdrawal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExitPage;
