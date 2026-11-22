import React, { useCallback, useEffect, useState } from 'react';
import { Search, History, ArrowRightLeft, UserMinus, Info } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { requestApi } from '../../services/api';
import { montessoriApi, MSection, MStudent, MRosterStudent, fmtDate } from './montessoriApi';
import { MPageHeader, SectionSelect, selectCls, inputCls, primaryBtn, ghostBtn, errorText } from './MontessoriShared';

export const MontessoriStudents: React.FC = () => {
  const toast = useToast();
  const [sections, setSections] = useState<MSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewSection, setViewSection] = useState<number | ''>('');
  const [roster, setRoster] = useState<MRosterStudent[]>([]);
  const [search, setSearch] = useState('');
  const [unallocatedOnly, setUnallocatedOnly] = useState(true);
  const [students, setStudents] = useState<MStudent[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [targetSection, setTargetSection] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);
  const [transfer, setTransfer] = useState<{ ids: number[]; to: number | ''; reason: string } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MRosterStudent | null>(null);
  const [history, setHistory] = useState<{ name: string; rows: any[] } | null>(null);

  const loadSections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const s = await montessoriApi.sections();
      setSections(s);
      if (!viewSection && s.length) setViewSection(s[0].id);
    } catch (err: any) {
      setError(err?.message || 'Failed to load sections');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRoster = useCallback(async () => {
    if (!viewSection) return setRoster([]);
    try {
      setRoster(await montessoriApi.sectionStudents(viewSection));
    } catch (err: any) {
      toast.error(errorText(err, 'Failed to load section students'));
    }
  }, [viewSection, toast]);

  const searchStudents = useCallback(async () => {
    try {
      const res = await montessoriApi.availableStudents({ search: search.trim(), unallocatedOnly, limit: 100 });
      setStudents(res.items);
      setTotal(res.total);
    } catch (err: any) {
      toast.error(errorText(err, 'Failed to search students'));
    }
  }, [search, unallocatedOnly, toast]);

  useEffect(() => {
    loadSections();
  }, [loadSections]);
  useEffect(() => {
    loadRoster();
  }, [loadRoster]);
  useEffect(() => {
    searchStudents();
    // search runs on submit / filter change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unallocatedOnly]);

  const refresh = () => {
    setSelected([]);
    loadRoster();
    searchStudents();
    loadSections();
  };

  const allocate = async () => {
    if (!targetSection || !selected.length) return;
    try {
      setBusy(true);
      await montessoriApi.allocate(targetSection, selected);
      toast.success(`${selected.length} student(s) allocated.`);
      refresh();
    } catch (err: any) {
      toast.error(errorText(err, 'Allocation failed'));
    } finally {
      setBusy(false);
    }
  };

  const doTransfer = async () => {
    if (!transfer || !transfer.to || transfer.reason.trim().length < 3) return toast.warning('Choose a section and enter a reason.');
    try {
      setBusy(true);
      await montessoriApi.transfer(transfer.ids, transfer.to, transfer.reason.trim());
      toast.success('Transfer complete. Previous allocation kept in history.');
      setTransfer(null);
      refresh();
    } catch (err: any) {
      toast.error(errorText(err, 'Transfer failed'));
    } finally {
      setBusy(false);
    }
  };

  const doRemove = async (reason: string) => {
    if (!removeTarget) return;
    try {
      await montessoriApi.removeAllocation(removeTarget.allocationId, reason);
      toast.success(`${removeTarget.name} removed from the section. History kept.`);
      setRemoveTarget(null);
      refresh();
    } catch (err: any) {
      toast.error(errorText(err, 'Failed to remove'));
    }
  };

  const showHistory = async (id: number, name: string) => {
    try {
      setHistory({ name, rows: await montessoriApi.allocationHistory(id) });
    } catch (err: any) {
      toast.error(errorText(err, 'Failed to load history'));
    }
  };

  if (loading) return <LoadingState message="Loading Montessori students..." rows={5} />;
  if (error) return <ErrorState message={error} onRetry={loadSections} />;

  const toggle = (id: number) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="space-y-4">
      <MPageHeader title="Student Allocation" description="Allocate students admitted to the Montessori class to a KG section. Students of Classes 1–8 are not listed; admit a child with Target Class “Montessori” in Students to see them here." />

      <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-[11px] flex gap-2">
        <Info className="w-4 h-4 shrink-0" />
        <span>
          Every CES student record also has a regular class (shown as “Regular class”). Montessori allocation is managed here and does not change that record.
        </span>
      </div>

      {/* Section roster */}
      <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-x-auto">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-800">Section students</span>
          <SectionSelect sections={sections} value={viewSection} onChange={setViewSection} />
        </div>
        {roster.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-slate-400">{viewSection ? 'No students allocated to this section yet.' : 'Select a section.'}</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Student</th>
                <th className="px-4 py-2 text-left">Admission No</th>
                <th className="px-4 py-2 text-left">Regular class</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roster.map((r) => (
                <tr key={r.studentId}>
                  <td className="px-4 py-2 font-semibold text-slate-900">{r.name}</td>
                  <td className="px-4 py-2 font-mono">{r.admissionNo}</td>
                  <td className="px-4 py-2 text-slate-500">{r.regularClassName || '—'}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => showHistory(r.studentId, r.name)} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="Allocation history"><History className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setTransfer({ ids: [r.studentId], to: '', reason: '' })} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" title="Transfer"><ArrowRightLeft className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setRemoveTarget(r)} className="p-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50" title="Remove from section"><UserMinus className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Allocate */}
      <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <form className="relative" onSubmit={(e) => { e.preventDefault(); searchStudents(); }}>
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or admission no ⏎" className={`${selectCls} pl-8 w-56`} />
          </form>
          <label className="text-xs text-slate-600 flex items-center gap-1.5">
            <input type="checkbox" checked={unallocatedOnly} onChange={(e) => setUnallocatedOnly(e.target.checked)} /> Not yet allocated only
          </label>
          <span className="text-[11px] text-slate-400 ml-auto">{total} student(s)</span>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
          {students.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-400">No Montessori students match. Admit a child with Target Class “Montessori” to list them here.</p>
          ) : (
            students.map((s) => (
              <label key={s.id} className="px-4 py-2 flex items-center gap-3 text-xs cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
                <span className="font-semibold text-slate-800 flex-1">{s.name}</span>
                <span className="font-mono text-slate-500">{s.admissionNo}</span>
                <span className="text-slate-500 w-28 truncate">{s.regularClassName || '—'}</span>
                <span className={`w-32 truncate ${s.currentAllocation ? 'text-amber-700' : 'text-slate-400'}`}>{s.currentAllocation ? s.currentAllocation.sectionName : 'Not allocated'}</span>
                <button type="button" onClick={(e) => { e.preventDefault(); showHistory(s.id, s.name); }} className="text-slate-400 hover:text-slate-700" title="Allocation history"><History className="w-3.5 h-3.5" /></button>
              </label>
            ))
          )}
        </div>
        <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-600">{selected.length} selected</span>
          <SectionSelect sections={sections} value={targetSection} onChange={setTargetSection} />
          <button disabled={!selected.length || !targetSection || busy} onClick={allocate} className={primaryBtn}>Allocate to section</button>
          <button disabled={!selected.length} onClick={() => setTransfer({ ids: selected, to: targetSection, reason: '' })} className={ghostBtn}>Transfer selected</button>
        </div>
      </div>

      {transfer && (
        <Modal isOpen onClose={() => setTransfer(null)} title={`Transfer ${transfer.ids.length} student(s)`} maxWidth="md">
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Move to section *</label>
              <SectionSelect sections={sections} value={transfer.to} onChange={(to) => setTransfer({ ...transfer, to })} />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Reason *</label>
              <input value={transfer.reason} onChange={(e) => setTransfer({ ...transfer, reason: e.target.value })} maxLength={300} className={inputCls} />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => setTransfer(null)} className={ghostBtn}>Cancel</button>
              <button disabled={busy} onClick={doTransfer} className={primaryBtn}>{busy ? 'Transferring…' : 'Transfer'}</button>
            </div>
          </div>
        </Modal>
      )}

      {history && (
        <Modal isOpen onClose={() => setHistory(null)} title={`${history.name} — Montessori history`} maxWidth="lg">
          {history.rows.length === 0 ? (
            <p className="text-xs text-slate-500">No Montessori allocations recorded.</p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {history.rows.map((h) => (
                <div key={h.id} className="py-2">
                  <div className="font-semibold text-slate-800">{h.sectionName} <span className="text-slate-400 font-normal">· {h.sessionName}</span></div>
                  <div className="text-slate-500">
                    {fmtDate(h.startDate)} → {h.active ? 'present' : fmtDate(h.endDate)}
                    {h.endReason ? ` · ${h.endReason === 'TRANSFERRED' ? 'Transferred' : 'Removed'}` : ''}
                    {h.notes ? ` · ${h.notes}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={doRemove}
        title="Remove from section?"
        message={removeTarget ? `${removeTarget.name} will be removed from this Montessori section. Attendance and progress records are kept.` : ''}
        requireReason
        confirmLabel="Remove"
        isDestructive
      />
    </div>
  );
};
