import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarRange,
  CalendarCheck2,
  Building,
  Building2,
  FileBarChart2,
  Banknote,
  Cpu,
  Laptop,
  Settings,
  LogOut,
  Bell
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { user, isSuperAdmin } = useAuth();
  const isSuperAdminOrCompanyHr =
    isSuperAdmin ||
    user?.role === 'COMPANY_ADMIN' ||
    user?.role === 'COMPANY_HR' ||
    user?.role === 'GROUP_HR';

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    ...(isSuperAdmin ? [{ label: 'Companies (SaaS)', path: '/companies', icon: Building2 }] : []),
    { label: 'Employees', path: '/employees', icon: Users },
    { label: 'Attendance & Punching', path: '/attendance', icon: Clock },
    { label: 'Shift Management', path: '/shifts', icon: CalendarRange },
    { label: 'Leaves & Approvals', path: '/leave', icon: CalendarCheck2 },
    { label: 'Salary Module', path: '/salary', icon: Banknote },
    { label: 'Assets', path: '/assets', icon: Laptop },
    { label: 'Exit Management', path: '/exit', icon: LogOut },
    { label: 'Notifications', path: '/notifications', icon: Bell },
    { label: 'Brands & Branches', path: '/brands', icon: Building },
    { label: 'Reports', path: '/reports', icon: FileBarChart2 },
    ...(isSuperAdminOrCompanyHr ? [{ label: 'System Settings', path: '/settings', icon: Settings }] : [])
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200/90 flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="h-16 px-6 border-b border-slate-200/80 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
          H
        </div>
        <div>
          <span className="text-sm font-bold text-slate-900 tracking-tight block">HRMS Enterprise</span>
          <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">Multi-Brand MVP</span>
        </div>
      </div>

      {/* Nav links */}
      <nav className="p-4 space-y-1 flex-1">
        <p className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Main Modules
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-100 text-brand-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Biometric Integration badge */}
      <div className="p-4 border-t border-slate-100 m-3 bg-slate-50 rounded-lg border">
        <div className="flex items-center gap-2 mb-1.5">
          <Cpu className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-semibold text-slate-800">Biometric Sync</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-snug">
          Real-time hardware punch synchronization active.
        </p>
      </div>
    </aside>
  );
};
