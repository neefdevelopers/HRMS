import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { Building2, AlertCircle, LogOut } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { user, isHr, logout } = useAuth();
  const { companies, loading } = useCompany();

  const isUnassignedHr = isHr && !loading && companies.length === 0;

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {isUnassignedHr ? (
            <div className="max-w-2xl mx-auto my-12 bg-white rounded-2xl border border-amber-200/80 shadow-sm p-8 text-center animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-5 text-amber-600 shadow-sm">
                <Building2 className="w-8 h-8" />
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100/80 text-amber-800 mb-3">
                <AlertCircle className="w-3.5 h-3.5" />
                No Company Assigned
              </span>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
                Account Pending Company Assignment
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed max-w-lg mx-auto mb-6">
                Hello <span className="font-semibold text-slate-900">{user?.firstName} {user?.lastName}</span>, your HR account is active and verified, but you have not yet been assigned to any tenant companies on the platform.
              </p>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-left text-xs text-slate-600 space-y-2 mb-6 max-w-md mx-auto">
                <p className="font-semibold text-slate-800">What to do next:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>Contact your system <strong>Admin</strong> to grant you access to your assigned company workspace.</li>
                  <li>Once an Admin assigns you to one or more companies, your workspace will activate immediately.</li>
                </ul>
              </div>
              <button
                onClick={logout}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
};
