import React, { useCallback, useEffect, useState } from 'react';
import { Layers, Users, UserCheck, CalendarCheck, AlertTriangle } from 'lucide-react';
import { StatCard } from '../../components/common/StatCard';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { montessoriApi, fmtDate } from './montessoriApi';
import { MPageHeader, ProgressBadge, ghostBtn } from './MontessoriShared';

export type MontessoriModuleId =
  | 'montessori-dashboard'
  | 'montessori-sections'
  | 'montessori-teachers'
  | 'montessori-students'
  | 'montessori-attendance'
  | 'montessori-activities'
  | 'montessori-progress'
  | 'montessori-reports';

export const MontessoriDashboard: React.FC<{ onNavigate?: (m: MontessoriModuleId) => void }> = ({ onNavigate }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setData(await montessoriApi.dashboard());
    } catch (err: any) {
      setError(err?.message || 'Failed to load the Montessori dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState message="Loading Montessori dashboard..." rows={5} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const att = data.todayAttendance;
  const go = (m: MontessoriModuleId) => onNavigate?.(m);

  return (
    <div className="space-y-4">
      <MPageHeader
        title="Montessori Dashboard"
        description={`Live overview of KG sections for ${fmtDate(data.date)}.`}
        action={
          <div className="flex flex-wrap gap-1.5">
            <button className={ghostBtn} onClick={() => go('montessori-sections')}>Manage Sections</button>
            <button className={ghostBtn} onClick={() => go('montessori-students')}>Allocate Students</button>
            <button className={ghostBtn} onClick={() => go('montessori-reports')}>Reports</button>
          </div>
        }
      />

      {data.totals.sections === 0 ? (
        <EmptyState
          title="No Montessori sections yet"
          description="Create your KG sections (for example Play Group, Nursery, KG-1) to start using Montessori Management."
          actionLabel="Create a section"
          onAction={() => go('montessori-sections')}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Active Sections" value={data.totals.sections} subtitle={data.totals.sectionsWithoutClassTeacher ? `${data.totals.sectionsWithoutClassTeacher} without a class teacher` : 'All have a class teacher'} icon={<Layers className="w-4 h-4" />} accentColor="purple" onClick={() => go('montessori-sections')} />
            <StatCard label="Montessori Students" value={data.totals.students} subtitle="Currently allocated" icon={<Users className="w-4 h-4" />} accentColor="blue" onClick={() => go('montessori-students')} />
            <StatCard label="Assigned Teachers" value={data.totals.teachers} subtitle="Class teachers & assistants" icon={<UserCheck className="w-4 h-4" />} accentColor="emerald" onClick={() => go('montessori-teachers')} />
            <StatCard
              label="Today's Attendance"
              value={`${att.PRESENT + att.LATE} / ${data.totals.students}`}
              subtitle={`${att.ABSENT} absent · ${att.LEAVE} leave · ${att.notMarked} not marked`}
              icon={<CalendarCheck className="w-4 h-4" />}
              accentColor="amber"
              progress={data.totals.students ? Math.round(((att.PRESENT + att.LATE) / data.totals.students) * 100) : 0}
              onClick={() => go('montessori-attendance')}
            />
          </div>

          <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-x-auto">
            <div className="px-4 py-3 border-b border-slate-100 text-xs font-semibold text-slate-800">Section summary</div>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Section</th>
                  <th className="px-4 py-2 text-right">Students</th>
                  <th className="px-4 py-2 text-left">Class teacher</th>
                  <th className="px-4 py-2 text-right">Present today</th>
                  <th className="px-4 py-2 text-right">Absent / Leave</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.sections.map((s: any) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2 font-semibold text-slate-900">{s.name}</td>
                    <td className="px-4 py-2 text-right">{s.students}</td>
                    <td className="px-4 py-2">{s.hasClassTeacher ? 'Assigned' : <span className="text-rose-600 font-medium">Not assigned</span>}</td>
                    <td className="px-4 py-2 text-right">{s.attendanceToday.total ? s.attendanceToday.PRESENT + s.attendanceToday.LATE : <span className="text-slate-400">Not marked</span>}</td>
                    <td className="px-4 py-2 text-right">{s.attendanceToday.total ? `${s.attendanceToday.ABSENT} / ${s.attendanceToday.LEAVE}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Panel title="Recent learning activities" onMore={() => go('montessori-activities')}>
              {data.recentActivities.length === 0 ? (
                <Empty text="No activities yet." />
              ) : (
                data.recentActivities.map((a: any) => (
                  <Row key={a.id} title={a.title} meta={`${a.sectionName} · ${a.learningAreaName} · ${fmtDate(a.activityDate)}`} />
                ))
              )}
            </Panel>
            <Panel title="Needs additional practice" icon={<AlertTriangle className="w-3.5 h-3.5 text-rose-500" />} onMore={() => go('montessori-progress')}>
              {data.needsPractice.length === 0 ? (
                <Empty text="No students currently need extra practice." />
              ) : (
                data.needsPractice.map((p: any) => <Row key={p.id} title={p.studentName} meta={`${p.activityTitle} · ${p.sectionName}`} badge={<ProgressBadge status={p.status} />} />)
              )}
            </Panel>
            <Panel title="Recent progress updates" onMore={() => go('montessori-progress')}>
              {data.recentProgress.length === 0 ? (
                <Empty text="No progress recorded yet." />
              ) : (
                data.recentProgress.map((p: any) => <Row key={p.id} title={p.studentName} meta={`${p.activityTitle} · ${fmtDate(p.observedOn)}`} badge={<ProgressBadge status={p.status} />} />)
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
};

const Panel: React.FC<{ title: string; icon?: React.ReactNode; onMore: () => void; children: React.ReactNode }> = ({ title, icon, onMore, children }) => (
  <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs">
    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
      <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">{icon}{title}</span>
      <button onClick={onMore} className="text-[11px] text-amber-700 hover:underline">View all</button>
    </div>
    <div className="divide-y divide-slate-100">{children}</div>
  </div>
);
const Row: React.FC<{ title: string; meta: string; badge?: React.ReactNode }> = ({ title, meta, badge }) => (
  <div className="px-4 py-2 flex items-center justify-between gap-2 text-xs">
    <div className="min-w-0">
      <div className="font-semibold text-slate-800 truncate">{title}</div>
      <div className="text-[11px] text-slate-500 truncate">{meta}</div>
    </div>
    {badge}
  </div>
);
const Empty: React.FC<{ text: string }> = ({ text }) => <div className="px-4 py-6 text-center text-[11px] text-slate-400">{text}</div>;
