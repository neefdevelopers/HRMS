import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Building,
  Building2,
  LogOut,
  Bell,
  CheckCheck,
  Check,
  CalendarCheck,
  Clock,
  Banknote,
  Users,
  LogOut as ExitIcon,
  AlertTriangle,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useBrand } from '../../context/BrandContext';
import { api } from '../../services/api';
import { NotificationItem, NotificationType } from '../../types';

// Helper for relative timestamps
function formatRelativeTime(dateStr: string): string {
  try {
    const now = new Date();
    const date = new Date(dateStr);
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

// Icon helper by notification type
function getNotificationIcon(type: NotificationType | string) {
  switch (type) {
    case 'LEAVE':
      return { icon: CalendarCheck, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' };
    case 'ATTENDANCE':
      return { icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-200' };
    case 'SALARY':
      return { icon: Banknote, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
    case 'EMPLOYEE':
      return { icon: Users, color: 'text-purple-600 bg-purple-50 border-purple-200' };
    case 'EXIT':
      return { icon: ExitIcon, color: 'text-rose-600 bg-rose-50 border-rose-200' };
    case 'HR_MANAGEMENT':
      return { icon: Building2, color: 'text-cyan-600 bg-cyan-50 border-cyan-200' };
    case 'SYSTEM':
      return { icon: AlertTriangle, color: 'text-red-600 bg-red-50 border-red-200' };
    default:
      return { icon: Bell, color: 'text-blue-600 bg-blue-50 border-blue-200' };
  }
}

export const Navbar: React.FC = () => {
  const { user, logout, canAccessAllBrands, isAttendanceViewer, isAdmin } = useAuth();
  const { companies, activeCompany, activeCompanyId, setActiveCompanyId, canSwitchCompany } = useCompany();
  const { brands, selectedBrandId, setSelectedBrandId } = useBrand();
  const navigate = useNavigate();

  // Notification state
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [recentNotifications, setRecentNotifications] = useState<NotificationItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch unread count for current active company (HR & Admin only)
  const fetchUnreadCount = async () => {
    if (!user || isAttendanceViewer) return;
    try {
      const res = await api.getUnreadNotificationCount(activeCompany?.id);
      setUnreadCount(res.unreadCount);
    } catch {
      // Ignore background poll errors
    }
  };

  // Fetch recent notifications when dropdown opens
  const fetchRecentNotifications = async () => {
    if (isAttendanceViewer) return;
    try {
      setLoading(true);
      const res = await api.getNotifications({ limit: 6, companyId: activeCompany?.id });
      setRecentNotifications(res.data);
      if (res.meta?.unreadCount !== undefined) {
        setUnreadCount(res.meta.unreadCount);
      }
    } catch (err) {
      console.error('Failed to load recent notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and 30-second background poll
  useEffect(() => {
    if (!isAttendanceViewer) {
      fetchUnreadCount();
      if (isOpen) {
        fetchRecentNotifications();
      }
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user, activeCompany?.id, isAttendanceViewer]);

  // Handle open dropdown
  const handleToggleDropdown = () => {
    if (!isOpen) {
      fetchRecentNotifications();
    }
    setIsOpen(!isOpen);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Mark single notification as read
  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.markNotificationAsRead(id);
      setRecentNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllNotificationsAsRead(activeCompany?.id);
      setRecentNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // Click on notification item -> mark read & navigate
  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      await handleMarkAsRead(notif.id);
    }
    setIsOpen(false);
    if (notif.actionUrl) {
      navigate(notif.actionUrl);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 px-4 sm:px-6 py-2.5 flex items-center justify-between">
      {/* Company & Brand Selectors */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        {/* Company Selector / Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50/70 border border-indigo-200/80 rounded-lg text-indigo-900">
          <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="text-xs font-medium text-indigo-600 hidden sm:inline">Company:</span>
          {companies.length === 0 ? (
            <span className="text-xs font-semibold text-amber-700">No Company Assigned</span>
          ) : canSwitchCompany ? (
            <select
              value={activeCompanyId || (activeCompany?.id ?? 'all')}
              onChange={(e) => setActiveCompanyId(e.target.value)}
              className="bg-transparent text-xs font-bold text-indigo-950 border-none focus:outline-none focus:ring-0 cursor-pointer pr-3 max-w-[170px] truncate"
            >
              <option value="all" className="text-slate-900 bg-white font-semibold">
                All Companies
              </option>
              {companies.map((c) => (
                <option key={c.id} value={c.id} className="text-slate-900 bg-white">
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs font-bold text-indigo-950 truncate max-w-[170px]">
              {activeCompany?.name || 'All Companies'}
            </span>
          )}
        </div>

        {/* Brand Selector */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
          <Building className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="text-xs font-medium text-slate-500 hidden sm:inline">Active Brand:</span>
          {canAccessAllBrands || brands.length > 1 ? (
            <select
              value={selectedBrandId}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-900 border-none focus:outline-none focus:ring-0 cursor-pointer pr-4 max-w-[170px] truncate"
            >
              <option value="all" className="text-slate-900 bg-white font-semibold">
                All Brands
              </option>
              {brands.map((b) => (
                <option key={b.id} value={b.id} className="text-slate-900 bg-white">
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs font-semibold text-slate-900 truncate max-w-[170px]">
              {user?.brand?.name || (brands.length > 0 ? brands[0].name : 'Assigned Brand')}
            </span>
          )}
        </div>
      </div>

      {/* User profile & actions */}
      <div className="flex items-center gap-3 sm:gap-4">

        {/* ----------------- NOTIFICATION BELL & DROPDOWN ----------------- */}
        {!isAttendanceViewer && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={handleToggleDropdown}
            className={`relative p-2 rounded-lg border transition-colors ${
              isOpen
                ? 'bg-slate-100 border-slate-300 text-slate-900'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-brand-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white animate-in zoom-in-75">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown Popover */}
          {isOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
              {/* Dropdown Header */}
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-100 text-brand-700">
                      {unreadCount} unread
                    </span>
                  )}
                </div>

                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-[11px] font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1 transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              {/* Dropdown List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {loading ? (
                  <div className="p-8 text-center">
                    <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span className="text-xs text-slate-400">Loading notifications...</span>
                  </div>
                ) : recentNotifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                      <Bell className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700">No notifications</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      You are all caught up with your HR updates.
                    </p>
                  </div>
                ) : (
                  recentNotifications.map((notif) => {
                    const iconConfig = getNotificationIcon(notif.type);
                    const Icon = iconConfig.icon;

                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer group ${
                          !notif.isRead
                            ? 'bg-blue-50/50 hover:bg-blue-50/80'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Type Icon */}
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 ${iconConfig.color}`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`text-xs block truncate ${
                                !notif.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'
                              }`}
                            >
                              {notif.title}
                            </span>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                              {formatRelativeTime(notif.createdAt)}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                            {notif.message}
                          </p>

                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {notif.company && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 truncate max-w-[130px]">
                                <Building2 className="w-2.5 h-2.5 shrink-0 text-slate-500" />
                                <span className="truncate">{notif.company.name}</span>
                              </span>
                            )}
                            {notif.actionUrl && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-600 group-hover:underline">
                                <span>Open record</span>
                                <ChevronRight className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Unread dot / Mark read on hover */}
                        <div className="shrink-0 pt-1">
                          {!notif.isRead ? (
                            <button
                              onClick={(e) => handleMarkAsRead(notif.id, e)}
                              className="w-2.5 h-2.5 rounded-full bg-brand-600 group-hover:w-4 group-hover:h-4 group-hover:bg-slate-200 group-hover:flex group-hover:items-center group-hover:justify-center text-slate-600 transition-all"
                              title="Mark as read"
                            >
                              <span className="hidden group-hover:inline text-[9px]">✓</span>
                            </button>
                          ) : (
                            <span className="w-2 h-2 rounded-full opacity-0" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Dropdown Footer */}
              <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center">
                <Link
                  to="/notifications"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800 py-1 px-3 rounded-lg hover:bg-brand-50/80 transition-colors w-full"
                >
                  <span>View all notifications</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>
        )}

        {/* User Info & Logout */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-xs font-semibold text-slate-900 leading-tight">
                {user?.firstName} {user?.lastName}
              </span>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                  user?.role === 'ADMIN'
                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                    : user?.role === 'ATTENDANCE_VIEWER'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                }`}
              >
                {user?.role === 'ATTENDANCE_VIEWER' ? 'Viewer' : user?.role || 'User'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight truncate max-w-[160px]">
              {user?.email}
            </p>
          </div>

          <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 font-semibold text-xs">
            {user?.firstName?.[0]}
            {user?.lastName?.[0]}
          </div>

          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
