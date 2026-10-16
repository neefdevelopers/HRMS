import React, { useState, useEffect } from 'react';
import { Card } from '../common/Card';
import { Badge, BadgeVariant } from '../common/Badge';
import { api } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import { DailyLeavesData, DailyLeaveRecord } from '../../types';
import {
  CalendarCheck,
  Calendar,
  Clock,
  AlertCircle,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Info,
  CheckCircle2,
  Building2,
  Sparkles
} from 'lucide-react';

interface DailyLeavesSummaryProps {
  selectedDate: string;
  selectedBrandId: string;
}

export const DailyLeavesSummary: React.FC<DailyLeavesSummaryProps> = ({
  selectedDate,
  selectedBrandId
}) => {
  const { activeCompanyId } = useCompany();
  const [data, setData] = useState<DailyLeavesData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const res = await api.getDailyLeaves({
        date: selectedDate,
        brandId: selectedBrandId !== 'all' ? selectedBrandId : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined
      });
      setData(res);
    } catch (err) {
      console.error('Failed to load daily leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
    const handleRefresh = () => {
      fetchLeaves();
    };
    window.addEventListener('hrms:company-changed', handleRefresh);
    window.addEventListener('hrms:brand-changed', handleRefresh);
    return () => {
      window.removeEventListener('hrms:company-changed', handleRefresh);
      window.removeEventListener('hrms:brand-changed', handleRefresh);
    };
  }, [activeCompanyId, selectedDate, selectedBrandId, statusFilter]);

  const summary = data?.summary || {
    totalApproved: 0,
    fullDayApproved: 0,
    halfDayApproved: 0,
    totalPending: 0,
    totalRejected: 0,
    totalRecords: 0
  };

  const leaves = data?.leaves || [];

  // Filter by local search query
  const filteredLeaves = leaves.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const fullName = `${item.employee?.firstName || ''} ${item.employee?.lastName || ''}`.toLowerCase();
    const empId = (item.employee?.employeeId || '').toLowerCase();
    const dept = (item.employee?.department?.name || '').toLowerCase();
    const lType = (item.leaveType?.name || '').toLowerCase();
    const brandName = (item.brand?.name || '').toLowerCase();
    return (
      fullName.includes(q) ||
      empId.includes(q) ||
      dept.includes(q) ||
      lType.includes(q) ||
      brandName.includes(q)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Approved Leave
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200" title="Under HR review - not counted as approved leave">
            <Clock className="w-3 h-3 text-amber-600" />
            Pending Review
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Approved On Leave */}
        <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
              Approved on Leave
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">
              {summary.totalApproved}
            </p>
            <span className="text-[10px] text-emerald-600 font-medium">
              Active on {selectedDate}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600">
            <CalendarCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Full-Day Leave */}
        <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider">
              Full-Day Leave
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">
              {summary.fullDayApproved}
            </p>
            <span className="text-[10px] text-blue-600 font-medium">
              Full absence authorized
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        {/* Half-Day Leave */}
        <div className="bg-white p-3.5 rounded-xl border border-amber-100 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
              Half-Day Leave
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">
              {summary.halfDayApproved}
            </p>
            <span className="text-[10px] text-amber-600 font-medium">
              Partial day off
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Pending Requests */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              Pending / Other
            </p>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">
              {summary.totalPending}
            </p>
            <span className="text-[10px] text-slate-500 font-medium">
              {summary.totalRejected > 0 ? `${summary.totalRejected} rejected` : 'Awaiting HR action'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <Card
        title={`Employee Leave Registry (${selectedDate})`}
        action={
          <button
            onClick={fetchLeaves}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
            title="Refresh leave records"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        }
      >
        {/* Filters Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search employee, ID, department, leave type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">Approved Only</option>
              <option value="PENDING">Pending Review Only</option>
              <option value="REJECTED">Rejected Only</option>
            </select>
          </div>
        </div>

        {/* Informative Note for Attendance Viewer */}
        <div className="mb-3.5 p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-lg text-[11px] text-blue-900 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            This is a <strong>read-only operational view</strong> of employee leaves covering{' '}
            <strong>{selectedDate}</strong>. Approved leave records explain legitimate employee absences on this date.
          </span>
        </div>

        {/* Leave Records Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-3 py-3">Brand &amp; Branch</th>
                <th className="px-3 py-3">Leave Type</th>
                <th className="px-3 py-3">Leave Duration</th>
                <th className="px-3 py-3">Coverage</th>
                <th className="px-3 py-3">Approval Status</th>
                <th className="px-3 py-3">Operational Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading employee leave records for {selectedDate}...
                  </td>
                </tr>
              ) : filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    <CalendarCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No employee leave records found covering {selectedDate}.
                  </td>
                </tr>
              ) : (
                filteredLeaves.map((item) => {
                  const isMultiDay = item.startDate !== item.endDate;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Employee */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {item.employee?.firstName} {item.employee?.lastName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {item.employee?.employeeId}
                          {item.employee?.department?.name && ` • ${item.employee.department.name}`}
                        </div>
                      </td>

                      {/* Brand & Branch */}
                      <td className="px-3 py-3">
                        <span className="font-medium text-slate-800">{item.brand?.name || 'General'}</span>
                        <span className="block text-[11px] text-slate-500">
                          {item.employee?.branch?.name || 'Main Branch'}
                        </span>
                      </td>

                      {/* Leave Type */}
                      <td className="px-3 py-3">
                        <span className="font-semibold text-slate-800">
                          {item.leaveType?.name || 'Standard Leave'}
                        </span>
                        <span className="block text-[10px] text-slate-400 font-mono">
                          {item.leaveType?.isPaid ? 'Paid Leave' : 'Unpaid'}
                        </span>
                      </td>

                      {/* Duration */}
                      <td className="px-3 py-3 font-mono text-slate-700">
                        {isMultiDay ? (
                          <div>
                            <span className="font-medium text-slate-900">
                              {item.startDate} → {item.endDate}
                            </span>
                            <span className="block text-[10px] text-indigo-600 font-sans font-medium">
                              Multi-day span
                            </span>
                          </div>
                        ) : (
                          <span className="font-medium text-slate-900">{item.startDate}</span>
                        )}
                      </td>

                      {/* Coverage (Full day vs Half day) */}
                      <td className="px-3 py-3">
                        {item.isHalfDay ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            Half Day ({item.halfDayType === 'SECOND_HALF' ? '2nd Half' : '1st Half'})
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                            Full Day
                          </span>
                        )}
                      </td>

                      {/* Approval Status */}
                      <td className="px-3 py-3">{getStatusBadge(item.status)}</td>

                      {/* Operational Notes */}
                      <td className="px-3 py-3 text-slate-600 max-w-xs truncate" title={item.reason}>
                        {item.reason || <span className="text-slate-300 italic">None recorded</span>}
                        {item.rejectionReason && (
                          <span className="block text-[10px] text-rose-600 font-medium">
                            Note: {item.rejectionReason}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
