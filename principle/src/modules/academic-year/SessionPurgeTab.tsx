import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  ShieldAlert,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  History,
  FileCheck,
  FileX,
  RefreshCw,
  Lock,
  ArrowRight,
  Database,
  Layers,
  Sparkles
} from 'lucide-react';
import { LoadingState } from '../../components/common/StateViews';

interface YearRow {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_current: number;
  status: string;
}

interface PurgeManifest {
  sessions: {
    from: { id: number; name: string; status: string };
    to: { id: number; name: string; status: string };
  };
  preconditionStatus: {
    canProceed: boolean;
    warnings: string[];
    totalEnrollments: number;
    unexecutedPromotions: number;
    unpublishedFinalResults: number;
    activeSupplementaryExams: number;
  };
  recordsToBePermanentlyPurged: {
    learningTasks: number;
    taskSubmissions: number;
    sessionLearningResources: number;
    monthlyTestsAndQuizzes: number;
    testAttempts: number;
    dailyAttendanceMarks: number;
    timetableLessons: number;
    timetableSlots: number;
    continuousAlerts: number;
  };
  recordsPreservedInPerpetuity: {
    terminalResultCards: number;
    subjectTerminalMarks: number;
    supplementaryResitLedger: number;
    historicalEnrollments: number;
    academicSessionRecord: string;
    studentsAndMasterCatalogs: string;
  };
  storageCleanup: {
    estimatedFilesQueued: number;
  };
  challengePhrase: string;
}

