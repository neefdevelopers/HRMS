import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Modal } from '../components/common/Modal';
import { api } from '../services/api';
import { LeaveRequest, LeaveType, Employee } from '../types';
import { useBrand } from '../context/BrandContext';
import { useCompany } from '../context/CompanyContext';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Calendar, RefreshCw, CalendarDays, Users, CheckCircle2, AlertCircle, X, Loader2, ArrowRight } from 'lucide-react';

export const LeavePage: React.FC = () => {
  const { activeCompanyId } = useCompany();
  const { selectedBrandId } = useBrand();
  const { user } = useAuth();

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [leaveFormError, setLeaveFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    employeeId: user?.employeeId || '',
    leaveTypeId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: ''
  });

  const canManageLeaves = user?.role === 'ADMIN' || user?.role === 'HR';

  const loadData = async () => {
    try {
      setLoading(true);
      const [reqs, types, emps] = await Promise.all([
        api.getLeaveRequests(selectedBrandId),
        api.getLeaveTypes(selectedBrandId),
        api.getEmployees({ brandId: selectedBrandId })
      ]);
      setRequests(reqs);
      setLeaveTypes(types);
      setEmployees(emps);

      if (types.length > 0 && !formData.leaveTypeId) {
        setFormData(prev => ({ ...prev, leaveTypeId: types[0].id }));
      }
      if (emps.length > 0 && !formData.employeeId && !user?.employeeId) {
        setFormData(prev => ({ ...prev, employeeId: emps[0].id }));
      }
    } catch (err) {
      console.error('Failed to load leave data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleRefresh = () => {
      loadData();
    };
    window.addEventListener('hrms:company-changed', handleRefresh);
    window.addEventListener('hrms:brand-changed', handleRefresh);
    return () => {
      window.removeEventListener('hrms:company-changed', handleRefresh);
      window.removeEventListener('hrms:brand-changed', handleRefresh);
    };
  }, [activeCompanyId, selectedBrandId]);

  const handleAddLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeaveFormError(null);
    const targetEmpId = formData.employeeId || user?.employeeId || employees[0]?.id;
    if (!targetEmpId) {
      setLeaveFormError('Please select an employee.');
      return;
    }
    if (!formData.leaveTypeId) {
      setLeaveFormError('Please select a leave type.');
      return;
    }

    setSubmitting(true);
    try {
      await api.addLeave({
        employeeId: targetEmpId,
        leaveTypeId: formData.leaveTypeId,
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason
      });

      setIsModalOpen(false);
      setFormData({
        employeeId: user?.employeeId || employees[0]?.id || '',
        leaveTypeId: leaveTypes[0]?.id || '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        reason: ''
      });
      loadData();
    } catch (err: any) {
      setLeaveFormError(err.message || 'Failed to add leave');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLeave = async (id: string, empName: string) => {
    if (!window.confirm(`Are you sure you want to remove the leave record for ${empName}?`)) {
      return;
    }
    try {
      setProcessingId(id);
      await api.deleteLeave(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete leave record');
    } finally {
      setProcessingId(null);
    }
  };

  const calculateDays = (start: string, end: string) => {
    try {
      const d1 = new Date(start);
      const d2 = new Date(end);
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
      return diffDays === 1 ? '1 day' : `${diffDays} days`;
    } catch {
      return '1 day';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Employee Leaves</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors"
            title="Refresh leaves"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : 'text-slate-500'}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              setLeaveFormError(null);
              if (employees.length > 0 && !formData.employeeId) {
                setFormData(prev => ({ ...prev, employeeId: employees[0].id }));
              }
              if (leaveTypes.length > 0 && !formData.leaveTypeId) {
                setFormData(prev => ({ ...prev, leaveTypeId: leaveTypes[0].id }));
              }
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Leave
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Recorded Leaves
            </span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              {requests.length}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Active leave records
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600">
            <CalendarDays className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Leave Policies
            </span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              {leaveTypes.length}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              {leaveTypes.map(lt => lt.code).join(', ') || 'Standard policies'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Employees
            </span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              {employees.length}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Eligible workforce
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Recorded Leaves Table */}
      <Card title="Recorded Leaves">
        {/* Desktop / Tablet Table View */}
        <div className="hidden sm:block overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Employee</th>
                <th className="px-3 py-3 whitespace-nowrap">Leave Type &amp; Applied Date</th>
                <th className="px-3 py-3 whitespace-nowrap">Duration &amp; Schedule</th>
                <th className="px-3 py-3">Reason / Details</th>
                {canManageLeaves && <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={canManageLeaves ? 5 : 4} className="px-4 py-8 text-center text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin inline-block mr-1.5 text-slate-400" />
                    Loading leave records...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={canManageLeaves ? 5 : 4} className="px-4 py-8 text-center text-slate-400">
                    No leave records found. Click "+ Add Leave" to record a leave.
                  </td>
                </tr>
              ) : (
                requests.map((req) => {
                  const empFullName = `${req.employee?.firstName || ''} ${req.employee?.lastName || ''}`.trim() || 'Employee';
                  const initials = `${req.employee?.firstName?.[0] || ''}${req.employee?.lastName?.[0] || ''}`.toUpperCase() || 'E';
                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 min-w-[180px]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">
                              {empFullName}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono truncate">
                              {req.employee?.employeeId} • {req.employee?.department?.name || req.employee?.brand?.name || 'Staff'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-brand-50 text-brand-700 border border-brand-200">
                          {req.leaveType?.name || 'Leave'}
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Applied: {new Date(req.appliedAt).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="px-3 py-3 font-mono text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium">
                          <span>{req.startDate}</span>
                          <ArrowRight className="w-3 h-3 text-slate-300" />
                          <span>{req.endDate}</span>
                        </div>
                        <div className="mt-0.5">
                          <span className="text-[10px] font-sans font-semibold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            {calculateDays(req.startDate, req.endDate)}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-3 text-slate-600 max-w-sm truncate" title={req.reason}>
                        {req.reason || <span className="text-slate-400 italic">No notes provided</span>}
                      </td>

                      {canManageLeaves && (
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            disabled={processingId === req.id}
                            onClick={() => handleDeleteLeave(req.id, empFullName)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-md border border-rose-200 transition-colors disabled:opacity-50 shadow-2xs"
                            title="Delete leave record"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
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
              Loading leave records...
            </div>
          ) : requests.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
              No leave records found.
            </div>
          ) : (
            requests.map((req) => {
              const empFullName = `${req.employee?.firstName || ''} ${req.employee?.lastName || ''}`.trim() || 'Employee';
              const initials = `${req.employee?.firstName?.[0] || ''}${req.employee?.lastName?.[0] || ''}`.toUpperCase() || 'E';
              return (
                <div
                  key={req.id}
                  className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          {empFullName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {req.employee?.employeeId} • {req.employee?.department?.name || 'Staff'}
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-brand-50 text-brand-700 border border-brand-200 whitespace-nowrap">
                      {req.leaveType?.name || 'Leave'}
                    </span>
                  </div>

                  <div className="p-2 bg-slate-50 rounded-lg flex items-center justify-between text-[11px] font-mono">
                    <span>{req.startDate} → {req.endDate}</span>
                    <span className="font-sans font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 text-[10px]">
                      {calculateDays(req.startDate, req.endDate)}
                    </span>
                  </div>

                  {req.reason && (
                    <p className="text-[11px] text-slate-600 line-clamp-2">
                      {req.reason}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                    <span className="text-[10px] text-slate-400 font-mono">
                      Applied: {new Date(req.appliedAt).toLocaleDateString()}
                    </span>
                    {canManageLeaves && (
                      <button
                        disabled={processingId === req.id}
                        onClick={() => handleDeleteLeave(req.id, empFullName)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md border border-rose-200"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Add Leave Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Leave"
        description="Record an employee leave directly with information."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAddLeave} className="space-y-4">
          {leaveFormError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{leaveFormError}</div>
              <button
                type="button"
                onClick={() => setLeaveFormError(null)}
                className="text-rose-400 hover:text-rose-600 p-0.5 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Employee *</label>
            <select
              required
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
            >
              <option value="" disabled>Select an employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.employeeId}) • {emp.department?.name || 'General'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Leave Type *</label>
            <select
              required
              value={formData.leaveTypeId}
              onChange={(e) => setFormData({ ...formData, leaveTypeId: e.target.value })}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {leaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date *</label>
              <input
                required
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">End Date *</label>
              <input
                required
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 flex items-center justify-between">
            <span>Calculated Duration:</span>
            <span className="font-semibold text-slate-900">
              {calculateDays(formData.startDate, formData.endDate)}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Info *</label>
            <textarea
              required
              rows={3}
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="e.g. Annual vacation, medical appointment, or personal leave"
              className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Add Leave</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
