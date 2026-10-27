import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Video, ClipboardList, Receipt, CheckCircle, Calendar, Star, X } from 'lucide-react';
import { RootState, AppDispatch } from '../store';
import { setFilter, markAsRead, markAllAsRead, NotificationItem } from '../store/slices/notificationsSlice';
import { markNotificationRead, markAllNotificationsRead } from '../store/slices/notificationsSlice';

export default function Notifications() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { items, activeFilter } = useSelector((state: RootState) => state.notifications);

  const filters = ['All', 'Classes', 'Assignments', 'Results', 'Fees', 'Notices'];

  const filteredItems = items.filter(item => {
    if (activeFilter === 'All') return true;
    return item.category.toLowerCase() === activeFilter.toLowerCase();
  });

  const getIcon = (type: NotificationItem['iconType']) => {
    switch (type) {
      case 'video':
        return <Video className="w-4 h-4 text-primary" />;
      case 'clipboard':
        return <ClipboardList className="w-4 h-4 text-warning" />;
      case 'receipt':
        return <Receipt className="w-4 h-4 text-error" />;
      case 'check':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'calendar':
        return <Calendar className="w-4 h-4 text-muted-foreground" />;
      case 'star':
        return <Star className="w-4 h-4 text-amber-500" />;
      default:
        return <Calendar className="w-4 h-4 text-primary" />;
    }
  };

  const [activeNotif, setActiveNotif] = useState<NotificationItem | null>(null);

  const handleClickItem = (item: NotificationItem) => {
    if (!item.read) {
      dispatch(markAsRead(item.id));
      dispatch(markNotificationRead(item.id));
    }
    setActiveNotif(item);
  };

  const closeModal = () => setActiveNotif(null);

  const handleMarkAll = () => {
    dispatch(markAllAsRead());               // optimistic
    dispatch(markAllNotificationsRead());    // sync to backend
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Filter Pills */}
        <div className="flex gap-1.5 flex-wrap">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => dispatch(setFilter(f))}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                activeFilter === f
                  ? "bg-foreground text-card font-bold"
                  : "bg-card border border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <button
          onClick={handleMarkAll}
          className="text-xs font-semibold text-primary hover:underline ml-auto cursor-pointer"
        >
          Mark all as read
        </button>
      </div>

      {/* Notifications List */}
      <div className="bg-card border border-border rounded-md divide-y divide-border shadow-sm">
        {filteredItems.map((n) => (
          <div
            key={n.id}
            onClick={() => handleClickItem(n)}
            className={`p-4 flex items-center gap-3.5 hover:bg-muted/40 transition cursor-pointer ${
              !n.read ? 'bg-secondary/20' : ''
            }`}
          >
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
              {getIcon(n.iconType)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground truncate">{n.title}</span>
                {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{n.description}</div>
              <div className="text-[11px] text-muted-foreground/75 mt-0.5">{n.time}</div>
            </div>
            <span className="text-xs font-semibold text-primary shrink-0 hover:underline">View</span>
          </div>
        ))}
      </div>

      {/* Notification Detail Modal */}
      {activeNotif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  {getIcon(activeNotif.iconType)}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">{activeNotif.category}</p>
                  <h3 className="text-sm font-bold text-foreground leading-snug">{activeNotif.title}</h3>
                </div>
              </div>
              <button onClick={closeModal} className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{activeNotif.description}</p>
            <p className="text-[11px] text-muted-foreground">{activeNotif.time}</p>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              {activeNotif.link && (
                <button
                  onClick={() => { navigate(activeNotif.link); closeModal(); }}
                  className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold"
                >
                  Open
                </button>
              )}
              <button onClick={closeModal} className="px-4 py-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
