import React, { useEffect, useState } from 'react';
import { X, GraduationCap, Award, BarChart3 } from 'lucide-react';
import { requestApi } from '../../services/api';
import { useAppSelector, useAppDispatch } from '../../store';
import { setCurrentTab } from '../../store/slices/uiSlice';
import { parseUtcInstant, getBrowserTimeZone, DEFAULT_SCHOOL_TIMEZONE } from '../../lib/timezone';
import { StudentAnnualPerformanceSummary } from './StudentAnnualPerformanceSummary';

interface Props {
  studentId: string;
  studentName: string;
  onClose: () => void;
}

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(Number(v))}%`);

const gradeTone = (p: number | null | undefined) =>
  p === null || p === undefined
    ? 'text-slate-400'
    : p >= 80
    ? 'text-emerald-700'
    : p >= 60
    ? 'text-indigo-700'
    : p >= 40
    ? 'text-amber-700'
    : 'text-rose-700';

/**
 * A student's grades as recorded in the system (graded tasks and tests, subject averages,
 * attendance), opened from the teacher's Students roster. Data comes from
 * GET /api/v1/students/:id/grades, which only allows students in the teacher's classes.
 */
export const StudentGradesModal: React.FC<Props> = ({ studentId, studentName, onClose }) => {
  const dispatch = useAppDispatch();
  const [viewMode, setViewMode] = useState<'annual' | 'activity'>('annual');
  const tz = (useAppSelector((s: any) => s.timetable?.timezone) as string) || getBrowserTimeZone() || DEFAULT_SCHOOL_TIMEZONE;
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    requestApi<any>(`/api/v1/students/${studentId}/grades`)
      .then((res) => alive && setData(res))
      .catch((err) => alive && setError(err?.message || 'Unable to load grades'));
    return () => {
      alive = false;
    };
  }, [studentId]);

  const date = (v: string | null | undefined) => {
    const d = parseUtcInstant(v || null);
    return d ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: tz }).format(d) : '—';
  };

  const s = data?.summary;
  const tests = data?.academicProgress?.testsSummary;
  const subjects: any[] = (data?.subjects || []).filter((x: any) => x.totalTasks > 0 || x.gradedTasks > 0);
  const results: any[] = data?.recentResults || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs" onClick={onClose}>
      <div
        className="bg-white rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-y-auto border border-slate-200 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-xs z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#36348e]/10 text-[#36348e] flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-black text-slate-900">{s?.studentName || studentName}</div>
              <div className="text-xs text-slate-500">
                {s ? `${s.className}${s.rollNumber ? ` · Roll ${s.rollNumber}` : ''} · ${s.admissionNumber}` : 'Grades & Academic Progress'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('annual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'annual'
                    ? 'bg-white text-indigo-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-indigo-600" />
                <span>Annual Performance</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('activity')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'activity'
                    ? 'bg-white text-indigo-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-slate-600" />
                <span>Activity &amp; Tasks Log</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {viewMode === 'annual' ? (
          <div className="p-4 sm:p-6">
            <StudentAnnualPerformanceSummary
              studentId={studentId}
              studentName={studentName}
              onClose={onClose}
              onOpenMarksEntry={(_subjectId, _subjectName, _classId) => {
                onClose();
                dispatch(setCurrentTab('exam-results'));
              }}
            />
          </div>
        ) : (
          <div>
            {error ? (
              <div className="p-8 text-center text-xs text-rose-600">{error}</div>
            ) : !data ? (
              <div className="p-10 text-center text-xs text-slate-400">Loading grades…</div>
            ) : (
              <div className="p-5 space-y-5 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    ['Overall average', s.overallAverage !== null && s.overallAverage !== undefined ? `${s.overallAverageDisplay || pct(s.overallAverage)}` : '—', s.overallGrade && s.overallGrade !== '—' ? `Grade ${s.overallGrade}` : 'No graded work yet', gradeTone(s.overallAverage)],
                    ['Attendance', pct(s.attendanceRate), 'of recorded lessons', gradeTone(s.attendanceRate)],
                    ['Tasks submitted', `${s.submittedTasks}/${s.totalTasks}`, `${s.gradedTasks} graded`, 'text-slate-900'],
                    ['Overdue tasks', String(s.overdueTasks), s.pendingGradingTasks ? `${s.pendingGradingTasks} awaiting grading` : 'not submitted', s.overdueTasks ? 'text-rose-700' : 'text-slate-900'],
                    ['Tests & quizzes', tests && tests.count ? pct(tests.avgPercentage) : '—', tests && tests.count ? `${tests.gradedCount} of ${tests.count} graded` : 'none yet', gradeTone(tests && tests.count ? tests.avgPercentage : null)]
                  ].map(([label, value, sub, tone]) => (
                    <div key={label} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
                      <div className={`text-lg font-black mt-0.5 ${tone}`}>{value}</div>
                      <div className="text-[10px] text-slate-500">{sub}</div>
                    </div>
                  ))}
                </div>

                <section>
                  <h3 className="text-sm font-bold text-slate-900 mb-2">Subject grades</h3>
                  {subjects.length === 0 ? (
                    <p className="text-slate-500">No subject has graded work yet.</p>
                  ) : (
                    <table className="w-full text-left">
                      <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-1.5">Subject</th>
                          <th>Teacher</th>
                          <th className="text-center">Graded</th>
                          <th className="text-center">Marks</th>
                          <th className="text-center">Average</th>
                          <th className="text-center">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {subjects.map((sub) => (
                          <tr key={sub.subjectId}>
                            <td className="py-2 font-semibold text-slate-800">{sub.subjectName}</td>
                            <td className="text-slate-600">{sub.teacherName}</td>
                            <td className="text-center font-mono">{sub.gradedTasks}/{sub.totalTasks}</td>
                            <td className="text-center font-mono">{sub.maxMarks ? `${sub.marksObtained}/${sub.maxMarks}` : '—'}</td>
                            <td className={`text-center font-bold ${gradeTone(sub.percentage)}`}>{pct(sub.percentage)}</td>
                            <td className="text-center font-bold text-slate-800">{sub.grade || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>

                <section>
                  <h3 className="text-sm font-bold text-slate-900 mb-2">Graded work</h3>
                  {results.length === 0 ? (
                    <p className="text-slate-500">No graded assignments or tests yet.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                      {results.map((r) => (
                        <li key={r.submissionId || `${r.taskId}-${r.gradedAt}`} className="px-3 py-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900">{r.title}</div>
                              <div className="text-[10px] text-slate-500">
                                {r.subjectName} · {String(r.taskType || '').toLowerCase()} · graded {date(r.gradedAt)}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className={`text-sm font-black ${gradeTone(r.percentage)}`}>
                                {r.marksAwarded}/{r.maxMarks}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {pct(r.percentage)} · {r.grade}
                              </div>
                            </div>
                          </div>
                          {r.feedback && <div className="mt-1 text-[11px] text-slate-600">Feedback: {r.feedback}</div>}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {s?.latestRemark && (
                  <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 text-indigo-900">
                    <span className="font-bold">Latest remark</span> ({s.latestRemark.subjectName}, {s.latestRemark.teacherName}): {s.latestRemark.comment}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
