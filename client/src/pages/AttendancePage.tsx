import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Badge, BadgeVariant } from '../components/common/Badge';
import { api } from '../services/api';
import { Attendance, AttendanceStatus } from '../types';
import { useBrand } from '../context/BrandContext';
import { useCompany } from '../context/CompanyContext';
import { useAuth } from '../context/AuthContext';
import { Cpu, RotateCw, Calendar as CalendarIcon, Clock, Search, Filter, CalendarCheck } from 'lucide-react';
import { AttendanceTable } from '../components/dashboard/AttendanceTable';
import { DailyLeavesSummary } from '../components/dashboard/DailyLeavesSummary';

export const AttendancePage: React.FC = () => {
  const { activeCompanyId } = useCompany();
  const { selectedBrandId } = useBrand();
  const { canManageAttendance } = useAuth();

  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'attendance' | 'leaves' | 'rawPunches'>('attendance');
  const [rawPunches, setRawPunches] = useState<any[]>([]);
  const [loadingPunches, setLoadingPunches] = useState(false);
  const [leaveSummaryCount, setLeaveSummaryCount] = useState<{ approved: number; pending: number }>({
    approved: 0,
    pending: 0
  });

  const loadLeaveCounts = async () => {
    try {
      const res = await api.getDailyLeaves({
        date,
        brandId: selectedBrandId !== 'all' ? selectedBrandId : undefined
      });
      setLeaveSummaryCount({
        approved: res.summary.totalApproved,
        pending: res.summary.totalPending
      });
    } catch {
      // Non-blocking background fetch
    }
  };

  useEffect(() => {
    loadLeaveCounts();
    const handleRefresh = () => {
      loadLeaveCounts();
      if (activeTab === 'rawPunches') loadRawPunches();
    };
    window.addEventListener('hrms:company-changed', handleRefresh);
    window.addEventListener('hrms:brand-changed', handleRefresh);
    return () => {
      window.removeEventListener('hrms:company-changed', handleRefresh);
      window.removeEventListener('hrms:brand-changed', handleRefresh);
    };
  }, [activeCompanyId, date, selectedBrandId]);

  const loadRawPunches = async () => {
    try {
      setLoadingPunches(true);
      const res = await api.getPunches({
        brandId: selectedBrandId !== 'all' ? selectedBrandId : undefined
      });
      setRawPunches(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPunches(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'rawPunches') {
      loadRawPunches();
    }
  }, [activeTab, activeCompanyId, selectedBrandId]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await api.syncPunches('MANUAL');
      alert(`Biometric Synchronization Succeeded!\n• Fetched: ${res.totalFetched}\n• Inserted: ${res.inserted}\n• Skipped Duplicates: ${res.duplicatesSkipped}`);
      if (activeTab === 'rawPunches') loadRawPunches();
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Attendance &amp; Biometrics</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Daily attendance records, biometric punch registry, and authorized employee leaves
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs">
            <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer"
            />
          </div>

          {canManageAttendance && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
            >
              <Cpu className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : 'text-emerald-400'}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Hardware Punches'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'attendance'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Daily Attendance Records
        </button>

        <button
          onClick={() => setActiveTab('leaves')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'leaves'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarCheck className="w-3.5 h-3.5" />
          <span>Employees on Leave</span>
          {leaveSummaryCount.approved > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              {leaveSummaryCount.approved}
            </span>
          )}
          {leaveSummaryCount.pending > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800" title="Pending HR approval">
              {leaveSummaryCount.pending} pending
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('rawPunches')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'rawPunches'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Raw Biometric Punches Audit
        </button>
      </div>

      {activeTab === 'attendance' ? (
        <AttendanceTable selectedDate={date} selectedBrandId={selectedBrandId} />
      ) : activeTab === 'leaves' ? (
        <DailyLeavesSummary selectedDate={date} selectedBrandId={selectedBrandId} />
      ) : (
        <Card
          title="Raw Biometric Punch Registry"
          action={
            <button
              onClick={loadRawPunches}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <RotateCw className={`w-4 h-4 ${loadingPunches ? 'animate-spin' : ''}`} />
            </button>
          }
        >
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3">Biometric Device ID</th>
                  <th className="px-3 py-3">Employee Name</th>
                  <th className="px-3 py-3">Punch Timestamp</th>
                  <th className="px-3 py-3">Punch Type</th>
                  <th className="px-3 py-3">Verification</th>
                  <th className="px-3 py-3">Device Serial</th>
                  <th className="px-3 py-3">Sync Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loadingPunches ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      Loading raw biometric punch records...
                    </td>
                  </tr>
                ) : rawPunches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No punch records found. Click 'Sync Hardware Punches' to fetch data.
                    </td>
                  </tr>
                ) : (
                  rawPunches.map((punch: any) => (
                    <tr key={punch.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                        {punch.biometricId}
                      </td>
                      <td className="px-3 py-3 font-medium">
                        {punch.employee
                          ? `${punch.employee.firstName} ${punch.employee.lastName} (${punch.employee.employeeId})`
                          : 'Unmapped Device ID'}
                      </td>
                      <td className="px-3 py-3 font-mono text-slate-600">
                        {new Date(punch.punchTime).toLocaleString()}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="neutral">{punch.punchType}</Badge>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{punch.verificationType}</td>
                      <td className="px-3 py-3 font-mono text-slate-500">
                        {punch.device?.serialNumber || 'GATE-01'}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="success">SYNCED</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
