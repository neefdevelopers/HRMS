import React, { useState, useEffect } from 'react';
import { Card } from '../common/Card';
import { Badge, BadgeVariant } from '../common/Badge';
import { Attendance, AttendanceStatus } from '../../types';
import { api } from '../../services/api';
import { Search, Filter, RefreshCw, ChevronLeft, ChevronRight, Edit3, CalendarCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';

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
  }, [selectedDate, selectedBrandId, statusFilter, page]);

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
    setEditStatus(att.status);
    setEditCheckIn(att.checkIn ? new Date(att.checkIn).toISOString().substring(11, 16) : '');
    setEditCheckOut(att.checkOut ? new Date(att.checkOut).toISOString().substring(11, 16) : '');
    setEditRemarks(att.remarks || '');
  };

  const handleSaveCorrection = async () => {
    if (!selectedRecord) return;
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
      alert(err.message || 'Correction failed');
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

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-3 py-3">Brand & Branch</th>
              <th className="px-3 py-3">Shift</th>
              <th className="px-3 py-3">Check-In</th>
              <th className="px-3 py-3">Check-Out</th>
              <th className="px-3 py-3">Hours</th>
              <th className="px-3 py-3">Status</th>
              {canManageAttendance && <th className="px-3 py-3 text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Loading attendance records...
                </td>
              </tr>
            ) : filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No attendance records found for this date.
                </td>
              </tr>
            ) : (
              filteredRecords.map((att) => (
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
                    <div className="font-semibold text-slate-900">
                      {att.employee?.firstName} {att.employee?.lastName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {att.employee?.employeeId} • {att.employee?.department?.name}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-medium text-slate-800">{att.brand?.name}</span>
                    <span className="block text-[11px] text-slate-500">{att.branch?.name}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-slate-700 font-medium">{att.shift?.name || 'General Shift'}</span>
                    {att.shift && (
                      <span className="block text-[10px] text-slate-400 font-mono">
                        {att.shift.startTime} - {att.shift.endTime}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-mono">
                    {att.checkIn ? (
                      <span className={att.status === 'LATE' ? 'text-amber-700 font-semibold' : 'text-slate-700'}>
                        {new Date(att.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {att.lateMinutes > 0 && (
                          <span className="block text-[10px] text-amber-600 font-sans">
                            +{att.lateMinutes}m late
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-mono">
                    {att.checkOut ? (
                      new Date(att.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-medium">
                    {att.workingHours > 0 ? `${att.workingHours} hrs` : '-'}
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={statusBadgeVariant(att.status)}>
                      {att.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  {canManageAttendance && (
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={(e) => handleOpenCorrection(att, e)}
                        title="Manual HR Correction"
                        className="p-1 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Manual Correction Modal */}
      <Modal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title="Manual Attendance Correction"
        description={`Record correction for ${selectedRecord?.employee?.firstName} ${selectedRecord?.employee?.lastName} (${selectedRecord?.date})`}
      >
        <div className="space-y-4">
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
              className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-xs disabled:opacity-50"
            >
              {savingCorrection ? 'Saving...' : 'Save Correction'}
            </button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};
