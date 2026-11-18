import React, { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { montessoriApi, MSection, MRosterStudent, PROGRESS_LABELS, ProgressStatus, fmtDate } from './montessoriApi';
import { MPageHeader, SectionSelect, ProgressBadge, selectCls, primaryBtn, errorText } from './MontessoriShared';

/**
 * Montessori section and student reports. Printing / PDF uses the browser print of
 * the `.print-area` region, as the rest of the Principal portal does.
 */
export const MontessoriReports: React.FC = () => {
  const toast = useToast();
  const [sections, setSections] = useState<MSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<'section' | 'student'>('section');
  const [sectionId, setSectionId] = useState<number | ''>('');
  const [roster, setRoster] = useState<MRosterStudent[]>([]);
  const [studentId, setStudentId] = useState<number | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<any>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    montessoriApi
      .sections(true)
      .then((s) => {
        setSections(s);
        if (s.length) setSectionId(s[0].id);
      })
      .catch((err) => setError(err?.message || 'Failed to load sections'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setStudentId('');
    if (!sectionId) return setRoster([]);
    montessoriApi.sectionStudents(sectionId).then(setRoster).catch(() => setRoster([]));
  }, [sectionId]);

  const run = async () => {
    try {
      setRunning(true);
      setReport(null);
      if (kind === 'section' && sectionId) setReport({ kind, data: await montessoriApi.sectionReport(sectionId, { from, to }) });
      if (kind === 'student' && studentId) setReport({ kind, data: await montessoriApi.studentReport(studentId, { from, to }) });
    } catch (err: any) {
      toast.error(errorText(err, 'Failed to generate the report'));
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <LoadingState message="Loading report options..." rows={4} />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!sections.length) return <EmptyState title="No Montessori sections" description="Reports become available once sections have students." />;

  return (
    <div className="space-y-4">
      <MPageHeader title="Montessori Progress Reports" description="Section-wise and individual student development reports. Use Print to save as PDF." />
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-wrap items-end gap-2 print:hidden">
        <div className="flex gap-1.5">
          {(['section', 'student'] as const).map((k) => (
            <button key={k} onClick={() => { setKind(k); setReport(null); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${kind === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>
              {k === 'section' ? 'Section report' : 'Student report'}
            </button>
          ))}
        </div>
        <SectionSelect sections={sections} value={sectionId} onChange={setSectionId} />
        {kind === 'student' && (
          <select value={studentId} onChange={(e) => setStudentId(e.target.value ? Number(e.target.value) : '')} className={selectCls}>
            <option value="">Select student</option>
            {roster.map((s) => <option key={s.studentId} value={s.studentId}>{s.name}</option>)}
          </select>
        )}
        <label className="text-[11px] text-slate-500">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={selectCls} /></label>
        <label className="text-[11px] text-slate-500">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={selectCls} /></label>
        <button onClick={run} disabled={running || (kind === 'section' ? !sectionId : !studentId)} className={primaryBtn}>{running ? 'Generating…' : 'Generate'}</button>
        {report && (
          <button onClick={() => window.print()} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs flex items-center gap-1.5">
            <Printer className="w-3.5 h-3.5" /> Print / PDF
          </button>
        )}
      </div>

      {report && (
        <div className="print-area rounded-2xl bg-white border border-slate-200/90 shadow-xs p-5 space-y-4 text-xs" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } as React.CSSProperties}>
          <div className="bg-[#1b1a47] text-white rounded-xl px-5 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white overflow-hidden shrink-0"><img src="/logo.jpeg" alt="" className="w-full h-full object-contain" /></div>
              <div className="leading-tight">
                <div className="font-heading font-extrabold tracking-wide">CAMBRIDGE</div>
                <div className="text-[11px] text-white/85">Montessori {report.kind === 'section' ? 'Section' : 'Student'} Report</div>
              </div>
            </div>
            <div className="text-right text-[11px] text-white/85">
              {report.data.period.from || report.data.period.to ? `${fmtDate(report.data.period.from)} – ${fmtDate(report.data.period.to)}` : 'All dates'}
            </div>
          </div>
          {report.kind === 'section' ? <SectionReportView r={report.data} /> : <StudentReportView r={report.data} />}
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 break-inside-avoid">
    <div className="text-slate-500">{label}</div>
    <div className="text-base font-semibold text-slate-900">{value}</div>
  </div>
);

const SectionReportView: React.FC<{ r: any }> = ({ r }) => (
  <>
    <div>
      <div className="text-base font-semibold text-slate-900">{r.section.name}</div>
      <div className="text-slate-500">{r.section.sessionName} · {r.teachers.map((t: any) => `${t.name} (${t.role === 'CLASS_TEACHER' ? 'class teacher' : 'assistant'})`).join(', ') || 'No teacher assigned'}</div>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat label="Students" value={r.totals.students} />
      <Stat label="Attendance rate" value={r.attendance.attendanceRate != null ? `${r.attendance.attendanceRate}%` : '—'} />
      <Stat label="Activities" value={r.totals.activities} />
      <Stat label="Progress records" value={r.totals.progressRecords} />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="break-inside-avoid">
        <div className="font-semibold text-slate-800 mb-1">Activity completion overview (latest per student & activity)</div>
        {(Object.keys(PROGRESS_LABELS) as ProgressStatus[]).map((s) => (
          <div key={s} className="flex justify-between py-0.5"><ProgressBadge status={s} /><span>{r.completionOverview[s]}</span></div>
        ))}
      </div>
      <div className="break-inside-avoid">
        <div className="font-semibold text-slate-800 mb-1">Activities by learning area</div>
        {r.activitiesByArea.length ? r.activitiesByArea.map((a: any) => <div key={a.area} className="flex justify-between py-0.5"><span>{a.area}</span><span>{a.count}</span></div>) : <div className="text-slate-400">No activities.</div>}
        <div className="font-semibold text-slate-800 mt-2 mb-1">Attendance summary</div>
        <div>Present {r.attendance.PRESENT} · Late {r.attendance.LATE} · Absent {r.attendance.ABSENT} · Leave {r.attendance.LEAVE}</div>
      </div>
    </div>
    <table className="w-full border border-slate-200">
      <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
        <tr>
          <th className="px-3 py-1.5 text-left">Student</th>
          <th className="px-3 py-1.5 text-right">Attendance</th>
          <th className="px-3 py-1.5 text-right">Observed</th>
          <th className="px-3 py-1.5 text-right">Completed</th>
          <th className="px-3 py-1.5 text-right">Needs improvement</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {r.students.map((s: any) => (
          <tr key={s.studentId}>
            <td className="px-3 py-1.5">{s.name}</td>
            <td className="px-3 py-1.5 text-right">{s.attendanceRate != null ? `${s.attendanceRate}%` : '—'}</td>
            <td className="px-3 py-1.5 text-right">{s.activitiesObserved}</td>
            <td className="px-3 py-1.5 text-right">{s.completed}</td>
            <td className="px-3 py-1.5 text-right">{s.needsImprovement}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </>
);

export const StudentReportView: React.FC<{ r: any }> = ({ r }) => (
  <>
    <div>
      <div className="text-base font-semibold text-slate-900">{r.student.name}</div>
      <div className="text-slate-500">
        Admission {r.student.admissionNo} · {r.currentSection ? `${r.currentSection.name} (${r.currentSection.sessionName}) since ${fmtDate(r.currentSection.since)}` : 'Not currently allocated'}
        {r.teachers.length ? ` · ${r.teachers.map((t: any) => t.name).join(', ')}` : ''}
      </div>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat label="Attendance rate" value={r.attendance.attendanceRate != null ? `${r.attendance.attendanceRate}%` : '—'} />
      <Stat label="Days recorded" value={r.attendance.total} />
      <Stat label="Completed activities" value={r.completedActivities.length} />
      <Stat label="Needs improvement" value={r.needsImprovement.length} />
    </div>
    <ListBlock title="Completed activities" items={r.completedActivities} />
    <ListBlock title="Activities requiring improvement" items={r.needsImprovement} showSuggestion />
    <div className="break-inside-avoid">
      <div className="font-semibold text-slate-800 mb-1">Teacher observations</div>
      {r.observations.length ? (
        r.observations.map((o: any) => (
          <div key={o.id} className="py-1 border-b border-slate-100">
            <span className="text-slate-500">{fmtDate(o.observedOn)} · {o.activityTitle}:</span> {o.observationNotes || o.remarks}
          </div>
        ))
      ) : (
        <div className="text-slate-400">No observations recorded.</div>
      )}
    </div>
    <div>
      <div className="font-semibold text-slate-800 mb-1">Progress history</div>
      <table className="w-full border border-slate-200">
        <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
          <tr><th className="px-3 py-1.5 text-left">Date</th><th className="px-3 py-1.5 text-left">Activity</th><th className="px-3 py-1.5 text-left">Status</th><th className="px-3 py-1.5 text-left">Teacher</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {r.history.map((h: any) => (
            <tr key={h.id}><td className="px-3 py-1.5">{fmtDate(h.observedOn)}</td><td className="px-3 py-1.5">{h.activityTitle}</td><td className="px-3 py-1.5"><ProgressBadge status={h.status} /></td><td className="px-3 py-1.5">{h.teacherName || '—'}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
);

const ListBlock: React.FC<{ title: string; items: any[]; showSuggestion?: boolean }> = ({ title, items, showSuggestion }) => (
  <div className="break-inside-avoid">
    <div className="font-semibold text-slate-800 mb-1">{title}</div>
    {items.length ? (
      items.map((p) => (
        <div key={p.id} className="flex items-start justify-between gap-2 py-1 border-b border-slate-100">
          <div>
            <div>{p.activityTitle} <span className="text-slate-400">· {p.learningAreaName}</span></div>
            {p.remarks && <div className="text-slate-500">{p.remarks}</div>}
            {showSuggestion && p.improvementSuggestions && <div className="text-amber-700">Suggestion: {p.improvementSuggestions}</div>}
          </div>
          <ProgressBadge status={p.status} />
        </div>
      ))
    ) : (
      <div className="text-slate-400">None.</div>
    )}
  </div>
);
