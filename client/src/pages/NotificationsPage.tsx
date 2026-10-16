import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Check,
  Filter,
  CalendarCheck,
  Clock,
  Banknote,
  Users,
  LogOut as ExitIcon,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Inbox,
  AlertCircle,
  ChevronLeft,
  Building2,
  Trash2,
  Search,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { NotificationItem, NotificationPagination, NotificationType } from '../types';
import { useCompany } from '../context/CompanyContext';
import { useAuth } from '../context/AuthContext';

function formatRelativeTime(dateStr: string): string {
  try {
    const now = new Date();
    const date = new Date(dateStr);
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

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

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeCompany, companies, canSwitchCompany } = useCompany();

  // State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [companyScope, setCompanyScope] = useState<string>('CURRENT'); // 'CURRENT' | 'ALL' | specific companyId
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  const [pagination, setPagination] = useState<NotificationPagination>({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
    unreadCount: 0
  });

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let isReadParam: boolean | undefined = undefined;
      if (statusFilter === 'UNREAD') isReadParam = false;
      if (statusFilter === 'READ') isReadParam = true;

      // Determine target company filter
      let targetCompanyId: string | undefined = undefined;
      if (companyScope === 'CURRENT') {
        targetCompanyId = activeCompany?.id;
      } else if (companyScope === 'ALL') {
        targetCompanyId = 'all';
      } else if (companyScope) {
        targetCompanyId = companyScope;
      }

      const res = await api.getNotifications({
        page,
        limit: 15,
        isRead: isReadParam,
        type: typeFilter !== 'ALL' ? typeFilter : undefined,
        companyId: targetCompanyId,
        search: searchQuery.trim() || undefined
      });

      setNotifications(res.data);
      if (res.meta) {
        setPagination(res.meta);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, companyScope, activeCompany?.id, searchQuery]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Mark single notification as read / unread
  const handleToggleRead = async (notif: NotificationItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      if (notif.isRead) {
        await api.markNotificationAsUnread(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: false, readAt: null } : n))
        );
        setPagination((prev) => ({
          ...prev,
          unreadCount: prev.unreadCount + 1
        }));
      } else {
        await api.markNotificationAsRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
        );
        setPagination((prev) => ({
          ...prev,
          unreadCount: Math.max(0, prev.unreadCount - 1)
        }));
      }
    } catch (err: any) {
      console.error('Failed to toggle notification read status:', err);
    }
  };

  // Delete single notification
  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.deleteNotification(id);
      const target = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setPagination((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
        unreadCount: target && !target.isRead ? Math.max(0, prev.unreadCount - 1) : prev.unreadCount
      }));
    } catch (err: any) {
      console.error('Failed to delete notification:', err);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      setActionLoading(true);
      const targetCompanyId = companyScope === 'CURRENT' ? activeCompany?.id : (companyScope === 'ALL' ? undefined : companyScope);
      await api.markAllNotificationsAsRead(targetCompanyId);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setPagination((prev) => ({ ...prev, unreadCount: 0 }));
    } catch (err: any) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Clear all read notifications
  const handleClearRead = async () => {
    if (!window.confirm('Are you sure you want to delete all read notifications?')) return;
    try {
      setActionLoading(true);
      const targetCompanyId = companyScope === 'CURRENT' ? activeCompany?.id : (companyScope === 'ALL' ? undefined : companyScope);
      await api.clearReadNotifications(targetCompanyId);
      loadNotifications();
    } catch (err: any) {
      console.error('Failed to clear read notifications:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Click on notification -> mark read and navigate if actionUrl present
  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      await api.markNotificationAsRead(notif.id).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setPagination((prev) => ({
        ...prev,
        unreadCount: Math.max(0, prev.unreadCount - 1)
      }));
    }
    if (notif.actionUrl) {
      navigate(notif.actionUrl);
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setSearchQuery('');
    setCompanyScope('CURRENT');
    setPage(1);
  };

  const hasActiveFilters =
    statusFilter !== 'ALL' ||
    typeFilter !== 'ALL' ||
    searchQuery.trim() !== '' ||
    companyScope !== 'CURRENT';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Bell className="w-5 h-5 text-brand-600" />
              Notifications Center
            </h1>
            {pagination.unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-brand-100 text-brand-700">
                {pagination.unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <span>Workspace:</span>
            {activeCompany ? (
              <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                <Building2 className="w-3 h-3 text-indigo-600" />
                {activeCompany.name} ({activeCompany.code})
              </span>
            ) : (
              <span className="font-medium text-slate-600">Platform Overview</span>
            )}
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadNotifications}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
            title="Refresh notifications"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {pagination.unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg transition-colors shadow-sm"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}

          <button
            onClick={handleClearRead}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors shadow-sm"
            title="Clear all read notifications"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear read</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs (All / Unread / Read) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg shrink-0">
            {[
              { id: 'ALL', label: `All (${pagination.total})` },
              {
                id: 'UNREAD',
                label: `Unread ${pagination.unreadCount > 0 ? `(${pagination.unreadCount})` : ''}`
              },
              { id: 'READ', label: 'Read' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setStatusFilter(tab.id as any);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search notifications by title or keyword..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Second Row: Company Scope and Module / Category Dropdowns */}
        <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-slate-100 text-xs">
          {/* Company Scope Selector (Only shown if user has access to multiple companies or is Admin) */}
          {canSwitchCompany && (
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-500 font-medium">Company Scope:</span>
              <select
                value={companyScope}
                onChange={(e) => {
                  setCompanyScope(e.target.value);
                  setPage(1);
                }}
                className="font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
              >
                <option value="CURRENT">Current Workspace ({activeCompany?.name || 'Active'})</option>
                <option value="ALL">All Authorized Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Type / Module Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-500 font-medium">Category:</span>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              <option value="LEAVE">Leave Management</option>
              <option value="ATTENDANCE">Attendance & Punching</option>
              <option value="SALARY">Salary & Payroll</option>
              <option value="EMPLOYEE">Employee Lifecycle</option>
              <option value="EXIT">Exit Clearance</option>
              <option value="HR_MANAGEMENT">HR & Company Management</option>
              <option value="SYSTEM">System & Security</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Notifications List */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <span className="text-xs font-semibold text-slate-500">Loading your notifications...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">No notifications found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {hasActiveFilters
                ? 'No notifications match your active search or category filters.'
                : 'You are all caught up! No notifications for your current company workspace.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="mt-3 px-3 py-1.5 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notif) => {
              const iconConfig = getNotificationIcon(notif.type);
              const Icon = iconConfig.icon;

              return (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`p-4 flex items-start gap-3.5 transition-all cursor-pointer group ${
                    !notif.isRead
                      ? 'bg-blue-50/40 hover:bg-blue-50/70 border-l-4 border-l-brand-600'
                      : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                  }`}
                >
                  {/* Category Icon Badge */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${iconConfig.color}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Main Information */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs block ${
                            !notif.isRead
                              ? 'font-bold text-slate-900'
                              : 'font-semibold text-slate-700'
                          }`}
                        >
                          {notif.title}
                        </span>

                        {!notif.isRead && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-brand-600 text-white uppercase tracking-wider">
                            New
                          </span>
                        )}

                        {/* Company Badge */}
                        {notif.company && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 truncate max-w-[150px]">
                            <Building2 className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{notif.company.name}</span>
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] text-slate-400 shrink-0">
                        {formatRelativeTime(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {notif.message}
                    </p>

                    <div className="flex items-center gap-3 mt-2 text-[11px] flex-wrap">
                      <span className="font-semibold text-slate-400 uppercase tracking-wider text-[9px]">
                        {notif.type.replace('_', ' ')}
                      </span>

                      {notif.actionUrl && (
                        <span className="inline-flex items-center gap-1 font-semibold text-brand-600 group-hover:underline">
                          <span>View record in {notif.module || 'module'}</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions column: toggle read / unread and delete */}
                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    <button
                      onClick={(e) => handleToggleRead(notif, e)}
                      className={`p-1.5 rounded-lg border transition-all text-xs ${
                        !notif.isRead
                          ? 'text-brand-600 bg-brand-50 border-brand-200 hover:bg-brand-100'
                          : 'text-slate-400 hover:text-slate-700 hover:bg-white border-transparent hover:border-slate-200'
                      }`}
                      title={notif.isRead ? 'Mark as unread' : 'Mark as read'}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => handleDelete(notif.id, e)}
                      className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-all opacity-0 group-hover:opacity-100"
                      title="Delete notification"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} notifications)
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded bg-white border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 font-medium flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="px-2.5 py-1 rounded bg-white border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 font-medium flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
