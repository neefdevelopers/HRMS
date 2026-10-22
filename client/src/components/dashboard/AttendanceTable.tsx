import React, { useState, useEffect } from 'react';
import { Card } from '../common/Card';
import { Badge, BadgeVariant } from '../common/Badge';
import { Attendance, AttendanceStatus } from '../../types';
import { api } from '../../services/api';
import { Search, Filter, RefreshCw, ChevronLeft, ChevronRight, Edit3, CalendarCheck, AlertCircle, X, Loader2, Clock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';

interface AttendanceTableProps {
  selectedDate: string;
  selectedBrandId: string;
  onRefreshParent?: () => void;
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
  selectedDate,
  selectedBrandId,
  onRefreshParent
}) => {
  const navigate = useNavigate();
  const { activeCompanyId } = useCompany();
  const { canManageAttendance, canManageEmployees } = useAuth();

  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Manual correction modal state
  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');
  const [editCheckIn, setEditCheckIn] = useState<string>('');
  const [editCheckOut, setEditCheckOut] = useState<string>('');
  const [editRemarks, setEditRemarks] = useState<string>('');
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      const data = await api.getAttendance({
        date: selectedDate,
        brandId: selectedBrandId !== 'all' ? selectedBrandId : undefined,
        status: statusFilter || undefined,
        page
      });
      setAttendances(data);
    } catch (err) {
      console.error('Failed to load attendance records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
    const handleRefresh = () => {
      fetchAttendanceData();
    };
    window.addEventListener('hrms:company-changed', handleRefresh);
    window.addEventListener('hrms:brand-changed', handleRefresh);
    return () => {
      window.removeEventListener('hrms:company-changed', handleRefresh);
      window.removeEventListener('hrms:brand-changed', handleRefresh);
    };
  }, [activeCompanyId, selectedDate, selectedBrandId, statusFilter, page]);

  const statusBadgeVariant = (status: AttendanceStatus): BadgeVariant => {
    switch (status) {
      case 'PRESENT': return 'success';
      case 'LATE': return 'warning';
      case 'ON_LEAVE': return 'info';
      case 'ABSENT': return 'danger';
      case 'HALF_DAY': return 'warning';
      case 'HOLIDAY': return 'neutral';
      case 'WEEK_OFF': return 'neutral';
      default: return 'neutral';
    }
  };

  const handleOpenCorrection = (att: Attendance, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRecord(att);
    setCorrectionError(null);
    setEditStatus(att.status);
    setEditCheckIn(att.checkIn ? new Date(att.checkIn).toISOString().substring(11, 16) : '');
    setEditCheckOut(att.checkOut ? new Date(att.checkOut).toISOString().substring(11, 16) : '');
    setEditRemarks(att.remarks || '');
  };

  const handleSaveCorrection = async () => {
    if (!selectedRecord) return;
    setCorrectionError(null);
    try {
      setSavingCorrection(true);
      const inDate = editCheckIn ? `${selectedRecord.date}T${editCheckIn}:00Z` : undefined;
      const outDate = editCheckOut ? `${selectedRecord.date}T${editCheckOut}:00Z` : undefined;

      await api.correctAttendance(selectedRecord.id, {
        status: editStatus,
        checkIn: inDate,
        checkOut: outDate,
        remarks: editRemarks
      });

      setSelectedRecord(null);
      fetchAttendanceData();
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      setCorrectionError(err.message || 'Correction failed');
    } finally {
      setSavingCorrection(false);
    }
  };

  // Filter local search for immediate UI responsiveness
  const filteredRecords = attendances.filter((att) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const fullName = `${att.employee?.firstName || ''} ${att.employee?.lastName || ''}`.toLowerCase();
    const empId = (att.employee?.employeeId || '').toLowerCase();
    const dept = (att.employee?.department?.name || '').toLowerCase();
    return fullName.includes(q) || empId.includes(q) || dept.includes(q);
  });

  return (
    <Card
      title="Daily Attendance Records"
      action={
        <button
          onClick={fetchAttendanceData}
          className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
          title="Refresh table"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      }
    >
      {/* Search and Filters toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search employee, ID, department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          {/* Quick toggle between All Attendance and Employees on Leave */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                statusFilter === ''
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Attendance
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ON_LEAVE')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === 'ON_LEAVE'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              On Leave
            </button>
          </div>

          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-700"
            >
              <option value="">Status Filter</option>
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="ABSENT">Absent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Desktop / Tablet Table View */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
            <tr>
              <th className="px-4 py-3 whitespace-nowrap">Employee</th>
              <th className="px-3 py-3 whitespace-nowrap">Shift &amp; Schedule</th>
              <th className="px-3 py-3 whitespace-nowrap">Punches &amp; Total Hours</th>
              <th className="px-3 py-3 whitespace-nowrap">Status</th>
              {canManageAttendance && <th className="px-4 py-3 text-right whitespace-nowrap">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {loading ? (
              <tr>
                <td colSpan={canManageAttendance ? 5 : 4} className="px-4 py-8 text-center text-slate-400">
                  Loading attendance records...
                </td>
              </tr>
            ) : filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={canManageAttendance ? 5 : 4} className="px-4 py-8 text-center text-slate-400">
                  No attendance records found for this date.
                </td>
              </tr>
            ) : (
              filteredRecords.map((att) => {
                const initials = `${att.employee?.firstName?.[0] || ''}${att.employee?.lastName?.[0] || ''}`.toUpperCase() || 'E';
                const checkInFormatted = att.checkIn
                  ? new Date(att.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : null;
                const checkOutFormatted = att.checkOut
                  ? new Date(att.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : null;

                return (
                  <tr
                    key={att.id}
                    onClick={() => {
                      if (canManageEmployees) {
                        navigate(`/employees?search=${att.employee?.employeeId}`);
                      }
                    }}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      canManageEmployees ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {att.employee?.firstName} {att.employee?.lastName}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-700">{att.employee?.employeeId}</span>
                            <span>•</span>
                            <span className="truncate">{att.employee?.department?.name || 'Department'}</span>
                            {att.brand?.name && (
                              <>
                                <span>•</span>
                                <span className="text-slate-400 truncate">{att.brand.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="font-medium text-slate-800">{att.shift?.name || 'General Shift'}</div>
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{att.shift ? `${att.shift.startTime} – ${att.shift.endTime}` : '09:00 – 18:00'}</span>
                      </div>
                    </td>

                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-mono text-slate-800 font-medium">
                        <span className={att.status === 'LATE' ? 'text-amber-700 font-semibold' : ''}>
                          {checkInFormatted || '—'}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-300" />
                        <span>{checkOutFormatted || '—'}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        {att.workingHours > 0 ? (
                          <span className="font-medium text-slate-700">{att.workingHours} hrs worked</span>
                        ) : (
                          <span className="text-slate-400">0 hrs</span>
                        )}
                        {att.lateMinutes > 0 && (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            +{att.lateMinutes}m late
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-3 whitespace-nowrap">
                      <Badge variant={statusBadgeVariant(att.status)}>
                        {att.status.replace('_', ' ')}
                      </Badge>
                    </td>

                    {canManageAttendance && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => handleOpenCorrection(att, e)}
                          title="Manual HR Correction"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-md border border-brand-200 transition-colors shadow-2xs"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      </td>
                    )}
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
            Loading attendance records...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            No attendance records found for this date.
          </div>
        ) : (
          filteredRecords.map((att) => {
            const initials = `${att.employee?.firstName?.[0] || ''}${att.employee?.lastName?.[0] || ''}`.toUpperCase() || 'E';
            const checkInFormatted = att.checkIn
              ? new Date(att.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '—';
            const checkOutFormatted = att.checkOut
              ? new Date(att.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '—';

            return (
              <div
                key={att.id}
                className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate text-xs">
                        {att.employee?.firstName} {att.employee?.lastName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">
                        {att.employee?.employeeId} • {att.employee?.department?.name || 'Staff'}
                      </div>
                    </div>
                  </div>
                  <Badge variant={statusBadgeVariant(att.status)}>
                    {att.status.replace('_', ' ')}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-100 bg-slate-50/60 p-2 rounded-lg">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Timing</span>
                    <span className="font-mono font-medium text-slate-800">
                      {checkInFormatted} → {checkOutFormatted}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Duration</span>
                    <span className="font-medium text-slate-800">
                      {att.workingHours > 0 ? `${att.workingHours} hrs` : '0 hrs'}
                      {att.lateMinutes > 0 && ` (+${att.lateMinutes}m)`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="text-slate-500 truncate max-w-[180px]">
                    {att.shift?.name || 'General Shift'}
                  </span>
                  {canManageAttendance && (
                    <button
                      onClick={(e) => handleOpenCorrection(att, e)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-md border border-brand-200 transition-colors"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Manual Correction Modal */}
      <Modal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title="Manual Attendance Correction"
        description={`Record correction for ${selectedRecord?.employee?.firstName} ${selectedRecord?.employee?.lastName} (${selectedRecord?.date})`}
      >
        <div className="space-y-4">
          {correctionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{correctionError}</div>
              <button
                type="button"
                onClick={() => setCorrectionError(null)}
                className="text-rose-400 hover:text-rose-600 p-0.5 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="ABSENT">Absent</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Check-In Time</label>
              <input
                type="time"
                value={editCheckIn}
                onChange={(e) => setEditCheckIn(e.target.value)}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Check-Out Time</label>
              <input
                type="time"
                value={editCheckOut}
                onChange={(e) => setEditCheckOut(e.target.value)}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Correction Remarks / Reason</label>
            <textarea
              rows={2}
              value={editRemarks}
              onChange={(e) => setEditRemarks(e.target.value)}
              placeholder="e.g. Biometric reader network delay verified by manager"
              className="w-full text-xs p-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setSelectedRecord(null)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              disabled={savingCorrection}
              onClick={handleSaveCorrection}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              {savingCorrection && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{savingCorrection ? 'Saving...' : 'Save Correction'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};
