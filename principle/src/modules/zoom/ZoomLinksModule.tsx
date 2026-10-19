import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { ClassZoomMeeting } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import {
  Video,
  ShieldCheck,
  RefreshCw,
  History,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

export const ZoomLinksModule: React.FC = () => {
  const [meetings, setMeetings] = useState<ClassZoomMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Renewal Modal
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<ClassZoomMeeting | null>(null);
  const [renewalReason, setRenewalReason] = useState('');
  const [renewing, setRenewing] = useState(false);

  // Health check in progress state
  const [checkingClassNum, setCheckingClassNum] = useState<number | null>(null);

  // Renewal History Modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const toast = useToast();

  const loadMeetings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getZoomMeetings();
      setMeetings(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load Zoom links');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const handleRunHealthCheck = async (classNumber: number) => {
    try {
      setCheckingClassNum(classNumber);
      const updated = await api.runZoomHealthCheck(classNumber);
      toast.success(`Health check passed for Class ${classNumber} Zoom room: ${updated.healthCheckStatus}.`);
      loadMeetings();
    } catch {
      toast.error('Health check failed to communicate with backend');
    } finally {
      setCheckingClassNum(null);
    }
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeeting) return;
    if (!renewalReason.trim()) {
      toast.warning('A reason is mandatory for renewing or replacing a class Zoom room link.');
      return;
    }

    try {
      setRenewing(true);
      await api.renewZoomMeeting(selectedMeeting.classNumber, renewalReason);
      toast.success(`Class ${selectedMeeting.classNumber} Zoom meeting renewed successfully. Historical credentials archived.`);
      setIsRenewModalOpen(false);
      setRenewalReason('');
      setSelectedMeeting(null);
      loadMeetings();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Renewal failed');
    } finally {
      setRenewing(false);
    }
  };

  if (loading) return <LoadingState message="Loading reusable Zoom classroom links for Classes 1–8..." rows={6} />;
  if (error) return <ErrorState message={error} onRetry={loadMeetings} />;

  return (
    <div className="space-y-5">
      {/* Overview & Security Policy Banner */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              Persistent Class Meeting Architecture · Classes 1–8
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Each class maintains one permanent, reusable Zoom meeting room. Subject teachers and students join the same persistent classroom link throughout the school day. Host keys and OAuth API secrets remain strictly protected on the backend.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-mono font-medium shadow-2xs">
            8 Persistent Classrooms
          </span>
        </div>
      </div>

      {/* Grid of 8 Class Rooms in Clean White Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {meetings.map((m) => {
          const isDegraded = m.status === 'Requires Renewal' || m.healthCheckStatus === 'Degraded';

          return (
            <div
              key={m.id}
              className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 transition-all duration-150 shadow-xs ${
                isDegraded
                  ? 'bg-amber-50/40 border-amber-200/90'
                  : 'bg-white border-slate-200/90'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Class {m.classNumber} Room
                  </span>
                  <StatusBadge status={m.status} />
                </div>

                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase tracking-wider block">Meeting ID</span>
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {m.zoomMeetingId}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[10px] uppercase tracking-wider block">Classroom Passcode</span>
                    <span className="font-mono text-xs font-semibold text-slate-700">
                      {m.passcode}
                    </span>
                  </div>

                  <div className="pt-1 border-t border-slate-100">
                    <span className="text-slate-400 text-[10px] uppercase tracking-wider block">Health Check</span>
                    <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                      {m.healthCheckStatus === 'Operational' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      )}
                      <span className="text-slate-700 font-medium">{m.healthCheckStatus}</span>
                      <span className="text-[10px] text-slate-400 font-mono ml-auto">
                        Exp: {m.expiryDate}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1 text-xs">
                <button
                  onClick={() => handleRunHealthCheck(m.classNumber)}
                  disabled={checkingClassNum === m.classNumber}
                  title="Run availability health check"
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors flex items-center gap-1 text-[11px]"
                >
                  <RefreshCw className={`w-3 h-3 ${checkingClassNum === m.classNumber ? 'animate-spin text-amber-600' : ''}`} />
                  <span>Check</span>
                </button>

                <div className="flex items-center gap-1">
                  {m.renewalHistory.length > 0 && (
                    <button
                      onClick={() => {
                        setSelectedMeeting(m);
                        setIsHistoryModalOpen(true);
                      }}
                      title="View link rotation history"
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      <History className="w-3 h-3" />
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setSelectedMeeting(m);
                      setIsRenewModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-[11px] transition-colors shadow-2xs flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Renew</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Renew / Replace Zoom Meeting Modal */}
      {selectedMeeting && (
        <Modal
          isOpen={isRenewModalOpen}
          onClose={() => setIsRenewModalOpen(false)}
          title={`Renew / Replace Meeting · Class ${selectedMeeting.classNumber}`}
          description="Rotate or replace the persistent class Zoom room with a fresh authorized meeting token."
          maxWidth="md"
        >
          <form onSubmit={handleRenewSubmit} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-500 block text-[10px]">Existing Meeting ID</span>
              <span className="font-mono text-sm font-bold text-slate-900">
                {selectedMeeting.zoomMeetingId}
              </span>
              <span className="text-[11px] text-slate-500 block">
                Last renewed: {new Date(selectedMeeting.lastRenewalDate).toLocaleDateString()}
              </span>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Replacement Justification <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={renewalReason}
                onChange={(e) => setRenewalReason(e.target.value)}
                required
                rows={3}
                placeholder="State the technical or administrative reason (e.g. Scheduled annual token rotation, compromised link, Zoom Pro account migration)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white resize-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-tight">
              Backend Integration: The new Zoom meeting credentials will be generated and dispatched automatically to student and teacher portals without manual copy-paste.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsRenewModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={renewing}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs"
              >
                {renewing ? 'Generating Meeting...' : 'Confirm Replacement'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Renewal History Modal */}
      {selectedMeeting && (
        <Modal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          title={`Zoom Link Audit Trail · Class ${selectedMeeting.classNumber}`}
          description="Historical record of previous meeting identifiers and rotation reasons."
          maxWidth="md"
        >
          <div className="space-y-3 text-xs">
            {selectedMeeting.renewalHistory.length === 0 ? (
              <p className="p-4 text-center text-slate-500 italic bg-slate-50 rounded-xl border border-slate-200">
                No previous renewals on record. Initial meeting remains active.
              </p>
            ) : (
              selectedMeeting.renewalHistory.map((rh) => (
                <div
                  key={rh.id}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1"
                >
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span className="font-mono font-semibold text-amber-800">
                      Old ID: {rh.previousMeetingId} → New: {rh.newMeetingId}
                    </span>
                    <span className="font-mono text-[10px]">
                      {new Date(rh.renewedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-slate-700">{rh.reason}</p>
                  <span className="text-[10px] text-slate-400">Authorized by: {rh.renewedBy}</span>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
