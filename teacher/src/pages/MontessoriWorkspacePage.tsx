import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, Users, CheckCircle2, BookOpen, TrendingUp, Plus, Pencil, Archive, RotateCcw, Paperclip, Loader2, X, History, AlertCircle } from 'lucide-react';
import { useAppDispatch } from '../store';
import { addToast } from '../store/slices/uiSlice';
import { requestApi, openProtectedFile } from '../services/api';
import {
  montessoriApi,
  MySection,
  MRosterStudent,
  MActivity,
  MProgress,
  MAttendance,
  MProgressStatus,
  ATTENDANCE_LABELS,
  PROGRESS_LABELS,
  PROGRESS_STYLES,
  todayLocal,
  fmtDate
} from '../services/montessoriApi';

export type MontessoriView = 'class' | 'attendance' | 'activities' | 'progress';
const card = 'rounded-2xl bg-white border border-slate-200 shadow-xs';
const input = 'w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500';
const primary = 'px-4 py-2 bg-[#36348e] hover:bg-[#1b1a47] text-white rounded-xl text-xs font-bold disabled:opacity-50';
const ghost = 'px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold';

const Badge: React.FC<{ status: MProgressStatus }> = ({ status }) => (
  <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-bold ${PROGRESS_STYLES[status]}`}>{PROGRESS_LABELS[status]}</span>
);

/**
 * Montessori class-teacher workflow: one teacher, all learning areas, daily activities and
 * development-based progress. Only sections the teacher is actively assigned to are shown;
 * the backend enforces the same rule. Regular subject workflows are untouched.
 */
export const MontessoriWorkspacePage: React.FC<{ view: MontessoriView }> = ({ view }) => {
  const dispatch = useAppDispatch();
  const toast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => dispatch(addToast({ message, type })), [dispatch]);
  const [sections, setSections] = useState<MySection[]>([]);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const s = await montessoriApi.mySections();
      setSections(s);
      setSectionId((cur) => (cur && s.some((x) => x.id === cur) ? cur : s[0]?.id ?? null));
    } catch (err: any) {
      setError(err?.message || 'Failed to load your Montessori sections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  const section = sections.find((s) => s.id === sectionId) || null;
  const titles: Record<MontessoriView, [string, React.ElementType]> = {
    class: ['My Montessori Class', Users],
    attendance: ['Montessori Attendance', CheckCircle2],
    activities: ['Daily Learning Activities', BookOpen],
    progress: ['Student Progress & History', TrendingUp]
  };
  const [title, Icon] = titles[view];

  return (
    <div className="flex flex-col w-full pb-12 space-y-5 animate-in fade-in duration-150">
      <div className={`${card} p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#36348e] text-white flex items-center justify-center shadow-md shrink-0">
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Montessori
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-[#1e1b4b] tracking-tight mt-1">{title}</h1>
            <p className="text-xs text-slate-500 font-medium">Class-teacher workflow for your assigned KG section.</p>
          </div>
        </div>
        {sections.length > 1 && (
          <select value={sectionId ?? ''} onChange={(e) => setSectionId(Number(e.target.value))} className="text-xs border border-slate-200 rounded-lg px-3 py-2 font-semibold">
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className={`${card} p-10 text-center text-xs text-slate-500`}><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading…</div>
      ) : error ? (
        <div className={`${card} p-6 text-xs text-rose-700 flex items-center gap-2`}><AlertCircle className="w-4 h-4" />{error}<button onClick={loadSections} className={`${ghost} ml-auto`}>Retry</button></div>
      ) : !section ? (
        <div className={`${card} p-10 text-center text-xs text-slate-500`}>You are not assigned to any active Montessori section.</div>
      ) : (
        <>
          {view === 'class' && <ClassView sections={sections} section={section} />}
          {view === 'attendance' && <AttendanceView section={section} toast={toast} onSaved={loadSections} />}
          {view === 'activities' && <ActivitiesView section={section} toast={toast} />}
          {view === 'progress' && <ProgressView section={section} toast={toast} />}
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
const ClassView: React.FC<{ sections: MySection[]; section: MySection }> = ({ sections, section }) => {
  const [students, setStudents] = useState<MRosterStudent[]>([]);
  const [report, setReport] = useState<any>(null);
  useEffect(() => {
    montessoriApi.students(section.id).then(setStudents).catch(() => setStudents([]));
  }, [section.id]);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sections.map((s) => (
          <div key={s.id} className={`${card} p-4 ${s.id === section.id ? 'ring-1 ring-[#36348e]' : ''}`}>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">{s.role === 'CLASS_TEACHER' ? 'Class teacher' : 'Assistant teacher'}</div>
            <div className="text-lg font-black text-slate-900">{s.name}</div>
            <div className="text-xs text-slate-500">{s.studentCount} students · {s.sessionName}</div>
            <div className={`text-[11px] font-semibold mt-1 ${s.attendanceMarkedToday ? 'text-emerald-700' : 'text-amber-700'}`}>
              {s.attendanceMarkedToday ? 'Attendance marked today' : 'Attendance not marked today'}
            </div>
          </div>
        ))}
      </div>
      <div className={card}>
        <div className="px-4 py-3 border-b border-slate-100 text-xs font-bold text-slate-800">My students · {section.name}</div>
        {students.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">No students are allocated to this section yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {students.map((s) => (
              <div key={s.studentId} className="px-4 py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-800">{s.name}</div>
                  <div className="text-slate-500 font-mono text-[10px]">{s.admissionNo}</div>
                </div>
                <button onClick={async () => setReport(await montessoriApi.studentReport(s.studentId))} className={ghost}>Progress report</button>
              </div>
            ))}
          </div>
        )}
      </div>
      {report && <ReportModal report={report} onClose={() => setReport(null)} />}
    </>
  );
};

