import React, { useState, useEffect } from 'react';
import {
  Banknote,
  Calculator,
  Calendar,
  Search,
  RefreshCw,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
  Mail,
  Download,
  FileText,
  ExternalLink,
  Send
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';
import { useCompany } from '../context/CompanyContext';
import { api } from '../services/api';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';

interface SalaryOverviewItem {
  id: string;
  employeeId: string;
  employee: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    monthlySalary?: number;
    department?: { name: string };
    designation?: { title: string };
    branch?: { name: string };
    brand?: { name: string };
  };
  period: string;
  fixedSalary: number;
  payableFixedSalary: number;
  otHours: number;
  otRate: number;
  otAmount: number;
  incompleteHours: number;
  incompleteDeductionRate: number;
  incompleteDeductionAmount: number;
  incentiveAmount: number;
  incentiveReason?: string;
  finalSalary: number;
  status: string;
  hasMissingPunchFlags: boolean;
  missingPunchDates?: string[];
  receiptId?: string | null;
  receiptNumber?: string | null;
  isSaved: boolean;
  calculationBreakdown?: {
    formula: string;
    hourlyBaseRate: number;
    dailyLogs: Array<{
      date: string;
      status: string;
      checkIn: string | null;
      checkOut: string | null;
      workingHours: number;
      expectedHours: number;
      otHours: number;
      incompleteHours: number;
      isLeaveOrHoliday: boolean;
      hasMissingPunch: boolean;
    }>;
  };
  savedAt?: string | null;
}

