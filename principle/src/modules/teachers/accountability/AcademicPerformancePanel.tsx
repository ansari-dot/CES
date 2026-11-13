import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Download, AlertTriangle } from 'lucide-react';
import { requestApi } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { TeacherEvidenceDetail } from './TeacherEvidenceDetail';
import { currentMonthKey, downloadCsv, statusMeta } from './shared';

interface OverviewRow {
  teacherId: number;
  teacherName: string;
  employeeNo: string | null;
  classes: string[];
  subjects: string[];
  quizzes: { required: number; completed: number };
  assignments: { required: number; completed: number };
  tests: { required: number; completed: number };
  pendingGrading: number;
  overdueGrading: number;
  dueSoonGrading: number;
  onTimeRate: number | null;
  gradedCount: number;
  missedRequirements: number;
  outstanding: number;
  status: string;
}

const STATUS_FILTERS = ['ALL', 'OVERDUE', 'DUE_SOON', 'PENDING', 'ON_TRACK', 'COMPLETED', 'EXCUSED'];

const fraction = (c: { required: number; completed: number }) =>
  c.required === 0 ? <span className="text-slate-300">—</span> : (
    <span className={c.completed >= c.required ? 'text-emerald-700 font-semibold' : 'text-slate-700'}>
      {c.completed}/{c.required}
    </span>
  );

