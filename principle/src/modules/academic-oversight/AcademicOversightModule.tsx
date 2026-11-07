import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../services/api';
import { StudentRecordReportRow, AcademicSession, SchoolClass } from '../../types';
import { Modal } from '../../components/common/Modal';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import {
  Trophy,
  Users,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Search,
  Download,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Clock,
  Send,
  BarChart3,
  Eye,
  Printer,
  Info,
  Check,
  Award,
  ShieldCheck,
  Calculator,
  RefreshCw
} from 'lucide-react';

export type AcademicTab = 'terminal' | 'progress' | 'approvals';

export const AcademicOversightModule: React.FC = () => {
  const toast = useToast();

  // Primary data states
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [students, setStudents] = useState<StudentRecordReportRow[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string; code: string }[]>([]);

  // Navigation & UI states
  const [activeTab, setActiveTab] = useState<AcademicTab>('terminal');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Approvals & Overview states
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null);
  const [resultsOverview, setResultsOverview] = useState<any | null>(null);
  const [overviewLoading, setOverviewLoading] = useState<boolean>(false);
  const [actionBusyClass, setActionBusyClass] = useState<number | 'ALL' | null>(null);
  const [inspectClassModal, setInspectClassModal] = useState<{
    open: boolean;
    classId: number | null;
    className: string;
    loading: boolean;
    rows: any[];
  }>({
    open: false,
    classId: null,
    className: '',
    loading: false,
    rows: []
  });

  // Transcript inspection modal state
  const [transcriptModal, setTranscriptModal] = useState<{
    open: boolean;
    student: StudentRecordReportRow | null;
    data: any | null;
    loading: boolean;
  }>({
    open: false,
    student: null,
    data: null,
    loading: false
  });

  // Parent intervention modal state
  const [alertModal, setAlertModal] = useState<{
    open: boolean;
    student: StudentRecordReportRow | null;
  }>({ open: false, student: null });
  const [alertSubjectId, setAlertSubjectId] = useState<string>('');
  const [alertCategory, setAlertCategory] = useState<string>('ATTENTION_NEEDED');
  const [alertTitle, setAlertTitle] = useState<string>('');
  const [alertMessage, setAlertMessage] = useState<string>('');
  const [isUrgent, setIsUrgent] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [cooldownInfo, setCooldownInfo] = useState<any | null>(null);
  const [alertSubmitting, setAlertSubmitting] = useState<boolean>(false);

  // Initial lookup data (sessions, classes, subjects)
  useEffect(() => {
    let isMounted = true;
    const fetchMetadata = async () => {
      try {
        const [sessList, clsList, subList] = await Promise.all([
          api.getAcademicSessions().catch(() => []),
          api.getClasses().catch(() => []),
          api.getAllSubjects().catch(() => [])
        ]);

        if (!isMounted) return;

        setSessions(sessList);
        setClasses(clsList);
        setSubjects(subList);

        // Select current session by default
        const currentSess = sessList.find((s) => s.isCurrent) || sessList[0];
        if (currentSess) {
          setSelectedSessionId(currentSess.id);
          const termList = await api.getAcademicTerms(currentSess.id).catch(() => []);
          if (isMounted) {
            setTerms(termList || []);
            if (termList && termList.length > 0) {
              const preferred = termList.find((t: any) => t.is_final) || termList[0];
              setSelectedTermId(preferred.id);
            }
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to initialize session parameters');
      }
    };

    fetchMetadata();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load terms when selectedSessionId changes
  useEffect(() => {
    if (!selectedSessionId) return;
    (async () => {
      try {
        const termList = await api.getAcademicTerms(selectedSessionId);
        setTerms(termList || []);
        if (termList && termList.length > 0) {
          const preferred = termList.find((t: any) => t.is_final) || termList[0];
          setSelectedTermId(preferred.id);
        } else {
          setSelectedTermId(null);
        }
      } catch {
        setTerms([]);
        setSelectedTermId(null);
      }
    })();
  }, [selectedSessionId]);

  // Load results overview whenever selectedTermId changes
  const loadOverview = useCallback(async () => {
    if (!selectedTermId) {
      setResultsOverview(null);
      return;
    }
    try {
      setOverviewLoading(true);
      const data = await api.getResultsOverview(selectedTermId);
      setResultsOverview(data);
    } catch {
      setResultsOverview(null);
    } finally {
      setOverviewLoading(false);
    }
  }, [selectedTermId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Fetch student records whenever session or class filter changes
  const loadStudentRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getStudentRecordsReport(selectedClassId, selectedSessionId);
      setStudents(data);
      setCurrentPage(1);
    } catch (err: any) {
      setError(err.message || 'Failed to load student academic records');
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, selectedSessionId]);

  useEffect(() => {
    loadStudentRecords();
  }, [loadStudentRecords]);

  // Selected session and class display labels
  const currentSessionObj = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) || sessions[0],
    [sessions, selectedSessionId]
  );
  const sessionName = currentSessionObj ? currentSessionObj.name : '2026-27';

  const selectedClassObj = useMemo(
    () => classes.find((c) => (c.id || c.classNumber) === selectedClassId),
    [classes, selectedClassId]
  );

  // Filter students by search query
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Search matching student name, roll number, or admission number
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = s.studentName.toLowerCase().includes(q);
        const matchesRoll = s.rollNo ? s.rollNo.toLowerCase().includes(q) : false;
        const matchesAdm = s.admissionNo ? s.admissionNo.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesRoll && !matchesAdm) return false;
      }
      return true;
    });
  }, [students, searchQuery]);

  // Aggregate Metrics for the 4 Stat Cards
  const stats = useMemo(() => {
    const total = filteredStudents.length;

    let passed = 0;
    let failed = 0;
    let totalPct = 0;
    let scoredCount = 0;

    // Continuous assessment metrics
    let continuousTotal = 0;
    let continuousCount = 0;
    let goodStandingCount = 0;
    let needAttentionCount = 0;

    for (const s of filteredStudents) {
      // 1. Terminal exam
      const termRes = s.terminalResult;
      const statusUpper = (termRes?.status || '').toUpperCase();

      if (statusUpper === 'PASS' || statusUpper === 'PASSED') {
        passed++;
      } else if (statusUpper === 'FAIL' || statusUpper === 'FAILED' || statusUpper === 'SUPPLEMENTARY') {
        failed++;
      }

      if (termRes && termRes.percentage != null) {
        totalPct += Number(termRes.percentage);
        scoredCount++;
      }

      // 2. Continuous academics
      const avg = s.academics?.averageScore;
      const att = s.attendance?.rate;
      if (avg != null) {
        continuousTotal += Number(avg);
        continuousCount += 1;
        if (avg >= 50 && (att === null || att >= 75)) {
          goodStandingCount += 1;
        } else {
          needAttentionCount += 1;
        }
      }
    }

    const successRate = scoredCount > 0 ? ((passed / scoredCount) * 100).toFixed(1) : '0.0';
    const failRate = scoredCount > 0 ? ((failed / scoredCount) * 100).toFixed(1) : '0.0';
    const avgTerminalExam = scoredCount > 0 ? `${(totalPct / scoredCount).toFixed(1)}%` : '—';

    const avgContinuousScore = continuousCount > 0 ? `${(continuousTotal / continuousCount).toFixed(1)}%` : '—';
    const goodStandingRate = total > 0 ? ((goodStandingCount / total) * 100).toFixed(1) : '0.0';
    const attentionRate = total > 0 ? ((needAttentionCount / total) * 100).toFixed(1) : '0.0';

    return {
      totalStudents: total,
      passedStudents: passed,
      failedStudents: failed,
      successRate,
      failRate,
      avgTerminalExam,
      scoredCount,
      continuousCount,
      goodStandingCount,
      goodStandingRate,
      needAttentionCount,
      attentionRate,
      avgContinuousScore
    };
  }, [filteredStudents]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / itemsPerPage));
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredStudents.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredStudents, currentPage, itemsPerPage]);

  const startIndexDisplay = filteredStudents.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endIndexDisplay = Math.min(currentPage * itemsPerPage, filteredStudents.length);

  // Transcript Inspection Modal Handler
  const handleOpenTranscript = async (student: StudentRecordReportRow) => {
    setTranscriptModal({
      open: true,
      student,
      data: null,
      loading: true
    });

    try {
      const hist = await api.getStudentResults(Number(student.id));
      setTranscriptModal((prev) => ({
        ...prev,
        data: hist,
        loading: false
      }));
    } catch {
      setTranscriptModal((prev) => ({
        ...prev,
        loading: false
      }));
    }
  };

  // Parent Alert Modal Handlers
  const handleOpenAlert = async (student: StudentRecordReportRow) => {
    const subId = subjects[0]?.id || '';
    setAlertModal({ open: true, student });
    setAlertSubjectId(subId);
    setAlertCategory('ATTENTION_NEEDED');
    setAlertTitle(`Academic Progress Alert: ${student.studentName}`);
    setAlertMessage(
      `Dear Parent/Guardian, this is an official academic progress notice regarding ${student.studentName} (${student.className}). Current term metrics require support.`
    );
    setIsUrgent(false);
    setOverrideReason('');
    setCooldownInfo(null);

    if (subId) {
      try {
        const cd = await api.getAlertCooldown(Number(student.id), Number(subId));
        setCooldownInfo(cd);
      } catch {
        setCooldownInfo(null);
      }
    }
  };

  const handleAlertSubjectChange = async (newSubId: string) => {
    setAlertSubjectId(newSubId);
    if (alertModal.student && newSubId) {
      try {
        const cd = await api.getAlertCooldown(Number(alertModal.student.id), Number(newSubId));
        setCooldownInfo(cd);
      } catch {
        setCooldownInfo(null);
      }
    }
  };

  const handleSendAlert = async () => {
    if (!alertModal.student || !alertSubjectId) return;
    try {
      setAlertSubmitting(true);
      await api.triggerParentAlert({
        studentId: Number(alertModal.student.id),
        subjectId: Number(alertSubjectId),
        sessionId: selectedSessionId || 1,
        alertCategory,
        title: alertTitle,
        messageBody: alertMessage,
        isUrgent,
        overrideReason: isUrgent ? overrideReason : undefined
      });
      toast.success(`Intervention notice dispatched for ${alertModal.student.studentName}`);
      setAlertModal({ open: false, student: null });
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch parent alert');
    } finally {
      setAlertSubmitting(false);
    }
  };

  // Publication & Principal Approval States
  const [approving, setApproving] = useState<boolean>(false);
  const [publishing, setPublishing] = useState<boolean>(false);

  // Compute publication and approval overview for filtered students
  const publicationOverview = useMemo(() => {
    let draftCount = 0;
    let approvedCount = 0;
    let publishedCount = 0;
    let totalEvaluated = 0;

    for (const s of filteredStudents) {
      const resStatus = s.terminalResult?.resultStatus?.toUpperCase();
      if (resStatus === 'PUBLISHED') {
        publishedCount++;
        totalEvaluated++;
      } else if (resStatus === 'APPROVED') {
        approvedCount++;
        totalEvaluated++;
      } else if (
        resStatus === 'DRAFT' ||
        resStatus === 'SUBMITTED' ||
        resStatus === 'UNDER_REVIEW' ||
        resStatus === 'INCOMPLETE'
      ) {
        draftCount++;
        totalEvaluated++;
      }
    }

    return {
      draftCount,
      approvedCount,
      publishedCount,
      totalEvaluated,
      isPendingApproval: draftCount > 0,
      isReadyToPublish: approvedCount > 0,
      isAllPublished: totalEvaluated > 0 && publishedCount === totalEvaluated
    };
  }, [filteredStudents]);

  const pendingTeacherSubmissionsCount = useMemo(() => {
    if (!resultsOverview?.classes) return 0;
    return resultsOverview.classes.reduce(
      (sum: number, c: any) =>
        sum + (c.resultsComputed > c.resultsApproved + c.resultsPublished ? 1 : 0),
      0
    );
  }, [resultsOverview]);

  const handleApproveResults = async () => {
    if (!selectedClassId) {
      toast.warning('Please select a specific class from the filter above to approve results.');
      return;
    }
    const termId = selectedTermId || 1;
    try {
      setApproving(true);
      await api.approveClassResults(selectedClassId, termId);
      toast.success('Terminal exam results officially approved by Principal.');
      await Promise.all([loadStudentRecords(), loadOverview()]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve class results');
    } finally {
      setApproving(false);
    }
  };

  const handlePublishResults = async () => {
    if (!selectedClassId) {
      toast.warning('Please select a specific class from the filter above to publish results.');
      return;
    }
    const termId = selectedTermId || 1;
    try {
      setPublishing(true);
      await api.publishClassResults(selectedClassId, termId);
      toast.success('Terminal exam results officially published to Students and Parents!');
      await Promise.all([loadStudentRecords(), loadOverview()]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish results to students and parents');
    } finally {
      setPublishing(false);
    }
  };

  const handleComputeClass = async (classId: number) => {
    if (!selectedTermId) return;
    try {
      setActionBusyClass(classId);
      await api.computeClassResults(classId, selectedTermId);
      toast.success('Examination marks computed for this class.');
      await Promise.all([loadOverview(), loadStudentRecords()]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to compute class results');
    } finally {
      setActionBusyClass(null);
    }
  };

  const handleApproveClass = async (classId: number | 'ALL') => {
    if (!selectedTermId) return;
    try {
      setActionBusyClass(classId);
      const res = await api.approveClassResults(classId as any, selectedTermId);
      toast.success(`Terminal exam results officially approved (${res?.approved ?? 'All'} evaluated).`);
      await Promise.all([loadOverview(), loadStudentRecords()]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve results');
    } finally {
      setActionBusyClass(null);
    }
  };

  const handlePublishClass = async (classId: number | 'ALL') => {
    if (!selectedTermId) return;
    try {
      setActionBusyClass(classId);
      const res = await api.publishClassResults(classId as any, selectedTermId);
      toast.success(`Official results published! Now live for Students & Parents (${res?.published ?? 'All'} released).`);
      await Promise.all([loadOverview(), loadStudentRecords()]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish results');
    } finally {
      setActionBusyClass(null);
    }
  };

  const handleInspectClass = async (classId: number, className: string) => {
    if (!selectedTermId) return;
    setInspectClassModal({
      open: true,
      classId,
      className,
      loading: true,
      rows: []
    });
    try {
      const rows = await api.listFinalResults({ termId: selectedTermId, classId });
      setInspectClassModal((prev) => ({
        ...prev,
        loading: false,
        rows: rows || []
      }));
    } catch {
      setInspectClassModal((prev) => ({
        ...prev,
        loading: false,
        rows: []
      }));
    }
  };

  // PDF Export Trigger
  const handleExportPDF = () => {
    window.print();
  };

  // Helper for Grade Badge Styling
  const renderGradeBadge = (grade: string | null | undefined) => {
    if (!grade || grade === '—') {
      return <span className="text-slate-400 font-mono text-xs">—</span>;
    }

    const g = grade.trim().toUpperCase();
    if (g.startsWith('A')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="text-[10px]">▲</span> {grade}
        </span>
      );
    }
    if (g.startsWith('B')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="text-[10px]">▲</span> {grade}
        </span>
      );
    }
    if (g.startsWith('C')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
          <span className="text-[10px]">▲</span> {grade}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <span className="text-[10px]">▲</span> {grade}
      </span>
    );
  };

  // Helper for Pass/Fail & Approval Status Indicator
  const renderStatusDot = (
    status: string | null | undefined,
    resultStatus: string | null | undefined
  ) => {
    const rs = (resultStatus || '').toUpperCase();

    // If published, display the official Pass/Fail status with Published sub-label
    if (rs === 'PUBLISHED') {
      const st = (status || '').trim().toUpperCase();
      const isPass = st === 'PASS' || st === 'PASSED';
      return (
        <div>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
              isPass ? 'text-emerald-700' : 'text-rose-600'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isPass ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            {st === 'SUPPLEMENTARY' ? 'Fail (Resit)' : isPass ? 'Pass' : 'Fail'}
          </span>
          <span className="text-[10px] text-emerald-600/80 font-mono block">
            Published
          </span>
        </div>
      );
    }

    // If approved by principal but not yet published to students
    if (rs === 'APPROVED') {
      return (
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            Approved
          </span>
          <span className="text-[10px] text-amber-600 font-medium block">
            Hidden from Students
          </span>
        </div>
      );
    }

    // If uploaded by teacher but waiting for Principal approval
    if (
      rs === 'DRAFT' ||
      rs === 'SUBMITTED' ||
      rs === 'UNDER_REVIEW' ||
      rs === 'INCOMPLETE'
    ) {
      return (
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Awaiting Approval
          </span>
          <span className="text-[10px] text-slate-400 font-mono block">
            Teacher Uploaded
          </span>
        </div>
      );
    }

    // Pending terminal exam evaluation
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <span className="w-2 h-2 rounded-full bg-slate-300" />
        Pending Terminal Exam
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* 1. TOP BREADCRUMB & FILTER BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-slate-600 font-medium">
          <GraduationCap className="w-4 h-4 text-indigo-600" />
          <span>Dashboard</span>
          <span className="text-slate-300">›</span>
          <span className="text-slate-900 font-semibold">Academic Results</span>
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Session Selector */}
          <div className="relative">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-500 font-normal">Session:</span>
              <select
                value={selectedSessionId || ''}
                onChange={(e) => setSelectedSessionId(Number(e.target.value))}
                className="bg-transparent text-slate-900 font-semibold focus:outline-none cursor-pointer pr-2"
              >
                {sessions.map((sess) => (
                  <option key={sess.id} value={sess.id}>
                    {sess.name} {sess.isCurrent ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Class Selector */}
          <div className="relative">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium shadow-2xs">
              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-500 font-normal">Class:</span>
              <select
                value={selectedClassId ?? ''}
                onChange={(e) => setSelectedClassId(e.target.value ? Number(e.target.value) : null)}
                className="bg-transparent text-slate-900 font-semibold focus:outline-none cursor-pointer pr-2"
              >
                <option value="">All Classes (1–8)</option>
                {classes.map((c) => {
                  const val = c.id ?? c.classNumber;
                  return (
                    <option key={val} value={val}>
                      {c.name}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 2. PURPLE HERO BANNER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-50/90 via-indigo-50/60 to-purple-50/40 border border-purple-100/90 shadow-2xs relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          {/* 3D Stylized Cap Illustration */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-300/40 ring-4 ring-white shrink-0">
            <GraduationCap className="w-8 h-8 drop-shadow-sm" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Academic Results Overview
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              View complete results for {selectedClassObj ? selectedClassObj.name : 'all classes (Class 1–8)'}
            </p>
          </div>
        </div>

        {/* Right Info Pill */}
        <div className="flex items-center gap-2 self-start md:self-auto px-4 py-2 rounded-2xl bg-white/80 backdrop-blur-xs border border-purple-200/80 text-purple-900 text-xs font-semibold shadow-2xs">
          <span>Session: {sessionName}</span>
          {selectedClassObj && (
            <>
              <span className="text-purple-300">|</span>
              <span>{selectedClassObj.name}</span>
            </>
          )}
          <SlidersHorizontal className="w-3.5 h-3.5 text-purple-600 ml-1" />
        </div>
      </div>

      {/* 3. FOUR METRIC STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Students */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 block">Total Students</span>
            <span className="text-2xl font-bold text-slate-900 font-mono block mt-0.5">
              {stats.totalStudents}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              Enrolled in {selectedClassObj ? selectedClassObj.name : 'Classes 1–8'}
            </span>
          </div>
        </div>

        {/* Card 2: Passed Terminal Exam or In Good Standing */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 block">
              {activeTab === 'progress' ? 'In Good Standing' : 'Passed Terminal Exam'}
            </span>
            <span className="text-2xl font-bold text-slate-900 font-mono block mt-0.5">
              {activeTab === 'progress' ? stats.goodStandingCount : stats.passedStudents}
            </span>
            <span className="text-[11px] text-emerald-600 font-semibold block mt-0.5">
              {activeTab === 'progress'
                ? `${stats.goodStandingRate}% Good Standing`
                : `${stats.successRate}% Success Rate`}
            </span>
          </div>
        </div>

        {/* Card 3: Failed Students or Academic Alert */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 block">
              {activeTab === 'progress' ? 'Needs Academic Attention' : 'Failed / Supplementary'}
            </span>
            <span className="text-2xl font-bold text-slate-900 font-mono block mt-0.5">
              {activeTab === 'progress' ? stats.needAttentionCount : stats.failedStudents}
            </span>
            <span className="text-[11px] text-rose-600 font-semibold block mt-0.5">
              {activeTab === 'progress'
                ? `${stats.attentionRate}% Below Benchmark`
                : `${stats.failRate}% Require Supplementary`}
            </span>
          </div>
        </div>

        {/* Card 4: Avg Score */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 block">
              {activeTab === 'progress' ? 'Continuous Term Average' : 'Avg. Terminal Exam'}
            </span>
            <span className="text-2xl font-bold text-slate-900 font-mono block mt-0.5">
              {activeTab === 'progress' ? stats.avgContinuousScore : stats.avgTerminalExam}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              {activeTab === 'progress' ? 'Continuous Tasks & Tests' : 'Official Terminal Results'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. TAB SWITCHER (Terminal Exam Results vs Student Progress vs Teacher Approvals) */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab('terminal')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all duration-150 cursor-pointer ${
            activeTab === 'terminal'
              ? 'bg-indigo-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Terminal Exam Results</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('progress')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all duration-150 cursor-pointer ${
            activeTab === 'progress'
              ? 'bg-indigo-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Student Academic Progress &amp; Projections</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('approvals')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all duration-150 cursor-pointer ${
            activeTab === 'approvals'
              ? 'bg-indigo-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Teacher Result Approvals &amp; Publishing</span>
          {pendingTeacherSubmissionsCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black">
              {pendingTeacherSubmissionsCount}
            </span>
          )}
        </button>
      </div>

      {/* 4.1 PRINCIPAL TERMINAL EXAM APPROVAL & PUBLISHING GATE BANNER */}
      {activeTab === 'terminal' && (
        <div className="space-y-2">
          {publicationOverview.isPendingApproval && (
            <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3 text-xs text-amber-950">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <span className="font-bold block text-slate-900">
                    Awaiting Principal Approval ({publicationOverview.draftCount} terminal exam marks submitted)
                  </span>
                  <span className="text-[11px] text-amber-800">
                    Teacher marks are under review. These results are <strong>strictly hidden</strong> from students and parents until you approve and publish.
                  </span>
                </div>
              </div>

              {selectedClassId ? (
                <button
                  type="button"
                  disabled={approving}
                  onClick={handleApproveResults}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-xs transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{approving ? 'Approving...' : `Approve ${selectedClassObj ? selectedClassObj.name : 'Class'} Results`}</span>
                </button>
              ) : (
                <span className="text-[11px] text-amber-700 font-medium italic">
                  Select a specific class from the dropdown above to approve
                </span>
              )}
            </div>
          )}

          {publicationOverview.isReadyToPublish && (
            <div className="p-4 rounded-2xl bg-indigo-50/90 border border-indigo-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3 text-xs text-indigo-950">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                  <Award className="w-4 h-4 text-indigo-700" />
                </div>
                <div>
                  <span className="font-bold block text-slate-900">
                    Results Approved by Principal ({publicationOverview.approvedCount} results ready for release)
                  </span>
                  <span className="text-[11px] text-indigo-800">
                    Results are verified and ready. They remain <strong>locked and hidden</strong> from students and parents until you click "Publish to Students & Parents".
                  </span>
                </div>
              </div>

              {selectedClassId ? (
                <button
                  type="button"
                  disabled={publishing}
                  onClick={handlePublishResults}
                  className="px-4 py-2 rounded-xl bg-indigo-900 hover:bg-indigo-800 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-xs transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{publishing ? 'Publishing...' : `Publish ${selectedClassObj ? selectedClassObj.name : 'Class'} Results`}</span>
                </button>
              ) : (
                <span className="text-[11px] text-indigo-700 font-medium italic">
                  Select a specific class from the dropdown above to publish
                </span>
              )}
            </div>
          )}

          {publicationOverview.isAllPublished && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-xs text-emerald-950 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Official Terminal Results Published:</strong> Students and parents can now view, download, and print their official Terminal Examination Result Cards.
              </span>
            </div>
          )}
        </div>
      )}

      {/* 5. MAIN TABLE CARD (Terminal and Progress tabs) */}
      {activeTab !== 'approvals' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        {/* Table Header Bar */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              {activeTab === 'terminal' ? (
                <Trophy className="w-5 h-5 text-amber-600" />
              ) : (
                <BarChart3 className="w-5 h-5 text-indigo-600" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {activeTab === 'terminal' ? 'Terminal Exam Results' : 'Student Academic Progress'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeTab === 'terminal'
                  ? `Final exam results for ${selectedClassObj ? selectedClassObj.name : 'all classes'}`
                  : 'Continuous assessment, task submission, and attendance tracking'}
              </p>
            </div>
          </div>

          {/* Right Action: Search Bar & Export PDF */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 sm:w-60 transition-colors"
              />
            </div>

            <button
              type="button"
              onClick={handleExportPDF}
              className="px-4 py-2 rounded-xl bg-indigo-900 hover:bg-indigo-800 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Table Body Content */}
        {loading ? (
          <div className="p-8">
            <LoadingState message="Aggregating academic evaluations & terminal results..." rows={6} />
          </div>
        ) : error ? (
          <div className="p-8">
            <ErrorState message={error} onRetry={loadStudentRecords} />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Student Records Found"
              description="No students match your filter criteria or no academic records have been published for this class / session."
            />
          </div>
        ) : activeTab === 'terminal' ? (
          /* TAB 1: TERMINAL EXAM RESULTS TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 w-12 text-center">#</th>
                  <th className="px-5 py-3">Student Name</th>
                  <th className="px-5 py-3">Roll No</th>
                  <th className="px-5 py-3">Class</th>
                  <th className="px-5 py-3">Terminal Exam Marks</th>
                  <th className="px-5 py-3">Percentage</th>
                  <th className="px-5 py-3">Grade</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedStudents.map((s, idx) => {
                  const termRes = s.terminalResult;
                  const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1;
                  const marksObtained = termRes?.obtainedMarks != null ? termRes.obtainedMarks : null;
                  const marksTotal = termRes?.totalMarks || 100;
                  const percentageDisplay =
                    termRes?.percentage != null ? `${Number(termRes.percentage).toFixed(1)}%` : '—';

                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                      onClick={() => handleOpenTranscript(s)}
                    >
                      <td className="px-5 py-3.5 text-center font-mono text-slate-400 font-medium">
                        {rowNumber}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-slate-900 block">{s.studentName}</span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          Adm: {s.admissionNo}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-600 font-medium">
                        {s.rollNo ? `S-${s.rollNo.padStart(3, '0')}` : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 font-medium">{s.className}</td>
                      <td className="px-5 py-3.5 font-mono text-slate-900 font-semibold">
                        {marksObtained != null ? `${marksObtained} / ${marksTotal}` : '—'}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-900 font-bold">
                        {percentageDisplay}
                      </td>
                      <td className="px-5 py-3.5">{renderGradeBadge(termRes?.grade)}</td>
                      <td className="px-5 py-3.5">{renderStatusDot(termRes?.status, termRes?.resultStatus)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenTranscript(s);
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs"
                        >
                          <Eye className="w-3 h-3 text-slate-400" />
                          <span>Transcript</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* TAB 2: STUDENT PROGRESS TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 w-12 text-center">#</th>
                  <th className="px-5 py-3">Student Name</th>
                  <th className="px-5 py-3">Roll No</th>
                  <th className="px-5 py-3">Attendance Rate</th>
                  <th className="px-5 py-3">Tasks / Quizzes</th>
                  <th className="px-5 py-3">Monthly Tests</th>
                  <th className="px-5 py-3">Term Average</th>
                  <th className="px-5 py-3">Academic Standing</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedStudents.map((s, idx) => {
                  const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1;
                  const attRate = s.attendance?.rate;
                  const avgScore = s.academics?.averageScore;
                  const isFlagged = (avgScore != null && avgScore < 50) || (attRate != null && attRate < 75);

                  return (
                    <tr key={s.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="px-5 py-3.5 text-center font-mono text-slate-400 font-medium">
                        {rowNumber}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-slate-900 block">{s.studentName}</span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          Adm: {s.admissionNo} · {s.className}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-600 font-medium">
                        {s.rollNo ? `S-${s.rollNo.padStart(3, '0')}` : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">
                            {attRate != null ? `${attRate}%` : '—'}
                          </span>
                          {attRate != null && (
                            <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  attRate >= 85 ? 'bg-emerald-500' : attRate >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${attRate}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-700">
                        {s.academics.assignmentAverage != null
                          ? `${Math.round(s.academics.assignmentAverage)}% Avg`
                          : s.academics.submitted > 0
                          ? `${s.academics.submitted} tasks`
                          : '—'}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-700">
                        {s.academics.testAverage != null
                          ? `${Math.round(s.academics.testAverage)}% Avg`
                          : '—'}
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                        {avgScore != null ? `${Math.round(avgScore)}%` : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {isFlagged ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Academic Alert
                          </span>
                        ) : avgScore != null && avgScore >= 80 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Good Standing
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200">
                            Regular
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenAlert(s)}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
                        >
                          <Send className="w-3 h-3" />
                          <span>Alert</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer: Pagination & Count */}
        <div className="px-5 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-800">{startIndexDisplay}</span> –{' '}
            <span className="font-semibold text-slate-800">{endIndexDisplay}</span> of{' '}
            <span className="font-semibold text-slate-800">{filteredStudents.length}</span> students
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => setCurrentPage(pageNum)}
                className={`w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors ${
                  currentPage === pageNum
                    ? 'bg-indigo-900 text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      )}

      {/* 6. TEACHER RESULT APPROVALS & PUBLISHING DASHBOARD */}
      {activeTab === 'approvals' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Controls Bar */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs flex-wrap">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                Select Term:
              </span>
              <select
                value={selectedTermId ?? ''}
                onChange={(e) => setSelectedTermId(Number(e.target.value))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.is_final ? '· Final Term' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={loadOverview}
                disabled={overviewLoading}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                title="Refresh Status"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${overviewLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Quick Bulk Actions */}
            <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
              <button
                type="button"
                disabled={actionBusyClass !== null || overviewLoading}
                onClick={() => handleApproveClass('ALL')}
                className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Approve all computed results across classes"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>{actionBusyClass === 'ALL' ? 'Processing...' : 'Approve All Classes'}</span>
              </button>

              <button
                type="button"
                disabled={actionBusyClass !== null || overviewLoading}
                onClick={() => handlePublishClass('ALL')}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                title="Publish all approved results to Student and Parent portals"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Publish All to Students &amp; Parents</span>
              </button>
            </div>
          </div>

          {/* 4 Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-medium text-slate-500 block">Classes</span>
                <span className="text-xl font-bold text-slate-900 font-mono">
                  {resultsOverview?.classes?.length || 0}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Active grade levels</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-medium text-slate-500 block">Teacher Submissions</span>
                <span className="text-xl font-bold text-amber-700 font-mono">
                  {resultsOverview?.submissions?.length || 0}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Marks hand-offs</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-medium text-slate-500 block">Pending Approval</span>
                <span className="text-xl font-bold text-rose-700 font-mono">
                  {(resultsOverview?.classes || []).reduce(
                    (acc: number, c: any) =>
                      acc +
                      (c.resultsComputed > c.resultsApproved + c.resultsPublished
                        ? c.resultsComputed - c.resultsApproved - c.resultsPublished
                        : 0),
                    0
                  )}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Students awaiting review</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-medium text-slate-500 block">Published Live</span>
                <span className="text-xl font-bold text-emerald-700 font-mono">
                  {(resultsOverview?.classes || []).reduce(
                    (acc: number, c: any) => acc + (c.resultsPublished || 0),
                    0
                  )}
                </span>
                <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
                  Live on Student &amp; Parent Portal
                </span>
              </div>
            </div>
          </div>

          {/* Class-wise Approvals Table Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Class-wise Results Approval &amp; Publishing Matrix</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review marks uploaded by teachers for each class, approve computed results, and publish them to students and parents.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Class</th>
                    <th className="px-5 py-3 text-center">Enrolled</th>
                    <th className="px-5 py-3 text-center">Teacher Marks Uploaded</th>
                    <th className="px-5 py-3 text-center">Computed Results</th>
                    <th className="px-5 py-3 text-center">Passed / Failed / Suppl.</th>
                    <th className="px-5 py-3 text-center">Publication Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(resultsOverview?.classes || []).map((c: any) => {
                    const hasPendingApproval =
                      c.resultsComputed > c.resultsApproved + c.resultsPublished;
                    const isAllPublished =
                      c.enrolledStudents > 0 && c.resultsPublished >= c.enrolledStudents;
                    const hasApproved = c.resultsApproved > 0;
                    const isBusy = actionBusyClass === c.classId;

                    return (
                      <tr key={c.classId} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-slate-900">{c.className}</td>
                        <td className="px-5 py-3.5 text-center font-mono font-medium text-slate-700">
                          {c.enrolledStudents}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                              c.marksSubmitted >= c.subjectsConfigured && c.subjectsConfigured > 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : c.marksSubmitted > 0
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {c.marksSubmitted} / {c.subjectsConfigured} Subjects
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center font-mono">
                          <span className="font-semibold text-slate-900">{c.resultsComputed}</span>
                          {c.resultsIncomplete > 0 && (
                            <span className="text-[10px] text-amber-700 ml-1 font-semibold">
                              ({c.resultsIncomplete} incomplete)
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center font-mono text-xs">
                          <span className="text-emerald-700 font-bold">{c.passed}</span>
                          <span className="text-slate-300 mx-1">/</span>
                          <span className="text-rose-700 font-bold">{c.failed}</span>
                          <span className="text-slate-300 mx-1">/</span>
                          <span className="text-amber-700 font-bold">{c.supplementary}</span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {isAllPublished ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Published to Students &amp; Parents
                            </span>
                          ) : hasApproved ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800">
                              <Check className="w-3 h-3 text-indigo-600" />
                              Approved ({c.resultsApproved} ready to publish)
                            </span>
                          ) : hasPendingApproval ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Awaiting Approval
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500">
                              Awaiting Marks
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Compute Button */}
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleComputeClass(c.classId)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-40 cursor-pointer shadow-2xs"
                              title="Recompute results from graded exams"
                            >
                              <Calculator className="w-3 h-3 text-slate-500" />
                              <span>Compute</span>
                            </button>

                            {/* Approve Button */}
                            <button
                              type="button"
                              disabled={isBusy || c.enrolledStudents === 0}
                              onClick={() => handleApproveClass(c.classId)}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1 transition-colors disabled:opacity-40 cursor-pointer shadow-xs"
                              title="Approve marks entered by teachers"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{isBusy ? '...' : 'Approve'}</span>
                            </button>

                            {/* Publish Button */}
                            <button
                              type="button"
                              disabled={isBusy || c.enrolledStudents === 0}
                              onClick={() => handlePublishClass(c.classId)}
                              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold inline-flex items-center gap-1 transition-colors disabled:opacity-40 cursor-pointer shadow-xs"
                              title="Publish terminal results to Student and Parent portals"
                            >
                              <Send className="w-3 h-3" />
                              <span>{isBusy ? '...' : 'Publish'}</span>
                            </button>

                            {/* View / Inspect Button */}
                            <button
                              type="button"
                              onClick={() => handleInspectClass(c.classId, c.className)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                              title="Inspect students' results"
                            >
                              <Eye className="w-3.5 h-3.5" />
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

          {/* Teacher Submissions Log */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-600" />
              <span>Teacher Examination Marks Hand-Offs (Submitted per Subject)</span>
            </h3>

            {(resultsOverview?.submissions || []).length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <Clock className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                <p className="font-semibold text-slate-600">No subject marks hand-offs recorded yet for this term.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  When teachers finalize their evaluations and submit marks from their portal, each subject entry will appear here for review.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {resultsOverview.submissions.map((sub: any) => (
                  <div
                    key={sub.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{sub.subjectName}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sub.status === 'PUBLISHED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : sub.status === 'APPROVED'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {sub.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 flex items-center justify-between">
                      <span>Class: <strong>{sub.className}</strong></span>
                      <span>Teacher: <strong>{sub.teacherName}</strong></span>
                    </div>
                    {sub.note && (
                      <p className="text-[11px] text-slate-500 italic bg-white p-2 rounded-lg border border-slate-100">
                        &quot;{sub.note}&quot;
                      </p>
                    )}
                    <div className="text-[10px] text-slate-400 font-mono">
                      Submitted: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'Recently'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. BOTTOM RETENTION NOTICE (Exact Text & Styling as Requested) */}
      <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
          <p className="text-xs text-indigo-950 font-normal leading-relaxed">
            <span className="font-bold">Note:</span> Only Student Progress, Session, and Terminal Exam Results are
            retained. Previous academic data like monthly tests, tasks, quizzes, and learning resources are not stored
            after session change, as per your request.
          </p>
        </div>

        {/* Current Session Data Pill */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-900 text-white text-[11px] font-bold shrink-0 shadow-xs">
          <Check className="w-3.5 h-3.5 text-indigo-300" />
          <span>Current Session Data</span>
        </div>
      </div>

      {/* 7. OFFICIAL TERMINAL TRANSCRIPT MODAL */}
      {transcriptModal.open && transcriptModal.student && (
        <Modal
          isOpen={transcriptModal.open}
          onClose={() => setTranscriptModal({ open: false, student: null, data: null, loading: false })}
          title={`Official Terminal Examination Transcript`}
          description={`${transcriptModal.student.studentName} · ${transcriptModal.student.className} · Session ${sessionName}`}
          maxWidth="2xl"
        >
          <div className="space-y-5 text-xs">
            {/* PRINT-AREA: Isolates ONLY this student's result card during print */}
            <div className="print-area space-y-5 text-xs bg-white p-6 rounded-2xl border border-slate-200/60 print:border-none print:p-0">
              {/* Official School Letterhead */}
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 text-center space-y-1.5 print:bg-white print:border-b-2 print:border-slate-800 print:rounded-none">
                <div className="w-14 h-14 mx-auto rounded-full bg-white shadow-xs p-1 flex items-center justify-center print:shadow-none">
                  <img src="/logowb.png" alt="Cambridge Education System" className="w-full h-full object-contain" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-wider font-heading">
                  Cambridge Education System
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Official Terminal Examination Academic Transcript
                </p>
                <div className="text-[10px] text-indigo-900 font-bold bg-indigo-50/80 px-3 py-1 rounded-full inline-block border border-indigo-100 print:border-none">
                  Academic Session: {sessionName} · Terminal Examination
                </div>
              </div>

              {/* Student Bio Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50/50 border border-slate-200 rounded-xl print:bg-white print:border print:border-slate-300">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Student Name</span>
                  <span className="font-bold text-slate-900 text-sm">{transcriptModal.student.studentName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Admission No</span>
                  <span className="font-mono text-slate-700 font-semibold">{transcriptModal.student.admissionNo}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Roll No</span>
                  <span className="font-mono text-slate-700 font-semibold">
                    {transcriptModal.student.rollNo ? `S-${transcriptModal.student.rollNo.padStart(3, '0')}` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Class</span>
                  <span className="font-bold text-slate-900">{transcriptModal.student.className}</span>
                </div>
              </div>

              {/* Subject Breakdown Table */}
              {transcriptModal.loading ? (
                <div className="py-8 text-center text-slate-400">Loading subject evaluation breakdown...</div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden print:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider print:bg-slate-100">
                      <tr>
                        <th className="px-3.5 py-2.5">Subject</th>
                        <th className="px-3.5 py-2.5 text-right font-mono">Max Marks</th>
                        <th className="px-3.5 py-2.5 text-right font-mono">Obtained Marks</th>
                        <th className="px-3.5 py-2.5 text-right font-mono">Percentage</th>
                        <th className="px-3.5 py-2.5 text-center">Grade</th>
                        <th className="px-3.5 py-2.5 text-center">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 print:divide-slate-300">
                      {transcriptModal.data?.results?.[0]?.subjects?.length > 0 ? (
                        transcriptModal.data.results[0].subjects.map((sub: any) => {
                          const isSuppPassed = sub.supplementary?.is_passed;
                          const finalObt = isSuppPassed
                            ? Math.round(sub.supplementary.obtained_marks)
                            : Math.round(sub.obtained_marks);
                          const finalPct = isSuppPassed
                            ? Math.round((sub.supplementary.obtained_marks / sub.supplementary.max_marks) * 100)
                            : Math.round(sub.percentage);
                          const finalGrade = isSuppPassed ? sub.supplementary.grade : sub.grade;

                          return (
                            <tr key={sub.id} className="hover:bg-slate-50/50 print:hover:bg-transparent">
                              <td className="px-3.5 py-2.5">
                                <span className="font-bold text-slate-900 block">{sub.subjectName}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{sub.subjectCode}</span>
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono text-slate-500">
                                {Math.round(sub.total_marks)}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900">
                                {finalObt}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900">
                                {finalPct}%
                              </td>
                              <td className="px-3.5 py-2.5 text-center">
                                {renderGradeBadge(finalGrade)}
                              </td>
                              <td className="px-3.5 py-2.5 text-center text-[11px] text-slate-600">
                                {isSuppPassed ? 'Cleared in Resit' : finalPct >= 50 ? 'Passed' : 'Needs Work'}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td className="px-3.5 py-3 font-semibold text-slate-900">Terminal Examination (Composite)</td>
                          <td className="px-3.5 py-3 text-right font-mono text-slate-500">
                            {transcriptModal.student.terminalResult?.totalMarks || 100}
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-900">
                            {transcriptModal.student.terminalResult?.obtainedMarks != null
                              ? transcriptModal.student.terminalResult.obtainedMarks
                              : '—'}
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-900">
                            {transcriptModal.student.terminalResult?.percentage != null
                              ? `${Number(transcriptModal.student.terminalResult.percentage).toFixed(1)}%`
                              : '—'}
                          </td>
                          <td className="px-3.5 py-3 text-center">
                            {renderGradeBadge(transcriptModal.student.terminalResult?.grade)}
                          </td>
                          <td className="px-3.5 py-3 text-center text-[11px] text-slate-600">
                            {transcriptModal.student.terminalResult?.status || 'Pending'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Summary Ribbon with Governance Status */}
              <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between text-xs print:bg-white print:border print:border-slate-800">
                <div>
                  <span className="text-slate-500 text-[10px] block uppercase font-bold tracking-wider">Final Standing</span>
                  <span className="font-extrabold text-indigo-950 text-base">
                    {transcriptModal.student.terminalResult?.status || 'Pending'}
                  </span>
                  <span className="text-[11px] block mt-0.5 print:hidden">
                    {transcriptModal.student.terminalResult?.resultStatus === 'PUBLISHED' ? (
                      <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Published to Student & Parent Portals
                      </span>
                    ) : transcriptModal.student.terminalResult?.resultStatus === 'APPROVED' ? (
                      <span className="text-indigo-700 font-semibold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Approved by Principal (Awaiting Publish)
                      </span>
                    ) : (
                      <span className="text-amber-700 font-semibold inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Teacher Uploaded · Hidden from Students & Parents
                      </span>
                    )}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 text-[10px] block uppercase font-bold tracking-wider">Final Grade</span>
                  <span className="font-mono font-black text-indigo-900 text-lg">
                    {transcriptModal.student.terminalResult?.grade || '—'}
                  </span>
                  <span className="text-slate-600 text-xs font-mono font-bold block mt-0.5">
                    {transcriptModal.student.terminalResult?.percentage != null
                      ? `${Number(transcriptModal.student.terminalResult.percentage).toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
              </div>

              {/* Official Signatures & Seal Section (Printed on Official Card) */}
              <div className="pt-6 pb-2 grid grid-cols-3 gap-6 text-center text-xs border-t border-slate-200 mt-6 print:border-slate-400">
                <div>
                  <div className="border-b border-slate-300 w-32 mx-auto mb-1.5 h-6" />
                  <span className="text-slate-500 text-[10px] uppercase font-bold">Class Teacher</span>
                </div>
                <div>
                  <div className="border-b border-slate-300 w-32 mx-auto mb-1.5 h-6" />
                  <span className="text-slate-500 text-[10px] uppercase font-bold">Controller of Exams</span>
                </div>
                <div>
                  <div className="border-b border-slate-800 w-36 mx-auto mb-1.5 h-6 flex items-center justify-center font-serif text-[11px] text-slate-800 font-bold">
                    Dr. A. Principal
                  </div>
                  <span className="text-slate-800 text-[10px] uppercase font-bold">Principal Signature & Stamp</span>
                </div>
              </div>

              {/* Official Institutional Footer */}
              <div className="bg-slate-900 text-white rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[10px] print:rounded-none">
                <span>Tel: 0300 511 8716</span>
                <span>Web: www.cambridgeeducation.uk.com</span>
                <span>Islamabad, Pakistan</span>
              </div>
            </div>

            {/* Modal Actions (Hidden when printing) */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 print:hidden">
              <span className="text-xs text-slate-500">
                Tip: Clicking "Print Official Card" will print <strong>only this student's transcript</strong>.
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTranscriptModal({ open: false, student: null, data: null, loading: false })}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2 rounded-xl bg-indigo-900 hover:bg-indigo-800 text-white font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Official Card</span>
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* 8. PARENT INTERVENTION ALERT MODAL WITH 48H COOLDOWN */}
      {alertModal.open && alertModal.student && (
        <Modal
          isOpen={alertModal.open}
          onClose={() => setAlertModal({ open: false, student: null })}
          title={`Parent Intervention Notice · ${alertModal.student.studentName}`}
          description={`Direct parental notification via Transactional Outbox (Respects 48-hour student-subject cooldown)`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            {/* Cooldown Status Badge */}
            {cooldownInfo?.inCooldown ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">48-Hour Cooldown Currently Active</div>
                  <div className="text-[11px] text-amber-700 mt-0.5">
                    An alert was recently dispatched for this student and subject. Cooldown expires in{' '}
                    <strong>{cooldownInfo.remainingTimeFormatted}</strong>. An emergency dispatch requires checking the
                    urgent override box below and providing justification.
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium text-[11px]">Ready to dispatch: No active cooldown for this subject.</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Subject</label>
              <select
                value={alertSubjectId}
                onChange={(e) => handleAlertSubjectChange(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-rose-500"
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} ({sub.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Intervention Category</label>
              <select
                value={alertCategory}
                onChange={(e) => setAlertCategory(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="ATTENTION_NEEDED">Attention Needed (Formative Deficit)</option>
                <option value="CRITICAL_RISK">Critical Risk (Severe Drop &lt; 40%)</option>
                <option value="HOMEWORK_DEFICIT">Homework / Task Deficit</option>
                <option value="ATTENDANCE_DEFICIT">Attendance Deficit (&lt; 75%)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Alert Title</label>
              <input
                type="text"
                value={alertTitle}
                onChange={(e) => setAlertTitle(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Message Body (to Guardian)</label>
              <textarea
                value={alertMessage}
                onChange={(e) => setAlertMessage(e.target.value)}
                rows={3}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {/* Urgent Override Checkbox */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded-sm"
                />
                <span className="text-xs font-bold text-slate-800">
                  Mark as Urgent Alert (Bypass &amp; Reset 48h Cooldown)
                </span>
              </label>

              {isUrgent && (
                <div>
                  <label className="block text-[11px] font-semibold text-rose-800 mb-1">
                    Override Justification (Required, min 10 characters)
                  </label>
                  <input
                    type="text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="e.g. Critical academic drop requiring immediate guardian conference."
                    className="w-full text-xs rounded-xl border border-rose-300 px-3 py-1.5 outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAlertModal({ open: false, student: null })}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendAlert}
                disabled={
                  alertSubmitting ||
                  !alertTitle ||
                  !alertMessage ||
                  (cooldownInfo?.inCooldown && (!isUrgent || overrideReason.trim().length < 10))
                }
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Dispatch Parent Alert</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* INSPECT CLASS MARKS MODAL */}
      {inspectClassModal.open && (
        <Modal
          title={`Results Inspection: ${inspectClassModal.className} (${currentSessionObj?.name || '2026-27'})`}
          onClose={() => setInspectClassModal((prev) => ({ ...prev, open: false }))}
          size="xl"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Exam results for all students in <strong>{inspectClassModal.className}</strong></span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={actionBusyClass !== null}
                  onClick={() => inspectClassModal.classId && handleApproveClass(inspectClassModal.classId)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Approve Class
                </button>
                <button
                  type="button"
                  disabled={actionBusyClass !== null}
                  onClick={() => inspectClassModal.classId && handlePublishClass(inspectClassModal.classId)}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Publish Class
                </button>
              </div>
            </div>

            {inspectClassModal.loading ? (
              <LoadingState message="Loading student marks..." rows={4} />
            ) : inspectClassModal.rows.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <Info className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                No computed results found for this class yet. Click &quot;Compute&quot; to generate results.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Student</th>
                      <th className="px-3 py-2">Roll No</th>
                      <th className="px-3 py-2 text-right">Obtained Marks</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-right">Percentage</th>
                      <th className="px-3 py-2 text-center">Grade</th>
                      <th className="px-3 py-2 text-center">Pass / Fail</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inspectClassModal.rows.map((r: any) => (
                      <tr key={r.id} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2.5 font-bold text-slate-900">{r.studentName}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-500">{r.rollNo || '—'}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                          {r.obtained_marks != null ? Number(r.obtained_marks).toFixed(1) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-500">
                          {r.total_marks != null ? Number(r.total_marks).toFixed(0) : '100'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                          {r.percentage != null ? `${Number(r.percentage).toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center">{renderGradeBadge(r.overall_grade)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.pass_status === 'PASSED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.pass_status === 'FAILED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {r.pass_status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.result_status === 'PUBLISHED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.result_status === 'APPROVED'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {r.result_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
