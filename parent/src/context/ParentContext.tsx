import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { requestApi } from '../services/api';

export interface ParentUser {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string;
  mustChangePassword: boolean;
}

export interface ChildSummary {
  studentId: number;
  studentName: string;
  rollNo: string | null;
  admissionNo: string;
  classId: number;
  classNumber: number;
  className: string;
  enrollmentStatus: string;
  accountStatus: string;
  relation: string;
  attendanceRate: number | null;
  totalAttendanceLogs: number;
  pendingTasksCount: number;
  totalOutstandingFee: number;
  challansCount: number;
  recentChallans: {
    id: number;
    challanNumber: string;
    billingMonth: string;
    totalPayable: number;
    paidAmount: number;
    status: string;
  }[];
  todaySchedule: { id: number; startAt: string; endAt: string; status: string; subjectName: string; teacherName: string }[];
  achievements: { id: number; badgeType: string; title: string; reason: string; starsCount: number; awardedByTeacher: string; awardedAt: string }[];
}

export interface ParentDashboard {
  parent: {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    relation: string | null;
    verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  };
  children: ChildSummary[];
}

interface ParentContextValue {
  user: ParentUser | null;
  authLoading: boolean;
  dashboard: ParentDashboard | null;
  dashboardLoading: boolean;
  dashboardError: string | null;
  children: ChildSummary[];
  selectedChild: ChildSummary | null;
  selectChild: (studentId: number) => void;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<boolean>;
  refreshDashboard: () => Promise<void>;
  unreadCount: number;
  refreshUnread: () => Promise<void>;
  toastMessage: { text: string; type: 'success' | 'error' } | null;
  showToast: (text: string, type?: 'success' | 'error') => void;
  clearToast: () => void;
}

const ParentContext = createContext<ParentContextValue | null>(null);

const CHILD_KEY = 'parent_portal_selected_child';

function readStoredChild(): number | null {
  try {
    const v = localStorage.getItem(CHILD_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

export function ParentProvider({ children: content }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ParentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [dashboard, setDashboard] = useState<ParentDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(readStoredChild);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
  }, []);
  const clearToast = useCallback(() => setToastMessage(null), []);

  const acceptUser = useCallback(async (data: any): Promise<ParentUser> => {
    if (data?.role !== 'PARENT') {
      await requestApi('/api/v1/auth/logout', { method: 'POST' }).catch(() => {});
      throw new Error('This portal is for parents and guardians only. Please use the correct portal for your role.');
    }
    const parentUser: ParentUser = {
      id: data.id,
      username: data.username,
      fullName: data.fullName || data.username,
      email: data.email || null,
      phone: data.phone || null,
      role: data.role,
      mustChangePassword: Boolean(data.mustChangePassword),
    };
    setUser(parentUser);
    return parentUser;
  }, []);

  const login = useCallback(
    async (identifier: string, password: string) => {
      setAuthLoading(true);
      try {
        const data = await requestApi<any>('/api/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({ identifier, password }),
        });
        await acceptUser(data);
      } finally {
        setAuthLoading(false);
      }
    },
    [acceptUser]
  );

  const restoreSession = useCallback(async () => {
    setAuthLoading(true);
    try {
      const data = await requestApi<any>('/api/v1/auth/me');
      await acceptUser(data);
      return true;
    } catch {
      setUser(null);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }, [acceptUser]);

  const logout = useCallback(async () => {
    try {
      await requestApi('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // cookies are cleared server-side
    }
    setUser(null);
    setDashboard(null);
    setUnreadCount(0);
  }, []);

  const refreshDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const data = await requestApi<ParentDashboard>('/api/v1/parents/me/dashboard');
      setDashboard(data);
    } catch (err: any) {
      setDashboardError(err.message || 'Failed to load your account');
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const refreshUnread = useCallback(async () => {
    try {
      const list = await requestApi<any[]>('/api/v1/notices/notifications');
      setUnreadCount(Array.isArray(list) ? list.filter((n) => !n.isRead).length : 0);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    if (user && !user.mustChangePassword) {
      refreshDashboard();
      refreshUnread();
    }
  }, [user, refreshDashboard, refreshUnread]);

  // Keep a mirror of the latest unread count so the poll below can tell
  // when a NEW notification arrives (count went up) vs. notices being read.
  const prevUnreadRef = useRef(0);
  useEffect(() => {
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  // Poll for new notifications and surface a toast; the parent then opens
  // the notification bell to read the real notification.
  useEffect(() => {
    if (!user || user.mustChangePassword) return;
    const check = async () => {
      try {
        const list = await requestApi<any[]>('/api/v1/notices/notifications');
        const count = Array.isArray(list) ? list.filter((n) => !n.isRead).length : 0;
        if (count > prevUnreadRef.current) {
          showToast('You have a new notification — click the bell to view it.');
        }
        setUnreadCount(count);
      } catch {
        // keep the previous count when a poll fails
      }
    };
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [user, showToast]);

  const childList = dashboard?.children || [];
  const selectedChild = useMemo(
    () => childList.find((c) => c.studentId === selectedChildId) || childList[0] || null,
    [childList, selectedChildId]
  );

  const selectChild = useCallback((studentId: number) => {
    setSelectedChildId(studentId);
    try {
      localStorage.setItem(CHILD_KEY, String(studentId));
    } catch {
      // storage unavailable — selection still works for this session
    }
  }, []);

  const value: ParentContextValue = {
    user,
    authLoading,
    dashboard,
    dashboardLoading,
    dashboardError,
    children: childList,
    selectedChild,
    selectChild,
    login,
    logout,
    restoreSession,
    refreshDashboard,
    unreadCount,
    refreshUnread,
    toastMessage,
    showToast,
    clearToast,
  };

  return <ParentContext.Provider value={value}>{content}</ParentContext.Provider>;
}

export function useParent(): ParentContextValue {
  const ctx = useContext(ParentContext);
  if (!ctx) throw new Error('useParent must be used inside ParentProvider');
  return ctx;
}

/**
 * Loads data for the selected child from a parent endpoint. The server checks
 * the parent-child link on every request.
 */
export function useChildData<T>(buildPath: (studentId: number) => string) {
  const { selectedChild } = useParent();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const studentId = selectedChild?.studentId ?? null;
  const path = studentId != null ? buildPath(studentId) : null;

  const reload = useCallback(async () => {
    if (!path) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await requestApi<T>(path));
    } catch (err: any) {
      setError(err.message || 'Failed to load records');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, studentId };
}
