import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { StatCard } from '../../components/common/StatCard';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import {
  CalendarRange,
  CalendarPlus,
  GraduationCap,
  ClipboardCheck,
  Settings2,
  Play,
  Lock,
  Calculator,
  CheckCircle2,
  Send,
  Eye,
  Users,
  ArrowUpRight,
  RefreshCw,
  ListChecks,
  Pencil
} from 'lucide-react';

type YearTab = 'years' | 'results' | 'promotions';

interface YearRow {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_current: number;
  status: string;
}

interface TermRow {
  id: number;
  session_id: number;
  name: string;
  start_date: string;
  end_date: string;
  exam_start_date: string | null;
  exam_end_date: string | null;
  is_final: number;
  sort_order: number;
  status: string;
}

const d = (value: string | null | undefined) => (value ? String(value).split('T')[0] : '');

const PASS_LABEL: Record<string, string> = {
  PASSED: 'Passed',
  FAILED: 'Failed',
  SUPPLEMENTARY: 'Supplementary',
  PENDING: 'Pending',
  ABSENT: 'Absent'
};

const ELIGIBILITY_LABEL: Record<string, string> = {
  ELIGIBLE: 'Eligible for Promotion',
  NOT_ELIGIBLE: 'Not Eligible',
  PENDING_RESULT: 'Pending Result',
  SUPPLEMENTARY_REQUIRED: 'Supplementary Required',
  GRADUATING: 'Graduating',
  WITHDRAWN: 'Withdrawn'
};

const DECISION_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under Review',
  PROMOTE: 'Promote',
  RETAIN: 'Retain',
  GRADUATE: 'Graduate',
  WITHHOLD: 'Withhold',
  WITHDRAW: 'Withdraw'
};

