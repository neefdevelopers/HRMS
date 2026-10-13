import React, { useState } from 'react';
import { Card } from '../components/common/Card';
import { useBrand } from '../context/BrandContext';
import { Download, FileText, Calendar, Filter } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { selectedBrandId } = useBrand();

  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const handleDownloadCSV = () => {
    const token = localStorage.getItem('hrms_token');
    const brandParam = selectedBrandId !== 'all' ? `&brandId=${selectedBrandId}` : '';
    const url = `/api/reports/attendance?startDate=${startDate}&endDate=${endDate}${brandParam}&format=csv`;

    // Download via link
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `attendance_report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Reports & Compliance</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Generate and export consolidated workforce attendance and leave reports in CSV format.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Attendance Report Card */}
        <Card
          title="Attendance & Punctuality Report"
          subtitle="Detailed employee check-in, check-out, working hours, and late penalties"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-xs text-slate-600">
              <p className="font-semibold text-slate-800 mb-1">Export includes columns:</p>
              <p className="text-[11px] text-slate-500">
                Date, Employee ID, Full Name, Brand, Branch, Department, Designation, Shift, Status, Check-In, Check-Out, Total Working Hours, Late Minutes.
              </p>
            </div>

            <button
              onClick={handleDownloadCSV}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" /> Download Attendance CSV Export
            </button>
          </div>
        </Card>

        {/* Sync & Audit Logs Card */}
        <Card
          title="Hardware Synchronization Logs"
          subtitle="Audit trail of automated and manual biometric device poll events"
        >
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/80 text-xs text-slate-600 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="font-semibold text-slate-800">Biometric Gateway API:</span>
              <span className="text-emerald-700 font-medium">Online (Mock/Hardware)</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="font-semibold text-slate-800">Deduplication Rule:</span>
              <span className="text-slate-600">60-second duplicate punch skip</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">Attendance Auto-Compute:</span>
              <span className="text-slate-600">Grace period & shift thresholds</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
