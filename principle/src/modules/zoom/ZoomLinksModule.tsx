import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../services/api';
import { ClassZoomMeeting, AttendanceReviewItem } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../hooks/useSocket';
import { RealtimeEvents } from '../../services/socketService';
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
  Plus,
  Trash2,
  ExternalLink,
  Radio,
  Clock,
  Calendar,
  UserCheck,
  Search,
  Check,
  X,
  LayoutGrid,
  List,
  Key,
  ShieldCheck,
  GraduationCap
} from 'lucide-react';

export const ZoomLinksModule: React.FC = () => {
  // Tab Navigation: 'classrooms' | 'reviews'
  const [activeTab, setActiveTab] = useState<'classrooms' | 'reviews'>('classrooms');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const [meetings, setMeetings] = useState<ClassZoomMeeting[]>([]);
  const [capacity, setCapacity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Attendance Reviews State
  const [reviews, setReviews] = useState<AttendanceReviewItem[]>([]);
  const [reviewStatusFilter, setReviewStatusFilter] = useState<'ALL' | 'REQUIRES_REVIEW' | 'FLAGGED' | 'VERIFIED' | 'REJECTED'>('REQUIRES_REVIEW');
  const [reviewSearch, setReviewSearch] = useState('');
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<AttendanceReviewItem | null>(null);
  const [resolveDecision, setResolveDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [resolveNote, setResolveNote] = useState('');
  const [resolving, setResolving] = useState(false);

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
  const [testingDeliveryClassNum, setTestingDeliveryClassNum] = useState<number | null>(null);

  const toast = useToast();

  const loadData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial && meetings.length === 0) {
        setLoading(true);
      }
      setError(null);

      // 1. Fetch classrooms immediately (instant local database query: ~10ms)
      const meetingsData = await api.getZoomMeetings();
      setMeetings(meetingsData);
      setLoading(false); // UI appears instantly with 0 delay!

      // 2. Fetch secondary data asynchronously in background without blocking UI
      Promise.all([
        api.getZoomCapacityStatus().catch(() => null),
        api.getZoomApiStatus().catch(() => null),
        api.getAttendanceReviews({ status: undefined, limit: 100 }).catch(() => [])
      ]).then(([capacityData, apiStatusData, reviewsData]) => {
        if (capacityData) setCapacity(capacityData);
        if (apiStatusData) setApiStatus(apiStatusData);
        if (reviewsData) setReviews(reviewsData);
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load Zoom links directory');
      setLoading(false);
    }
  }, [meetings.length]);

  useEffect(() => {
    loadData(true);
  }, []);

  // Realtime updates
  useSocketEvent(RealtimeEvents.CLASS_STATUS_UPDATED, () => loadData());
  useSocketEvent(RealtimeEvents.STUDENT_ATTENDANCE_UPDATED, () => loadData());

  const pendingReviewCount = useMemo(() => {
    return reviews.filter(
      (r) => r.verificationStatus === 'REQUIRES_REVIEW' || r.verificationStatus === 'FLAGGED'
    ).length;
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      if (reviewStatusFilter !== 'ALL' && r.verificationStatus !== reviewStatusFilter) {
        return false;
      }
      if (reviewSearch.trim()) {
        const q = reviewSearch.toLowerCase().trim();
        const teacherMatch = (r.matchedTeacherName || '').toLowerCase().includes(q);
        const participantMatch = (r.participantName || '').toLowerCase().includes(q);
        const classMatch = (r.className || '').toLowerCase().includes(q) || String(r.classNumber || '').includes(q);
        return teacherMatch || participantMatch || classMatch;
      }
      return true;
    });
  }, [reviews, reviewStatusFilter, reviewSearch]);

  const handleOpenAddModal = (defaultClassNum?: number) => {
    setIsAddMode(true);
    const existing = new Set(meetings.map((m) => m.classNumber));
    let chosenClass = defaultClassNum || 1;
    if (!defaultClassNum) {
      for (let i = 1; i <= 8; i++) {
        if (!existing.has(i)) {
          chosenClass = i;
          break;
        }
      }
    }
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
      toast.success(`Class ${classNum} Zoom room ${isAddMode ? 'added' : 'updated'} successfully.`);
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
    if (!window.confirm(`Are you sure you want to delete the persistent Zoom link for Class ${classNumber}?`)) {
      return;
    }
    try {
      setDeletingClassNum(classNumber);
      await api.deleteZoomMeeting(classNumber);
      toast.success(`Class ${classNumber} Zoom link removed.`);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete meeting');
    } finally {
      setDeletingClassNum(null);
    }
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeeting) return;
    if (!renewalReason.trim()) {
      toast.warning('A reason is mandatory for rotating a room link.');
      return;
    }

    try {
      setRenewing(true);
      await api.renewZoomMeeting(selectedMeeting.classNumber, renewalReason);
      toast.success(`Class ${selectedMeeting.classNumber} Zoom meeting renewed.`);
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

  const handleOpenResolveModal = (review: AttendanceReviewItem, decision: 'APPROVE' | 'REJECT') => {
    setSelectedReview(review);
    setResolveDecision(decision);
    setResolveNote(
      decision === 'APPROVE'
        ? `Principal verified identity for ${review.participantName} based on classroom schedule.`
        : `Principal rejected duty credit: unverified participant identity.`
    );
    setIsResolveModalOpen(true);
  };

  const handleResolveReview = async () => {
    if (!selectedReview) return;
    try {
      setResolving(true);
      await api.resolveAttendanceReview(selectedReview.id, {
        decision: resolveDecision,
        note: resolveNote
      });
      toast.success(`Review #${selectedReview.id} ${resolveDecision === 'APPROVE' ? 'Approved' : 'Rejected'}.`);
      setIsResolveModalOpen(false);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to resolve review');
    } finally {
      setResolving(false);
    }
  };

  if (loading) return <LoadingState message="Loading Zoom classrooms directory..." rows={6} />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  const configuredClasses = new Set(meetings.map((m) => m.classNumber));

  return (
    <div className="flex flex-col w-full pb-12 space-y-6 animate-in fade-in duration-150">
      {/* =========================================================================
          1. HEADER BANNER: Clean, Modern Cambridge Styling
          ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-xs select-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <Video className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
                  Online Classrooms
                </span>
                <span className="text-[11px] font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  Classes 1–8
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#1e1b4b] tracking-tight mt-1">
                Zoom Classrooms &amp; Live Links
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Permanent online meeting rooms for Classes 1 to 8. Teachers and students connect automatically.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white text-blue-600 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Card View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-blue-600 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Table View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {apiStatus?.connected && (
              <button
                type="button"
                onClick={handleGenerateAllViaApi}
                disabled={generatingAllApi}
                className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 transition cursor-pointer active:scale-[0.98]"
              >
                {generatingAllApi ? 'Generating...' : 'Auto-Create on Zoom'}
              </button>
            )}

            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition cursor-pointer active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Add Classroom</span>
            </button>

            <button
              type="button"
              onClick={loadData}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              title="Refresh Zoom data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. TOP 4 KPI CARDS (Wave Style)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Rooms */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-emerald-100/80 hover:border-emerald-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Video className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-emerald-50 text-emerald-700 border-emerald-100">
              <span>{meetings.length}/8 Configured</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              {meetings.length} Active
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Permanent Class Rooms
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(16, 185, 129, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#10b981" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 2: Today's Scheduled Lessons */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-blue-100/80 hover:border-blue-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Calendar className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-blue-50 text-blue-700 border-blue-100">
              <span>Scheduled</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              {capacity?.todayScheduledLessons || 0} Lessons
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Today's Live Sessions
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(59, 130, 246, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 3: Host Claim PIN */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-amber-100/80 hover:border-amber-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Key className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-amber-50 text-amber-800 border-amber-200">
              <span>Universal PIN</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight font-mono">
              884422
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Teacher Host Key
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(245, 158, 11, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 4: Attendance Tracking Status */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-purple-100/80 hover:border-purple-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white shadow-sm shadow-purple-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-purple-50 text-purple-700 border-purple-100">
              <span>Real-Time</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              Automated
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Attendance &amp; Hours Tracking
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(139, 92, 246, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. NAVIGATION TABS (Classrooms vs Faculty Attendance Reviews)
          ========================================================================= */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('classrooms')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'classrooms'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>Classrooms Directory ({meetings.length}/8)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reviews')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'reviews'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>Attendance Reviews</span>
          {pendingReviewCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white animate-pulse">
              {pendingReviewCount}
            </span>
          )}
        </button>
      </div>

      {/* =========================================================================
          4. MAIN VIEW (CARDS OR TABLE)
          ========================================================================= */}
      {activeTab === 'classrooms' ? (
        <>
          {meetings.length === 0 ? (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center shadow-xs">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
                <Video className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">No Classroom Links Configured</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                Add permanent Zoom links for Class 1 through Class 8 to enable scheduled teacher handovers and instant student attendance.
              </p>
              <button
                type="button"
                onClick={() => handleOpenAddModal()}
                className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Classroom Link</span>
              </button>
            </div>
          ) : viewMode === 'cards' ? (
            /* 4A. BEAUTIFUL GRID OF CLASS CARDS (Minimal text, rich icons) */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {meetings.map((m) => {
                const isDegraded = m.status === 'Requires Renewal' || m.healthCheckStatus === 'Degraded';
                return (
                  <div
                    key={m.id}
                    className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-300 p-4 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
                  >
                    {/* Top Header: Class badge & Status */}
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-100">
                            C{m.classNumber}
                          </div>
                          <div>
                            <span className="font-black text-slate-900 text-sm block">
                              Class {m.classNumber}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              Room #{m.concurrencySlot || m.classNumber}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            isDegraded
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isDegraded ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'
                            }`}
                          />
                          <span>{m.status || 'Active'}</span>
                        </span>
                      </div>

                      {/* Room Credentials (Clean pills with 1-click copy) */}
                      <div className="py-3.5 space-y-2 text-xs">
                        {/* Meeting ID */}
                        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <span className="text-[11px] font-bold text-slate-500">Meeting ID:</span>
                          <div className="flex items-center gap-1.5 font-mono font-black text-slate-900">
                            <span>{m.zoomMeetingId}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(m.zoomMeetingId);
                                toast.success(`Copied Meeting ID ${m.zoomMeetingId}`);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-blue-600 transition cursor-pointer"
                              title="Copy Meeting ID"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Passcode */}
                        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <span className="text-[11px] font-bold text-slate-500">Passcode:</span>
                          <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800">
                            <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-xs">
                              {m.passcode}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(m.passcode);
                                toast.success(`Copied Passcode ${m.passcode}`);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-blue-600 transition cursor-pointer"
                              title="Copy Passcode"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Host PIN & Host Name */}
                        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1 font-medium">
                          <span>Host PIN: <strong className="font-mono text-slate-800">{m.hostKey || '884422'}</strong></span>
                          <span className="truncate max-w-[130px] font-mono text-[10px]" title={m.accountEmail}>
                            {m.accountEmail || `zoom.class${m.classNumber}@school.pk`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        {/* Join Link */}
                        <a
                          href={m.joinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-2xs active:scale-[0.98]"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Join Room</span>
                        </a>

                        {/* Copy Link */}
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(m.joinUrl);
                            toast.success(`Copied Class ${m.classNumber} link`);
                          }}
                          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-[0.98]"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </button>
                      </div>

                      {/* Micro actions row (Edit, Health Check, Delete) */}
                      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                        <button
                          type="button"
                          onClick={() => handleOpenConfigModal(m)}
                          className="hover:text-blue-600 flex items-center gap-1 transition cursor-pointer font-semibold"
                        >
                          <Settings className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRunHealthCheck(m.classNumber)}
                          disabled={checkingClassNum === m.classNumber}
                          className="hover:text-emerald-600 flex items-center gap-1 transition cursor-pointer font-semibold"
                        >
                          <RefreshCw className={`w-3 h-3 ${checkingClassNum === m.classNumber ? 'animate-spin' : ''}`} />
                          <span>Check</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteMeeting(m.classNumber)}
                          disabled={deletingClassNum === m.classNumber}
                          className="hover:text-rose-600 flex items-center gap-1 transition cursor-pointer font-semibold"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 4B. STREAMLINED DIRECTORY TABLE VIEW */
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50 text-slate-500 font-bold text-[11px] uppercase tracking-wider h-11">
                      <th className="py-2 px-5">Class</th>
                      <th className="py-2 px-5">Meeting ID &amp; PIN</th>
                      <th className="py-2 px-5">Passcode</th>
                      <th className="py-2 px-5">Join Link</th>
                      <th className="py-2 px-5 text-center">Status</th>
                      <th className="py-2 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {meetings.map((m) => {
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/80 h-14 transition-colors">
                          <td className="py-2 px-5">
                            <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200">
                              Class {m.classNumber}
                            </span>
                          </td>

                          <td className="py-2 px-5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900 text-xs">
                                {m.zoomMeetingId}
                              </span>
                              <span className="text-[10px] text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded font-mono font-bold border border-amber-200">
                                PIN: {m.hostKey || '884422'}
                              </span>
                            </div>
                          </td>

                          <td className="py-2 px-5">
                            <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              {m.passcode}
                            </span>
                          </td>

                          <td className="py-2 px-5 max-w-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-mono text-[11px] text-slate-500 block max-w-[180px]">
                                {m.joinUrl}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(m.joinUrl);
                                  toast.success(`Copied Class ${m.classNumber} link`);
                                }}
                                className="p-1 rounded text-slate-400 hover:text-blue-600 transition cursor-pointer"
                                title="Copy link"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          <td className="py-2 px-5 text-center">
                            <StatusBadge status={m.status} />
                          </td>

                          <td className="py-2 px-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <a
                                href={m.joinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 transition shadow-2xs"
                              >
                                <Video className="w-3.5 h-3.5" />
                                <span>Join</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => handleOpenConfigModal(m)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                                title="Edit Link"
                              >
                                <Settings className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMeeting(m.classNumber)}
                                className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        /* =========================================================================
            FACULTY ATTENDANCE REVIEWS TAB
            ========================================================================= */
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            {/* Filter and Search Bar */}
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setReviewStatusFilter('REQUIRES_REVIEW')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    reviewStatusFilter === 'REQUIRES_REVIEW'
                      ? 'bg-amber-500 text-slate-950 shadow-2xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Needs Review ({pendingReviewCount})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    reviewStatusFilter === 'ALL'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  All Logs ({reviews.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewStatusFilter('VERIFIED')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    reviewStatusFilter === 'VERIFIED'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Verified ({reviews.filter((r) => r.verificationStatus === 'VERIFIED').length})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewStatusFilter('REJECTED')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    reviewStatusFilter === 'REJECTED'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Rejected ({reviews.filter((r) => r.verificationStatus === 'REJECTED').length})
                </button>
              </div>

              <div className="relative w-full md:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search faculty or class..."
                  value={reviewSearch}
                  onChange={(e) => setReviewSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Reviews Table */}
            {filteredReviews.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-800">
                  {reviewStatusFilter === 'REQUIRES_REVIEW'
                    ? 'No Attendance Reviews Pending'
                    : 'No Matching Attendance Records'}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  All faculty Zoom sessions have been verified. Teaching duty is cleanly synced for payroll.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50 text-slate-600 font-bold text-[11px] uppercase tracking-wider h-11">
                      <th className="py-2 px-4">Classroom</th>
                      <th className="py-2 px-4">Scheduled Window</th>
                      <th className="py-2 px-4">Faculty vs Zoom Identity</th>
                      <th className="py-2 px-4">Presence</th>
                      <th className="py-2 px-4">Status</th>
                      <th className="py-2 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredReviews.map((r) => {
                      const isNeedsReview = r.verificationStatus === 'REQUIRES_REVIEW' || r.verificationStatus === 'FLAGGED';
                      const durMins = r.durationSeconds ? Math.round(r.durationSeconds / 60) : 0;
                      return (
                        <tr
                          key={r.id}
                          className={`hover:bg-slate-50/80 h-14 transition-colors ${
                            isNeedsReview ? 'bg-amber-50/25' : ''
                          }`}
                        >
                          <td className="py-2 px-4 whitespace-nowrap">
                            <span className="font-bold text-slate-900 block">
                              {r.className || `Class ${r.classNumber || 'Room'}`}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {r.subjectName || 'Core Curriculum'}
                            </span>
                          </td>

                          <td className="py-2 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>
                                {r.scheduledStart
                                  ? new Date(r.scheduledStart).toLocaleDateString([], {
                                      month: 'short',
                                      day: 'numeric'
                                    })
                                  : 'Scheduled'}
                              </span>
                            </div>
                            <div className="font-mono text-[11px] text-slate-400">
                              {r.scheduledStart ? String(r.scheduledStart).substring(11, 16) : ''} -{' '}
                              {r.scheduledEnd ? String(r.scheduledEnd).substring(11, 16) : ''}
                            </div>
                          </td>

                          <td className="py-2 px-4">
                            <div className="font-bold text-slate-900 flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                              <span>{r.matchedTeacherName || 'Unknown Faculty'}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Zoom: "{r.participantName}"
                            </span>
                          </td>

                          <td className="py-2 px-4 whitespace-nowrap">
                            <span className="font-bold text-slate-800 font-mono">
                              {durMins} mins
                            </span>
                          </td>

                          <td className="py-2 px-4 whitespace-nowrap">
                            {r.verificationStatus === 'REQUIRES_REVIEW' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                Needs Review
                              </span>
                            ) : r.verificationStatus === 'VERIFIED' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Verified
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                {r.verificationStatus}
                              </span>
                            )}
                          </td>

                          <td className="py-2 px-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isNeedsReview ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenResolveModal(r, 'APPROVE')}
                                    className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenResolveModal(r, 'REJECT')}
                                    className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenResolveModal(r, r.verificationStatus === 'VERIFIED' ? 'REJECT' : 'APPROVE')}
                                  className="px-2.5 py-1 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition cursor-pointer"
                                >
                                  Re-evaluate
                                </button>
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
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS: Config, Renewal, Resolve
          ========================================================================= */}
      {isConfigModalOpen && (
        <Modal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          title={isAddMode ? 'Add Classroom Zoom Link' : `Configure Classroom · Class ${selectedMeeting?.classNumber}`}
          description="Enter permanent meeting ID, passcode and link for this class."
          maxWidth="md"
        >
          <form onSubmit={handleConfigSubmit} className="space-y-4 text-xs">
            {isAddMode && (
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Select Target Class <span className="text-rose-500">*</span>
                </label>
                <select
                  value={targetClassNumber}
                  onChange={(e) => handleClassNumberChange(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900 focus:bg-white cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((cls) => {
                    const isConfigured = configuredClasses.has(cls);
                    return (
                      <option key={cls} value={cls}>
                        Class {cls} {isConfigured ? '(Already configured)' : '(Available)'}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Room Title
              </label>
              <input
                type="text"
                value={configTopic}
                onChange={(e) => setConfigTopic(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white font-medium"
                placeholder="e.g. Class 1 Live Classroom"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Meeting ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={configMeetingId}
                  onChange={(e) => setConfigMeetingId(e.target.value)}
                  required
                  placeholder="e.g. 624 305 9177"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-900 focus:bg-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Passcode <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={configPasscode}
                  onChange={(e) => setConfigPasscode(e.target.value)}
                  required
                  placeholder="e.g. CLASS1#"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-900 focus:bg-white font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Host Key PIN
                </label>
                <input
                  type="text"
                  value={configHostKey}
                  onChange={(e) => setConfigHostKey(e.target.value)}
                  placeholder="884422"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Account Email
                </label>
                <input
                  type="email"
                  value={configAccountEmail}
                  onChange={(e) => setConfigAccountEmail(e.target.value)}
                  placeholder="zoom.class1@school.pk"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-900 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Permanent Join URL <span className="text-rose-500">*</span>
              </label>
              <input
                type="url"
                value={configJoinUrl}
                onChange={(e) => setConfigJoinUrl(e.target.value)}
                required
                placeholder="https://us05web.zoom.us/j/..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-900 focus:bg-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingConfig}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {savingConfig ? 'Saving...' : 'Save Classroom'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Attendance Resolve Modal */}
      {isResolveModalOpen && selectedReview && (
        <Modal
          isOpen={isResolveModalOpen}
          onClose={() => setIsResolveModalOpen(false)}
          title={`Resolve Attendance Review #${selectedReview.id}`}
          description={`Participant: "${selectedReview.participantName}" · Class ${selectedReview.classNumber || 'Room'}`}
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Decision</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setResolveDecision('APPROVE')}
                  className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    resolveDecision === 'APPROVE'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Approve Duty</span>
                </button>
                <button
                  type="button"
                  onClick={() => setResolveDecision('REJECT')}
                  className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    resolveDecision === 'REJECT'
                      ? 'bg-rose-50 border-rose-300 text-rose-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <X className="w-4 h-4 text-rose-600" />
                  <span>Reject Duty</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Administrative Note</label>
              <textarea
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white"
                placeholder="Reason or reference..."
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsResolveModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResolveReview}
                disabled={resolving}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {resolving ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
