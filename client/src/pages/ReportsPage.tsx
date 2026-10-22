import React, { useState } from 'react';
import { Card } from '../components/common/Card';
import { useBrand } from '../context/BrandContext';
import { useCompany } from '../context/CompanyContext';
import { Download, FileText, Calendar, Filter, Building2, Building } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { selectedBrandId, selectedBrand } = useBrand();
  const { activeCompanyId, activeCompany } = useCompany();

  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadCSV = async () => {
    try {
      setDownloading(true);
      const token = localStorage.getItem('hrms_token');
      const brandParam = selectedBrandId !== 'all' ? `&brandId=${selectedBrandId}` : '';
      const companyParam = (activeCompanyId && activeCompanyId !== 'all') ? `&companyId=${activeCompanyId}` : '';
      const url = `/api/reports/attendance?startDate=${startDate}&endDate=${endDate}${brandParam}${companyParam}&format=csv`;

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (activeCompanyId && activeCompanyId !== 'all') headers['X-Company-Id'] = activeCompanyId;
      if (selectedBrandId && selectedBrandId !== 'all') headers['X-Brand-Id'] = selectedBrandId;

      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error('Failed to download report');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.setAttribute('download', `attendance_report_${startDate}_to_${endDate}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      alert(err.message || 'Report download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Reports & Compliance</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Export company and brand-specific audit spreadsheets
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            {activeCompany?.name || 'All Companies'}
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5" />
            {selectedBrand?.name || 'All Brands'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
        {/* Attendance Report Card */}
        <Card
          title="Attendance & Punctuality Report"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                Date, Employee ID, Full Name, Brand, Department, Designation, Shift, Status, Check-In, Check-Out, Total Working Hours, Late Minutes.
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
