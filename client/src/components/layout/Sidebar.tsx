import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCheck,
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

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onMobileClose }) => {
  const { user, isAdmin, isAttendanceViewer } = useAuth();

  const navItems = isAttendanceViewer
    ? [{ label: 'Attendance', path: '/attendance', icon: Clock }]
    : [
        { label: 'Dashboard', path: '/', icon: LayoutDashboard },
        ...(isAdmin
          ? [
              { label: 'Companies (SaaS)', path: '/companies', icon: Building2 },
              { label: 'HR Management', path: '/hr-management', icon: UserCheck }
            ]
          : []),
        { label: 'Employees', path: '/employees', icon: Users },
        { label: 'Attendance & Punching', path: '/attendance', icon: Clock },
        { label: 'Shift Management', path: '/shifts', icon: CalendarRange },
        { label: 'Leaves & Approvals', path: '/leave', icon: CalendarCheck2 },
        { label: 'Salary Module', path: '/salary', icon: Banknote },
        { label: 'Assets', path: '/assets', icon: Laptop },
        { label: 'Exit Management', path: '/exit', icon: LogOut },
        { label: 'Notifications', path: '/notifications', icon: Bell },
        { label: 'Brands', path: '/brands', icon: Building },
        { label: 'Reports', path: '/reports', icon: FileBarChart2 },
        { label: 'System Settings', path: '/settings', icon: Settings }
      ];

  const renderNavContent = (onItemClick?: () => void) => (
    <>
      {/* Brand Header */}
      <div className="h-16 px-6 border-b border-slate-200/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
            H
          </div>
          <div className="min-w-0">
            <span className="text-sm font-bold text-slate-900 tracking-tight block truncate">HRMS Enterprise</span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase block truncate">Multi-Company SaaS</span>
          </div>
        </div>
        {onItemClick && (
          <button
            onClick={onItemClick}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close navigation"
          >
            <LogOut className="w-4 h-4 rotate-180" />
          </button>
        )}
      </div>

      {/* Nav links */}
      <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
        <p className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          {isAttendanceViewer ? 'Attendance Portal' : 'Main Modules'}
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onItemClick}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-100 text-brand-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Biometric Integration badge (HR & Admin only) */}
      {!isAttendanceViewer && (
        <div className="p-3.5 border-t border-slate-100 m-3 bg-slate-50 rounded-lg border shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-semibold text-slate-800">Biometric Sync</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            Real-time hardware punch synchronization active.
          </p>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop Sidebar (lg screens and up) */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200/90 flex-col shrink-0 min-h-screen sticky top-0 h-screen">
        {renderNavContent()}
      </aside>

      {/* Mobile Drawer Navigation (< lg screens) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onMobileClose}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {renderNavContent(onMobileClose)}
          </div>
        </div>
      )}
    </>
  );
};
