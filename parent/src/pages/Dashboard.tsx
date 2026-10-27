import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, ClipboardList, Receipt, Award, ChevronRight, Bell } from 'lucide-react';
import { useParent } from '../context/ParentContext';
import { requestApi } from '../services/api';
import { MetricCard, StatusChip, RequireChild } from '../components/common';
import { rupees, pct, formatDate, CHALLAN_STATUS_LABELS } from '../lib/format';

interface NoticeItem {
  id: string;
  title: string;
  content: string;
  audience: string;
  publishDate: string;
  priority: string;
  isRead?: boolean;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { children, selectedChild, selectChild, user } = useParent();
  const [notices, setNotices] = useState<NoticeItem[]>([]);

  useEffect(() => {
    requestApi<NoticeItem[]>('/api/v1/notices')
      .then((list) => setNotices(Array.isArray(list) ? list.slice(0, 3) : []))
      .catch(() => setNotices([]));
  }, []);

  const child = selectedChild;

  return (
    <div className="space-y-6">
      <div className="bg-primary text-white rounded-lg p-6 shadow-sm">
        <div className="font-headings font-bold text-2xl">Welcome, {(user?.fullName || 'Parent').split(' ')[0]}</div>
        <div className="text-xs opacity-80 mt-1">
          {children.length === 0
            ? 'No children are linked to your account yet.'
            : `You are following ${children.length} ${children.length === 1 ? 'child' : 'children'} at Cambridge Education System.`}
        </div>
      </div>

      {children.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {children.map((c) => (
            <button
              key={c.studentId}
              onClick={() => selectChild(c.studentId)}
              className={`text-left bg-card border rounded-md p-4 shadow-sm transition cursor-pointer ${
                child?.studentId === c.studentId ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-primary/40'
              }`}
            >
              <div className="font-headings font-bold text-sm text-foreground">{c.studentName}</div>
              <div className="text-xs text-muted-foreground">
                {c.className} · Roll {c.rollNo || '—'} · {c.admissionNo}
              </div>
              <div className="flex gap-3 mt-2 text-[11px] text-muted-foreground">
                <span>Attendance {pct(c.attendanceRate)}</span>
                <span>· {c.pendingTasksCount} pending tasks</span>
                <span>· {rupees(c.totalOutstandingFee)} due</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <RequireChild>
        {child && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                icon={CalendarCheck}
                title="Attendance"
                value={pct(child.attendanceRate)}
                subtitle={child.totalAttendanceLogs > 0 ? `${child.totalAttendanceLogs} lessons recorded` : 'Not recorded yet'}
                colorScheme="success"
              />
              <MetricCard icon={ClipboardList} title="Pending Tasks" value={child.pendingTasksCount} subtitle="Not yet submitted" colorScheme="warning" />
              <MetricCard
                icon={Receipt}
                title="Outstanding Fees"
                value={rupees(child.totalOutstandingFee)}
                subtitle={`${child.challansCount} challans issued`}
                colorScheme={child.totalOutstandingFee > 0 ? 'error' : 'success'}
              />
              <MetricCard
                icon={Award}
                title="Achievements"
                value={child.achievements.length}
                subtitle={`${child.achievements.reduce((s, a) => s + Number(a.starsCount || 0), 0)} stars earned`}
                colorScheme="secondary"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-md p-5 shadow-sm">
                <div className="font-headings font-bold text-base text-foreground mb-3">Today's classes · {child.studentName.split(' ')[0]}</div>
                {child.todaySchedule.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No lessons are scheduled for today.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {child.todaySchedule.map((l) => (
                      <li key={l.id} className="py-2 flex items-center justify-between text-sm">
                        <div>
                          <div className="font-semibold text-foreground">{l.subjectName}</div>
                          <div className="text-xs text-muted-foreground">{l.teacherName}</div>
                        </div>
                        <div className="text-xs text-muted-foreground text-right">
                          {new Date(l.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          <div><StatusChip status={l.status.charAt(0) + l.status.slice(1).toLowerCase()} /></div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-card border border-border rounded-md p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-headings font-bold text-base text-foreground">Recent challans</div>
                  <button onClick={() => navigate('/parent/fees')} className="text-xs font-semibold text-primary hover:underline cursor-pointer flex items-center">
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                {child.recentChallans.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No fee challans have been issued yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {child.recentChallans.map((c) => (
                      <li key={c.id} className="py-2 flex items-center justify-between text-sm">
                        <div>
                          <div className="font-semibold text-foreground">{c.billingMonth}</div>
                          <div className="text-xs text-muted-foreground font-mono">{c.challanNumber}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-semibold text-foreground">{rupees(c.totalPayable)}</div>
                          <StatusChip status={CHALLAN_STATUS_LABELS[c.status] || c.status} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </RequireChild>

      <div className="bg-card border border-border rounded-md p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="font-headings font-bold text-base text-foreground flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" /> Latest notices
          </div>
          <button onClick={() => navigate('/parent/notices')} className="text-xs font-semibold text-primary hover:underline cursor-pointer flex items-center">
            View all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {notices.length === 0 ? (
          <p className="text-xs text-muted-foreground">There are no current notices for parents.</p>
        ) : (
          <ul className="divide-y divide-border">
            {notices.map((n) => (
              <li key={n.id} className="py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{n.title}</span>
                  {n.isRead === false && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                </div>
                <div className="text-xs text-muted-foreground line-clamp-1">{n.content}</div>
                <div className="text-[11px] text-muted-foreground/75 mt-0.5">
                  {n.audience} · {formatDate(n.publishDate)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
