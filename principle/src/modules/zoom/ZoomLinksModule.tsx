import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { ClassZoomMeeting } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import {
  Video,
  RefreshCw,
  History,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Copy,
  Settings,
  Info,
  Plus,
  Trash2,
  ExternalLink
} from 'lucide-react';

export const ZoomLinksModule: React.FC = () => {
  const [meetings, setMeetings] = useState<ClassZoomMeeting[]>([]);
  const [capacity, setCapacity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Configuration / Add Modal (Principal One-Time Setup & Management)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [targetClassNumber, setTargetClassNumber] = useState<number>(1);
  const [configMeetingId, setConfigMeetingId] = useState('');
  const [configJoinUrl, setConfigJoinUrl] = useState('');
  const [configPasscode, setConfigPasscode] = useState('');
  const [configHostKey, setConfigHostKey] = useState('884422');
  const [configAccountEmail, setConfigAccountEmail] = useState('');
  const [configTopic, setConfigTopic] = useState('');
  const [configNotes, setConfigNotes] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  // Renewal Modal
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<ClassZoomMeeting | null>(null);
  const [renewalReason, setRenewalReason] = useState('');
  const [renewing, setRenewing] = useState(false);

  // Health check & Deletion in progress state
  const [checkingClassNum, setCheckingClassNum] = useState<number | null>(null);
  const [deletingClassNum, setDeletingClassNum] = useState<number | null>(null);

  // Renewal History Modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Zoom Server-to-Server OAuth status
  const [apiStatus, setApiStatus] = useState<any>(null);
  const [generatingApiClass, setGeneratingApiClass] = useState<number | null>(null);
  const [generatingAllApi, setGeneratingAllApi] = useState(false);

  const toast = useToast();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [meetingsData, capacityData, apiStatusData] = await Promise.all([
        api.getZoomMeetings(),
        api.getZoomCapacityStatus().catch(() => null),
        api.getZoomApiStatus().catch(() => null)
      ]);
      setMeetings(meetingsData);
      setCapacity(capacityData);
      setApiStatus(apiStatusData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load Zoom links');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenAddModal = (classNum?: number) => {
    setIsAddMode(true);
    setSelectedMeeting(null);
    const existingClasses = new Set(meetings.map((m) => m.classNumber));
    const chosenClass = classNum || [1, 2, 3, 4, 5, 6, 7, 8].find((c) => !existingClasses.has(c)) || 1;
    setTargetClassNumber(chosenClass);
    setConfigTopic(`Class ${chosenClass} Official Live Classroom`);
    setConfigMeetingId('');
    setConfigJoinUrl('');
    setConfigPasscode(`CLASS${chosenClass}#`);
    setConfigHostKey('884422');
    setConfigAccountEmail(`zoom.class${chosenClass}@school.pk`);
    setConfigNotes('Persistent room configured with Join-Before-Host (JBH) enabled.');
    setIsConfigModalOpen(true);
  };

  const handleClassNumberChange = (num: number) => {
    setTargetClassNumber(num);
    setConfigTopic(`Class ${num} Official Live Classroom`);
    if (!configPasscode || configPasscode.startsWith('CLASS')) {
      setConfigPasscode(`CLASS${num}#`);
    }
    setConfigAccountEmail(`zoom.class${num}@school.pk`);
  };

  const handleOpenConfigModal = (m: ClassZoomMeeting) => {
    setIsAddMode(false);
    setSelectedMeeting(m);
    setTargetClassNumber(m.classNumber);
    setConfigMeetingId(m.zoomMeetingId);
    setConfigJoinUrl(m.joinUrl);
    setConfigPasscode(m.passcode);
    setConfigHostKey(m.hostKey || '884422');
    setConfigAccountEmail(m.accountEmail || `zoom.class${m.classNumber}@school.pk`);
    setConfigTopic(`Class ${m.classNumber} Official Live Classroom`);
    setConfigNotes(m.configNotes || '');
    setIsConfigModalOpen(true);
  };

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const classNum = isAddMode ? targetClassNumber : selectedMeeting?.classNumber;
    if (!classNum) return;

    if (!configMeetingId.trim()) {
      toast.warning('Meeting ID is required.');
      return;
    }
    if (!configJoinUrl.trim().startsWith('http')) {
      toast.warning('A valid join URL (starting with http:// or https://) is required.');
      return;
    }

    try {
      setSavingConfig(true);
      await api.configureZoomMeeting(classNum, {
        zoomMeetingId: configMeetingId.trim(),
        joinUrl: configJoinUrl.trim(),
        passcode: configPasscode.trim(),
        hostKey: configHostKey.trim() || '884422',
        accountEmail: configAccountEmail.trim(),
        topic: configTopic.trim(),
        configNotes: configNotes.trim() || 'Persistent room configured with Join-Before-Host (JBH) enabled.',
        reason: isAddMode ? 'Principal added new classroom link' : 'Principal updated classroom setup'
      });
      toast.success(`Class ${classNum} permanent Zoom room ${isAddMode ? 'added' : 'updated'} successfully.`);
      setIsConfigModalOpen(false);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Configuration update failed');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleGenerateSingleViaApi = async () => {
    const classNum = isAddMode ? targetClassNumber : selectedMeeting?.classNumber;
    if (!classNum) return;
    try {
      setGeneratingApiClass(classNum);
      const generated = await api.generateZoomMeetingViaApi(
        classNum,
        configPasscode,
        configTopic
      );
      setConfigMeetingId(generated.zoom_meeting_id || generated.zoomMeetingId);
      setConfigJoinUrl(generated.joinUrl);
      if (generated.passcode) setConfigPasscode(generated.passcode);
      toast.success(`Meeting created directly on Zoom for Class ${classNum}!`);
      setIsConfigModalOpen(false);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Zoom API generation failed');
    } finally {
      setGeneratingApiClass(null);
    }
  };

  const handleGenerateAllViaApi = async () => {
    try {
      setGeneratingAllApi(true);
      const res = await api.generateAllZoomMeetingsViaApi();
      toast.success(`Zoom API: ${res.message || 'Classroom meetings created on Zoom'}`);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Batch Zoom API generation failed');
    } finally {
      setGeneratingAllApi(false);
    }
  };

  const handleRunHealthCheck = async (classNumber: number) => {
    try {
      setCheckingClassNum(classNumber);
      const updated = await api.runZoomHealthCheck(classNumber);
      toast.success(`Health check completed for Class ${classNumber}: ${updated.healthCheckStatus || 'Operational'}.`);
      loadData();
    } catch {
      toast.error('Health check failed to communicate with backend');
    } finally {
      setCheckingClassNum(null);
    }
  };

  const handleDeleteMeeting = async (classNumber: number) => {
    if (!window.confirm(`Are you sure you want to delete the persistent Zoom link for Class ${classNumber}? This will remove it from the database.`)) {
      return;
    }
    try {
      setDeletingClassNum(classNumber);
      await api.deleteZoomMeeting(classNumber);
      toast.success(`Class ${classNumber} Zoom link removed from database.`);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete meeting');
    } finally {
      setDeletingClassNum(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Are you sure you want to delete ALL Zoom classroom links from the database? This cannot be undone.')) {
      return;
    }
    try {
      setLoading(true);
      for (const m of meetings) {
        await api.deleteZoomMeeting(m.classNumber);
      }
      toast.success('All Zoom classroom links deleted from database.');
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete all meetings');
      setLoading(false);
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
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Renewal failed');
    } finally {
      setRenewing(false);
    }
  };

  if (loading) return <LoadingState message="Loading reusable Zoom classroom links for Classes 1–8..." rows={6} />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  const configuredClasses = new Set(meetings.map((m) => m.classNumber));

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
            Each class maintains one permanent, reusable Zoom meeting room. The principal configures each room once, and subject teachers hand over sessions automatically each timetable period without recreating links.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {apiStatus?.connected ? (
            <span className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-medium flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              Zoom API: Connected ({apiStatus.accountEmail})
            </span>
          ) : (
            <span
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-medium flex items-center gap-1.5 shadow-2xs"
              title="Add ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET in .env for one-click Zoom API generation"
            >
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              Manual Mode (Zoom API optional)
            </span>
          )}

          <span
            className="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 font-medium flex items-center gap-1.5 shadow-2xs"
            title="Webhook listener at /api/v1/zoom/webhook tracks teacher join, leave, daily hours & attendance for automated payroll"
          >
            <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
            Server-to-Server Hours &amp; Duty Tracking: Active
          </span>

          {apiStatus?.connected && (
            <button
              onClick={handleGenerateAllViaApi}
              disabled={generatingAllApi}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Video className="w-3.5 h-3.5" />
              <span>{generatingAllApi ? 'Generating...' : 'Auto-Create All on Zoom'}</span>
            </button>
          )}

          <button
            onClick={() => handleOpenAddModal()}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Classroom Link</span>
          </button>
        </div>
      </div>

      {/* Zoom Pro Account Capacity & Concurrency Card */}
      {capacity && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/70 via-slate-50 to-indigo-50/50 border border-blue-200/80 shadow-xs">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                <Video className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">{capacity.accountType}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-medium">
                    Host: {capacity.licensedHost}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {capacity.concurrencyArchitecture} · Concurrency: {capacity.simultaneousCapacity} simultaneous periods supported
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Today's Sessions</span>
                <span className="font-bold text-slate-800">{capacity.todayScheduledLessons} Scheduled</span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Absence Alerts</span>
                <span className={`font-bold ${capacity.todayAbsenceAlerts > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {capacity.todayAbsenceAlerts} Reported
                </span>
              </div>
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-blue-100/80 flex items-start gap-1.5 text-[11px] text-slate-600">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
            <span>
              <strong>Operational Architecture:</strong> Persistent rooms with Join-Before-Host (JBH) and passcodes enabled eliminate link recreation. The school timetable handles 5-minute pre-class teacher notifications, absence detection (10-minute grace period), and teacher handover transitions automatically.
            </span>
          </div>
        </div>
      )}

      {/* Directory Table Layout (Replaces Old Cards/Boxes) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        {/* Table Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Classroom Zoom Meeting Directory</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                {meetings.length} of 8 Classes Configured
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Permanent meeting rooms mapped per class. Clean table layout for fast auditing and updates.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {meetings.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="px-3 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Delete all meetings from database"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Links</span>
              </button>
            )}

            <button
              onClick={() => handleOpenAddModal()}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Classroom Link</span>
            </button>
          </div>
        </div>

        {/* Empty State Banner */}
        {meetings.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
              <Video className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900">No Classroom Links in Database</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
              The database is currently empty. Click below to add persistent Zoom links for Class 1 through Class 8 to enable scheduled teacher handovers and student joins.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => handleOpenAddModal()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Classroom Link</span>
              </button>

              {apiStatus?.connected && (
                <button
                  onClick={handleGenerateAllViaApi}
                  disabled={generatingAllApi}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>{generatingAllApi ? 'Creating...' : 'Auto-Create All on Zoom'}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Zoom Pro Account & Host Key</th>
                  <th className="py-3 px-4">Meeting ID</th>
                  <th className="py-3 px-4">Classroom Passcode</th>
                  <th className="py-3 px-4">Permanent Join Link</th>
                  <th className="py-3 px-4">Health Check</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {meetings.map((m) => {
                  const isDegraded = m.status === 'Requires Renewal' || m.healthCheckStatus === 'Degraded';
                  return (
                    <tr
                      key={m.id}
                      className={`transition-colors hover:bg-slate-50/70 ${isDegraded ? 'bg-amber-50/30' : ''}`}
                    >
                      {/* Class */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200/80 font-bold text-blue-900 text-xs">
                            Class {m.classNumber}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                            Live Room
                          </span>
                        </div>
                      </td>

                      {/* Zoom Pro Account & Host Key */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold text-slate-800 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
                            <span className="truncate max-w-[140px]" title={m.accountEmail}>
                              {m.accountEmail || `Account #${m.classNumber}`}
                            </span>
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-mono font-bold">
                              PIN: {m.hostKey || '884422'}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(m.hostKey || '884422');
                                toast.success(`Copied Host Key: ${m.hostKey || '884422'}`);
                              }}
                              className="p-0.5 rounded text-slate-400 hover:text-slate-700 transition-colors"
                              title="Copy Host Key"
                            >
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Meeting ID */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                            {m.zoomMeetingId}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(m.zoomMeetingId);
                              toast.success(`Copied Meeting ID ${m.zoomMeetingId}`);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 transition-colors"
                            title="Copy Meeting ID"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Passcode */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                          {m.passcode}
                        </span>
                      </td>

                      {/* Permanent Join Link */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-mono text-[11px] text-slate-600 block max-w-[200px]" title={m.joinUrl}>
                            {m.joinUrl}
                          </span>
                          <a
                            href={m.joinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors shrink-0"
                            title="Test / Open Join Link"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(m.joinUrl);
                              toast.success(`Copied Class ${m.classNumber} join link`);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                            title="Copy link"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Health Check */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs">
                          {m.healthCheckStatus === 'Operational' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          )}
                          <span className="text-slate-800 font-medium">{m.healthCheckStatus}</span>
                          <span className="text-[10px] text-slate-400 font-mono ml-1">· JBH</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={m.status} />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenConfigModal(m)}
                            title="Edit link details"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            <Settings className="w-3 h-3" />
                            <span>Edit</span>
                          </button>

                          <button
                            onClick={() => handleRunHealthCheck(m.classNumber)}
                            disabled={checkingClassNum === m.classNumber}
                            title="Run health check"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className={`w-3 h-3 ${checkingClassNum === m.classNumber ? 'animate-spin text-amber-600' : ''}`} />
                            <span>Check</span>
                          </button>

                          {m.renewalHistory.length > 0 && (
                            <button
                              onClick={() => {
                                setSelectedMeeting(m);
                                setIsHistoryModalOpen(true);
                              }}
                              title="View link audit trail"
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                            >
                              <History className="w-3 h-3" />
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSelectedMeeting(m);
                              setIsRenewModalOpen(true);
                            }}
                            title="Rotate meeting link"
                            className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-[11px] transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Rotate</span>
                          </button>

                          <button
                            onClick={() => handleDeleteMeeting(m.classNumber)}
                            disabled={deletingClassNum === m.classNumber}
                            title="Delete class link from database"
                            className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Configuration & Add Classroom Link Modal */}
      {isConfigModalOpen && (
        <Modal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          title={isAddMode ? 'Add Classroom Zoom Link' : `Configure Permanent Classroom · Class ${selectedMeeting?.classNumber}`}
          description={
            isAddMode
              ? 'Select a class and configure its persistent Zoom room. This link will be permanently stored and used for all scheduled periods.'
              : 'Update the permanent Zoom meeting ID and join link. Saved once and automatically reused for every school day.'
          }
          maxWidth="md"
        >
          <form onSubmit={handleConfigSubmit} className="space-y-3.5 text-xs">
            {/* Class Selection Dropdown in Add Mode */}
            {isAddMode && (
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Select Target Class <span className="text-rose-500">*</span>
                </label>
                <select
                  value={targetClassNumber}
                  onChange={(e) => handleClassNumberChange(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold text-slate-900 focus:bg-white cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((cls) => {
                    const isConfigured = configuredClasses.has(cls);
                    return (
                      <option key={cls} value={cls}>
                        Class {cls} {isConfigured ? '(Already configured - will overwrite)' : '(Available)'}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {apiStatus?.connected ? (
              <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div>
                  <span className="font-semibold text-blue-900 block text-xs">Zoom API Mode Available</span>
                  <span className="text-[11px] text-blue-700">
                    Auto-create room for Class {isAddMode ? targetClassNumber : selectedMeeting?.classNumber} on Zoom directly with JBH
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateSingleViaApi}
                  disabled={generatingApiClass === (isAddMode ? targetClassNumber : selectedMeeting?.classNumber)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shrink-0 flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>
                    {generatingApiClass === (isAddMode ? targetClassNumber : selectedMeeting?.classNumber)
                      ? 'Creating on Zoom...'
                      : 'Auto-Generate via Zoom API'}
                  </span>
                </button>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
                <span>Manual mode active. Enter your permanent Zoom meeting details below.</span>
              </div>
            )}

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Classroom Room Title
              </label>
              <input
                type="text"
                value={configTopic}
                onChange={(e) => setConfigTopic(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white"
                placeholder="e.g. Class 1 Official Live Classroom"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Zoom Meeting ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={configMeetingId}
                  onChange={(e) => setConfigMeetingId(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-slate-800 focus:bg-white text-xs"
                  placeholder="e.g. 892 4810 9921"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Classroom Passcode
                </label>
                <input
                  type="text"
                  value={configPasscode}
                  onChange={(e) => setConfigPasscode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-slate-800 focus:bg-white text-xs"
                  placeholder="e.g. CLASS1#"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Zoom Pro Account (Email / Label)
                </label>
                <input
                  type="text"
                  value={configAccountEmail}
                  onChange={(e) => setConfigAccountEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white text-xs"
                  placeholder="e.g. class1@school.com or Account #1"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Host Key (6-digit PIN) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={configHostKey}
                  onChange={(e) => setConfigHostKey(e.target.value)}
                  required
                  maxLength={6}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-slate-800 focus:bg-white text-xs"
                  placeholder="e.g. 884422"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Permanent Join URL <span className="text-rose-500">*</span>
              </label>
              <input
                type="url"
                value={configJoinUrl}
                onChange={(e) => setConfigJoinUrl(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-[11px] text-slate-800 focus:bg-white"
                placeholder="https://zoom.us/j/89248109921?pwd=..."
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Configuration Notes
              </label>
              <textarea
                value={configNotes}
                onChange={(e) => setConfigNotes(e.target.value)}
                rows={2}
                placeholder="Join-Before-Host (JBH) enabled, Waiting Room disabled for smooth teacher handover..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white resize-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-900 leading-relaxed">
              <strong>One-Time Setup:</strong> Once saved, this link is permanent. The school timetable automatically provisions student join windows and notifies incoming teachers 5 minutes prior to each period.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingConfig}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-xs cursor-pointer"
              >
                {savingConfig ? 'Saving...' : isAddMode ? 'Add Classroom Link' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Renew / Rotate Zoom Meeting Modal */}
      {selectedMeeting && isRenewModalOpen && (
        <Modal
          isOpen={isRenewModalOpen}
          onClose={() => setIsRenewModalOpen(false)}
          title={`Rotate Classroom Link · Class ${selectedMeeting.classNumber}`}
          description="Rotate or replace the persistent class Zoom room with a fresh authorized meeting identifier."
          maxWidth="md"
        >
          <form onSubmit={handleRenewSubmit} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-500 block text-[10px]">Current Meeting ID</span>
              <span className="font-mono text-sm font-bold text-slate-900">
                {selectedMeeting.zoomMeetingId}
              </span>
              <span className="text-[11px] text-slate-500 block">
                Last updated: {new Date(selectedMeeting.lastRenewalDate).toLocaleDateString()}
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
                placeholder="State the technical or administrative reason (e.g. Scheduled annual token rotation, link compromised, meeting ID revoked)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white resize-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-tight">
              Backend Integration: The rotated Zoom room credentials will be updated in the system and previous links will be retired in audit history.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsRenewModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={renewing}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs cursor-pointer"
              >
                {renewing ? 'Rotating Meeting...' : 'Confirm Rotation'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Renewal History Modal */}
      {selectedMeeting && isHistoryModalOpen && (
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