const ReportModal: React.FC<{ report: any; onClose: () => void }> = ({ report, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
      <div className="px-5 py-3 bg-[#1b1a47] text-white flex items-center justify-between">
        <span className="text-sm font-bold">{report.student.name} · Montessori progress</span>
        <button onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-5 overflow-y-auto space-y-4 text-xs">
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200"><div className="text-slate-500">Attendance</div><div className="text-base font-black">{report.attendance.attendanceRate != null ? `${report.attendance.attendanceRate}%` : '—'}</div></div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200"><div className="text-slate-500">Completed</div><div className="text-base font-black">{report.completedActivities.length}</div></div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200"><div className="text-slate-500">Needs improvement</div><div className="text-base font-black">{report.needsImprovement.length}</div></div>
        </div>
        <div>
          <div className="font-bold text-slate-800 mb-1">Progress history</div>
          {report.history.length === 0 ? <p className="text-slate-500">No progress recorded yet.</p> : report.history.map((h: MProgress) => (
            <div key={h.id} className="py-1.5 border-b border-slate-100 flex justify-between gap-2">
              <div><div className="font-semibold">{h.activityTitle} <span className="text-slate-400 font-normal">· {fmtDate(h.observedOn)}</span></div>{h.remarks && <div className="text-slate-500">{h.remarks}</div>}</div>
              <Badge status={h.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
const AttendanceView: React.FC<{ section: MySection; toast: any; onSaved: () => void }> = ({ section, toast, onSaved }) => {
  const [date, setDate] = useState(todayLocal());
  const [roster, setRoster] = useState<{ isMarked: boolean; canEdit: boolean; students: MRosterStudent[] } | null>(null);
  const [marks, setMarks] = useState<Record<number, { status: MAttendance | ''; remarks: string }>>({});
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await montessoriApi.attendance(section.id, date);
      setRoster(r);
      setMarks(Object.fromEntries(r.students.map((s) => [s.studentId, { status: (s.status || '') as MAttendance | '', remarks: s.remarks || '' }])));
    } catch (err: any) {
      toast(err?.message || 'Failed to load attendance', 'error');
    }
  }, [section.id, date, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!roster) return;
    const records = roster.students.filter((s) => marks[s.studentId]?.status).map((s) => ({ studentId: s.studentId, status: marks[s.studentId].status as MAttendance, remarks: marks[s.studentId].remarks || null }));
    if (!records.length) return toast('Mark at least one student.', 'error');
    if (roster.isMarked && reason.trim().length < 3) return toast('Enter a reason for changing saved attendance.', 'error');
    try {
      setSaving(true);
      const res = await montessoriApi.saveAttendance(section.id, { date, records, reason: reason.trim() || undefined });
      toast(`Attendance saved (${res.created} new, ${res.corrected} corrected).`);
      setReason('');
      load();
      onSaved();
    } catch (err: any) {
      toast(err?.message || 'Failed to save attendance', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={card}>
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
        <input type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-3 py-2" />
        {roster && <span className="text-[11px] text-slate-500">{roster.isMarked ? 'Saved — changes are logged as corrections' : 'Not marked yet'}</span>}
        {roster?.canEdit && roster.students.length > 0 && (
          <button onClick={() => setMarks((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { ...v, status: v.status || 'PRESENT' }])))} className="ml-auto text-[11px] font-bold text-indigo-700 hover:underline">
            Mark remaining present
          </button>
        )}
      </div>
      {!roster ? null : roster.students.length === 0 ? (
        <p className="p-8 text-center text-xs text-slate-500">No students were allocated to {section.name} on {fmtDate(date)}.</p>
      ) : (
        <>
          {!roster.canEdit && <p className="px-4 pt-3 text-[11px] text-amber-700">This date is outside the 7-day correction window. Ask the Principal to correct it.</p>}
          <div className="divide-y divide-slate-100">
            {roster.students.map((s) => (
              <div key={s.studentId} className="px-4 py-2.5 flex flex-wrap items-center gap-2 text-xs">
                <div className="w-44 font-bold text-slate-800 truncate">{s.name}</div>
                <div className="flex gap-1">
                  {(Object.keys(ATTENDANCE_LABELS) as MAttendance[]).map((st) => (
                    <button key={st} disabled={!roster.canEdit} onClick={() => setMarks((m) => ({ ...m, [s.studentId]: { ...m[s.studentId], status: st } }))} className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${marks[s.studentId]?.status === st ? 'bg-[#36348e] text-white border-[#36348e]' : 'bg-white text-slate-600 border-slate-200'} disabled:opacity-60`}>
                      {ATTENDANCE_LABELS[st]}
                    </button>
                  ))}
                </div>
                <input disabled={!roster.canEdit} value={marks[s.studentId]?.remarks || ''} onChange={(e) => setMarks((m) => ({ ...m, [s.studentId]: { ...m[s.studentId], remarks: e.target.value } }))} placeholder="Remarks" maxLength={255} className="flex-1 min-w-[140px] text-xs border border-slate-200 rounded-lg px-2.5 py-1.5" />
              </div>
            ))}
          </div>
          {roster.canEdit && (
            <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap gap-2 items-center">
              {roster.isMarked && <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for correction *" maxLength={300} className={`${input} max-w-sm`} />}
              <button onClick={save} disabled={saving} className={`${primary} ml-auto`}>{saving ? 'Saving…' : 'Save Attendance'}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
const emptyActivity = { learningAreaId: '', title: '', description: '', objectives: '', activityDate: todayLocal(), attachmentUrl: '', attachmentName: '' };

const ActivitiesView: React.FC<{ section: MySection; toast: any }> = ({ section, toast }) => {
  const [areas, setAreas] = useState<{ id: number; name: string }[]>([]);
  const [items, setItems] = useState<MActivity[]>([]);
  const [status, setStatus] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [editing, setEditing] = useState<MActivity | 'new' | null>(null);
  const [form, setForm] = useState(emptyActivity);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await montessoriApi.activities({ sectionId: section.id, status, limit: 100 });
      setItems(res.items);
    } catch (err: any) {
      toast(err?.message || 'Failed to load activities', 'error');
    }
  }, [section.id, status, toast]);

  useEffect(() => {
    montessoriApi.learningAreas().then(setAreas).catch(() => {});
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const open = (a: MActivity | 'new') => {
    setEditing(a);
    setForm(
      a === 'new'
        ? emptyActivity
        : { learningAreaId: String(a.learningAreaId), title: a.title, description: a.description || '', objectives: a.objectives || '', activityDate: String(a.activityDate).slice(0, 10), attachmentUrl: a.attachmentUrl || '', attachmentName: a.attachmentName || '' }
    );
  };

  const upload = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      setUploading(true);
      const res = await requestApi<{ fileUrl: string; originalName: string }>('/api/v1/uploads', { method: 'POST', body: fd });
      setForm((f) => ({ ...f, attachmentUrl: res.fileUrl, attachmentName: res.originalName }));
    } catch (err: any) {
      toast(err?.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.learningAreaId || form.title.trim().length < 2) return toast('Choose a learning area and enter a title.', 'error');
    const body = {
      learningAreaId: Number(form.learningAreaId),
      title: form.title.trim(),
      description: form.description.trim() || null,
      objectives: form.objectives.trim() || null,
      activityDate: form.activityDate,
      attachmentUrl: form.attachmentUrl || null,
      attachmentName: form.attachmentName || null
    };
    try {
      setSaving(true);
      if (editing === 'new') await montessoriApi.createActivity({ ...body, sectionId: section.id });
      else if (editing) await montessoriApi.updateActivity(editing.id, body);
      toast(editing === 'new' ? 'Activity created.' : 'Activity updated.');
      setEditing(null);
      load();
    } catch (err: any) {
      toast(err?.message || 'Failed to save activity', 'error');
    } finally {
      setSaving(false);
    }
  };

  const setActivityStatus = async (a: MActivity, next: 'ACTIVE' | 'ARCHIVED') => {
    try {
      await montessoriApi.setActivityStatus(a.id, next);
      toast(next === 'ARCHIVED' ? 'Activity archived.' : 'Activity restored.');
      load();
    } catch (err: any) {
      toast(err?.message || 'Failed to update activity', 'error');
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {(['ACTIVE', 'ARCHIVED'] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`px-3.5 py-2 rounded-xl text-xs font-bold border ${status === s ? 'bg-[#36348e] text-white border-[#36348e]' : 'bg-white text-slate-600 border-slate-200'}`}>
            {s === 'ACTIVE' ? 'Current activities' : 'Archived'}
          </button>
        ))}
        <button onClick={() => open('new')} className={`${primary} ml-auto flex items-center gap-1.5`}><Plus className="w-4 h-4" /> New Activity</button>
      </div>
      <div className={card}>
        {items.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">{status === 'ACTIVE' ? 'No activities yet. Create your first learning activity.' : 'No archived activities.'}</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((a) => (
              <div key={a.id} className="px-4 py-3 flex items-start justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">{a.learningAreaName} · {fmtDate(a.activityDate)}</div>
                  <div className="text-sm font-black text-slate-900">{a.title}</div>
                  {a.objectives && <div className="text-slate-500 line-clamp-2">Objectives: {a.objectives}</div>}
                  <div className="text-[11px] text-slate-400">{a.progressCount ?? 0} progress observation(s)</div>
                  {a.attachmentUrl && (
                    <button onClick={() => openProtectedFile(a.attachmentUrl!, a.attachmentName || undefined).catch((e: any) => toast(e.message, 'error'))} className="text-indigo-700 font-semibold flex items-center gap-1 mt-0.5">
                      <Paperclip className="w-3 h-3" /> {a.attachmentName || 'Attachment'}
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {a.status === 'ACTIVE' ? (
                    <>
                      <button onClick={() => open(a)} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setActivityStatus(a, 'ARCHIVED')} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" title="Archive"><Archive className="w-3.5 h-3.5" /></button>
                    </>
                  ) : (
                    <button onClick={() => setActivityStatus(a, 'ACTIVE')} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" title="Restore"><RotateCcw className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60">
          <form onSubmit={save} className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-3 bg-[#1b1a47] text-white flex items-center justify-between">
              <span className="text-sm font-bold">{editing === 'new' ? `New activity · ${section.name}` : 'Edit activity'}</span>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Learning area *</label>
                  <select value={form.learningAreaId} onChange={(e) => setForm({ ...form, learningAreaId: e.target.value })} className={input}>
                    <option value="">Select</option>
                    {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Activity date *</label>
                  <input type="date" value={form.activityDate} onChange={(e) => setForm({ ...form, activityDate: e.target.value })} className={input} />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Title *</label>
                <input value={form.title} maxLength={150} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Counting 1-20" className={input} />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea rows={3} value={form.description} maxLength={4000} onChange={(e) => setForm({ ...form, description: e.target.value })} className={input} />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Instructions / learning objectives</label>
                <textarea rows={3} value={form.objectives} maxLength={4000} onChange={(e) => setForm({ ...form, objectives: e.target.value })} className={input} />
              </div>
              <div className="flex items-center gap-2">
                <label className={`${ghost} cursor-pointer flex items-center gap-1`}>
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />} Attach material
                  <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                </label>
                {form.attachmentUrl && (
                  <span className="text-slate-600 flex items-center gap-1">
                    {form.attachmentName}
                    <button type="button" onClick={() => setForm({ ...form, attachmentUrl: '', attachmentName: '' })} className="text-slate-400 hover:text-rose-600"><X className="w-3 h-3" /></button>
                  </span>
                )}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className={ghost}>Cancel</button>
              <button type="submit" disabled={saving || uploading} className={primary}>{saving ? 'Saving…' : 'Save Activity'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
type Draft = { status: MProgressStatus | ''; remarks: string; improvementSuggestions: string; observationNotes: string };

const ProgressView: React.FC<{ section: MySection; toast: any }> = ({ section, toast }) => {
  const [tab, setTab] = useState<'record' | 'history'>('record');
  const [activities, setActivities] = useState<MActivity[]>([]);
  const [activityId, setActivityId] = useState<number | ''>('');
  const [students, setStudents] = useState<MRosterStudent[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [historyStudent, setHistoryStudent] = useState<number | ''>('');
  const [history, setHistory] = useState<MProgress[]>([]);
  const [correcting, setCorrecting] = useState<MProgress | null>(null);
  const [fix, setFix] = useState({ status: '' as MProgressStatus | '', remarks: '', reason: '' });

  useEffect(() => {
    montessoriApi.activities({ sectionId: section.id, limit: 100 }).then((r) => setActivities(r.items)).catch(() => {});
    montessoriApi.students(section.id).then((s) => {
      setStudents(s);
      setDrafts(Object.fromEntries(s.map((x) => [x.studentId, { status: '', remarks: '', improvementSuggestions: '', observationNotes: '' }])));
    }).catch(() => {});
  }, [section.id]);

  const loadHistory = useCallback(async () => {
    if (!historyStudent) return setHistory([]);
    try {
      setHistory((await montessoriApi.progress({ studentId: historyStudent, limit: 200 })).items);
    } catch (err: any) {
      toast(err?.message || 'Failed to load history', 'error');
    }
  }, [historyStudent, toast]);
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filled = useMemo(() => students.filter((s) => drafts[s.studentId]?.status), [students, drafts]);

  const save = async () => {
    if (!activityId || !filled.length) return toast('Choose an activity and set a status for at least one student.', 'error');
    try {
      setSaving(true);
      await montessoriApi.recordProgress({
        activityId: Number(activityId),
        records: filled.map((s) => {
          const d = drafts[s.studentId];
          return { studentId: s.studentId, status: d.status, remarks: d.remarks || null, improvementSuggestions: d.improvementSuggestions || null, observationNotes: d.observationNotes || null };
        })
      });
      toast(`Progress recorded for ${filled.length} student(s).`);
      setDrafts(Object.fromEntries(students.map((x) => [x.studentId, { status: '', remarks: '', improvementSuggestions: '', observationNotes: '' }])));
    } catch (err: any) {
      toast(err?.message || 'Failed to record progress', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveCorrection = async () => {
    if (!correcting || fix.reason.trim().length < 3) return toast('Enter the reason for this correction.', 'error');
    try {
      await montessoriApi.correctProgress(correcting.id, { status: fix.status || undefined, remarks: fix.remarks, reason: fix.reason.trim() });
      toast('Progress corrected. The previous version is kept.');
      setCorrecting(null);
      loadHistory();
    } catch (err: any) {
      toast(err?.message || 'Correction failed', 'error');
    }
  };

  const setDraft = (id: number, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  return (
    <>
      <div className="flex gap-1.5">
        {(['record', 'history'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${tab === t ? 'bg-[#36348e] text-white border-[#36348e]' : 'bg-white text-slate-600 border-slate-200'}`}>
            {t === 'record' ? <><TrendingUp className="w-3.5 h-3.5" /> Record progress</> : <><History className="w-3.5 h-3.5" /> Progress history</>}
          </button>
        ))}
      </div>

      {tab === 'record' ? (
        <div className={card}>
          <div className="px-4 py-3 border-b border-slate-100">
            <select value={activityId} onChange={(e) => setActivityId(e.target.value ? Number(e.target.value) : '')} className="text-xs border border-slate-200 rounded-lg px-3 py-2 font-semibold w-full sm:w-auto">
              <option value="">Select a learning activity</option>
              {activities.map((a) => <option key={a.id} value={a.id}>{fmtDate(a.activityDate)} · {a.learningAreaName} · {a.title}</option>)}
            </select>
          </div>
          {!activityId ? (
            <p className="p-8 text-center text-xs text-slate-500">{activities.length ? 'Choose an activity to record each student’s progress.' : 'Create a learning activity first.'}</p>
          ) : (
            <>
              <div className="divide-y divide-slate-100">
                {students.map((s) => (
                  <div key={s.studentId} className="px-4 py-3 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-40 font-bold text-slate-800 truncate">{s.name}</span>
                      {(Object.keys(PROGRESS_LABELS) as MProgressStatus[]).map((st) => (
                        <button key={st} onClick={() => setDraft(s.studentId, { status: drafts[s.studentId]?.status === st ? '' : st })} className={`px-2 py-1 rounded-lg border text-[11px] font-bold ${drafts[s.studentId]?.status === st ? PROGRESS_STYLES[st] + ' ring-1 ring-current' : 'bg-white text-slate-500 border-slate-200'}`}>
                          {PROGRESS_LABELS[st]}
                        </button>
                      ))}
                    </div>
                    {drafts[s.studentId]?.status && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <input value={drafts[s.studentId].remarks} onChange={(e) => setDraft(s.studentId, { remarks: e.target.value })} maxLength={1000} placeholder="Teacher remark" className={input} />
                        <input value={drafts[s.studentId].improvementSuggestions} onChange={(e) => setDraft(s.studentId, { improvementSuggestions: e.target.value })} maxLength={1000} placeholder="Improvement suggestion" className={input} />
                        <input value={drafts[s.studentId].observationNotes} onChange={(e) => setDraft(s.studentId, { observationNotes: e.target.value })} maxLength={1000} placeholder="Observation notes" className={input} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-slate-100 flex justify-end">
                <button onClick={save} disabled={saving || !filled.length} className={primary}>{saving ? 'Saving…' : `Save progress (${filled.length})`}</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className={card}>
          <div className="px-4 py-3 border-b border-slate-100">
            <select value={historyStudent} onChange={(e) => setHistoryStudent(e.target.value ? Number(e.target.value) : '')} className="text-xs border border-slate-200 rounded-lg px-3 py-2 font-semibold">
              <option value="">Select a student</option>
              {students.map((s) => <option key={s.studentId} value={s.studentId}>{s.name}</option>)}
            </select>
          </div>
          {!historyStudent ? (
            <p className="p-8 text-center text-xs text-slate-500">Choose a student to see their development over time.</p>
          ) : history.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-500">No progress recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map((h) => (
                <div key={h.id} className="px-4 py-3 flex items-start justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800">{h.activityTitle} <span className="text-slate-400 font-normal">· {h.learningAreaName} · {fmtDate(h.observedOn)}</span></div>
                    {h.remarks && <div className="text-slate-600">{h.remarks}</div>}
                    {h.improvementSuggestions && <div className="text-amber-700">Suggestion: {h.improvementSuggestions}</div>}
                    {h.observationNotes && <div className="text-slate-500 italic">{h.observationNotes}</div>}
                    {h.corrected && <div className="text-[10px] text-slate-400">Corrected</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge status={h.status} />
                    <button onClick={() => { setCorrecting(h); setFix({ status: h.status, remarks: h.remarks || '', reason: '' }); }} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" title="Correct"><Pencil className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {correcting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-5 py-3 bg-[#1b1a47] text-white flex items-center justify-between">
              <span className="text-sm font-bold">Correct progress · {correcting.studentName}</span>
              <button onClick={() => setCorrecting(null)} aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <select value={fix.status} onChange={(e) => setFix({ ...fix, status: e.target.value as MProgressStatus })} className={input}>
                {(Object.keys(PROGRESS_LABELS) as MProgressStatus[]).map((s) => <option key={s} value={s}>{PROGRESS_LABELS[s]}</option>)}
              </select>
              <input value={fix.remarks} onChange={(e) => setFix({ ...fix, remarks: e.target.value })} maxLength={1000} placeholder="Teacher remark" className={input} />
              <input value={fix.reason} onChange={(e) => setFix({ ...fix, reason: e.target.value })} maxLength={300} placeholder="Reason for correction *" className={input} />
              <p className="text-[11px] text-slate-500">The previous version stays in the record’s correction history.</p>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setCorrecting(null)} className={ghost}>Cancel</button>
              <button onClick={saveCorrection} className={primary}>Save correction</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