export const SalaryPage: React.FC = () => {
  const { user } = useAuth();
  const { selectedBrandId } = useBrand();
  const { activeCompanyId } = useCompany();

  const canManageSalary = user?.role === 'ADMIN' || user?.role === 'HR';

  // Month selection: YYYY-MM (default to current month e.g. 2026-10)
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7);
  });

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Data
  const [overviewData, setOverviewData] = useState<{
    period: string;
    totalEmployees: number;
    savedEmployeesCount: number;
    summaryFixedSalary: number;
    summaryOtAmount: number;
    summaryIncompleteDeductions: number;
    summaryIncentives: number;
    summaryFinalPayable: number;
    missingPunchWarningsCount: number;
    items: SalaryOverviewItem[];
  } | null>(null);

  // Modals
  const [isIncentiveModalOpen, setIsIncentiveModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SalaryOverviewItem | null>(null);

  // Incentive Form
  const [incentiveForm, setIncentiveForm] = useState({
    amount: '',
    reason: ''
  });

  // Receipt Preview & Mail Modal
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [previewReceiptItem, setPreviewReceiptItem] = useState<SalaryOverviewItem | null>(null);
  const [receiptDetails, setReceiptDetails] = useState<any | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [sendingReceiptEmail, setSendingReceiptEmail] = useState(false);
  const [emailSuccessInfo, setEmailSuccessInfo] = useState<{ message: string; previewUrl?: string } | null>(null);

  const loadSalaryData = async () => {
    try {
      setLoading(true);
      const res = await api.getSalaryOverview({
        brandId: selectedBrandId !== 'all' ? selectedBrandId : undefined,
        period: selectedPeriod,
        search
      });
      setOverviewData(res);
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Failed to load salary data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSalaryData();
    const handleRefresh = () => {
      loadSalaryData();
    };
    window.addEventListener('hrms:company-changed', handleRefresh);
    window.addEventListener('hrms:brand-changed', handleRefresh);
    return () => {
      window.removeEventListener('hrms:company-changed', handleRefresh);
      window.removeEventListener('hrms:brand-changed', handleRefresh);
    };
  }, [activeCompanyId, selectedBrandId, selectedPeriod, search]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [year, month] = selectedPeriod.split('-').map(Number);
    const date = new Date(year, month - 2, 1);
    setSelectedPeriod(date.toISOString().slice(0, 7));
  };

  const handleNextMonth = () => {
    const [year, month] = selectedPeriod.split('-').map(Number);
    const date = new Date(year, month, 1);
    setSelectedPeriod(date.toISOString().slice(0, 7));
  };

  // Calculate & save single employee, make receipt and email staff
  const handleCalculateSingle = async (item: SalaryOverviewItem) => {
    try {
      setActionLoading(true);
      const res: any = await api.calculateSingleSalary({
        employeeId: item.employeeId,
        period: selectedPeriod
      });
      setMessage({
        type: 'success',
        text: res.message || `Salary calculated, receipt generated & emailed to ${item.employee.email} for ${selectedPeriod}`
      });
      await loadSalaryData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Calculation failed' });
    } finally {
      setActionLoading(false);
    }
  };

  // Calculate all active employees for current month, make receipts and email staff
  const handleCalculateAll = async () => {
    try {
      setActionLoading(true);
      const effectiveBrand = selectedBrandId !== 'all' ? selectedBrandId : overviewData?.items[0]?.employee?.brand ? (overviewData?.items[0] as any).brandId || selectedBrandId : selectedBrandId;
      const res = await api.processMonthlySalary({
        brandId: effectiveBrand && effectiveBrand !== 'all' ? effectiveBrand : (overviewData?.items[0]?.employee as any)?.brandId || user?.brandId || '',
        period: selectedPeriod,
        reprocess: true
      });
      setMessage({
        type: 'success',
        text: `Calculated salaries, generated receipts and emailed ${res.processedCount} staff members for ${selectedPeriod}!`
      });
      await loadSalaryData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Bulk calculation failed' });
    } finally {
      setActionLoading(false);
    }
  };

  // Manually send / re-send salary receipt email to employee
  const handleSendReceiptMail = async (item: SalaryOverviewItem) => {
    try {
      setActionLoading(true);
      const res: any = await api.sendSalaryReceiptMail({
        employeeId: item.employeeId,
        period: selectedPeriod
      });
      setMessage({
        type: 'success',
        text: res.message || `Salary receipt emailed to ${item.employee.email}!`
      });
      await loadSalaryData();
    } catch (err: any) {
      alert(err.message || 'Failed to email salary receipt');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Receipt Preview Modal before sending email
  const handleOpenReceiptPreview = async (item: SalaryOverviewItem) => {
    setPreviewReceiptItem(item);
    setEmailSuccessInfo(null);
    setIsReceiptModalOpen(true);
    setReceiptLoading(true);
    setReceiptDetails(null);

    try {
      const res = await api.prepareSalaryReceipt({
        employeeId: item.employeeId,
        period: selectedPeriod
      });
      setReceiptDetails(res);
    } catch (err: any) {
      console.error('Failed to prepare receipt:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to prepare receipt preview' });
    } finally {
      setReceiptLoading(false);
    }
  };

  // Send Email from inside the Receipt Preview Modal
  const handleSendEmailFromPreview = async () => {
    if (!previewReceiptItem) return;
    try {
      setSendingReceiptEmail(true);
      const res: any = await api.sendSalaryReceiptMail({
        employeeId: previewReceiptItem.employeeId,
        period: selectedPeriod
      });
      setEmailSuccessInfo({
        message: res.message || `Salary receipt successfully emailed to ${previewReceiptItem.employee.email}`,
        previewUrl: res.data?.emailPreviewUrl || res.emailPreviewUrl
      });
      setMessage({
        type: 'success',
        text: res.message || `Salary receipt emailed to ${previewReceiptItem.employee.email}`
      });
      await loadSalaryData();
    } catch (err: any) {
      alert(err.message || 'Failed to send receipt email');
    } finally {
      setSendingReceiptEmail(false);
    }
  };

  // Open Add / Edit Incentive Modal
  const handleOpenIncentiveModal = (item: SalaryOverviewItem) => {
    setSelectedItem(item);
    setIncentiveForm({
      amount: item.incentiveAmount > 0 ? item.incentiveAmount.toString() : '',
      reason: item.incentiveReason || ''
    });
    setIsIncentiveModalOpen(true);
  };

  // Submit / Update Incentive
  const handleSaveIncentive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    try {
      setActionLoading(true);
      const amountVal = Math.max(0, parseFloat(incentiveForm.amount) || 0);
      const isEditing = Boolean(selectedItem.incentiveAmount > 0);
      await api.createIncentive({
        employeeId: selectedItem.employeeId,
        payrollMonth: selectedPeriod,
        title: incentiveForm.reason.trim() || 'Performance Incentive',
        amount: amountVal,
        reason: incentiveForm.reason.trim() || undefined
      });
      setIsIncentiveModalOpen(false);
      setMessage({
        type: 'success',
        text: amountVal === 0
          ? `Removed incentive for ${selectedItem.employee.firstName}`
          : `${isEditing ? 'Updated' : 'Added'} incentive of ₹${amountVal.toLocaleString('en-IN')} for ${selectedItem.employee.firstName}`
      });
      await loadSalaryData();
      if (isDetailsModalOpen) {
        // Refresh details modal view
        const refreshed = overviewData?.items.find((i) => i.employeeId === selectedItem.employeeId);
        if (refreshed) setSelectedItem(refreshed);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save incentive');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Details Modal
  const handleOpenDetails = (item: SalaryOverviewItem) => {
    setSelectedItem(item);
    setIsDetailsModalOpen(true);
  };

  const filteredItems = (overviewData?.items || []).filter((item) => {
    if (statusFilter === 'SAVED' && !item.isSaved) return false;
    if (statusFilter === 'PREVIEW' && item.isSaved) return false;
    if (statusFilter === 'WARNING' && !item.hasMissingPunchFlags) return false;
    return true;
  });

  const formatPeriodDisplay = (periodStr: string) => {
    const [year, month] = periodStr.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Month Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-600" />
            Salary Module
          </h1>
        </div>

        {/* Month Selector & Main Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month Controller */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 text-slate-600 hover:bg-slate-100 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 py-1 text-xs font-semibold text-slate-800 flex items-center gap-1.5 min-w-[130px] justify-center">
              <Calendar className="w-3.5 h-3.5 text-brand-600" />
              {formatPeriodDisplay(selectedPeriod)}
            </div>
            <button
              onClick={handleNextMonth}
              className="p-1.5 text-slate-600 hover:bg-slate-100 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={loadSalaryData}
            disabled={loading}
            className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors shadow-2xs"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {canManageSalary && (
            <button
              onClick={handleCalculateAll}
              disabled={actionLoading || loading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Calculate All for Month</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div
          className={`flex items-center justify-between p-3 rounded-lg text-xs font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 ml-2 font-bold">
            ×
          </button>
        </div>
      )}

      {/* Summary KPI Strip */}
      {overviewData && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500 block">Total Employees</span>
            <div className="text-lg font-bold text-slate-900 mt-0.5">
              {overviewData.totalEmployees}
            </div>
            <span className="text-[10px] text-slate-400">
              {overviewData.savedEmployeesCount} saved records
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500 block">Fixed Salary Base</span>
            <div className="text-lg font-bold text-slate-900 mt-0.5">
              ₹{overviewData.summaryFixedSalary.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-slate-400">From Employee Profiles</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-emerald-700 block">Overtime Pay</span>
            <div className="text-lg font-bold text-emerald-700 mt-0.5">
              + ₹{overviewData.summaryOtAmount.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-emerald-600/80">From Punch Records</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-rose-700 block">Incomplete Deductions</span>
            <div className="text-lg font-bold text-rose-700 mt-0.5">
              - ₹{overviewData.summaryIncompleteDeductions.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-rose-600/80">Short Working Hours</span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-blue-700 block">Incentives Added</span>
            <div className="text-lg font-bold text-blue-700 mt-0.5">
              + ₹{overviewData.summaryIncentives.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-blue-600/80">Optional Bonuses</span>
          </div>

          <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200/80 shadow-2xs">
            <span className="text-[11px] font-semibold text-emerald-800 block">Final Net Payout</span>
            <div className="text-lg font-extrabold text-emerald-900 mt-0.5">
              ₹{overviewData.summaryFinalPayable.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-emerald-700">Total Payable for Month</span>
          </div>
        </div>
      )}

      {/* Warning banner if any employees have unclosed punches */}
      {overviewData && overviewData.missingPunchWarningsCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            <strong>{overviewData.missingPunchWarningsCount} employee(s)</strong> have unclosed punches (check-in recorded without check-out).
            Incomplete hour deductions for these days have been withheld for HR review to protect employee accuracy.
          </span>
        </div>
      )}

      {/* Main Table Card */}
      <Card>
        {/* Table Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-slate-100">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by employee name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All Statuses</option>
              <option value="SAVED">Saved Records</option>
              <option value="PREVIEW">Preview / Unsaved</option>
              <option value="WARNING">Flagged for Review</option>
            </select>
          </div>
        </div>

        {/* Clean Employee Salary Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-3 py-3">Fixed Salary</th>
                <th className="px-3 py-3">Overtime</th>
                <th className="px-3 py-3">Incomplete Hours</th>
                <th className="px-3 py-3">Incentive</th>
                <th className="px-4 py-3 text-right">Final Payable Salary</th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading && !overviewData ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-300" />
                    Calculating employee salary data...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    No employee records found for this period.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.employeeId} className="hover:bg-slate-50/60 transition-colors">
                    {/* Employee info */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {item.employee.firstName} {item.employee.lastName}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                          {item.employee.employeeId}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {item.employee.department?.name || 'Department'}
                        </span>
                      </div>
                    </td>

                    {/* Fixed Salary */}
                    <td className="px-3 py-3 font-medium text-slate-900">
                      ₹{item.fixedSalary.toLocaleString('en-IN')}
                    </td>

                    {/* Overtime */}
                    <td className="px-3 py-3">
                      {item.otHours > 0 ? (
                        <div>
                          <span className="font-semibold text-emerald-700">
                            + ₹{item.otAmount.toLocaleString('en-IN')}
                          </span>
                          <span className="block text-[10px] text-slate-500">
                            {item.otHours} hrs @ ₹{item.otRate}/h
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Incomplete Hours */}
                    <td className="px-3 py-3">
                      {item.incompleteHours > 0 ? (
                        <div>
                          <span className="font-semibold text-rose-700">
                            - ₹{item.incompleteDeductionAmount.toLocaleString('en-IN')}
                          </span>
                          <span className="block text-[10px] text-slate-500">
                            {item.incompleteHours} hrs @ ₹{item.incompleteDeductionRate}/h
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Incentives */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={item.incentiveAmount > 0 ? 'font-semibold text-blue-700' : 'text-slate-400'}>
                          {item.incentiveAmount > 0 ? `₹${item.incentiveAmount.toLocaleString('en-IN')}` : '₹0'}
                        </span>
                        {canManageSalary && (
                          <button
                            type="button"
                            onClick={() => handleOpenIncentiveModal(item)}
                            className="text-[10px] text-brand-600 hover:text-brand-800 underline font-medium ml-1"
                            title={item.incentiveAmount > 0 ? 'Edit Incentive' : 'Add Incentive'}
                          >
                            {item.incentiveAmount > 0 ? 'Edit' : '+ Add'}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Final Salary */}
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-sm text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        ₹{item.finalSalary.toLocaleString('en-IN')}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3 text-center">
                      {item.hasMissingPunchFlags ? (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full cursor-help"
                          title="Missing check-out punch flagged for review"
                        >
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Review
                        </span>
                      ) : item.isSaved ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Saved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3 text-slate-400" />
                          Preview
                        </span>
                      )}
                    </td>

                    {/* Action buttons */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canManageSalary && (
                          <button
                            type="button"
                            onClick={() => handleCalculateSingle(item)}
                            disabled={actionLoading}
                            className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded shadow-2xs transition-colors"
                            title="Calculate, save and prepare receipt"
                          >
                            {item.isSaved ? 'Recalculate' : 'Save'}
                          </button>
                        )}

                        {/* View / Preview Receipt before emailing */}
                        <button
                          type="button"
                          onClick={() => handleOpenReceiptPreview(item)}
                          className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          title="View / Preview Salary Receipt before emailing"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>

                        {canManageSalary && item.isSaved && (
                          <button
                            type="button"
                            onClick={() => handleOpenReceiptPreview(item)}
                            disabled={actionLoading}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title={`Preview receipt and email to ${item.employee.email}`}
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {item.receiptId && (
                          <button
                            type="button"
                            onClick={() => api.downloadReceiptPdf(item.receiptId!, item.receiptNumber || undefined)}
                            className="p-1 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            title="Download Salary Receipt PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenDetails(item)}
                          className="p-1 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded transition-colors"
                          title="View Calculation Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL 1: Add / Edit Incentive Modal */}
      <Modal
        isOpen={isIncentiveModalOpen}
        onClose={() => setIsIncentiveModalOpen(false)}
        title={selectedItem && selectedItem.incentiveAmount > 0 ? "Edit Employee Incentive" : "Set Employee Incentive"}
        description={
          selectedItem && selectedItem.incentiveAmount > 0
            ? `Update or edit the monthly incentive for ${selectedItem.employee.firstName} ${selectedItem.employee.lastName} for ${selectedPeriod}`
            : `Set an optional performance incentive for ${selectedItem?.employee.firstName} ${selectedItem?.employee.lastName} for ${selectedPeriod}`
        }
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveIncentive} className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Employee:</span>
              <span className="font-semibold text-slate-800">
                {selectedItem?.employee.firstName} {selectedItem?.employee.lastName} ({selectedItem?.employee.employeeId})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Fixed Monthly Salary:</span>
              <span className="font-semibold text-slate-800">
                ₹{selectedItem?.fixedSalary.toLocaleString('en-IN')}
              </span>
            </div>
            {selectedItem && selectedItem.incentiveAmount > 0 && (
              <div className="flex justify-between pt-1 border-t border-slate-200/60">
                <span className="text-slate-500">Current Incentive:</span>
                <span className="font-bold text-blue-700">
                  ₹{selectedItem.incentiveAmount.toLocaleString('en-IN')}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Month:</span>
              <span className="font-medium text-slate-700">{formatPeriodDisplay(selectedPeriod)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {selectedItem && selectedItem.incentiveAmount > 0 ? 'New Incentive Amount (₹) *' : 'Incentive Amount (₹) *'}
            </label>
            <input
              required
              type="number"
              min="0"
              step="any"
              placeholder="e.g. 5000 (enter 0 to remove)"
              value={incentiveForm.amount}
              onChange={(e) => setIncentiveForm({ ...incentiveForm, amount: e.target.value })}
              className="w-full text-sm font-semibold p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              {selectedItem && selectedItem.incentiveAmount > 0
                ? 'Editing this replaces the current incentive (it will not add on top). Enter 0 to remove.'
                : 'Incentives are added to the employee’s salary calculation for this month.'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason / Description
            </label>
            <input
              type="text"
              placeholder="e.g. Sales milestone achievement or festive bonus"
              value={incentiveForm.reason}
              onChange={(e) => setIncentiveForm({ ...incentiveForm, reason: e.target.value })}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsIncentiveModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-2xs disabled:opacity-50"
            >
              {selectedItem && selectedItem.incentiveAmount > 0 ? 'Update Incentive' : 'Save Incentive'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Salary Calculation Details */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title="Salary Breakdown & Calculation Details"
        description={`Period: ${formatPeriodDisplay(selectedPeriod)} • ${selectedItem?.employee.firstName} ${selectedItem?.employee.lastName} (${selectedItem?.employee.employeeId})`}
        maxWidth="max-w-3xl"
      >
        {selectedItem && (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Calculation Formula Banner */}
            <div className="p-4 bg-slate-900 text-white rounded-xl shadow-xs space-y-2">
              <span className="text-[11px] font-semibold text-brand-300 uppercase tracking-wider block">
                Standard Salary Formula
              </span>
              <div className="font-mono text-xs sm:text-sm text-slate-200">
                Final Salary = Fixed Salary (₹{selectedItem.fixedSalary.toLocaleString('en-IN')})
                {' + '}
                Overtime (₹{selectedItem.otAmount.toLocaleString('en-IN')})
                {' + '}
                Incentives (₹{selectedItem.incentiveAmount.toLocaleString('en-IN')})
                {' − '}
                Incomplete Deduction (₹{selectedItem.incompleteDeductionAmount.toLocaleString('en-IN')})
              </div>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Total Net Payable Salary:</span>
                <span className="text-lg font-bold text-emerald-400">
                  ₹{selectedItem.finalSalary.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* 4 Core Pillars Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-slate-500 font-medium block">1. Fixed Salary</span>
                <span className="text-base font-bold text-slate-900 block mt-1">
                  ₹{selectedItem.fixedSalary.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Hourly rate: ₹{selectedItem.otRate}/h
                </span>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <span className="text-emerald-700 font-medium block">2. Overtime Pay</span>
                <span className="text-base font-bold text-emerald-900 block mt-1">
                  + ₹{selectedItem.otAmount.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-emerald-600 block mt-0.5">
                  {selectedItem.otHours} hours computed
                </span>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                <span className="text-rose-700 font-medium block">3. Incomplete Hours</span>
                <span className="text-base font-bold text-rose-900 block mt-1">
                  - ₹{selectedItem.incompleteDeductionAmount.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-rose-600 block mt-0.5">
                  {selectedItem.incompleteHours} short hours
                </span>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="text-blue-700 font-medium block">4. Incentives</span>
                <span className="text-base font-bold text-blue-900 block mt-1">
                  + ₹{selectedItem.incentiveAmount.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-blue-600 block mt-0.5">
                  Optional additions
                </span>
              </div>
            </div>

            {/* Missing punch alert in details */}
            {selectedItem.hasMissingPunchFlags && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Missing Punch Flagged for HR Review
                </div>
                <p className="text-[11px] text-amber-800">
                  This employee had unclosed punch sessions (checked in with no recorded check-out).
                  In accordance with rule safeguards, deductions for incomplete hours were withheld on those dates so the employee is not incorrectly penalized.
                </p>
              </div>
            )}

            {/* Daily Attendance Logs Table */}
            {selectedItem.calculationBreakdown?.dailyLogs && selectedItem.calculationBreakdown.dailyLogs.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                  <span>Daily Attendance & Punch Logs ({selectedItem.calculationBreakdown.dailyLogs.length} days)</span>
                  <span className="text-[11px] font-normal text-slate-400">Shift standard: 8 hrs/day</span>
                </h4>
                <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-56">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100/80 sticky top-0 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="px-2.5 py-1.5">Date</th>
                        <th className="px-2.5 py-1.5">Status</th>
                        <th className="px-2.5 py-1.5">Hours Worked</th>
                        <th className="px-2.5 py-1.5">Overtime</th>
                        <th className="px-2.5 py-1.5">Incomplete</th>
                        <th className="px-2.5 py-1.5">Flags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {selectedItem.calculationBreakdown.dailyLogs.map((log) => (
                        <tr key={log.date} className="hover:bg-slate-50">
                          <td className="px-2.5 py-1.5 font-mono text-slate-800">{log.date}</td>
                          <td className="px-2.5 py-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              log.status === 'PRESENT'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : log.status === 'LATE'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : log.status === 'ON_LEAVE' || log.status === 'HOLIDAY'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="px-2.5 py-1.5 font-medium">{log.workingHours} hrs</td>
                          <td className="px-2.5 py-1.5 text-emerald-700 font-semibold">
                            {log.otHours > 0 ? `+${log.otHours}h` : '—'}
                          </td>
                          <td className="px-2.5 py-1.5 text-rose-700 font-semibold">
                            {log.incompleteHours > 0 ? `-${log.incompleteHours}h` : '—'}
                          </td>
                          <td className="px-2.5 py-1.5">
                            {log.hasMissingPunch && (
                              <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                Missing check-out
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <div className="flex items-center gap-2">
                {canManageSalary && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailsModalOpen(false);
                      handleOpenIncentiveModal(selectedItem);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                  >
                    {selectedItem.incentiveAmount > 0 ? 'Edit Incentive' : '+ Add Incentive'}
                  </button>
                )}
                {canManageSalary && selectedItem.isSaved && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailsModalOpen(false);
                      handleOpenReceiptPreview(selectedItem);
                    }}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" /> Preview Receipt & Email
                  </button>
                )}
                {selectedItem.receiptId && (
                  <button
                    type="button"
                    onClick={() => api.downloadReceiptPdf(selectedItem.receiptId!, selectedItem.receiptNumber || undefined)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> PDF
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                {canManageSalary && (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleCalculateSingle(selectedItem);
                      setIsDetailsModalOpen(false);
                    }}
                    disabled={actionLoading}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-2xs transition-colors"
                  >
                    Save / Recalculate
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 3. Salary Receipt Preview & Send Modal */}
      <Modal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setEmailSuccessInfo(null);
        }}
        title="Salary Receipt Preview"
        description="Inspect receipt details and PDF document before emailing to employee."
        maxWidth="max-w-3xl"
      >
        {previewReceiptItem && (
          <div className="space-y-4">
            {/* Success message banner */}
            {emailSuccessInfo && (
              <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">{emailSuccessInfo.message}</span>
                </div>
                {emailSuccessInfo.previewUrl && (
                  <a
                    href={emailSuccessInfo.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-900 underline ml-2"
                  >
                    View Test Email <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            {/* Email destination indicator */}
            <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs ${
              previewReceiptItem.employee.email
                ? 'bg-blue-50/70 border-blue-200 text-blue-900'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <div className="flex items-center gap-2">
                <Mail className={`w-4 h-4 ${previewReceiptItem.employee.email ? 'text-blue-600' : 'text-amber-600'}`} />
                <span>
                  Recipient Email:{' '}
                  {previewReceiptItem.employee.email ? (
                    <strong className="font-semibold">{previewReceiptItem.employee.email}</strong>
                  ) : (
                    <span className="italic font-medium text-amber-700">No email on record (PDF preview and download still available)</span>
                  )}
                </span>
              </div>
              <Badge variant={previewReceiptItem.employee.email ? 'info' : 'warning'}>
                {previewReceiptItem.employee.email ? 'Ready to Dispatch' : 'Email Missing'}
              </Badge>
            </div>

            {/* Loading Skeleton */}
            {receiptLoading && (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl">
                <RefreshCw className="w-6 h-6 text-brand-600 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">Generating receipt snapshot and PDF preview...</p>
              </div>
            )}

            {/* Receipt Preview Card */}
            {!receiptLoading && receiptDetails && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                {/* Receipt Header Banner */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-5 py-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] tracking-widest font-semibold uppercase text-blue-400">
                      {receiptDetails.snapshot?.brandName || previewReceiptItem.employee.brand?.name || 'HRMS'}
                    </span>
                    <h4 className="text-sm font-bold tracking-tight text-white">Official Salary Receipt</h4>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 bg-white/10 rounded font-mono text-[11px] text-blue-200 border border-white/15">
                      {receiptDetails.receiptNumber}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Period: <strong className="text-slate-200">{receiptDetails.period}</strong>
                    </div>
                  </div>
                </div>

                {/* Employee & Meta Details */}
                <div className="p-4 bg-slate-50/70 border-b border-slate-200 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-slate-500 text-[11px]">Employee Name</span>
                    <div className="font-semibold text-slate-900 mt-0.5">{receiptDetails.employeeName}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Employee ID</span>
                    <div className="font-mono font-medium text-slate-800 mt-0.5">{receiptDetails.snapshot?.employeeId}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Department / Role</span>
                    <div className="font-medium text-slate-800 mt-0.5">
                      {receiptDetails.snapshot?.department} • {receiptDetails.snapshot?.designation}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Branch / Location</span>
                    <div className="font-medium text-slate-800 mt-0.5">{receiptDetails.snapshot?.branch}</div>
                  </div>
                </div>

                {/* Working Statistics bar */}
                <div className="px-4 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Present:</span>
                    <strong className="font-semibold text-slate-800">{receiptDetails.snapshot?.presentDaysCount} days</strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Leave/Holiday:</span>
                    <strong className="font-semibold text-slate-800">{receiptDetails.snapshot?.leaveDaysCount} days</strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Working Hours:</span>
                    <strong className="font-semibold text-slate-800">{receiptDetails.snapshot?.payableWorkingHours} hrs</strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Approved OT:</span>
                    <strong className="font-semibold text-emerald-700">
                      {receiptDetails.snapshot?.approvedOtHours > 0 ? `+${receiptDetails.snapshot?.approvedOtHours} hrs` : '0 hrs'}
                    </strong>
                  </div>
                </div>

                {/* Earnings & Deductions Table */}
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* Earnings */}
                  <div className="space-y-2 border-r border-slate-100 sm:pr-4">
                    <h5 className="font-bold text-slate-800 pb-1 border-b border-slate-200 flex items-center justify-between">
                      <span>Earnings</span>
                      <span className="text-[10px] text-slate-500">Amount (INR)</span>
                    </h5>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Base Salary</span>
                      <span className="font-medium text-slate-900">₹{receiptDetails.snapshot?.baseSalary?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {receiptDetails.snapshot?.isProrated && (
                      <div className="flex justify-between py-1 border-b border-slate-100 text-amber-700 bg-amber-50/50 px-1 rounded">
                        <span>Prorated Payable Pay</span>
                        <span className="font-semibold">₹{receiptDetails.snapshot?.payableSalary?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Overtime Payment ({receiptDetails.snapshot?.approvedOtHours || 0}h)</span>
                      <span className="font-medium text-emerald-700">+₹{receiptDetails.snapshot?.otPayment?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Performance Incentives</span>
                      <span className="font-medium text-emerald-700">+₹{receiptDetails.snapshot?.approvedIncentivesAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between pt-1 font-bold text-slate-900">
                      <span>Gross Total Earnings</span>
                      <span className="text-emerald-700">₹{receiptDetails.snapshot?.grossEarnings?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="space-y-2">
                    <h5 className="font-bold text-slate-800 pb-1 border-b border-slate-200 flex items-center justify-between">
                      <span>Deductions</span>
                      <span className="text-[10px] text-slate-500">Amount (INR)</span>
                    </h5>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Incomplete Hours ({receiptDetails.snapshot?.incompleteHours || 0}h)</span>
                      <span className="font-medium text-rose-700">-₹{receiptDetails.snapshot?.incompleteDeductionAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Other Deductions</span>
                      <span className="font-medium text-rose-700">-₹{receiptDetails.snapshot?.otherDeductions?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between pt-1 font-bold text-slate-900">
                      <span>Total Deductions</span>
                      <span className="text-rose-700">₹{receiptDetails.snapshot?.totalDeductions?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                {/* Net Payable Salary Highlight */}
                <div className="p-4 bg-gradient-to-r from-blue-900 to-indigo-950 text-white flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-blue-300">Net Payable Salary</span>
                    <div className="text-xs italic text-blue-200 mt-0.5 line-clamp-1">
                      {receiptDetails.amountInWords || receiptDetails.snapshot?.amountInWords}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xl sm:text-2xl font-black tracking-tight text-white">
                      ₹{receiptDetails.netSalary?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs font-semibold text-blue-300 ml-1">INR</span>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-200 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {receiptDetails?.receiptId && (
                  <>
                    <button
                      type="button"
                      onClick={() => api.previewReceiptPdf(receiptDetails.receiptId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors"
                      title="Open PDF in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500" /> View PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => api.downloadReceiptPdf(receiptDetails.receiptId, receiptDetails.receiptNumber)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                      title="Download PDF to computer"
                    >
                      <Download className="w-3.5 h-3.5" /> Download PDF
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsReceiptModalOpen(false);
                    setEmailSuccessInfo(null);
                  }}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                >
                  Close
                </button>

                {canManageSalary && (
                  <button
                    type="button"
                    onClick={handleSendEmailFromPreview}
                    disabled={sendingReceiptEmail || receiptLoading || !previewReceiptItem.employee.email}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:pointer-events-none rounded-lg shadow-xs transition-all"
                    title={previewReceiptItem.employee.email ? `Send receipt to ${previewReceiptItem.employee.email}` : 'No email address available'}
                  >
                    {sendingReceiptEmail ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending Email...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Email Now</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