export const AcademicPerformancePanel: React.FC = () => {
  const toast = useToast();
  const [view, setView] = useState<'overview' | 'reports'>('overview');
  const [period, setPeriod] = useState(currentMonthKey());
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [detail, setDetail] = useState<{ teacherId: number; focusOverdue: boolean } | null>(null);

  // reports
  const [fromMonth, setFromMonth] = useState(currentMonthKey());
  const [toMonth, setToMonth] = useState(currentMonthKey());
  const [report, setReport] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await requestApi<{ rows: OverviewRow[] }>(`/api/v1/accountability/overview?period=${period}`);
      setRows(res?.rows || []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load teacher performance');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [period, toast]);

  useEffect(() => {
    if (view === 'overview') load();
  }, [load, view]);

  const loadReport = async () => {
    setReportLoading(true);
    try {
      const res = await requestApi<{ rows: any[] }>(`/api/v1/accountability/reports?from=${fromMonth}&to=${toMonth}`);
      setReport(res?.rows || []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load report');
    } finally {
      setReportLoading(false);
    }
  };

  const classOptions = useMemo(() => Array.from(new Set(rows.flatMap((r) => r.classes))).sort(), [rows]);
  const subjectOptions = useMemo(() => Array.from(new Set(rows.flatMap((r) => r.subjects))).sort(), [rows]);

  const visible = rows.filter(
    (r) =>
      (!search || r.teacherName.toLowerCase().includes(search.toLowerCase()) || String(r.employeeNo || '').toLowerCase().includes(search.toLowerCase())) &&
      (!classFilter || r.classes.includes(classFilter)) &&
      (!subjectFilter || r.subjects.includes(subjectFilter)) &&
      (statusFilter === 'ALL' || r.status === statusFilter)
  );

  const totals = {
    overdue: rows.reduce((s, r) => s + r.overdueGrading, 0),
    missed: rows.reduce((s, r) => s + r.missedRequirements, 0),
    teachersAtRisk: rows.filter((r) => r.status === 'OVERDUE').length
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-wrap items-center gap-2 text-xs">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 font-medium">
          {(['overview', 'reports'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 rounded-md cursor-pointer ${view === v ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-600'}`}
            >
              {v === 'overview' ? 'Monthly overview' : 'Reports & history'}
            </button>
          ))}
        </div>

        {view === 'overview' ? (
          <>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <input type="month" value={period} max={currentMonthKey()} onChange={(e) => setPeriod(e.target.value || currentMonthKey())} className="bg-transparent font-bold text-slate-900 outline-none text-xs" />
            </div>
            <input placeholder="Search teacher…" value={search} onChange={(e) => setSearch(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 min-w-36" />
            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <option value="">All classes</option>
              {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <option value="">All subjects</option>
              {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : statusMeta(s).label}</option>)}
            </select>
          </>
        ) : (
          <>
            <label className="flex items-center gap-1 text-slate-600">From <input type="month" value={fromMonth} max={currentMonthKey()} onChange={(e) => setFromMonth(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1" /></label>
            <label className="flex items-center gap-1 text-slate-600">To <input type="month" value={toMonth} max={currentMonthKey()} onChange={(e) => setToMonth(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1" /></label>
            <button onClick={loadReport} className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium cursor-pointer">Generate report</button>
            {report.length > 0 && (
              <button
                onClick={() =>
                  downloadCsv(
                    `teacher-academic-performance-${fromMonth}-to-${toMonth}.csv`,
                    ['Month', 'Teacher', 'Quizzes', 'Assignments', 'Tests', 'Requirement completion %', 'Graded', 'On-time grading %', 'Avg turnaround (h)', 'Pending grading', 'Overdue grading', 'Exceptions'],
                    report.map((r) => [
                      r.period, r.teacherName,
                      `${r.quizzesCompleted}/${r.quizzesRequired}`, `${r.assignmentsCompleted}/${r.assignmentsRequired}`, `${r.testsCompleted}/${r.testsRequired}`,
                      r.requirementCompletionRate ?? '', r.graded, r.onTimeGradingRate ?? '', r.avgTurnaroundHours ?? '', r.pendingGrading, r.overdueGrading, r.exceptions
                    ])
                  )
                }
                className="ml-auto px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            )}
          </>
        )}
      </div>

      {view === 'overview' && totals.teachersAtRisk > 0 && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {totals.teachersAtRisk} teacher(s) have overdue work: {totals.overdue} grading item(s) past deadline
            {totals.missed ? ` and ${totals.missed} missed monthly requirement(s)` : ''}. Click a teacher to see the exact items, deadlines and how late they are.
          </span>
        </div>
      )}

      {view === 'overview' ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Teacher</th>
                  <th className="px-4 py-3">Classes / Subjects</th>
                  <th className="px-4 py-3 text-center">Quizzes</th>
                  <th className="px-4 py-3 text-center">Assignments</th>
                  <th className="px-4 py-3 text-center">Tests</th>
                  <th className="px-4 py-3 text-center">Pending grading</th>
                  <th className="px-4 py-3 text-center">Overdue</th>
                  <th className="px-4 py-3 text-center">On-time</th>
                  <th className="px-4 py-3 text-center">Outstanding</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">Calculating from published work and submissions…</td></tr>
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                      {rows.length === 0 ? 'No teacher has an active academic work policy for this month. Create one under Work Policies.' : 'No teachers match these filters.'}
                    </td>
                  </tr>
                ) : (
                  visible.map((r) => {
                    const meta = statusMeta(r.status);
                    return (
                      <tr key={r.teacherId} onClick={() => setDetail({ teacherId: r.teacherId, focusOverdue: false })} className="hover:bg-slate-50/80 cursor-pointer">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{r.teacherName}</div>
                          {r.employeeNo && <div className="font-mono text-[10px] text-slate-400">{r.employeeNo}</div>}
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-56">
                          <div className="truncate">{r.classes.join(', ') || '—'}</div>
                          <div className="truncate text-[10px] text-slate-400">{r.subjects.join(', ')}</div>
                        </td>
                        <td className="px-4 py-3 text-center font-mono">{fraction(r.quizzes)}</td>
                        <td className="px-4 py-3 text-center font-mono">{fraction(r.assignments)}</td>
                        <td className="px-4 py-3 text-center font-mono">{fraction(r.tests)}</td>
                        <td className="px-4 py-3 text-center font-mono">{r.pendingGrading || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          {r.overdueGrading > 0 ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetail({ teacherId: r.teacherId, focusOverdue: true });
                              }}
                              className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 font-bold hover:bg-rose-100"
                              title="Show the exact overdue items"
                            >
                              {r.overdueGrading}
                            </button>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-mono">{r.onTimeRate === null ? '—' : `${r.onTimeRate}%`}</td>
                        <td className="px-4 py-3 text-center font-mono">{r.outstanding || '—'}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={meta.label} variant={meta.variant} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-[10px] text-slate-400 border-t border-slate-100">
            Counts come from published quizzes, assignments and tests and from real student submissions. Drafts are not counted unless the policy allows it. Click a row for evidence.
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Teacher</th>
                  <th className="px-4 py-3 text-center">Quizzes</th>
                  <th className="px-4 py-3 text-center">Assignments</th>
                  <th className="px-4 py-3 text-center">Tests</th>
                  <th className="px-4 py-3 text-center">Completion</th>
                  <th className="px-4 py-3 text-center">On-time grading</th>
                  <th className="px-4 py-3 text-center">Avg turnaround</th>
                  <th className="px-4 py-3 text-center">Pending / Overdue</th>
                  <th className="px-4 py-3 text-center">Exceptions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportLoading ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">Building report…</td></tr>
                ) : report.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">Choose a month range and generate the report.</td></tr>
                ) : (
                  report.map((r) => (
                    <tr key={`${r.period}-${r.teacherId}`} className="hover:bg-slate-50/80">
                      <td className="px-4 py-2.5 font-mono">{r.period}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-900">{r.teacherName}</td>
                      <td className="px-4 py-2.5 text-center font-mono">{r.quizzesCompleted}/{r.quizzesRequired}</td>
                      <td className="px-4 py-2.5 text-center font-mono">{r.assignmentsCompleted}/{r.assignmentsRequired}</td>
                      <td className="px-4 py-2.5 text-center font-mono">{r.testsCompleted}/{r.testsRequired}</td>
                      <td className="px-4 py-2.5 text-center font-mono">{r.requirementCompletionRate === null ? '—' : `${r.requirementCompletionRate}%`}</td>
                      <td className="px-4 py-2.5 text-center font-mono">
                        {r.onTimeGradingRate === null ? '—' : `${r.onTimeGradingRate}%`}
                        <span className="text-slate-400"> ({r.graded})</span>
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono">{r.avgTurnaroundHours === null ? '—' : `${r.avgTurnaroundHours} h`}</td>
                      <td className="px-4 py-2.5 text-center font-mono">
                        {r.pendingGrading} / <span className={r.overdueGrading ? 'text-rose-700 font-bold' : ''}>{r.overdueGrading}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono">{r.exceptions}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detail && (
        <TeacherEvidenceDetail
          teacherId={detail.teacherId}
          period={period}
          focusOverdue={detail.focusOverdue}
          onClose={() => setDetail(null)}
          onChanged={load}
        />
      )}
    </div>
  );
};
