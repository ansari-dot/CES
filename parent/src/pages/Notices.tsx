import React, { useCallback, useEffect, useState } from 'react';
import { Megaphone, Bell } from 'lucide-react';
import { useParent } from '../context/ParentContext';
import { requestApi } from '../services/api';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../components/common';
import { formatDate, formatDateTime } from '../lib/format';

interface NoticeRow {
  id: string;
  title: string;
  content: string;
  audience: string;
  category: string | null;
  priority: 'Normal' | 'High' | 'Urgent';
  publishDate: string;
  expiryDate?: string;
  createdBy: string;
  isRead?: boolean;
}

interface AlertRow {
  id: string;
  title: string;
  message: string;
  type: string;
  relatedRecordType?: string;
  createdAt: string;
  isRead: boolean;
}

export default function Notices() {
  const { refreshUnread, showToast } = useParent();
  const [tab, setTab] = useState<'notices' | 'alerts'>('notices');
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [noticeList, notificationList] = await Promise.all([
        requestApi<NoticeRow[]>('/api/v1/notices'),
        requestApi<AlertRow[]>('/api/v1/notices/notifications'),
      ]);
      setNotices(Array.isArray(noticeList) ? noticeList : []);
      // Notices are listed in their own tab; alerts are results, assignments, fees, etc.
      setAlerts((Array.isArray(notificationList) ? notificationList : []).filter((n) => n.relatedRecordType !== 'Notice'));
    } catch (err: any) {
      setError(err.message || 'Failed to load notices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNotice = async (n: NoticeRow) => {
    setExpanded((prev) => (prev === n.id ? null : n.id));
    if (n.isRead === false) {
      setNotices((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      try {
        await requestApi(`/api/v1/notices/${n.id}/read`, { method: 'POST' });
        refreshUnread();
      } catch {
        // read state will be retried next time the notice is opened
      }
    }
  };

  const openAlert = async (a: AlertRow) => {
    setExpanded((prev) => (prev === a.id ? null : a.id));
    if (!a.isRead) {
      setAlerts((prev) => prev.map((x) => (x.id === a.id ? { ...x, isRead: true } : x)));
      try {
        await requestApi(`/api/v1/notices/notifications/${a.id}/read`, { method: 'POST' });
        refreshUnread();
      } catch {
        // ignore — shown as read locally
      }
    }
  };

  const markAllRead = async () => {
    try {
      await requestApi('/api/v1/notices/notifications/read-all', { method: 'POST' });
      setNotices((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
      refreshUnread();
    } catch (err: any) {
      showToast(err.message || 'Failed to mark as read', 'error');
    }
  };

  if (loading) return <LoadingBlock message="Loading notices…" />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  const unreadNotices = notices.filter((n) => n.isRead === false).length;
  const unreadAlerts = alerts.filter((a) => !a.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex gap-1.5">
          <button
            onClick={() => setTab('notices')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
              tab === 'notices' ? 'bg-foreground text-card font-bold' : 'bg-card border border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            Notices & Circulars{unreadNotices > 0 ? ` (${unreadNotices})` : ''}
          </button>
          <button
            onClick={() => setTab('alerts')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
              tab === 'alerts' ? 'bg-foreground text-card font-bold' : 'bg-card border border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            Alerts{unreadAlerts > 0 ? ` (${unreadAlerts})` : ''}
          </button>
        </div>
        {(unreadNotices > 0 || unreadAlerts > 0) && (
          <button onClick={markAllRead} className="text-xs font-semibold text-primary hover:underline ml-auto cursor-pointer">
            Mark all as read
          </button>
        )}
      </div>

      {tab === 'notices' ? (
        notices.length === 0 ? (
          <EmptyBlock title="No current notices" description="Notices from the school and your children's teachers will appear here." />
        ) : (
          <div className="bg-card border border-border rounded-md divide-y divide-border shadow-sm">
            {notices.map((n) => {
              const urgent = n.priority === 'Urgent' || n.priority === 'High';
              return (
                <div
                  key={n.id}
                  onClick={() => openNotice(n)}
                  className={`p-4 flex items-start gap-3.5 hover:bg-muted/40 transition cursor-pointer ${n.isRead === false ? 'bg-secondary/20' : ''}`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${urgent ? 'bg-error-bg' : 'bg-muted'}`}>
                    <Megaphone className={`w-4 h-4 ${urgent ? 'text-error' : 'text-primary'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{n.title}</span>
                      {n.isRead === false && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                      {urgent && <span className="text-[10px] font-bold uppercase text-error">{n.priority}</span>}
                    </div>
                    <div className={`text-xs text-muted-foreground mt-0.5 ${expanded === n.id ? 'whitespace-pre-wrap' : 'line-clamp-1'}`}>
                      {n.content}
                    </div>
                    <div className="text-[11px] text-muted-foreground/75 mt-0.5">
                      {[n.category, n.audience, `By ${n.createdBy}`, formatDate(n.publishDate)].filter(Boolean).join(' · ')}
                      {n.expiryDate ? ` · until ${formatDate(n.expiryDate)}` : ''}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-primary shrink-0 hover:underline">{expanded === n.id ? 'Less' : 'Read'}</span>
                </div>
              );
            })}
          </div>
        )
      ) : alerts.length === 0 ? (
        <EmptyBlock title="No alerts" description="Alerts about results, assignments, fees and achievements will appear here." />
      ) : (
        <div className="bg-card border border-border rounded-md divide-y divide-border shadow-sm">
          {alerts.map((a) => (
            <div
              key={a.id}
              onClick={() => openAlert(a)}
              className={`p-4 flex items-start gap-3.5 hover:bg-muted/40 transition cursor-pointer ${!a.isRead ? 'bg-secondary/20' : ''}`}
            >
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-foreground">{a.title}</span>
                  {!a.isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                </div>
                <div className={`text-xs text-muted-foreground mt-0.5 ${expanded === a.id ? 'whitespace-pre-wrap' : 'line-clamp-1'}`}>{a.message}</div>
                <div className="text-[11px] text-muted-foreground/75 mt-0.5">{formatDateTime(a.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Notices are delivered inside this portal. Email, SMS and WhatsApp delivery are not part of this feature.
      </p>
    </div>
  );
}
