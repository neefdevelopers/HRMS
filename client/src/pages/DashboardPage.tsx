import React, { useState, useEffect } from 'react';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  CalendarOff,
  UserPlus,
  ClipboardList,
  Banknote,
  RotateCw,
  Cpu,
  Calendar as CalendarIcon,
  Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { DashboardMetrics, Department } from '../types';
import { KPICard } from '../components/dashboard/KPICard';
import { AttendanceChart } from '../components/dashboard/AttendanceChart';
import { BrandDistributionChart } from '../components/dashboard/BrandDistributionChart';
import { AttendanceTable } from '../components/dashboard/AttendanceTable';
import { RecentJoinersList } from '../components/dashboard/RecentJoinersList';
import { PayrollSummaryCard } from '../components/dashboard/PayrollSummaryCard';
import { KPISkeleton } from '../components/common/Skeleton';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedBrandId, setSelectedBrandId } = useBrand();
  const { user, canManageAttendance } = useAuth();

  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [departmentId, setDepartmentId] = useState<string>('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const loadDepartments = async () => {
    try {
      const data = await api.getDepartments(selectedBrandId);
      setDepartments(data);
    } catch (err) {
      console.error('Failed to load departments', err);
    }
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await api.getDashboardMetrics({
        date,
        brandId: selectedBrandId,
        departmentId: departmentId || undefined
      });
      setMetrics(data);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, [selectedBrandId]);

  useEffect(() => {
    loadDashboard();
  }, [date, selectedBrandId, departmentId]);

  const handleSyncPunches = async () => {
    try {
      setSyncing(true);
      const res = await api.syncPunches('MANUAL');
      alert(`Hardware Biometric Sync Complete!\n${res.totalFetched} records processed, ${res.inserted} new punches registered.`);
      loadDashboard();
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleResetFilters = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setDepartmentId('');
    if (user?.role === 'SUPER_ADMIN' || user?.role === 'GROUP_HR') {
      setSelectedBrandId('all');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header and Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Overview of your workforce and daily HR operations.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
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

          {/* Department Filter */}
          {departments.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reset Filters */}
          <button
            onClick={handleResetFilters}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Reset
          </button>

          {/* Refresh Action */}
          <button
            onClick={loadDashboard}
            title="Refresh dashboard metrics"
            className="p-2 text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Biometric Sync Action */}
          {canManageAttendance && (
            <button
              onClick={handleSyncPunches}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
            >
              <Cpu className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : 'text-emerald-400'}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Punches'}</span>
            </button>
          )}

          {/* Timestamp */}
          {lastUpdated && (
            <span className="text-[11px] text-slate-400 hidden xl:inline">
              Updated: {lastUpdated}
            </span>
          )}
        </div>
      </div>

      {/* 2. Key Performance Indicator Cards (Responsive 3x3 Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && !metrics ? (
          Array.from({ length: 9 }).map((_, i) => <KPISkeleton key={i} />)
        ) : (
          <>
            {/* Total Employees */}
            <KPICard
              title="Total Employees"
              value={metrics?.kpis.totalEmployees ?? 0}
              subtitle="Active workforce on payroll"
              icon={Users}
              onClick={() => navigate('/employees')}
              accentColor="bg-blue-50 text-blue-600"
            />

            {/* Present Today */}
            <KPICard
              title="Present Today"
              value={metrics?.kpis.presentToday.count ?? 0}
              subtitle={`${metrics?.kpis.presentToday.percentage ?? 0}% workforce active`}
              badge={{
                text: `${metrics?.kpis.presentToday.percentage ?? 0}%`,
                variant: 'success'
              }}
              icon={CheckCircle2}
              accentColor="bg-emerald-50 text-emerald-600"
            />

            {/* Absent Today */}
            <KPICard
              title="Absent Today"
              value={metrics?.kpis.absentToday.count ?? 0}
              subtitle="Excluding approved leave"
              badge={{
                text: `${metrics?.kpis.absentToday.percentage ?? 0}%`,
                variant: 'danger'
              }}
              icon={XCircle}
              accentColor="bg-rose-50 text-rose-600"
            />

            {/* Late Employees */}
            <KPICard
              title="Late Employees"
              value={metrics?.kpis.lateEmployees.count ?? 0}
              subtitle="Exceeded shift grace window"
              badge={{
                text: 'Grace exceeded',
                variant: 'warning'
              }}
              icon={Clock}
              accentColor="bg-amber-50 text-amber-600"
            />

            {/* Employees on Leave */}
            <KPICard
              title="Employees on Leave"
              value={metrics?.kpis.employeesOnLeave.count ?? 0}
              subtitle="Approved leave records"
              badge={{
                text: 'Approved',
                variant: 'info'
              }}
              icon={CalendarOff}
              onClick={() => navigate('/leave')}
              accentColor="bg-blue-50 text-blue-600"
            />

            {/* New Joiners */}
            <KPICard
              title="New Joiners"
              value={metrics?.kpis.newJoinersCount ?? 0}
              subtitle="Joined in current month"
              icon={UserPlus}
              onClick={() => navigate('/employees')}
              accentColor="bg-purple-50 text-purple-600"
            />

            {/* Pending Approvals */}
            <KPICard
              title="Pending Approvals"
              value={metrics?.kpis.pendingApprovalsCount ?? 0}
              subtitle="Leaves & regularizations"
              badge={{
                text: 'Action Required',
                variant: 'warning'
              }}
              icon={ClipboardList}
              onClick={() => navigate('/leave')}
              accentColor="bg-amber-50 text-amber-600"
            />

            {/* Brand Distribution summary */}
            <KPICard
              title="Active Brands"
              value={metrics?.brandDistribution.length ?? 0}
              subtitle="Operating brand divisions"
              icon={Layers}
              onClick={() => navigate('/brands')}
              accentColor="bg-slate-100 text-slate-700"
            />

            {/* Payroll Status */}
            <KPICard
              title="Payroll Status"
              value={metrics?.payrollSummary?.status ?? 'UNCONFIGURED'}
              subtitle={metrics?.payrollSummary?.period || 'Current month'}
              badge={{
                text: metrics?.payrollSummary?.status ? 'Configured' : 'Pending',
                variant: metrics?.payrollSummary?.status === 'FINALIZED' ? 'success' : 'neutral'
              }}
              icon={Banknote}
              accentColor="bg-emerald-50 text-emerald-600"
            />
          </>
        )}
      </div>

      {/* 3. Dedicated Attendance Overview & Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {metrics && (
            <AttendanceChart
              distribution={metrics.attendanceDistribution}
              trend={metrics.attendanceTrend}
            />
          )}
        </div>

        <div>
          {metrics && (
            <BrandDistributionChart
              distribution={metrics.brandDistribution}
              selectedBrandId={selectedBrandId}
              onSelectBrand={(id) => setSelectedBrandId(id)}
            />
          )}
        </div>
      </div>

      {/* 4. Attendance Details Table */}
      <AttendanceTable
        selectedDate={date}
        selectedBrandId={selectedBrandId}
        onRefreshParent={loadDashboard}
      />

      {/* 5. Additional Operational Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RecentJoinersList joiners={metrics?.newJoiners || []} />
        <PayrollSummaryCard payroll={metrics?.payrollSummary} />
      </div>
    </div>
  );
};
