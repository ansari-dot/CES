import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { OperationalNotification } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { ActiveModule } from '../../components/common/Sidebar';
import {
  BellRing,
  Check,
  CheckCheck,
  Clock,
  ArrowRight,
  AlertTriangle,
  Info
} from 'lucide-react';

interface NotificationsModuleProps {
  onNavigate: (module: ActiveModule) => void;
}

export const NotificationsModule: React.FC<NotificationsModuleProps> = ({ onNavigate }) => {
  const [notifications, setNotifications] = useState<OperationalNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const toast = useToast();

  const loadNotifs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifs();
  }, [loadNotifs]);

  const handleMarkRead = async (id: string) => {
    await api.markNotificationAsRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    toast.success('All operational notifications marked as read.');
  };

  const handleNavigateToRecord = (notif: OperationalNotification) => {
    handleMarkRead(notif.id);
    if (notif.relatedRecordType === 'PaymentProof') onNavigate('payments');
    else if (notif.relatedRecordType === 'ZoomMeeting') onNavigate('zoom');
    else if (notif.relatedRecordType === 'Attendance' || notif.relatedRecordType === 'AttendanceCorrection') onNavigate('attendance');
    else if (notif.relatedRecordType === 'Payroll') onNavigate('payroll');
    else onNavigate('dashboard');
  };

  if (loading) return <LoadingState message="Loading operational event notifications..." rows={6} />;
  if (error) return <ErrorState message={error} onRetry={loadNotifs} />;

  return (
    <div className="space-y-4">
      {/* Top Banner Card in clean white */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Operational Event Notifications</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time administrative feed for timetable changes, Zoom health degraded alerts, missing attendance, and fee proofs.
          </p>
        </div>

        <button
          onClick={handleMarkAllRead}
          className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium transition-colors flex items-center gap-1.5 shadow-2xs shrink-0"
        >
          <CheckCheck className="w-3.5 h-3.5 text-amber-600" strokeWidth={1.75} />
          <span>Mark All Read</span>
        </button>
      </div>

      <div className="space-y-2.5">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
              notif.isRead
                ? 'bg-white border-slate-200/70 shadow-2xs opacity-75'
                : 'bg-white border-amber-200/90 shadow-xs ring-1 ring-amber-100'
            }`}
          >
            <div className="space-y-1 text-xs max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-amber-700 font-mono text-[11px] uppercase tracking-wide">
                  {notif.type}
                </span>
                <span className="text-slate-300">·</span>
                <span className="font-mono text-[11px] text-slate-400">
                  {new Date(notif.timestamp).toLocaleString()}
                </span>
                {!notif.isRead && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    NEW
                  </span>
                )}
              </div>
              <h4 className="text-sm font-semibold text-slate-900">{notif.title}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              {!notif.isRead && (
                <button
                  onClick={() => handleMarkRead(notif.id)}
                  title="Mark as read"
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  <Check className="w-4 h-4" strokeWidth={1.75} />
                </button>
              )}
              {notif.relatedRecordType && (
                <button
                  onClick={() => handleNavigateToRecord(notif)}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <span>Open Record</span>
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
