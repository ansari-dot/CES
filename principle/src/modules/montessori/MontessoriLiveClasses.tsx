import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Edit2, Ban, Video, Copy, RefreshCw } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { montessoriApi, MSection, MLiveClass, MLiveClassInput, LiveClassState, fmtDate, todayLocal } from './montessoriApi';
import { MPageHeader, SectionSelect, inputCls, primaryBtn, ghostBtn, errorText } from './MontessoriShared';

const STATE_STYLES: Record<LiveClassState, string> = {
  UPCOMING: 'bg-sky-50 text-sky-700 border-sky-200',
  LIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  COMPLETED: 'bg-slate-100 text-slate-600 border-slate-200',
  CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200'
};
const STATE_LABELS: Record<LiveClassState, string> = { UPCOMING: 'Upcoming', LIVE: 'Live now', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };

type Form = {
  sectionId: number | '';
  teacherId: number | '';
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  meetingMode: 'MANUAL' | 'ZOOM_API';
  joinUrl: string;
  passcode: string;
};
const emptyForm = (): Form => ({ sectionId: '', teacherId: '', title: '', description: '', date: todayLocal(), startTime: '', endTime: '', meetingMode: 'MANUAL', joinUrl: '', passcode: '' });

/**
 * Montessori Live Classes (Principal): scheduled Zoom classes per KG section.
 * Kept separate from the regular class Zoom rooms; uses the same Zoom integration.
 */
