import React, { useState, useEffect } from 'react';
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
  ChevronLeft
} from 'lucide-react';
import { api } from '../services/api';
import { NotificationItem, NotificationPagination, NotificationType } from '../types';

function formatRelativeTime(dateStr: string): string {
  try {
    const now = new Date();
    const date = new Date(dateStr);
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} minutes ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} days ago`;

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
    case 'SYSTEM':
      return { icon: AlertTriangle, color: 'text-red-600 bg-red-50 border-red-200' };
    default:
      return { icon: Bell, color: 'text-blue-600 bg-blue-50 border-blue-200' };
  }
}

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();

  // State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const [pagination, setPagination] = useState<NotificationPagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    unreadCount: 0
  });

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError(null);

      let isReadParam: boolean | undefined = undefined;
      if (statusFilter === 'UNREAD') isReadParam = false;
      if (statusFilter === 'READ') isReadParam = true;

      const res = await api.getNotifications({
        page,
        limit: 20,
        isRead: isReadParam,
        type: typeFilter !== 'ALL' ? typeFilter : undefined
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
  };

  useEffect(() => {
    loadNotifications();
  }, [page, statusFilter, typeFilter]);

  // Mark single notification as read
  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setPagination((prev) => ({
        ...prev,
        unreadCount: Math.max(0, prev.unreadCount - 1)
      }));
    } catch (err: any) {
      console.error('Failed to mark notification read:', err);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setPagination((prev) => ({ ...prev, unreadCount: 0 }));
    } catch (err: any) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  // Item click -> mark read and navigate if actionUrl present
  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      await handleMarkAsRead(notif.id);
    }
    if (notif.actionUrl) {
      navigate(notif.actionUrl);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="w-5 h-5 text-brand-600" />
            Notifications
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Stay informed with real-time updates across leaves, attendance, payroll, and employee activities.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
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
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg transition-colors shadow-sm"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Status Filters (All / Unread / Read) */}
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-lg">
          {[
            { id: 'ALL', label: 'All' },
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

        {/* Type / Module Filter Dropdown or Pills */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">Module:</span>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            <option value="LEAVE">Leave Management</option>
            <option value="ATTENDANCE">Attendance & Punching</option>
            <option value="SALARY">Salary & Payroll</option>
            <option value="EMPLOYEE">Employee Management</option>
            <option value="EXIT">Exit Management</option>
            <option value="SYSTEM">System & Security</option>
          </select>
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
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <span className="text-xs font-semibold text-slate-500">Loading your notifications...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">No notifications found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              There are no notifications matching your current filter criteria.
            </p>
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
                  className={`p-4 flex items-start gap-4 transition-all cursor-pointer group ${
                    !notif.isRead
                      ? 'bg-blue-50/40 hover:bg-blue-50/70 border-l-4 border-l-brand-600'
                      : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                  }`}
                >
                  {/* Type Icon Badge */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${iconConfig.color}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Main Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
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
                      </div>

                      <span className="text-[11px] text-slate-400 shrink-0">
                        {formatRelativeTime(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {notif.message}
                    </p>

                    <div className="flex items-center gap-3 mt-2 text-[11px]">
                      <span className="font-semibold text-slate-400 uppercase tracking-wider text-[9px]">
                        {notif.type}
                      </span>

                      {notif.actionUrl && (
                        <span className="inline-flex items-center gap-1 font-semibold text-brand-600 group-hover:underline">
                          <span>View in {notif.module || 'module'}</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mark as read button */}
                  {!notif.isRead && (
                    <button
                      onClick={(e) => handleMarkAsRead(notif.id, e)}
                      className="shrink-0 p-1.5 text-slate-400 hover:text-brand-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all opacity-80 group-hover:opacity-100"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
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
