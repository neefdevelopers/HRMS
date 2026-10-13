import React, { useState } from 'react';
import { Card } from '../common/Card';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';

interface AttendanceChartProps {
  distribution: {
    present: number;
    absent: number;
    late: number;
    onLeave: number;
    halfDay: number;
  };
  trend: Array<{
    date: string;
    day: string;
    present: number;
    absent: number;
    late: number;
    onLeave: number;
  }>;
}

export const AttendanceChart: React.FC<AttendanceChartProps> = ({ distribution, trend }) => {
  const [viewMode, setViewMode] = useState<'trend' | 'distribution'>('trend');

  const distributionData = [
    { name: 'Present', count: distribution.present, fill: '#10b981' }, // green
    { name: 'Late', count: distribution.late, fill: '#f59e0b' },       // amber
    { name: 'On Leave', count: distribution.onLeave, fill: '#3b82f6' }, // blue
    { name: 'Absent', count: distribution.absent, fill: '#ef4444' },    // red
    { name: 'Half Day', count: distribution.halfDay, fill: '#8b5cf6' }  // purple
  ];

  return (
    <Card
      title="Attendance Overview & Trends"
      subtitle="Workforce presence, punctuality, and weekly trajectory"
      action={
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            onClick={() => setViewMode('trend')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
              viewMode === 'trend'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            7-Day Trend
          </button>
          <button
            onClick={() => setViewMode('distribution')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
              viewMode === 'distribution'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Status Breakdown
          </button>
        </div>
      }
    >
      <div className="h-64 w-full">
        {viewMode === 'trend' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  fontSize: '12px'
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                iconType="circle"
              />
              <Bar dataKey="present" name="Present" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="late" name="Late Arrivals" fill="#f59e0b" radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="onLeave" name="On Leave" fill="#3b82f6" radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={distributionData}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#334155', fontSize: 12, fontWeight: 500 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="count" name="Employees" radius={[0, 4, 4, 0]}>
                {distributionData.map((entry, index) => (
                  <Bar key={`cell-${index}`} dataKey="count" fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Summary indicators */}
      <div className="grid grid-cols-5 gap-2 mt-4 pt-4 border-t border-slate-100 text-center">
        <div>
          <span className="block text-[10px] uppercase font-semibold text-slate-400">Present</span>
          <span className="text-sm font-bold text-emerald-600">{distribution.present}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-semibold text-slate-400">Late</span>
          <span className="text-sm font-bold text-amber-600">{distribution.late}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-semibold text-slate-400">Leave</span>
          <span className="text-sm font-bold text-blue-600">{distribution.onLeave}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-semibold text-slate-400">Absent</span>
          <span className="text-sm font-bold text-rose-600">{distribution.absent}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-semibold text-slate-400">Half Day</span>
          <span className="text-sm font-bold text-purple-600">{distribution.halfDay}</span>
        </div>
      </div>
    </Card>
  );
};