export const MontessoriLiveClasses: React.FC = () => {
  const toast = useToast();
  const [scope, setScope] = useState<'upcoming' | 'previous'>('upcoming');
  const [sectionFilter, setSectionFilter] = useState<number | ''>('');
  const [sections, setSections] = useState<MSection[]>([]);
  const [zoomApi, setZoomApi] = useState(false);
  const [timezone, setTimezone] = useState('');
  const [items, setItems] = useState<MLiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MLiveClass | 'new' | null>(null);
  const [form, setForm] = useState<Form>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState<MLiveClass | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setItems(await montessoriApi.liveClasses({ scope, sectionId: sectionFilter }));
    } catch (err: any) {
      setError(err?.message || 'Failed to load Montessori live classes');
    } finally {
      setLoading(false);
    }
  }, [scope, sectionFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    montessoriApi.sections().then(setSections).catch(() => setSections([]));
    montessoriApi
      .liveClassOptions()
      .then((o) => {
        setZoomApi(o.zoomApiConfigured);
        setTimezone(o.timezone);
      })
      .catch(() => setZoomApi(false));
  }, []);

  // Only teachers actively assigned to the chosen section can be selected (also enforced by the server)
  const sectionTeachers = useMemo(() => {
    const s = sections.find((x) => x.id === form.sectionId);
    if (!s) return [];
    return [...(s.classTeacher ? [{ id: s.classTeacher.teacherId, label: `${s.classTeacher.name} (Class Teacher)` }] : []), ...s.assistants.map((a) => ({ id: a.teacherId, label: `${a.name} (Assistant)` }))];
  }, [sections, form.sectionId]);

  const openNew = () => {
    setForm({ ...emptyForm(), sectionId: sectionFilter });
    setEditing('new');
  };
  const openEdit = (c: MLiveClass) => {
    setForm({
      sectionId: c.sectionId,
      teacherId: c.teacherId,
      title: c.title,
      description: c.description || '',
      date: c.date,
      startTime: c.startTime,
      endTime: c.endTime,
      meetingMode: c.meetingSource,
      joinUrl: c.meetingSource === 'MANUAL' ? c.joinUrl || '' : '',
      passcode: c.meetingSource === 'MANUAL' ? c.passcode || '' : ''
    });
    setEditing(c);
  };
  const pickSection = (id: number | '') => {
    const s = sections.find((x) => x.id === id);
    setForm((f) => ({ ...f, sectionId: id, teacherId: s?.classTeacher?.teacherId ?? '' }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sectionId) return toast.warning('Select a Montessori section.');
    if (!form.teacherId) return toast.warning('Select the Montessori teacher.');
    if (form.title.trim().length < 3) return toast.warning('Enter a class title.');
    if (!form.date || !form.startTime || !form.endTime) return toast.warning('Set the class date, start time and end time.');
    if (form.endTime <= form.startTime) return toast.warning('End time must be after the start time.');
    if (form.meetingMode === 'MANUAL' && !form.joinUrl.trim().startsWith('https://')) return toast.warning('Paste a valid Zoom meeting link (https://…).');
    const body: MLiveClassInput = {
      sectionId: form.sectionId,
      teacherId: form.teacherId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      meetingMode: form.meetingMode,
      joinUrl: form.meetingMode === 'MANUAL' ? form.joinUrl.trim() : null,
      passcode: form.meetingMode === 'MANUAL' ? form.passcode.trim() || null : null
    };
    try {
      setSaving(true);
      if (editing === 'new') await montessoriApi.createLiveClass(body);
      else if (editing) await montessoriApi.updateLiveClass(editing.id, body);
      toast.success(editing === 'new' ? 'Montessori live class scheduled.' : 'Live class updated.');
      setEditing(null);
      load();
    } catch (err: any) {
      toast.error(errorText(err, 'Failed to save live class'));
    } finally {
      setSaving(false);
    }
  };

  const confirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelling) return;
    if (cancelReason.trim().length < 3) return toast.warning('Enter a reason for cancelling.');
    try {
      setSaving(true);
      await montessoriApi.cancelLiveClass(cancelling.id, cancelReason.trim());
      toast.success('Live class cancelled.');
      setCancelling(null);
      setCancelReason('');
      load();
    } catch (err: any) {
      toast.error(errorText(err, 'Failed to cancel live class'));
    } finally {
      setSaving(false);
    }
  };

  const copyLink = (c: MLiveClass) => {
    if (!c.joinUrl) return;
    navigator.clipboard.writeText(c.joinUrl);
    toast.success('Meeting link copied.');
  };

  const tab = (value: 'upcoming' | 'previous', label: string) => (
    <button
      type="button"
      onClick={() => setScope(value)}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${scope === value ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <MPageHeader
        title="Montessori Live Classes"
        description="Schedule Zoom live classes for a KG section and its assigned teacher. Teachers, students and parents of that section see them in their portals."
        action={
          <button onClick={openNew} className={`${primaryBtn} flex items-center gap-1.5`}>
            <Plus className="w-3.5 h-3.5" /> Schedule Live Class
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {tab('upcoming', 'Upcoming')}
        {tab('previous', 'Previous & Cancelled')}
        <div className="ml-auto flex items-center gap-2">
          <SectionSelect sections={sections} value={sectionFilter} onChange={setSectionFilter} allowAll />
          <button type="button" onClick={load} className={ghostBtn} title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading Montessori live classes..." rows={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        scope === 'upcoming' ? (
          <EmptyState title="No upcoming Montessori live classes" description="Schedule a live class for a KG section." actionLabel="Schedule Live Class" onAction={openNew} />
        ) : (
          <EmptyState title="No previous live classes" description="Completed and cancelled Montessori live classes appear here." />
        )
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Class</th>
                <th className="px-4 py-2 text-left">Section</th>
                <th className="px-4 py-2 text-left">Teacher</th>
                <th className="px-4 py-2 text-left">Date &amp; Time{timezone ? ` (${timezone})` : ''}</th>
                <th className="px-4 py-2 text-left">Meeting</th>
                <th className="px-4 py-2 text-center">Status</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((c) => {
                const editable = c.state === 'UPCOMING' || c.state === 'LIVE';
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-2 max-w-[240px]">
                      <div className="font-semibold text-slate-900">{c.title}</div>
                      {c.description && <div className="text-[11px] text-slate-500 line-clamp-2">{c.description}</div>}
                      {c.cancelReason && <div className="text-[11px] text-rose-600">Cancelled: {c.cancelReason}</div>}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">{c.sectionName}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{c.teacherName}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div>{fmtDate(c.date)}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{c.startTime} – {c.endTime}</div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="text-[11px] text-slate-500">{c.meetingSource === 'ZOOM_API' ? `Created on Zoom${c.zoomMeetingId ? ` · ID ${c.zoomMeetingId}` : ''}` : 'Pasted link'}</div>
                      {c.passcode && <div className="text-[11px] text-slate-500">Passcode: <span className="font-mono text-slate-800">{c.passcode}</span></div>}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold ${STATE_STYLES[c.state]}`}>{STATE_LABELS[c.state]}</span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1.5">
                        {editable && c.joinUrl && (
                          <>
                            <a href={c.joinUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100" title="Open meeting">
                              <Video className="w-3.5 h-3.5" />
                            </a>
                            <button onClick={() => copyLink(c)} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100" title="Copy meeting link">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {editable && (
                          <>
                            <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100" title="Edit">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { setCancelling(c); setCancelReason(''); }} className="p-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50" title="Cancel class">
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal
          isOpen
          onClose={() => setEditing(null)}
          title={editing === 'new' ? 'Schedule Montessori Live Class' : `Edit ${editing.title}`}
          description={`Times are in school time${timezone ? ` (${timezone})` : ''}.`}
          maxWidth="lg"
        >
          <form onSubmit={save} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">KG section *</label>
                <select value={form.sectionId} onChange={(e) => pickSection(e.target.value ? Number(e.target.value) : '')} className={inputCls}>
                  <option value="">Select section</option>
                  {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Montessori teacher *</label>
                <select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value ? Number(e.target.value) : '' })} className={inputCls} disabled={!form.sectionId}>
                  <option value="">{form.sectionId ? 'Select teacher' : 'Select a section first'}</option>
                  {sectionTeachers.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                {form.sectionId !== '' && sectionTeachers.length === 0 && <p className="text-[11px] text-rose-600 mt-1">No teacher is assigned to this section. Assign one in Montessori Teachers first.</p>}
              </div>
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Class title *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={150} className={inputCls} placeholder="e.g. Rhymes & Storytelling" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Date *</label>
                <input type="date" value={form.date} min={todayLocal()} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Start time *</label>
                <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">End time *</label>
                <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} rows={2} className={inputCls} />
            </div>

            <div className="rounded-xl border border-slate-200 p-3 space-y-2">
              <div className="text-slate-700 font-medium">Zoom meeting</div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={form.meetingMode === 'MANUAL'} onChange={() => setForm({ ...form, meetingMode: 'MANUAL' })} />
                  Paste a Zoom meeting link
                </label>
                <label className={`flex items-center gap-1.5 ${zoomApi ? 'cursor-pointer' : 'text-slate-400'}`}>
                  <input type="radio" disabled={!zoomApi} checked={form.meetingMode === 'ZOOM_API'} onChange={() => setForm({ ...form, meetingMode: 'ZOOM_API' })} />
                  Create the meeting on Zoom automatically
                </label>
              </div>
              {!zoomApi && <p className="text-[11px] text-slate-500">Automatic creation needs the school's Zoom API credentials on the server.</p>}
              {form.meetingMode === 'MANUAL' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-medium mb-1">Meeting link *</label>
                    <input type="url" value={form.joinUrl} onChange={(e) => setForm({ ...form, joinUrl: e.target.value })} maxLength={1000} className={`${inputCls} font-mono`} placeholder="https://us05web.zoom.us/j/..." />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Passcode</label>
                    <input value={form.passcode} onChange={(e) => setForm({ ...form, passcode: e.target.value })} maxLength={50} className={`${inputCls} font-mono`} />
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">
                  {editing !== 'new' && editing.meetingSource === 'ZOOM_API'
                    ? 'The existing Zoom meeting keeps its link; its title and time are updated on Zoom.'
                    : 'A scheduled meeting is created in the school Zoom account when you save. The link and passcode are generated by Zoom.'}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setEditing(null)} className={ghostBtn}>Close</button>
              <button type="submit" disabled={saving} className={primaryBtn}>{saving ? 'Saving…' : editing === 'new' ? 'Schedule Class' : 'Save Changes'}</button>
            </div>
          </form>
        </Modal>
      )}

      {cancelling && (
        <Modal isOpen onClose={() => setCancelling(null)} title={`Cancel ${cancelling.title}?`} description={`${cancelling.sectionName} · ${fmtDate(cancelling.date)} ${cancelling.startTime}. The record is kept under Previous & Cancelled.`} maxWidth="md">
          <form onSubmit={confirmCancel} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Reason *</label>
              <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} maxLength={300} rows={2} className={inputCls} autoFocus />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setCancelling(null)} className={ghostBtn}>Keep Class</button>
              <button type="submit" disabled={saving} className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium disabled:opacity-50">{saving ? 'Cancelling…' : 'Cancel Class'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