export const AcademicYearModule: React.FC = () => {
  const [tab, setTab] = useState<YearTab>('years');
  const [years, setYears] = useState<YearRow[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedYear = years.find((y) => y.id === selectedYearId) || null;

  const loadYears = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await api.getAcademicYearsRaw();
      setYears(rows);
      if (rows.length > 0) {
        setSelectedYearId((prev) => {
          if (prev && rows.some((r: YearRow) => r.id === prev)) return prev;
          const active = rows.find((r: YearRow) => r.is_current);
          return active ? active.id : rows[0].id;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load academic years');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTerms = useCallback(async () => {
    if (!selectedYearId) return;
    try {
      setTerms(await api.getAcademicTerms(selectedYearId));
    } catch {
      setTerms([]);
    }
  }, [selectedYearId]);

  useEffect(() => {
    loadYears();
  }, [loadYears]);

  useEffect(() => {
    loadTerms();
  }, [loadTerms]);

  if (loading) return <LoadingState message="Loading academic year management..." rows={6} />;
  if (error) return <ErrorState message={error} onRetry={loadYears} />;

  return (
    <div className="space-y-4">
      {/* Banner + year selector + tabs */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Academic Year & Promotion Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure academic years and terms, review and publish term results, and run year-end promotion.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Academic Year</span>
          <select
            value={selectedYearId ?? ''}
            onChange={(e) => setSelectedYearId(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name} {y.is_current ? '· Active' : `· ${y.status}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {(
          [
            { id: 'years', label: 'Years & Terms', icon: CalendarRange },
            { id: 'results', label: 'Results Review', icon: ClipboardCheck },
            { id: 'promotions', label: 'Promotions', icon: GraduationCap }
          ] as { id: YearTab; label: string; icon: React.ElementType }[]
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                tab === t.id
                  ? 'bg-amber-500 text-amber-950 font-semibold shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-amber-500 hover:text-amber-950'
              }`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'years' && (
        <YearsAndTermsTab
          years={years}
          selectedYear={selectedYear}
          terms={terms}
          onReloadYears={loadYears}
          onReloadTerms={loadTerms}
        />
      )}
      {tab === 'results' && selectedYear && <ResultsReviewTab year={selectedYear} terms={terms} />}
      {tab === 'promotions' && selectedYear && (
        <PromotionsTab year={selectedYear} years={years} onReloadYears={loadYears} />
      )}
    </div>
  );
};

/* ────────────────────────── Years & Terms ────────────────────────── */

const YearsAndTermsTab: React.FC<{
  years: YearRow[];
  selectedYear: YearRow | null;
  terms: TermRow[];
  onReloadYears: () => void;
  onReloadTerms: () => void;
}> = ({ years, selectedYear, terms, onReloadYears, onReloadTerms }) => {
  const toast = useToast();
  const [yearModal, setYearModal] = useState<{ open: boolean; editing: YearRow | null }>({ open: false, editing: null });
  const [termModal, setTermModal] = useState<{ open: boolean; editing: TermRow | null }>({ open: false, editing: null });
  const [confirm, setConfirm] = useState<{ open: boolean; kind: 'activate' | 'close'; year: YearRow } | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [policy, setPolicy] = useState<any | null>(null);
  const [policySaving, setPolicySaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadExtras = useCallback(async () => {
    if (!selectedYear) return;
    try {
      const [s, p] = await Promise.all([
        api.getAcademicYearStats(selectedYear.id).catch(() => null),
        api.getPromotionPolicy(selectedYear.id).catch(() => null)
      ]);
      setStats(s);
      setPolicy(p);
    } catch {
      /* non-blocking */
    }
  }, [selectedYear]);

  useEffect(() => {
    loadExtras();
  }, [loadExtras]);

  const runLifecycle = async (kind: 'activate' | 'close', year: YearRow) => {
    try {
      setBusy(true);
      if (kind === 'activate') {
        await api.activateAcademicYear(year.id);
        toast.success(`${year.name} is now the active academic year.`);
      } else {
        await api.closeAcademicYear(year.id);
        toast.success(`${year.name} has been closed. Historical records remain available.`);
      }
      onReloadYears();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const totalEnrolled = stats?.enrollmentsByClass?.reduce((sum: number, r: any) => sum + r.students, 0) || 0;

  return (
    <div className="space-y-4">
      {/* Year list */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Academic Years</h3>
          <button
            onClick={() => setYearModal({ open: true, editing: null })}
            className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-xs"
          >
            <CalendarPlus className="w-3.5 h-3.5" strokeWidth={1.75} />
            Create Academic Year
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-2.5">Year</th>
                <th className="px-4 py-2.5">Start</th>
                <th className="px-4 py-2.5">End</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {years.map((y) => (
                <tr key={y.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{y.name}</td>
                  <td className="px-4 py-2.5 font-mono">{d(y.start_date)}</td>
                  <td className="px-4 py-2.5 font-mono">{d(y.end_date)}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={y.is_current ? 'Active' : y.status || 'Draft'} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {y.status !== 'CLOSED' && (
                        <button
                          onClick={() => setYearModal({ open: true, editing: y })}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                          title="Edit dates"
                        >
                          <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </button>
                      )}
                      {!y.is_current && y.status !== 'CLOSED' && (
                        <button
                          onClick={() => setConfirm({ open: true, kind: 'activate', year: y })}
                          className="px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-[11px] font-medium flex items-center gap-1"
                        >
                          <Play className="w-3 h-3" strokeWidth={1.75} /> Activate
                        </button>
                      )}
                      {y.status !== 'CLOSED' && !y.is_current && (
                        <button
                          onClick={() => setConfirm({ open: true, kind: 'close', year: y })}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 text-[11px] font-medium flex items-center gap-1"
                        >
                          <Lock className="w-3 h-3" strokeWidth={1.75} /> Close
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedYear && (
        <>
          {/* Selected-year statistics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Enrolled Students" value={totalEnrolled} subtitle={selectedYear.name} icon={<Users className="w-4 h-4" />} accentColor="blue" />
            <StatCard
              label="Terms Defined"
              value={terms.length}
              subtitle={terms.find((t) => t.is_final) ? 'Final term set' : 'No final term yet'}
              icon={<CalendarRange className="w-4 h-4" />}
              accentColor="purple"
            />
            <StatCard
              label="Results Published"
              value={stats?.resultsByStatus?.find((r: any) => r.status === 'PUBLISHED')?.count || 0}
              subtitle="This academic year"
              icon={<ClipboardCheck className="w-4 h-4" />}
              accentColor="emerald"
            />
            <StatCard
              label="Promotions Executed"
              value={stats?.promotionsByStatus?.find((r: any) => r.status === 'EXECUTED')?.count || 0}
              subtitle="Year-end transitions"
              icon={<GraduationCap className="w-4 h-4" />}
              accentColor="amber"
            />
          </div>

          {/* Terms */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Terms & Examination Periods · <span className="text-slate-500 font-medium">{selectedYear.name}</span>
              </h3>
              <button
                onClick={() => setTermModal({ open: true, editing: null })}
                disabled={selectedYear.status === 'CLOSED'}
                className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 shadow-xs"
              >
                <CalendarPlus className="w-3.5 h-3.5" strokeWidth={1.75} />
                Add Term
              </button>
            </div>
            {terms.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No terms defined"
                  description="Add this academic year's terms (e.g. Term 1, Final Term) with their examination periods. The final term's published results drive promotion."
                />
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5">Term</th>
                    <th className="px-4 py-2.5">Dates</th>
                    <th className="px-4 py-2.5">Examination Period</th>
                    <th className="px-4 py-2.5">Final Term</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {terms.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-slate-900">{t.name}</td>
                      <td className="px-4 py-2.5 font-mono">
                        {d(t.start_date)} → {d(t.end_date)}
                      </td>
                      <td className="px-4 py-2.5 font-mono">
                        {t.exam_start_date ? `${d(t.exam_start_date)} → ${d(t.exam_end_date)}` : '—'}
                      </td>
                      <td className="px-4 py-2.5">{t.is_final ? <StatusBadge status="Final" variant="info" /> : '—'}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => setTermModal({ open: true, editing: t })}
                          disabled={selectedYear.status === 'CLOSED'}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                          title="Edit term"
                        >
                          <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Promotion policy */}
          {policy && (
            <PolicyCard
              policy={policy}
              saving={policySaving}
              onSave={async (payload) => {
                try {
                  setPolicySaving(true);
                  const saved = await api.savePromotionPolicy({ ...payload, sessionId: selectedYear.id });
                  setPolicy({ ...saved, source: 'SESSION' });
                  toast.success('Promotion & passing criteria saved for this academic year.');
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Failed to save policy');
                } finally {
                  setPolicySaving(false);
                }
              }}
            />
          )}
        </>
      )}

      {yearModal.open && (
        <YearFormModal
          editing={yearModal.editing}
          onClose={() => setYearModal({ open: false, editing: null })}
          onSaved={() => {
            setYearModal({ open: false, editing: null });
            onReloadYears();
          }}
        />
      )}
      {termModal.open && selectedYear && (
        <TermFormModal
          sessionId={selectedYear.id}
          editing={termModal.editing}
          onClose={() => setTermModal({ open: false, editing: null })}
          onSaved={() => {
            setTermModal({ open: false, editing: null });
            onReloadTerms();
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          isOpen={confirm.open}
          onClose={() => setConfirm(null)}
          onConfirm={() => runLifecycle(confirm.kind, confirm.year)}
          title={confirm.kind === 'activate' ? `Activate ${confirm.year.name}?` : `Close ${confirm.year.name}?`}
          message={
            confirm.kind === 'activate'
              ? 'This becomes the only active academic year. The previously active year moves to Closing so its results and promotions can be finalised.'
              : 'Closing freezes this academic year. No marks, results or promotions can be changed afterwards. Historical records remain readable.'
          }
          requireReason={false}
          confirmLabel={confirm.kind === 'activate' ? 'Activate Year' : 'Close Year'}
          isDestructive={confirm.kind === 'close'}
          loading={busy}
        />
      )}
    </div>
  );
};

const YearFormModal: React.FC<{ editing: YearRow | null; onClose: () => void; onSaved: () => void }> = ({
  editing,
  onClose,
  onSaved
}) => {
  const toast = useToast();
  const [name, setName] = useState(editing?.name || '');
  const [startDate, setStartDate] = useState(d(editing?.start_date) || '');
  const [endDate, setEndDate] = useState(d(editing?.end_date) || '');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editing) {
        await api.updateAcademicYear(editing.id, { name, start_date: startDate, end_date: endDate });
        toast.success('Academic year updated.');
      } else {
        await api.createAcademicYear({ name, start_date: startDate, end_date: endDate });
        toast.success('Academic year created.');
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save academic year');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editing ? `Edit ${editing.name}` : 'Create Academic Year'}
      description="Years must not overlap. Example name: 2027-28"
      maxWidth="md"
    >
      <form onSubmit={submit} className="space-y-3 text-xs">
        <div>
          <label className="block text-slate-600 font-medium mb-1">Year Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 2027-28"
            required
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-600 font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium shadow-xs"
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Year'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const TermFormModal: React.FC<{
  sessionId: number;
  editing: TermRow | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ sessionId, editing, onClose, onSaved }) => {
  const toast = useToast();
  const [name, setName] = useState(editing?.name || '');
  const [startDate, setStartDate] = useState(d(editing?.start_date) || '');
  const [endDate, setEndDate] = useState(d(editing?.end_date) || '');
  const [examStart, setExamStart] = useState(d(editing?.exam_start_date) || '');
  const [examEnd, setExamEnd] = useState(d(editing?.exam_end_date) || '');
  const [isFinal, setIsFinal] = useState(Boolean(editing?.is_final));
  const [sortOrder, setSortOrder] = useState(editing?.sort_order || 1);
  const [status, setStatus] = useState(editing?.status || 'UPCOMING');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name,
      start_date: startDate,
      end_date: endDate,
      exam_start_date: examStart || null,
      exam_end_date: examEnd || null,
      is_final: isFinal,
      sort_order: sortOrder,
      status
    };
    try {
      setSaving(true);
      if (editing) {
        await api.updateAcademicTerm(editing.id, payload);
        toast.success('Term updated.');
      } else {
        await api.createAcademicTerm(sessionId, payload);
        toast.success('Term created.');
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save term');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editing ? `Edit ${editing.name}` : 'Add Term'}
      description="Term dates must fall inside the academic year. Mark the final term — its published results drive promotion eligibility."
      maxWidth="md"
    >
      <form onSubmit={submit} className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-600 font-medium mb-1">Term Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Final Term"
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">Sort Order</label>
            <input
              type="number"
              min={1}
              max={10}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-600 font-medium mb-1">Term Start</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="w-full px-3 py-2 rounded-lg border border-slate-200" />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">Term End</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="w-full px-3 py-2 rounded-lg border border-slate-200" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-600 font-medium mb-1">Exams Start (optional)</label>
            <input type="date" value={examStart} onChange={(e) => setExamStart(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200" />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">Exams End (optional)</label>
            <input type="date" value={examEnd} onChange={(e) => setExamEnd(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <label className="block text-slate-600 font-medium mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white">
              <option value="UPCOMING">Upcoming</option>
              <option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-slate-700 font-medium pb-2">
            <input type="checkbox" checked={isFinal} onChange={(e) => setIsFinal(e.target.checked)} className="rounded border-slate-300" />
            Final term of the year
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium shadow-xs">
            {saving ? 'Saving…' : editing ? 'Save Term' : 'Add Term'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const PolicyCard: React.FC<{ policy: any; saving: boolean; onSave: (p: Record<string, unknown>) => void }> = ({
  policy,
  saving,
  onSave
}) => {
  const [form, setForm] = useState({
    min_overall_percentage: Number(policy.min_overall_percentage),
    min_subject_percentage: Number(policy.min_subject_percentage),
    max_failed_subjects: Number(policy.max_failed_subjects),
    supplementary_allowed: Boolean(policy.supplementary_allowed),
    max_supplementary_subjects: Number(policy.max_supplementary_subjects),
    absent_policy: policy.absent_policy || 'ZERO',
    auto_graduate_final_grade: Boolean(policy.auto_graduate_final_grade)
  });

  const num = (key: keyof typeof form, label: string, min = 0, max = 100) => (
    <div>
      <label className="block text-slate-600 font-medium mb-1">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={Number(form[key])}
        onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
      />
    </div>
  );

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <Settings2 className="w-4 h-4 text-amber-600" strokeWidth={1.75} />
            Promotion & Passing Criteria
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {policy.source === 'SESSION'
              ? 'Configured for this academic year.'
              : policy.source === 'DEFAULT'
                ? 'Currently inheriting the school default policy. Saving creates a year-specific override.'
                : 'No policy saved yet — the built-in defaults below apply. Saving stores them for this year.'}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {num('min_overall_percentage', 'Min Overall %')}
        {num('min_subject_percentage', 'Min Subject %')}
        {num('max_failed_subjects', 'Failed Subjects Allowed', 0, 20)}
        {num('max_supplementary_subjects', 'Max Supplementary Subjects', 0, 20)}
        <div>
          <label className="block text-slate-600 font-medium mb-1">Absent Student Rule</label>
          <select
            value={form.absent_policy}
            onChange={(e) => setForm((f) => ({ ...f, absent_policy: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs"
          >
            <option value="ZERO">Count as zero marks</option>
            <option value="FAIL">Automatic fail</option>
            <option value="EXCLUDE">Exclude from totals</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-slate-700 font-medium text-xs pt-5">
          <input
            type="checkbox"
            checked={form.supplementary_allowed}
            onChange={(e) => setForm((f) => ({ ...f, supplementary_allowed: e.target.checked }))}
            className="rounded border-slate-300"
          />
          Supplementary exams allowed
        </label>
        <label className="flex items-center gap-2 text-slate-700 font-medium text-xs pt-5">
          <input
            type="checkbox"
            checked={form.auto_graduate_final_grade}
            onChange={(e) => setForm((f) => ({ ...f, auto_graduate_final_grade: e.target.checked }))}
            className="rounded border-slate-300"
          />
          Auto-graduate final grade
        </label>
      </div>
      <div className="flex justify-end pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={saving}
          className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-medium shadow-xs"
        >
          {saving ? 'Saving…' : 'Save Criteria'}
        </button>
      </div>
    </div>
  );
};

/* ────────────────────────── Results Review ───────────────────────── */

const ResultsReviewTab: React.FC<{ year: YearRow; terms: TermRow[] }> = ({ year, terms }) => {
  const toast = useToast();
  const [termId, setTermId] = useState<number | null>(null);
  const [overview, setOverview] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyClass, setBusyClass] = useState<number | null>(null);
  const [listModal, setListModal] = useState<{ classId: number; className: string } | null>(null);

  useEffect(() => {
    if (terms.length > 0) {
      setTermId((prev) => (prev && terms.some((t) => t.id === prev) ? prev : (terms.find((t) => t.is_final) || terms[0]).id));
    } else {
      setTermId(null);
    }
  }, [terms]);

  const loadOverview = useCallback(async () => {
    if (!termId) return;
    try {
      setLoading(true);
      setOverview(await api.getResultsOverview(termId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load results overview');
    } finally {
      setLoading(false);
    }
  }, [termId, toast]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const run = async (label: string, classId: number, fn: () => Promise<any>) => {
    try {
      setBusyClass(classId);
      const res = await fn();
      toast.success(
        label === 'compute'
          ? `Results computed: ${res.computed} (${res.incomplete} incomplete).`
          : label === 'approve'
            ? `${res.approved} results approved.`
            : `${res.published} results published and families notified.`
      );
      loadOverview();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setBusyClass(null);
    }
  };

  if (terms.length === 0) {
    return (
      <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
        <EmptyState
          title="No terms defined for this academic year"
          description="Define terms in the Years & Terms tab first. Results are computed per term from graded examinations."
        />
      </div>
    );
  }

  const totals = (overview?.classes || []).reduce(
    (acc: any, c: any) => ({
      passed: acc.passed + c.passed,
      failed: acc.failed + c.failed,
      supplementary: acc.supplementary + c.supplementary,
      pending: acc.pending + c.pending
    }),
    { passed: 0, failed: 0, supplementary: 0, pending: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px]">Term</span>
          <select
            value={termId ?? ''}
            onChange={(e) => setTermId(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700"
          >
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.is_final ? '· Final' : ''}
              </option>
            ))}
          </select>
          <button
            onClick={loadOverview}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-medium">
          <span className="text-emerald-700">Passed: {totals.passed}</span>
          <span className="text-rose-700">Failed: {totals.failed}</span>
          <span className="text-amber-700">Supplementary: {totals.supplementary}</span>
          <span className="text-slate-500">Pending: {totals.pending}</span>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading class-wise result status..." rows={5} />
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-2.5">Class</th>
                <th className="px-4 py-2.5 text-right">Students</th>
                <th className="px-4 py-2.5 text-right">Marks Submitted</th>
                <th className="px-4 py-2.5 text-right">Computed</th>
                <th className="px-4 py-2.5 text-right">Pass / Fail / Suppl.</th>
                <th className="px-4 py-2.5 text-right">Approved</th>
                <th className="px-4 py-2.5 text-right">Published</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(overview?.classes || []).map((c: any) => (
                <tr key={c.classId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{c.className}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{c.enrolledStudents}</td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {c.marksSubmitted}/{c.subjectsConfigured}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {c.resultsComputed}
                    {c.resultsIncomplete > 0 && (
                      <span className="text-amber-700 ml-1">({c.resultsIncomplete} inc.)</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    <span className="text-emerald-700">{c.passed}</span> /{' '}
                    <span className="text-rose-700">{c.failed}</span> /{' '}
                    <span className="text-amber-700">{c.supplementary}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{c.resultsApproved}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{c.resultsPublished}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => run('compute', c.classId, () => api.computeClassResults(c.classId, termId!))}
                        disabled={busyClass === c.classId}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-[11px] font-medium flex items-center gap-1 disabled:opacity-50"
                        title="Compute results from graded examinations"
                      >
                        <Calculator className="w-3 h-3" strokeWidth={1.75} /> Compute
                      </button>
                      <button
                        onClick={() => run('approve', c.classId, () => api.approveClassResults(c.classId, termId!))}
                        disabled={busyClass === c.classId || c.resultsComputed - c.resultsIncomplete - c.resultsApproved - c.resultsPublished <= 0}
                        className="px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-[11px] font-medium flex items-center gap-1 disabled:opacity-40"
                      >
                        <CheckCircle2 className="w-3 h-3" strokeWidth={1.75} /> Approve
                      </button>
                      <button
                        onClick={() => run('publish', c.classId, () => api.publishClassResults(c.classId, termId!))}
                        disabled={busyClass === c.classId || c.resultsApproved <= 0}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-medium flex items-center gap-1 disabled:opacity-40 shadow-xs"
                      >
                        <Send className="w-3 h-3" strokeWidth={1.75} /> Publish
                      </button>
                      <button
                        onClick={() => setListModal({ classId: c.classId, className: c.className })}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                        title="View student results"
                      >
                        <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {listModal && termId && (
        <ClassResultsModal
          classId={listModal.classId}
          className={listModal.className}
          termId={termId}
          termName={terms.find((t) => t.id === termId)?.name || ''}
          onClose={() => setListModal(null)}
          onChanged={loadOverview}
        />
      )}
    </div>
  );
};

const ClassResultsModal: React.FC<{
  classId: number;
  className: string;
  termId: number;
  termName: string;
  onClose: () => void;
  onChanged: () => void;
}> = ({ classId, className, termId, termName, onClose, onChanged }) => {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setRows(await api.listFinalResults({ termId, classId }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load results');
    } finally {
      setLoading(false);
    }
  }, [classId, termId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Modal isOpen onClose={onClose} title={`${className} · ${termName} Results`} description="Click a student to inspect and correct subject marks." maxWidth="4xl">
      {loading ? (
        <LoadingState message="Loading student results..." rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState title="No results computed" description="Use Compute on this class first." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2 text-right">Obtained / Total</th>
                <th className="px-3 py-2 text-right">%</th>
                <th className="px-3 py-2">Grade</th>
                <th className="px-3 py-2">Outcome</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-3 py-2">
                    <span className="font-semibold text-slate-900">{r.studentName}</span>
                    <span className="text-slate-400 ml-1.5 font-mono text-[10px]">{r.admissionNo}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {Number(r.obtained_marks).toFixed(0)} / {Number(r.total_marks).toFixed(0)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{r.percentage != null ? `${Number(r.percentage).toFixed(1)}%` : '—'}</td>
                  <td className="px-3 py-2 font-semibold">{r.overall_grade || '—'}</td>
                  <td className="px-3 py-2">
                    <StatusBadge
                      status={PASS_LABEL[r.pass_status] || r.pass_status}
                      variant={r.pass_status === 'PASSED' ? 'success' : r.pass_status === 'FAILED' ? 'danger' : r.pass_status === 'SUPPLEMENTARY' ? 'warning' : 'neutral'}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.result_status} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={async () => {
                        try {
                          setDetail(await api.getFinalResultDetail(r.id));
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Failed to load detail');
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 text-[11px]"
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <ResultDetailModal
          result={detail}
          onClose={() => setDetail(null)}
          onSaved={(updated) => {
            setDetail(updated);
            load();
            onChanged();
          }}
        />
      )}
    </Modal>
  );
};

const ResultDetailModal: React.FC<{ result: any; onClose: () => void; onSaved: (r: any) => void }> = ({
  result,
  onClose,
  onSaved
}) => {
  const toast = useToast();
  const [editRow, setEditRow] = useState<any | null>(null);
  const [marks, setMarks] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const isProtected = ['APPROVED', 'PUBLISHED'].includes(result.result_status);

  const saveMarks = async () => {
    if (!editRow) return;
    try {
      setSaving(true);
      const updated = await api.updateResultSubjectMarks(result.id, {
        subjectId: editRow.subject_id,
        obtainedMarks: marks === '' ? null : Number(marks),
        reason: reason || undefined
      });
      toast.success('Subject marks updated and the result recomputed.');
      setEditRow(null);
      setMarks('');
      setReason('');
      onSaved(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update marks');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${result.studentName} · ${result.termName}`}
      description={`${result.className} · ${result.sessionName} · Admission ${result.admissionNo}`}
      maxWidth="2xl"
    >
      <div className="space-y-3 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <span className="text-slate-500 text-[11px] block">Obtained / Total</span>
            <span className="font-mono font-bold text-slate-900">
              {Number(result.obtained_marks).toFixed(0)} / {Number(result.total_marks).toFixed(0)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[11px] block">Percentage · Grade</span>
            <span className="font-mono font-bold text-slate-900">
              {result.percentage != null ? `${Number(result.percentage).toFixed(1)}%` : '—'} · {result.overall_grade || '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[11px] block">Outcome</span>
            <StatusBadge
              status={PASS_LABEL[result.pass_status] || result.pass_status}
              variant={result.pass_status === 'PASSED' ? 'success' : result.pass_status === 'FAILED' ? 'danger' : 'warning'}
            />
          </div>
          <div>
            <span className="text-slate-500 text-[11px] block">Result Status</span>
            <StatusBadge status={result.result_status} />
          </div>
        </div>

        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2 text-right">Marks</th>
              <th className="px-3 py-2 text-right">%</th>
              <th className="px-3 py-2">Grade</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.subjects.map((s: any) => (
              <tr key={s.id}>
                <td className="px-3 py-2 font-medium text-slate-900">{s.subjectName}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {s.obtained_marks != null ? Number(s.obtained_marks).toFixed(0) : s.is_absent ? 'Absent' : '—'} /{' '}
                  {Number(s.total_marks).toFixed(0)}
                </td>
                <td className="px-3 py-2 text-right font-mono">{s.percentage != null ? `${Number(s.percentage).toFixed(1)}%` : '—'}</td>
                <td className="px-3 py-2 font-semibold">{s.grade || '—'}</td>
                <td className="px-3 py-2">
                  {s.passed === null ? '—' : s.passed ? <StatusBadge status="Pass" variant="success" minimal /> : <StatusBadge status="Fail" variant="danger" minimal />}
                </td>
                <td className="px-3 py-2 text-[10px] text-slate-400 font-mono">{s.source}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => {
                      setEditRow(s);
                      setMarks(s.obtained_marks != null ? String(Number(s.obtained_marks)) : '');
                      setReason('');
                    }}
                    className="px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 text-[11px]"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {editRow && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
            <div className="font-semibold text-amber-900">
              Correct marks · {editRow.subjectName} (out of {Number(editRow.total_marks).toFixed(0)})
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={Number(editRow.total_marks)}
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                placeholder="Leave empty for absent"
                className="w-40 px-3 py-2 rounded-lg border border-slate-200"
              />
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={isProtected ? 'Reason (required after approval)' : 'Reason (optional)'}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200"
              />
              <button
                onClick={saveMarks}
                disabled={saving || (isProtected && !reason.trim())}
                className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium shadow-xs"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditRow(null)} className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-white">
                Cancel
              </button>
            </div>
            {isProtected && (
              <p className="text-[11px] text-amber-800">
                This result is {result.result_status.toLowerCase()}; corrections require a reason and are recorded in the audit log.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

/* ─────────────────────────── Promotions ──────────────────────────── */

const PromotionsTab: React.FC<{ year: YearRow; years: YearRow[]; onReloadYears: () => void }> = ({
  year,
  years,
  onReloadYears
}) => {
  const toast = useToast();
  const [overview, setOverview] = useState<any | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [classFilter, setClassFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [decideRecord, setDecideRecord] = useState<any | null>(null);
  const [toYearId, setToYearId] = useState<number | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [confirmExecute, setConfirmExecute] = useState(false);

  const targetYears = years.filter((y) => y.id !== year.id && y.status !== 'CLOSED');

  useEffect(() => {
    if (targetYears.length > 0 && !targetYears.some((y) => y.id === toYearId)) {
      setToYearId(targetYears[0].id);
    }
  }, [years, year.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [ov, recs] = await Promise.all([
        api.getPromotionsOverview(year.id).catch(() => null),
        api.listPromotions(year.id).catch(() => [])
      ]);
      setOverview(ov);
      setRecords(recs);
    } finally {
      setLoading(false);
    }
  }, [year.id]);

  useEffect(() => {
    load();
  }, [load]);

  const countBy = (key: string) =>
    overview?.byEligibility?.find((r: any) => r.eligibility === key)?.count || 0;
  const executedCount = overview?.byDecision?.filter((r: any) => r.status === 'EXECUTED').reduce((s: number, r: any) => s + r.count, 0) || 0;

  const filtered = classFilter === 'All' ? records : records.filter((r) => String(r.fromClassNumber) === classFilter);
  const classNumbers = Array.from(new Set(records.map((r) => String(r.fromClassNumber)))).sort((a, b) => Number(a) - Number(b));

  const act = async (label: string, fn: () => Promise<any>) => {
    try {
      setBusy(true);
      const res = await fn();
      if (label === 'evaluate') toast.success(`Eligibility evaluated: ${res.created} new, ${res.updated} refreshed (final term: ${res.finalTerm}).`);
      if (label === 'bulk') toast.success(`${res.decided} promotion decisions approved; ${res.skipped} left for individual review.`);
      if (label === 'execute') {
        toast.success(
          `Promotion executed — Promoted: ${res.promoted}, Retained: ${res.retained}, Graduated: ${res.graduated}, Withdrawn: ${res.withdrawn}.`
        );
        onReloadYears();
      }
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Overview stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Eligible for Promotion" value={countBy('ELIGIBLE')} subtitle="Passed final term" icon={<ArrowUpRight className="w-4 h-4" />} accentColor="emerald" />
        <StatCard label="Not Eligible" value={countBy('NOT_ELIGIBLE')} subtitle="To be retained" icon={<Users className="w-4 h-4" />} accentColor="amber" />
        <StatCard
          label="Pending / Supplementary"
          value={countBy('PENDING_RESULT') + countBy('SUPPLEMENTARY_REQUIRED')}
          subtitle="Awaiting results or resits"
          icon={<ListChecks className="w-4 h-4" />}
          accentColor="purple"
        />
        <StatCard label="Executed" value={executedCount} subtitle="Already moved" icon={<GraduationCap className="w-4 h-4" />} accentColor="blue" />
      </div>

      {/* Action bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => act('evaluate', () => api.evaluatePromotions(year.id))}
            disabled={busy}
            className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 shadow-xs"
          >
            <Calculator className="w-3.5 h-3.5" strokeWidth={1.75} /> Evaluate Eligibility
          </button>
          <button
            onClick={() => act('bulk', () => api.bulkApprovePromotions(year.id))}
            disabled={busy || records.length === 0}
            className="px-3.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 text-xs font-medium flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} /> Bulk Approve Recommendations
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px]">Promote Into</span>
          <select
            value={toYearId ?? ''}
            onChange={(e) => setToYearId(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700"
          >
            {targetYears.length === 0 && <option value="">No open target year</option>}
            {targetYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
          <button
            onClick={async () => {
              if (!toYearId) return;
              try {
                setPreview(await api.previewPromotions(year.id, toYearId));
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Preview failed');
              }
            }}
            disabled={!toYearId || busy}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 font-medium flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" strokeWidth={1.75} /> Preview
          </button>
          <button
            onClick={() => setConfirmExecute(true)}
            disabled={!toYearId || busy}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium flex items-center gap-1.5 shadow-xs"
          >
            <GraduationCap className="w-3.5 h-3.5" strokeWidth={1.75} /> Execute Promotion
          </button>
        </div>
      </div>

      {/* Records */}
      {loading ? (
        <LoadingState message="Loading promotion worksheet..." rows={6} />
      ) : records.length === 0 ? (
        <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
          <EmptyState
            title="No promotion records yet"
            description="Publish the final-term results, then click Evaluate Eligibility to build the promotion worksheet."
          />
        </div>
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium mr-1">Class:</span>
            {['All', ...classNumbers].map((c) => (
              <button
                key={c}
                onClick={() => setClassFilter(c)}
                className={`px-2.5 py-1 rounded-lg font-medium ${
                  classFilter === c ? 'bg-amber-500 text-amber-950 shadow-2xs' : 'text-slate-500 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {c === 'All' ? 'All' : `Class ${c}`}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-2.5">Student</th>
                  <th className="px-4 py-2.5">Class</th>
                  <th className="px-4 py-2.5 text-right">Final Result</th>
                  <th className="px-4 py-2.5">Eligibility</th>
                  <th className="px-4 py-2.5">Decision</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-slate-900">{r.studentName}</span>
                      <span className="text-slate-400 ml-1.5 font-mono text-[10px]">{r.admissionNo}</span>
                    </td>
                    <td className="px-4 py-2.5">{r.fromClassName}</td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {r.resultPercentage != null ? `${Number(r.resultPercentage).toFixed(1)}% · ${r.resultGrade}` : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        status={ELIGIBILITY_LABEL[r.eligibility] || r.eligibility}
                        variant={
                          r.eligibility === 'ELIGIBLE' || r.eligibility === 'GRADUATING'
                            ? 'success'
                            : r.eligibility === 'NOT_ELIGIBLE'
                              ? 'danger'
                              : 'warning'
                        }
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`font-semibold ${r.is_override ? 'text-amber-700' : 'text-slate-700'}`}>
                        {DECISION_LABEL[r.decision] || r.decision}
                        {r.is_override ? ' · Override' : ''}
                      </span>
                      {r.toClassName && r.status === 'EXECUTED' && (
                        <span className="block text-[10px] text-slate-400">→ {r.toClassName}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => setDecideRecord(r)}
                        disabled={r.status === 'EXECUTED'}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 text-[11px] disabled:opacity-40"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {decideRecord && (
        <DecisionModal
          record={decideRecord}
          onClose={() => setDecideRecord(null)}
          onSaved={() => {
            setDecideRecord(null);
            load();
          }}
        />
      )}

      {preview && (
        <Modal isOpen onClose={() => setPreview(null)} title={`Placement Preview · ${preview.session} → ${preview.toSession}`} maxWidth="2xl">
          {preview.placements.length === 0 ? (
            <EmptyState title="Nothing to execute" description="Approve promotion decisions first (Bulk Approve or individual review)." />
          ) : (
            <div className="overflow-x-auto max-h-[55vh]">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase text-[10px] tracking-wider sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">From</th>
                    <th className="px-3 py-2">Outcome</th>
                    <th className="px-3 py-2">To</th>
                    <th className="px-3 py-2">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.placements.map((p: any) => (
                    <tr key={p.recordId}>
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {p.studentName} <span className="text-slate-400 font-mono text-[10px]">{p.admissionNo}</span>
                      </td>
                      <td className="px-3 py-2">Class {p.fromClassNumber}</td>
                      <td className="px-3 py-2 font-semibold">{DECISION_LABEL[p.outcome] || p.outcome}</td>
                      <td className="px-3 py-2">{p.toClassNumber ? `Class ${p.toClassNumber}` : p.outcome === 'GRADUATE' ? 'Graduated' : '—'}</td>
                      <td className="px-3 py-2">{p.executed ? <StatusBadge status="Executed" variant="success" minimal /> : <StatusBadge status="Ready" variant="info" minimal />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}

      <ConfirmDialog
        isOpen={confirmExecute}
        onClose={() => setConfirmExecute(false)}
        onConfirm={() => {
          setConfirmExecute(false);
          if (toYearId) act('execute', () => api.executePromotions(year.id, toYearId));
        }}
        title="Execute year-end promotion?"
        message={`All approved decisions will be executed into ${
          targetYears.find((y) => y.id === toYearId)?.name || 'the selected year'
        }: passed students enroll in the next grade, retained students re-enroll in the same grade, and final-grade students graduate. Previous-year records stay unchanged. Running it again will not create duplicates.`}
        requireReason={false}
        confirmLabel="Execute Promotion"
        isDestructive
        loading={busy}
      />
    </div>
  );
};

const DecisionModal: React.FC<{ record: any; onClose: () => void; onSaved: () => void }> = ({ record, onClose, onSaved }) => {
  const toast = useToast();
  const [decision, setDecision] = useState(record.decision === 'PENDING' ? '' : record.decision);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const recommended: Record<string, string> = {
    ELIGIBLE: 'PROMOTE',
    NOT_ELIGIBLE: 'RETAIN',
    GRADUATING: 'GRADUATE',
    WITHDRAWN: 'WITHDRAW'
  };
  const rec = recommended[record.eligibility] || null;
  const isOverride = decision && decision !== 'WITHHOLD' && decision !== rec;

  const submit = async () => {
    if (!decision) return;
    try {
      setSaving(true);
      await api.decidePromotion(record.id, decision, reason || undefined);
      toast.success('Promotion decision recorded.');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record decision');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Promotion Review · ${record.studentName}`}
      description={`${record.fromClassName} · ${ELIGIBILITY_LABEL[record.eligibility] || record.eligibility}${
        record.resultPercentage != null ? ` · Final result ${Number(record.resultPercentage).toFixed(1)}% (${record.resultGrade})` : ''
      }`}
      maxWidth="md"
    >
      <div className="space-y-3 text-xs">
        {rec && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600">
            Recommended decision: <span className="font-semibold text-slate-900">{DECISION_LABEL[rec]}</span>. Choosing a
            different outcome is an override and requires a reason (audited).
          </div>
        )}
        <div>
          <label className="block text-slate-600 font-medium mb-1">Decision</label>
          <select
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
          >
            <option value="">Select a decision…</option>
            <option value="PROMOTE">Promote to next grade</option>
            <option value="RETAIN">Retain in the same grade</option>
            <option value="GRADUATE">Graduate (final grade)</option>
            <option value="WITHHOLD">Withhold (keep pending)</option>
            <option value="WITHDRAW">Mark as withdrawn</option>
          </select>
        </div>
        <div>
          <label className="block text-slate-600 font-medium mb-1">
            Reason {isOverride ? '(required for an override)' : '(optional)'}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-slate-200"
            placeholder="e.g. Approved by the academic committee on medical grounds"
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !decision || (Boolean(isOverride) && !reason.trim())}
            className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium shadow-xs"
          >
            {saving ? 'Saving…' : 'Record Decision'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