export const SessionPurgeTab: React.FC<{
  currentYear: YearRow;
  years: YearRow[];
  onReloadYears: () => Promise<void>;
}> = ({ currentYear, years, onReloadYears }) => {
  const toast = useToast();

  const [fromYearId, setFromYearId] = useState<number>(currentYear.id);
  const [toYearId, setToYearId] = useState<number>(
    years.find((y) => y.id !== currentYear.id && y.status !== 'CLOSED')?.id || 0
  );

  const [preview, setPreview] = useState<PurgeManifest | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [lastPurgeReceipt, setLastPurgeReceipt] = useState<any | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const rows = await api.getPurgeHistory();
      setHistoryList(rows);
    } catch {
      // Ignored
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleFetchPreview = async () => {
    if (!fromYearId || !toYearId || fromYearId === toYearId) {
      toast.error('Please select two distinct academic sessions.');
      return;
    }
    try {
      setLoadingPreview(true);
      setPreview(null);
      setConfirmationInput('');
      const data = await api.getPurgePreview(fromYearId, toYearId);
      setPreview(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate purge manifest.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExecutePurge = async () => {
    if (!preview) return;
    if (confirmationInput.trim() !== preview.challengePhrase) {
      toast.error('Confirmation phrase does not match exactly.');
      return;
    }

    try {
      setExecuting(true);
      const receipt = await api.executeSessionPurge(fromYearId, toYearId, confirmationInput.trim());
      setLastPurgeReceipt(receipt);
      toast.success(receipt.message || 'Academic Year Purge & Rollover completed successfully!');
      setPreview(null);
      setConfirmationInput('');
      await onReloadYears();
      await loadHistory();
    } catch (err: any) {
      toast.error(err.message || 'Purge failed. The database has been rolled back safely.');
    } finally {
      setExecuting(false);
    }
  };

  const handleRetryCleanup = async (sessionId: number) => {
    try {
      const res = await api.retryFileCleanup(sessionId);
      toast.success(`File cleanup re-run: ${res.deletedCount} files deleted, ${res.failedCount} failed.`);
      loadHistory();
    } catch (err: any) {
      toast.error(err.message || 'File cleanup retry failed.');
    }
  };

  const isPhraseMatched = preview && confirmationInput.trim() === preview.challengePhrase;

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-sm border border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-semibold border border-rose-500/30">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Production Rollover & Permanent Purge Engine</span>
            </div>
            <h3 className="text-xl font-bold tracking-tight mt-1">Session Data Purge & Terminal Card Preservation</h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              When transitioning to a new academic year, all operational records (daily attendance, homework, submissions,
              and monthly tests) of the previous session are <strong>permanently eradicated from the database and storage</strong>.
              Only each student's official <strong>Terminal Examination Result Card</strong>, subject marks, and supplementary ledger
              are preserved forever.
            </p>
          </div>
          <div className="p-3 bg-white/5 rounded-xl border border-white/10 shrink-0 hidden sm:block">
            <Database className="w-8 h-8 text-indigo-400" />
          </div>
        </div>
      </div>

      {/* Step 1: Session Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center">1</span>
            <h4 className="text-sm font-bold text-slate-900">Select Sessions for Rollover</h4>
          </div>
          <span className="text-xs text-slate-400">Step 1 of 2</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Previous Session to Purge & Close
            </label>
            <select
              value={fromYearId}
              onChange={(e) => {
                setFromYearId(Number(e.target.value));
                setPreview(null);
              }}
              className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.is_current ? '(Currently Active)' : `(${y.status})`}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              All daily records in this session will be permanently deleted.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Target Session to Activate
            </label>
            <select
              value={toYearId}
              onChange={(e) => {
                setToYearId(Number(e.target.value));
                setPreview(null);
              }}
              className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value={0}>-- Select target session --</option>
              {years
                .filter((y) => y.id !== fromYearId && y.status !== 'CLOSED')
                .map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name} ({y.status})
                  </option>
                ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              This session will become the single ACTIVE academic year.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleFetchPreview}
            disabled={loadingPreview || !fromYearId || !toYearId || fromYearId === toYearId}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition cursor-pointer"
          >
            {loadingPreview ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Auditing Database Manifest...</span>
              </>
            ) : (
              <>
                <FileCheck className="w-3.5 h-3.5" />
                <span>Audit & Preview Purge Manifest</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Step 2: Purge Manifest & Confirmation Barrier */}
      {preview && (
        <div className="bg-white rounded-2xl border-2 border-rose-200 p-6 shadow-xs space-y-6 animate-in fade-in-50 duration-300">
          <div className="flex items-center justify-between border-b border-rose-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center">2</span>
              <h4 className="text-sm font-bold text-slate-900">Pre-Purge Audit Manifest & Security Barrier</h4>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold border border-rose-200">
              Irreversible Action
            </span>
          </div>

          {/* Warnings (if any) */}
          {preview.preconditionStatus.warnings.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Precondition Checks Pending</span>
              </div>
              <ul className="list-disc list-inside text-xs text-amber-800 space-y-1 pl-1">
                {preview.preconditionStatus.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
              <p className="text-[11px] text-amber-700">
                It is strongly recommended to resolve these before permanently wiping operational records.
              </p>
            </div>
          )}

          {/* Side-by-Side: Preserved vs Purged */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Preserved Column (Green) */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>PRESERVED IN PERPETUITY (The Immortal Spine)</span>
              </div>
              <ul className="text-xs space-y-2 text-emerald-950">
                <li className="flex justify-between items-center py-1 border-b border-emerald-100">
                  <span>Terminal Examination Result Cards</span>
                  <strong className="font-mono bg-emerald-100/80 px-2 py-0.5 rounded">
                    {preview.recordsPreservedInPerpetuity.terminalResultCards} cards
                  </strong>
                </li>
                <li className="flex justify-between items-center py-1 border-b border-emerald-100">
                  <span>Subject-wise Terminal Marks</span>
                  <strong className="font-mono bg-emerald-100/80 px-2 py-0.5 rounded">
                    {preview.recordsPreservedInPerpetuity.subjectTerminalMarks} records
                  </strong>
                </li>
                <li className="flex justify-between items-center py-1 border-b border-emerald-100">
                  <span>Supplementary Re-sit Exam Ledger</span>
                  <strong className="font-mono bg-emerald-100/80 px-2 py-0.5 rounded">
                    {preview.recordsPreservedInPerpetuity.supplementaryResitLedger} records
                  </strong>
                </li>
                <li className="flex justify-between items-center py-1 border-b border-emerald-100">
                  <span>Historical Student Enrollments</span>
                  <strong className="font-mono bg-emerald-100/80 px-2 py-0.5 rounded">
                    {preview.recordsPreservedInPerpetuity.historicalEnrollments} records
                  </strong>
                </li>
                <li className="flex justify-between items-center py-1">
                  <span>Master Catalogs (Students, Classes, Subjects)</span>
                  <strong className="text-emerald-700 font-semibold">100% Intact</strong>
                </li>
              </ul>
            </div>

            {/* Purged Column (Red) */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-900">
                <FileX className="w-4 h-4 text-rose-600" />
                <span>PERMANENTLY PURGED (Physical Hard-Delete)</span>
              </div>
              <ul className="text-xs space-y-2 text-rose-950">
                <li className="flex justify-between items-center py-1 border-b border-rose-100">
                  <span>Daily Attendance Checks</span>
                  <strong className="font-mono bg-rose-100/80 px-2 py-0.5 rounded">
                    {preview.recordsToBePermanentlyPurged.dailyAttendanceMarks} rows
                  </strong>
                </li>
                <li className="flex justify-between items-center py-1 border-b border-rose-100">
                  <span>Homework & Learning Tasks</span>
                  <strong className="font-mono bg-rose-100/80 px-2 py-0.5 rounded">
                    {preview.recordsToBePermanentlyPurged.learningTasks} tasks
                  </strong>
                </li>
                <li className="flex justify-between items-center py-1 border-b border-rose-100">
                  <span>Student Task Submissions</span>
                  <strong className="font-mono bg-rose-100/80 px-2 py-0.5 rounded">
                    {preview.recordsToBePermanentlyPurged.taskSubmissions} submissions
                  </strong>
                </li>
                <li className="flex justify-between items-center py-1 border-b border-rose-100">
                  <span>Monthly Tests, Quizzes & Attempts</span>
                  <strong className="font-mono bg-rose-100/80 px-2 py-0.5 rounded">
                    {preview.recordsToBePermanentlyPurged.monthlyTestsAndQuizzes} tests ({preview.recordsToBePermanentlyPurged.testAttempts} attempts)
                  </strong>
                </li>
                <li className="flex justify-between items-center py-1">
                  <span>Physical Uploaded Files Staged for Cleanup</span>
                  <strong className="font-mono bg-rose-100/80 px-2 py-0.5 rounded text-rose-700 font-bold">
                    {preview.storageCleanup.estimatedFilesQueued} files
                  </strong>
                </li>
              </ul>
            </div>
          </div>

          {/* Security Challenge Phrase Input */}
          <div className="bg-slate-900 text-white p-5 rounded-xl space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-400" />
              <h5 className="text-xs font-bold uppercase tracking-wider text-rose-300">
                Principal Security Confirmation Barrier
              </h5>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              To prevent accidental data erasure, please type the exact challenge phrase below into the verification field.
              Once confirmed, the database records will be <strong>physically deleted</strong> and cannot be undone.
            </p>

            <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 font-mono text-center text-rose-400 font-bold text-sm tracking-wider select-all">
              {preview.challengePhrase}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Type the challenge phrase to unlock:
              </label>
              <input
                type="text"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder={preview.challengePhrase}
                className="w-full text-xs font-mono rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-rose-500/50"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                {isPhraseMatched ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Phrase Verified · Ready to Execute
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 italic">
                    Type exact phrase to enable purge
                  </span>
                )}
              </div>

              <button
                onClick={handleExecutePurge}
                disabled={!isPhraseMatched || executing}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-lg disabled:opacity-40 transition cursor-pointer"
              >
                {executing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing Transactional Purge...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently Purge & Activate New Session</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Execution Receipt Modal / Banner */}
      {lastPurgeReceipt && (
        <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-300 space-y-3">
          <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Academic Year Rollover Completed Successfully</span>
          </div>
          <p className="text-xs text-emerald-800 leading-relaxed">
            {lastPurgeReceipt.message}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
            <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200">
              <span className="text-slate-500 block text-[10px]">Active Session</span>
              <span className="font-bold text-slate-900">{lastPurgeReceipt.sessionRollover.activeSession}</span>
            </div>
            <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200">
              <span className="text-slate-500 block text-[10px]">Closed Session</span>
              <span className="font-bold text-slate-900">{lastPurgeReceipt.sessionRollover.closedSession}</span>
            </div>
            <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200">
              <span className="text-slate-500 block text-[10px]">Terminal Cards Kept</span>
              <span className="font-bold text-emerald-700">{lastPurgeReceipt.terminalCardsPreserved} cards</span>
            </div>
            <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200">
              <span className="text-slate-500 block text-[10px]">Physical Files Cleaned</span>
              <span className="font-bold text-indigo-700">
                {lastPurgeReceipt.fileCleanup?.deletedCount || 0} unlinked
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Purge Audit History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-600" />
            <h4 className="text-sm font-bold text-slate-900">Permanent Purge Audit Log</h4>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {historyList.length} recorded {historyList.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        {loadingHistory ? (
          <LoadingState message="Loading audit history..." rows={3} />
        ) : historyList.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            No session purges have been executed yet. Historical purges will be immutably recorded here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-[11px] font-semibold bg-slate-50">
                  <th className="px-3 py-2.5">Date & Time</th>
                  <th className="px-3 py-2.5">Purged Session</th>
                  <th className="px-3 py-2.5">Activated Session</th>
                  <th className="px-3 py-2.5">Terminal Cards Preserved</th>
                  <th className="px-3 py-2.5">Executed By</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyList.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-3 font-mono text-[11px] text-slate-600">
                      {new Date(h.executedAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 font-bold text-slate-900">{h.sessionName}</td>
                    <td className="px-3 py-3 text-indigo-700 font-semibold">{h.targetSessionName}</td>
                    <td className="px-3 py-3">
                      <span className="font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                        {h.terminalCardsPreserved} preserved
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {h.executedByName} ({h.executedByRole})
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        {h.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => handleRetryCleanup(h.sessionId)}
                        title="Retry unlinking any pending/failed files"
                        className="px-2.5 py-1 text-[11px] rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                      >
                        Retry File Cleanup
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

