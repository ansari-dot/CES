import React, { useCallback, useEffect, useState } from 'react';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { montessoriApi, MSection, MRosterStudent, AttendanceStatus, ATTENDANCE_LABELS, todayLocal, fmtDate } from './montessoriApi';
import { MPageHeader, SectionSelect, AttendanceBadge, selectCls, inputCls, primaryBtn, errorText } from './MontessoriShared';

const STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'];

export const MontessoriAttendance: React.FC = () => {
  const toast = useToast();
  const [tab, setTab] = useState<'register' | 'report'>('register');
  const [sections, setSections] = useState<MSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    montessoriApi
      .sections(true)
      .then(setSections)
      .catch((err) => setError(err?.message || 'Failed to load sections'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading Montessori attendance..." rows={5} />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-4">
      <MPageHeader
        title="Montessori Attendance"
        description="Daily attendance recorded by section teachers. The Principal can review and correct any date; every correction is logged."
        action={
          <div className="flex gap-1.5">
            {(['register', 'report'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${tab === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>
                {t === 'register' ? 'Daily Register' : 'Attendance Report'}
              </button>
            ))}
          </div>
        }
      />
      {sections.length === 0 ? (
        <EmptyState title="No Montessori sections" description="Create sections and allocate students first." />
      ) : tab === 'register' ? (
        <Register sections={sections} toast={toast} />
      ) : (
        <Report sections={sections} toast={toast} />
      )}
    </div>
  );
};

const Register: React.FC<{ sections: MSection[]; toast: any }> = ({ sections, toast }) => {
  const [sectionId, setSectionId] = useState<number | ''>(sections.find((s) => s.isActive)?.id || '');
  const [date, setDate] = useState(todayLocal());
  const [roster, setRoster] = useState<{ isMarked: boolean; canEdit: boolean; students: MRosterStudent[] } | null>(null);
  const [marks, setMarks] = useState<Record<number, { status: AttendanceStatus | ''; remarks: string }>>({});
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!sectionId) return;
    try {
      const r = await montessoriApi.attendance(sectionId, date);
      setRoster(r);
      setMarks(Object.fromEntries(r.students.map((s) => [s.studentId, { status: (s.status || '') as AttendanceStatus | '', remarks: s.remarks || '' }])));
    } catch (err: any) {
      toast.error(errorText(err, 'Failed to load attendance'));
    }
  }, [sectionId, date, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!sectionId || !roster) return;
    const records = roster.students
      .filter((s) => marks[s.studentId]?.status)
      .map((s) => ({ studentId: s.studentId, status: marks[s.studentId].status as AttendanceStatus, remarks: marks[s.studentId].remarks || null }));
    if (!records.length) return toast.warning('Mark at least one student.');
    if (roster.isMarked && reason.trim().length < 3) return toast.warning('Enter a reason for correcting saved attendance.');
    try {
      setSaving(true);
      const res = await montessoriApi.saveAttendance(sectionId, { date, records, reason: reason.trim() || undefined });
      toast.success(`Attendance saved (${res.created} new, ${res.corrected} corrected).`);
      setReason('');
      load();
    } catch (err: any) {
      toast.error(errorText(err, 'Failed to save attendance'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
        <SectionSelect sections={sections} value={sectionId} onChange={setSectionId} />
        <input type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} className={selectCls} />
        {roster && <span className="text-[11px] text-slate-500">{roster.isMarked ? 'Saved — changes are corrections' : 'Not marked yet'}</span>}
        {roster && roster.students.length > 0 && roster.canEdit && (
          <button
            type="button"
            onClick={() => setMarks((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { ...v, status: v.status || 'PRESENT' }])))}
            className="ml-auto text-[11px] text-amber-700 hover:underline"
          >
            Mark remaining present
          </button>
        )}
      </div>
      {!roster ? (
        <p className="px-4 py-6 text-center text-xs text-slate-400">Select a section.</p>
      ) : roster.students.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-slate-400">No students were allocated to this section on {fmtDate(date)}.</p>
      ) : (
        <>
          <div className="divide-y divide-slate-100">
            {roster.students.map((s) => (
              <div key={s.studentId} className="px-4 py-2 flex flex-wrap items-center gap-2 text-xs">
                <div className="w-48 min-w-0">
                  <div className="font-semibold text-slate-800 truncate">{s.name}</div>
                  <div className="text-[10px] text-slate-400">{s.admissionNo}{s.updatedBy ? ` · by ${s.updatedBy}` : ''}</div>
                </div>
                <div className="flex gap-1">
                  {STATUSES.map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={!roster.canEdit}
                      onClick={() => setMarks((m) => ({ ...m, [s.studentId]: { ...m[s.studentId], status: st } }))}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] ${marks[s.studentId]?.status === st ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'} disabled:opacity-60`}
                    >
                      {ATTENDANCE_LABELS[st]}
                    </button>
                  ))}
                </div>
                <input
                  value={marks[s.studentId]?.remarks || ''}
                  disabled={!roster.canEdit}
                  onChange={(e) => setMarks((m) => ({ ...m, [s.studentId]: { ...m[s.studentId], remarks: e.target.value } }))}
                  placeholder="Remarks"
                  maxLength={255}
                  className={`${selectCls} flex-1 min-w-[140px]`}
                />
              </div>
            ))}
          </div>
          {roster.canEdit && (
            <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
              {roster.isMarked && (
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for correction *" maxLength={300} className={`${inputCls} max-w-sm`} />
              )}
              <button onClick={save} disabled={saving} className={`${primaryBtn} ml-auto`}>{saving ? 'Saving…' : 'Save Attendance'}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const Report: React.FC<{ sections: MSection[]; toast: any }> = ({ sections, toast }) => {
  const [filters, setFilters] = useState({ sectionId: '' as number | '', from: '', to: '' });
  const [data, setData] = useState<Awaited<ReturnType<typeof montessoriApi.attendanceReport>> | null>(null);

  useEffect(() => {
    montessoriApi
      .attendanceReport(filters)
      .then(setData)
      .catch((err) => toast.error(errorText(err, 'Failed to load report')));
  }, [filters, toast]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SectionSelect sections={sections} value={filters.sectionId} onChange={(sectionId) => setFilters({ ...filters, sectionId })} allowAll />
        <label className="text-[11px] text-slate-500">From <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className={selectCls} /></label>
        <label className="text-[11px] text-slate-500">To <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className={selectCls} /></label>
      </div>
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            {[['Records', data.totals.total], ['Present', data.totals.PRESENT], ['Late', data.totals.LATE], ['Absent', data.totals.ABSENT], ['Leave', data.totals.LEAVE]].map(([l, v]) => (
              <div key={String(l)} className="p-3 rounded-xl bg-white border border-slate-200"><div className="text-slate-500">{l}</div><div className="text-lg font-semibold text-slate-900">{v}</div></div>
            ))}
          </div>
          <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-x-auto">
            {data.students.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-400">No attendance recorded for these filters.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Student</th>
                    <th className="px-4 py-2 text-left">Section</th>
                    {STATUSES.map((s) => <th key={s} className="px-4 py-2 text-right">{ATTENDANCE_LABELS[s]}</th>)}
                    <th className="px-4 py-2 text-right">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.students.map((s) => (
                    <tr key={s.studentId}>
                      <td className="px-4 py-2 font-semibold text-slate-800">{s.name}</td>
                      <td className="px-4 py-2 text-slate-500">{s.sectionName}</td>
                      {STATUSES.map((st) => <td key={st} className="px-4 py-2 text-right">{(s as any)[st]}</td>)}
                      <td className="px-4 py-2 text-right font-semibold">{s.attendanceRate != null ? `${s.attendanceRate}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {data.days.length > 0 && (
            <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs p-4 text-xs">
              <div className="font-semibold text-slate-800 mb-2">Day-wise</div>
              <div className="flex flex-wrap gap-2">
                {data.days.slice(0, 31).map((d) => (
                  <div key={d.date} className="px-2.5 py-1.5 rounded-lg border border-slate-200">
                    <div className="text-slate-500">{fmtDate(d.date)}</div>
                    <div className="flex gap-1 mt-0.5"><AttendanceBadge status="PRESENT" />{d.PRESENT + d.LATE}<AttendanceBadge status="ABSENT" />{d.ABSENT}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
