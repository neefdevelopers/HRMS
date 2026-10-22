import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/common/Card';
import { Badge, BadgeVariant } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { api } from '../services/api';
import { Shift, ShiftAssignment, ShiftCalendarData, ShiftAttendanceData, Employee } from '../types';
import { useBrand } from '../context/BrandContext';
import { useCompany } from '../context/CompanyContext';
import { useAuth } from '../context/AuthContext';
import {
  Clock,
  Calendar,
  CalendarRange,
  Users,
  Plus,
  RefreshCw,
  Repeat,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Moon,
  Sun,
  Coffee,
  CalendarDays,
  Search,
  Filter,
  Check,
  X,
  Loader2,
  ArrowRight
} from 'lucide-react';

export const ShiftPage: React.FC = () => {
  const { selectedBrandId } = useBrand();
  const { activeCompanyId } = useCompany();
  const { user } = useAuth();
  const isHrOrAdmin = user?.role === 'ADMIN' || user?.role === 'HR';

  // 3 Primary Tabs
  const [activeTab, setActiveTab] = useState<'shifts' | 'assignments' | 'calendar_attendance'>('shifts');

  // Tab 3 Sub-View: 'calendar' or 'attendance'
  const [calSubView, setCalSubView] = useState<'calendar' | 'attendance'>('calendar');

  // Data states
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [calendarData, setCalendarData] = useState<ShiftCalendarData | null>(null);
  const [attendanceData, setAttendanceData] = useState<ShiftAttendanceData | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [calendarPeriod, setCalendarPeriod] = useState<string>(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [attendanceDate, setAttendanceDate] = useState<string>(() => new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftFormError, setShiftFormError] = useState<string | null>(null);
  const [shiftSubmitting, setShiftSubmitting] = useState(false);
  const [shiftForm, setShiftForm] = useState({
    name: '',
    code: '',
    startTime: '09:00',
    endTime: '18:00',
    breakMinutes: 60,
    weeklyOff: 'SUNDAY',
    gracePeriodMinutes: 15,
    isDefault: false
  });

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignFormError, setAssignFormError] = useState<string | null>(null);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignForm, setAssignForm] = useState<{
    selectedEmployeeIds: string[];
    shiftId: string;
    startDate: string;
    endDate: string;
    isRotational: boolean;
    rotationFrequency: 'WEEKLY' | 'MONTHLY';
    rotationShiftIds: string[];
    notes: string;
  }>({
    selectedEmployeeIds: [],
    shiftId: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    isRotational: false,
    rotationFrequency: 'WEEKLY',
    rotationShiftIds: [],
    notes: ''
  });

  // Load shifts & assignments
  const loadShiftsAndAssignments = async () => {
    try {
      setLoading(true);
      setError(null);
      const brandParam = selectedBrandId !== 'all' ? selectedBrandId : undefined;
      const [fetchedShifts, fetchedAssignments] = await Promise.all([
        api.getShiftsList(brandParam),
        api.getShiftAssignments(brandParam)
      ]);
      setShifts(fetchedShifts);
      setAssignments(fetchedAssignments);

      // Also fetch active employees for assignment dropdown if HR/Admin
      if (isHrOrAdmin) {
        const empList = await api.getEmployees({
          brandId: brandParam,
          limit: 200,
          status: 'ACTIVE'
        });
        setEmployees(Array.isArray(empList) ? empList : []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load shift records');
    } finally {
      setLoading(false);
    }
  };

  // Load calendar
  const loadCalendar = async () => {
    try {
      setLoading(true);
      const brandParam = selectedBrandId !== 'all' ? selectedBrandId : undefined;
      const data = await api.getShiftCalendar({
        brandId: brandParam,
        period: calendarPeriod,
        search: searchQuery || undefined
      });
      setCalendarData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load shift calendar');
    } finally {
      setLoading(false);
    }
  };

  // Load attendance
  const loadAttendance = async () => {
    try {
      setLoading(true);
      const brandParam = selectedBrandId !== 'all' ? selectedBrandId : undefined;
      const data = await api.getShiftWiseAttendance({
        brandId: brandParam,
        date: attendanceDate,
        search: searchQuery || undefined
      });
      setAttendanceData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load shift attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShiftsAndAssignments();
    const handleRefresh = () => {
      loadShiftsAndAssignments();
    };
    window.addEventListener('hrms:company-changed', handleRefresh);
    window.addEventListener('hrms:brand-changed', handleRefresh);
    return () => {
      window.removeEventListener('hrms:company-changed', handleRefresh);
      window.removeEventListener('hrms:brand-changed', handleRefresh);
    };
  }, [activeCompanyId, selectedBrandId]);

  useEffect(() => {
    if (activeTab === 'calendar_attendance') {
      if (calSubView === 'calendar') {
        loadCalendar();
      } else {
        loadAttendance();
      }
    }
  }, [activeCompanyId, activeTab, calSubView, calendarPeriod, attendanceDate, selectedBrandId]);

  // Flash message helper
  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Handle Shift Modal Open
  const handleOpenShiftModal = (shiftToEdit?: Shift) => {
    setShiftFormError(null);
    if (shiftToEdit) {
      setEditingShift(shiftToEdit);
      setShiftForm({
        name: shiftToEdit.name,
        code: shiftToEdit.code,
        startTime: shiftToEdit.startTime,
        endTime: shiftToEdit.endTime,
        breakMinutes: shiftToEdit.breakMinutes || 60,
        weeklyOff: shiftToEdit.weeklyOff || 'SUNDAY',
        gracePeriodMinutes: shiftToEdit.gracePeriodMinutes || 15,
        isDefault: Boolean(shiftToEdit.isDefault)
      });
    } else {
      setEditingShift(null);
      setShiftForm({
        name: '',
        code: '',
        startTime: '09:00',
        endTime: '18:00',
        breakMinutes: 60,
        weeklyOff: 'SUNDAY',
        gracePeriodMinutes: 15,
        isDefault: false
      });
    }
    setIsShiftModalOpen(true);
  };

  // Save Shift
  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setShiftFormError(null);
    setShiftSubmitting(true);
    try {
      if (editingShift) {
        await api.updateShiftRecord(editingShift.id, shiftForm);
        showSuccess(`Shift "${shiftForm.name}" updated successfully.`);
      } else {
        const brandId = selectedBrandId !== 'all' ? selectedBrandId : undefined;
        await api.createShiftRecord({ ...shiftForm, brandId });
        showSuccess(`Shift "${shiftForm.name}" created successfully.`);
      }
      setIsShiftModalOpen(false);
      loadShiftsAndAssignments();
    } catch (err: any) {
      setShiftFormError(err.message || 'Failed to save shift. Please check the timings and details.');
    } finally {
      setShiftSubmitting(false);
    }
  };

  // Delete Shift
  const handleDeleteShift = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete shift "${name}"?`)) return;
    try {
      await api.deleteShiftRecord(id);
      showSuccess(`Shift "${name}" deleted.`);
      loadShiftsAndAssignments();
    } catch (err: any) {
      setError(err.message || 'Failed to delete shift');
    }
  };

  // Handle Assign Modal Open
  const handleOpenAssignModal = () => {
    setAssignFormError(null);
    setAssignForm({
      selectedEmployeeIds: [],
      shiftId: shifts[0]?.id || '',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      isRotational: false,
      rotationFrequency: 'WEEKLY',
      rotationShiftIds: shifts.slice(0, 2).map(s => s.id),
      notes: ''
    });
    setIsAssignModalOpen(true);
  };

  // Save Assignment
  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignFormError(null);
    if (assignForm.selectedEmployeeIds.length === 0) {
      setAssignFormError('Please select at least one employee.');
      return;
    }
    if (!assignForm.shiftId) {
      setAssignFormError('Please select a primary shift.');
      return;
    }

    setAssignSubmitting(true);
    try {
      const brandId = selectedBrandId !== 'all' ? selectedBrandId : undefined;
      await api.assignShifts({
        brandId,
        employeeIds: assignForm.selectedEmployeeIds,
        shiftId: assignForm.shiftId,
        startDate: assignForm.startDate,
        endDate: assignForm.endDate || undefined,
        isRotational: assignForm.isRotational,
        rotationFrequency: assignForm.isRotational ? assignForm.rotationFrequency : undefined,
        rotationShiftIds: assignForm.isRotational ? assignForm.rotationShiftIds : undefined,
        notes: assignForm.notes || undefined
      });

      showSuccess(`Shift assigned to ${assignForm.selectedEmployeeIds.length} employee(s) successfully.`);
      setIsAssignModalOpen(false);
      loadShiftsAndAssignments();
      if (activeTab === 'calendar_attendance') {
        if (calSubView === 'calendar') loadCalendar();
        else loadAttendance();
      }
    } catch (err: any) {
      setAssignFormError(err.message || 'Failed to assign shifts');
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Delete Assignment
  const handleDeleteAssignment = async (id: string) => {
    if (!confirm('Remove this shift assignment?')) return;
    try {
      await api.deleteShiftAssignment(id);
      showSuccess('Shift assignment removed.');
      loadShiftsAndAssignments();
    } catch (err: any) {
      setError(err.message || 'Failed to delete assignment');
    }
  };

  // Overnight shift detection helper for form
  const isFormOvernight = useMemo(() => {
    const [sh, sm] = shiftForm.startTime.split(':').map(Number);
    const [eh, em] = shiftForm.endTime.split(':').map(Number);
    return eh * 60 + em < sh * 60 + sm;
  }, [shiftForm.startTime, shiftForm.endTime]);

  // Net calculated working hours for form
  const formCalculatedHours = useMemo(() => {
    const [sh, sm] = shiftForm.startTime.split(':').map(Number);
    const [eh, em] = shiftForm.endTime.split(':').map(Number);
    let startM = sh * 60 + sm;
    let endM = eh * 60 + em;
    if (endM < startM) endM += 24 * 60;
    const netM = Math.max(0, endM - startM - (shiftForm.breakMinutes || 0));
    return (netM / 60).toFixed(1);
  }, [shiftForm.startTime, shiftForm.endTime, shiftForm.breakMinutes]);

  // Days of week options
  const daysOfWeek = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Shift Management</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 font-semibold border border-brand-200">
              Simple & Minimal
            </span>
          </div>
        </div>

        {/* Action Buttons for HR/Admin */}
        {isHrOrAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenShiftModal()}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Shift</span>
            </button>
            <button
              onClick={handleOpenAssignModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
            >
              <Users className="w-4 h-4" />
              <span>Assign Shift</span>
            </button>
          </div>
        )}
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2.5 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-rose-600 hover:underline">Dismiss</button>
        </div>
      )}


      {/* Navigation Tabs (Strictly 3 Main Sections per Requirement 7) */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('shifts')}
          className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'shifts'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>1. Shifts</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-full font-bold">
            {shifts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('assignments')}
          className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'assignments'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>2. Shift Assignment</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-full font-bold">
            {assignments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('calendar_attendance')}
          className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'calendar_attendance'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>3. Shift Calendar & Attendance</span>
        </button>
      </div>

      {/* TAB 1: SHIFTS */}
      {activeTab === 'shifts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Configured Shifts</h2>
            <span className="text-xs text-slate-500">{shifts.length} shift definitions active</span>
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 whitespace-nowrap">Shift &amp; Type</th>
                    <th className="py-3 px-4 whitespace-nowrap">Timing &amp; Working Hours</th>
                    <th className="py-3 px-4 whitespace-nowrap">Rules &amp; Weekly Off</th>
                    {isHrOrAdmin && <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {shifts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        No shifts configured. Click "+ Create Shift" above to add your first work shift.
                      </td>
                    </tr>
                  ) : (
                    shifts.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 min-w-[200px]">
                          <div className="font-semibold text-slate-900">{s.name}</div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-bold border border-slate-200">
                              {s.code}
                            </span>
                            {s.isDefault && (
                              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-semibold">
                                Default
                              </span>
                            )}
                            {s.isNightShift ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <Moon className="w-2.5 h-2.5 text-indigo-500" /> Night
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <Sun className="w-2.5 h-2.5 text-amber-500" /> Day
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-mono font-medium text-slate-900">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{s.startTime} – {s.endTime}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="font-semibold text-slate-700">
                              {s.expectedWorkingHours !== undefined ? `${s.expectedWorkingHours} hrs net` : `${s.fullDayThresholdHours || 8} hrs`}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-slate-400">
                              <Coffee className="w-3 h-3" /> {s.breakMinutes || 60}m break
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              Off: {s.weeklyOff || 'SUNDAY'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Grace: <span className="font-medium text-slate-700">{s.gracePeriodMinutes || 15} mins</span>
                          </div>
                        </td>

                        {isHrOrAdmin && (
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => handleOpenShiftModal(s)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-md border border-brand-200 transition-colors shadow-2xs"
                                title="Edit Shift"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteShift(s.id, s.name)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                title="Delete Shift"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View (< sm) */}
          <div className="sm:hidden space-y-3">
            {shifts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                No shifts configured.
              </div>
            ) : (
              shifts.map((s) => (
                <div
                  key={s.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">{s.name}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="font-mono font-bold text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                          {s.code}
                        </span>
                        {s.isDefault && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-semibold">
                            Default
                          </span>
                        )}
                      </div>
                    </div>
                    {s.isNightShift ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <Moon className="w-2.5 h-2.5 text-indigo-500" /> Night
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <Sun className="w-2.5 h-2.5 text-amber-500" /> Day
                      </span>
                    )}
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg space-y-1 text-[11px]">
                    <div className="flex items-center justify-between font-mono font-medium text-slate-800">
                      <span>{s.startTime} – {s.endTime}</span>
                      <span className="font-sans font-semibold text-slate-700">
                        {s.expectedWorkingHours !== undefined ? `${s.expectedWorkingHours} hrs` : `${s.fullDayThresholdHours || 8} hrs`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 text-[10px]">
                      <span>Weekly Off: {s.weeklyOff || 'SUNDAY'}</span>
                      <span>Break: {s.breakMinutes || 60}m</span>
                    </div>
                  </div>

                  {isHrOrAdmin && (
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                      <button
                        onClick={() => handleDeleteShift(s.id, s.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenShiftModal(s)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg font-semibold text-xs border border-brand-200"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit Shift</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SHIFT ASSIGNMENT */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Employee Shift Assignments</h2>
            </div>
            {isHrOrAdmin && (
              <button
                onClick={handleOpenAssignModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Assign Shift</span>
              </button>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 whitespace-nowrap">Employee</th>
                    <th className="py-3 px-4 whitespace-nowrap">Shift &amp; Cycle</th>
                    <th className="py-3 px-4 whitespace-nowrap">Effective Period</th>
                    <th className="py-3 px-4">Notes</th>
                    {isHrOrAdmin && <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {assignments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No assignments recorded. Click "+ Assign Shift" to assign shifts to employees.
                      </td>
                    </tr>
                  ) : (
                    assignments.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 min-w-[180px]">
                          <div className="font-semibold text-slate-900">
                            {a.employee?.firstName} {a.employee?.lastName}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {a.employee?.employeeId} • {a.employee?.department?.name || 'General'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-800">{a.shift?.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                            <span>{a.shift?.startTime} – {a.shift?.endTime}</span>
                            {a.isRotational ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                <Repeat className="w-2.5 h-2.5 text-purple-600" />
                                {a.rotationFrequency}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Fixed</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <span>{a.startDate}</span>
                            <ArrowRight className="w-3 h-3 text-slate-300" />
                            {a.endDate ? (
                              <span>{a.endDate}</span>
                            ) : (
                              <span className="text-emerald-700 font-sans font-semibold text-[10px] bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                Ongoing
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate" title={a.notes || undefined}>
                          {a.notes || <span className="text-slate-400 italic">No notes</span>}
                        </td>

                        {isHrOrAdmin && (
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => handleDeleteAssignment(a.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                              title="Delete Assignment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View (< sm) */}
          <div className="sm:hidden space-y-3">
            {assignments.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                No assignments recorded.
              </div>
            ) : (
              assignments.map((a) => (
                <div
                  key={a.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {a.employee?.firstName} {a.employee?.lastName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {a.employee?.employeeId} • {a.employee?.department?.name || 'General'}
                      </div>
                    </div>
                    {a.isRotational ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        <Repeat className="w-2.5 h-2.5" /> {a.rotationFrequency}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                        Fixed
                      </span>
                    )}
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg space-y-1 text-[11px]">
                    <div className="font-semibold text-slate-800">
                      {a.shift?.name} ({a.shift?.startTime} – {a.shift?.endTime})
                    </div>
                    <div className="font-mono text-slate-600 flex items-center gap-1.5">
                      <span>{a.startDate}</span>
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                      <span>{a.endDate || 'Ongoing Active'}</span>
                    </div>
                  </div>

                  {a.notes && (
                    <p className="text-[11px] text-slate-500 italic">
                      {a.notes}
                    </p>
                  )}

                  {isHrOrAdmin && (
                    <div className="flex justify-end pt-1 border-t border-slate-100">
                      <button
                        onClick={() => handleDeleteAssignment(a.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md border border-rose-200"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove Assignment</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SHIFT CALENDAR & ATTENDANCE */}
      {activeTab === 'calendar_attendance' && (
        <div className="space-y-5">
          {/* Sub-view switcher bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="inline-flex p-1 bg-slate-100 rounded-lg">
              <button
                onClick={() => setCalSubView('calendar')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-all ${
                  calSubView === 'calendar'
                    ? 'bg-white text-brand-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                <span>Monthly Shift Calendar</span>
              </button>
              <button
                onClick={() => setCalSubView('attendance')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-all ${
                  calSubView === 'attendance'
                    ? 'bg-white text-brand-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Shift-Wise Attendance & Overtime</span>
              </button>
            </div>

            {/* Filter controls based on active subview */}
            <div className="flex items-center gap-3">
              {calSubView === 'calendar' ? (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-medium text-slate-600">Month:</span>
                  <input
                    type="month"
                    value={calendarPeriod}
                    onChange={(e) => setCalendarPeriod(e.target.value)}
                    className="bg-transparent font-semibold text-slate-800 focus:outline-hidden"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-medium text-slate-600">Date:</span>
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="bg-transparent font-semibold text-slate-800 focus:outline-hidden"
                  />
                </div>
              )}

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter employee..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (calSubView === 'calendar') loadCalendar();
                      else loadAttendance();
                    }
                  }}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-brand-500 w-44"
                />
              </div>

              <button
                onClick={() => (calSubView === 'calendar' ? loadCalendar() : loadAttendance())}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* SUB-VIEW 1: MONTHLY CALENDAR ROSTER */}
          {calSubView === 'calendar' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold">
                  Roster for {calendarPeriod} ({calendarData?.roster?.length || 0} employees)
                </span>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" />
                    Weekly Off
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 inline-block" />
                    General Shift
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-purple-100 border border-purple-300 inline-block" />
                    Rotational Active
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="py-2.5 px-3 sticky left-0 z-10 bg-slate-50 border-r border-slate-200 text-left font-bold text-slate-700 min-w-[160px]">
                          Employee
                        </th>
                        {calendarData?.dates.map((dStr) => {
                          const dayNum = parseInt(dStr.split('-')[2], 10);
                          const d = new Date(dStr + 'T00:00:00Z');
                          const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
                          const isSun = d.getUTCDay() === 0;

                          return (
                            <th
                              key={dStr}
                              className={`py-2 px-1 text-center font-semibold border-r border-slate-100 min-w-[42px] ${
                                isSun ? 'bg-amber-50/70 text-amber-800' : 'text-slate-600'
                              }`}
                            >
                              <div className="text-[11px] font-bold">{dayNum}</div>
                              <div className="text-[9px] uppercase text-slate-400 font-medium">{dayName}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {calendarData?.roster && calendarData.roster.length > 0 ? (
                        calendarData.roster.map((row) => (
                          <tr key={row.employee.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2 px-3 sticky left-0 z-10 bg-white border-r border-slate-200">
                              <div className="font-semibold text-slate-900 truncate max-w-[150px]">
                                {row.employee.firstName} {row.employee.lastName}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {row.employee.employeeId}
                              </div>
                            </td>
                            {calendarData.dates.map((dStr) => {
                              const dayItem = row.schedule[dStr];
                              if (!dayItem) {
                                return <td key={dStr} className="p-1 border-r border-slate-100 text-center text-slate-300">—</td>;
                              }

                              if (dayItem.isWeeklyOff) {
                                return (
                                  <td
                                    key={dStr}
                                    title={`Weekly Off: ${dStr}`}
                                    className="p-1 border-r border-slate-100 text-center bg-amber-50/40"
                                  >
                                    <span className="text-[9px] font-bold text-amber-800 px-1 py-0.5 rounded bg-amber-100/90 border border-amber-200">
                                      OFF
                                    </span>
                                  </td>
                                );
                              }

                              return (
                                <td
                                  key={dStr}
                                  title={`${dayItem.shiftName} (${dayItem.startTime} - ${dayItem.endTime})`}
                                  className="p-1 border-r border-slate-100 text-center"
                                >
                                  <span
                                    className={`text-[9px] font-bold px-1 py-0.5 rounded border block truncate ${
                                      dayItem.isNightShift
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                        : dayItem.isRotational
                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                    }`}
                                  >
                                    {dayItem.shiftCode || dayItem.shiftName.slice(0, 3).toUpperCase()}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={32} className="py-8 text-center text-slate-400">
                            No calendar roster entries found for {calendarPeriod}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUB-VIEW 2: SHIFT-WISE ATTENDANCE */}
          {calSubView === 'attendance' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold">Shift Attendance & Salary Integration:</span>
                  <p className="mt-0.5 text-blue-800 leading-relaxed">
                    Attendance timings and punch logs are evaluated directly against each employee's assigned shift timings.
                    Overtime hours and incomplete hours calculated here feed automatically into the <strong>Salary Module</strong> without duplicate calculations.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs min-w-[780px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4 whitespace-nowrap">Employee</th>
                        <th className="py-3 px-4 whitespace-nowrap">Assigned Shift</th>
                        <th className="py-3 px-4 whitespace-nowrap">Punch In & Out</th>
                        <th className="py-3 px-4 whitespace-nowrap">Late Arrival</th>
                        <th className="py-3 px-4 whitespace-nowrap">Working Hours</th>
                        <th className="py-3 px-4 whitespace-nowrap">Incomplete Hours</th>
                        <th className="py-3 px-4 whitespace-nowrap">Overtime Hours</th>
                        <th className="py-3 px-4 whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {attendanceData?.records && attendanceData.records.length > 0 ? (
                        attendanceData.records.map((rec) => {
                          const formatTime = (iso: string | null) => {
                            if (!iso) return '—';
                            try {
                              const d = new Date(iso);
                              return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            } catch {
                              return '—';
                            }
                          };

                          return (
                            <tr key={rec.employeeId} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-900">{rec.employeeName}</div>
                                <div className="text-[11px] text-slate-500 font-mono">
                                  {rec.employeeCode} • {rec.department}
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-800">{rec.shift.name}</div>
                                <div className="text-[11px] text-slate-500 font-mono">
                                  {rec.shift.startTime} – {rec.shift.endTime} ({rec.shift.expectedWorkingHours}h)
                                  {rec.isOvernight && <span className="ml-1 text-indigo-600 font-bold">(Overnight)</span>}
                                </div>
                              </td>

                              <td className="py-3 px-4 font-mono font-medium">
                                <div className="flex items-center gap-1.5">
                                  <span className={rec.checkIn ? 'text-slate-900' : 'text-slate-400'}>
                                    {formatTime(rec.checkIn)}
                                  </span>
                                  <span className="text-slate-400">→</span>
                                  <span className={rec.checkOut ? 'text-slate-900' : 'text-slate-400'}>
                                    {formatTime(rec.checkOut)}
                                  </span>
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                {rec.lateMinutes > 0 ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    {rec.lateMinutes}m Late
                                  </span>
                                ) : rec.checkIn ? (
                                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    On Time
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>

                              <td className="py-3 px-4 font-semibold text-slate-900">
                                {rec.workingHours} hrs
                              </td>

                              <td className="py-3 px-4">
                                {rec.incompleteHours > 0 ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    {rec.incompleteHours}h shortfall
                                  </span>
                                ) : (
                                  <span className="text-slate-400">0.0h</span>
                                )}
                              </td>

                              <td className="py-3 px-4">
                                {rec.overtimeHours > 0 ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    +{rec.overtimeHours}h OT
                                  </span>
                                ) : (
                                  <span className="text-slate-400">0.0h</span>
                                )}
                              </td>

                              <td className="py-3 px-4">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    rec.status === 'PRESENT'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : rec.status === 'LATE'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : rec.status === 'WEEK_OFF'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : rec.status === 'ON_LEAVE'
                                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}
                                >
                                  {rec.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400">
                            No shift attendance records found for {attendanceDate}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT SHIFT MODAL (Requirement 1) */}
      <Modal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        title={editingShift ? 'Edit Shift' : 'Create New Work Shift'}
        description="Configure shift timings, break duration, and weekly off rules."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveShift} className="space-y-4 text-xs">
          {shiftFormError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{shiftFormError}</div>
              <button
                type="button"
                onClick={() => setShiftFormError(null)}
                className="text-rose-400 hover:text-rose-600 p-0.5 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Shift Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Morning Shift, General Shift, Night Shift"
              value={shiftForm.name}
              onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Shift Code *</label>
            <input
              type="text"
              required
              placeholder="e.g. MOR, GEN, NIG"
              value={shiftForm.code}
              onChange={(e) => setShiftForm({ ...shiftForm, code: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono uppercase focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Start Time (HH:mm) *</label>
              <input
                type="time"
                required
                value={shiftForm.startTime}
                onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">End Time (HH:mm) *</label>
              <input
                type="time"
                required
                value={shiftForm.endTime}
                onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Overnight notification */}
          {isFormOvernight && (
            <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900 text-[11px] flex items-center gap-2">
              <Moon className="w-4 h-4 text-indigo-600 shrink-0" />
              <span><strong>Overnight Shift Detected:</strong> This shift crosses midnight into the next day. Attendance and punch outs will automatically handle next morning check-outs.</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Break Duration (Minutes)</label>
              <input
                type="number"
                min="0"
                max="240"
                value={shiftForm.breakMinutes}
                onChange={(e) => setShiftForm({ ...shiftForm, breakMinutes: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Deducted from gross duration</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Grace Period (Minutes)</label>
              <input
                type="number"
                min="0"
                max="60"
                value={shiftForm.gracePeriodMinutes}
                onChange={(e) => setShiftForm({ ...shiftForm, gracePeriodMinutes: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Late flag threshold</span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Weekly Off Day *</label>
            <select
              value={shiftForm.weeklyOff}
              onChange={(e) => setShiftForm({ ...shiftForm, weeklyOff: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-brand-500"
            >
              {daysOfWeek.map((day) => (
                <option key={day} value={day}>{day}</option>
              ))}
              <option value="SATURDAY,SUNDAY">SATURDAY & SUNDAY (5-day week)</option>
              <option value="FRIDAY">FRIDAY</option>
            </select>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">Calculated Net Daily Working Hours:</span>
            <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
              {formCalculatedHours} Hours
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefaultShift"
              checked={shiftForm.isDefault}
              onChange={(e) => setShiftForm({ ...shiftForm, isDefault: e.target.checked })}
              className="rounded text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="isDefaultShift" className="text-xs text-slate-700 font-medium">
              Set as Default Shift for new employees
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsShiftModalOpen(false)}
              className="px-3.5 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={shiftSubmitting}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow-xs flex items-center gap-1.5"
            >
              {shiftSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{editingShift ? 'Save Changes' : 'Create Shift'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ASSIGN SHIFT & ROTATION MODAL (Requirements 2 & 3) */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Shift to Employees"
        description="Assign a fixed or rotational shift schedule to single or multiple staff members."
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveAssignment} className="space-y-4 text-xs">
          {assignFormError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{assignFormError}</div>
              <button
                type="button"
                onClick={() => setAssignFormError(null)}
                className="text-rose-400 hover:text-rose-600 p-0.5 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Employee multi-selection */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">Select Employee(s) *</label>
              <span className="text-[11px] text-brand-700 font-medium">
                {assignForm.selectedEmployeeIds.length} selected
              </span>
            </div>

            <div className="border border-slate-200 rounded-lg p-2 max-h-40 overflow-y-auto space-y-1 bg-slate-50/50">
              {employees.length === 0 ? (
                <div className="text-slate-400 text-center py-2">No active employees found.</div>
              ) : (
                employees.map((emp) => {
                  const isChecked = assignForm.selectedEmployeeIds.includes(emp.id);
                  return (
                    <label
                      key={emp.id}
                      className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
                        isChecked ? 'bg-brand-50 text-brand-900 font-medium' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAssignForm({
                              ...assignForm,
                              selectedEmployeeIds: [...assignForm.selectedEmployeeIds, emp.id]
                            });
                          } else {
                            setAssignForm({
                              ...assignForm,
                              selectedEmployeeIds: assignForm.selectedEmployeeIds.filter(id => id !== emp.id)
                            });
                          }
                        }}
                        className="rounded text-brand-600 focus:ring-brand-500"
                      />
                      <span className="truncate flex-1">{emp.firstName} {emp.lastName}</span>
                      <span className="font-mono text-[10px] text-slate-400">{emp.employeeId}</span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-end gap-2 mt-1">
              <button
                type="button"
                onClick={() => setAssignForm({ ...assignForm, selectedEmployeeIds: employees.map(e => e.id) })}
                className="text-[10px] text-brand-600 hover:underline font-semibold"
              >
                Select All
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={() => setAssignForm({ ...assignForm, selectedEmployeeIds: [] })}
                className="text-[10px] text-slate-500 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Primary Shift */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Primary Shift *</label>
            <select
              required
              value={assignForm.shiftId}
              onChange={(e) => setAssignForm({ ...assignForm, shiftId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-brand-500"
            >
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.startTime} – {s.endTime}) [{s.code}]
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Assignment Start Date *</label>
              <input
                type="date"
                required
                value={assignForm.startDate}
                onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">End Date (Optional)</label>
              <input
                type="date"
                value={assignForm.endDate}
                onChange={(e) => setAssignForm({ ...assignForm, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* ROTATIONAL SHIFT SECTION (Requirement 3) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-purple-600" />
                <span className="font-bold text-slate-800">Rotational Shifts</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignForm.isRotational}
                  onChange={(e) => setAssignForm({ ...assignForm, isRotational: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
              </label>
            </div>

            {assignForm.isRotational && (
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Rotation Frequency *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAssignForm({ ...assignForm, rotationFrequency: 'WEEKLY' })}
                      className={`py-1.5 px-3 rounded-lg border text-xs font-semibold transition-all ${
                        assignForm.rotationFrequency === 'WEEKLY'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Weekly Rotation
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignForm({ ...assignForm, rotationFrequency: 'MONTHLY' })}
                      className={`py-1.5 px-3 rounded-lg border text-xs font-semibold transition-all ${
                        assignForm.rotationFrequency === 'MONTHLY'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Monthly Rotation
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Select Shifts in Rotation Cycle (in order):
                  </label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto bg-white p-2 border border-slate-200 rounded-lg">
                    {shifts.map((s) => {
                      const isSelected = assignForm.rotationShiftIds.includes(s.id);
                      const orderIndex = assignForm.rotationShiftIds.indexOf(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            if (isSelected) {
                              setAssignForm({
                                ...assignForm,
                                rotationShiftIds: assignForm.rotationShiftIds.filter(id => id !== s.id)
                              });
                            } else {
                              setAssignForm({
                                ...assignForm,
                                rotationShiftIds: [...assignForm.rotationShiftIds, s.id]
                              });
                            }
                          }}
                          className={`flex items-center justify-between p-1.5 rounded cursor-pointer border text-xs transition-colors ${
                            isSelected
                              ? 'bg-purple-50 border-purple-300 text-purple-900 font-semibold'
                              : 'border-slate-100 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] bg-slate-200 px-1 rounded">{s.code}</span>
                            <span>{s.name} ({s.startTime}–{s.endTime})</span>
                          </div>
                          {isSelected && (
                            <span className="text-[10px] font-bold bg-purple-600 text-white px-2 py-0.5 rounded-full">
                              Step {orderIndex + 1}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-purple-700 mt-1">
                    Automatic schedule will rotate through selected shifts every {assignForm.rotationFrequency.toLowerCase()}.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Notes / Instructions</label>
            <input
              type="text"
              placeholder="e.g. Q4 shift allocation"
              value={assignForm.notes}
              onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(false)}
              className="px-3.5 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={assignSubmitting}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow-xs flex items-center gap-1.5"
            >
              {assignSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Assign Shift</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ShiftPage;
