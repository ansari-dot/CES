import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { addToast } from '../store/slices/uiSlice';
import { mistakesApi, StudentMistake, CreateMistakePayload } from '../services/mistakesApi';
import { requestApi } from '../services/api';
import { BrandLoader } from '../components/common/BrandLoader';
import { Pagination } from '../components/common/Pagination';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  Plus,
  RotateCw,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  X,
  Lock,
  Pencil,
  Trash2,
  BookOpen,
  Layers,
  GraduationCap,
  ShieldCheck,
  Check,
  ChevronDown
} from 'lucide-react';

const SEVERITY_BADGES: Record<string, { label: string; cls: string }> = {
  LOW: { label: 'Low', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  MEDIUM: { label: 'Medium', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  HIGH: { label: 'High', cls: 'bg-orange-50 text-orange-800 border-orange-200' },
  CRITICAL: { label: 'Critical', cls: 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse' },
};

const MISTAKE_TYPE_LABELS: Record<string, string> = {
  CONCEPTUAL: 'Conceptual Misunderstanding',
  CALCULATION: 'Calculation Slip',
  CARELESS: 'Careless Error',
  INCOMPLETE: 'Incomplete Steps',
  FORMAT: 'Formatting / Notation',
  OTHER: 'Other Weak Area',
};

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  IDENTIFIED: { label: 'Identified', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  PRACTICING: { label: 'In Remediation', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  RETESTED: { label: 'Re-tested', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  RESOLVED: { label: 'Resolved / Mastered', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

export const StudentMistakesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const teacher = useAppSelector((state) => state.auth.teacher);
  const assignedClasses = teacher?.assignedClasses || [];

  // Deduplicated assigned classes
  const uniqueClasses = useMemo(() => {
    const map = new Map<string, { id: string; classId: number; name: string }>();
    for (const c of assignedClasses) {
      const cid = String(c.classId || c.id);
      if (!map.has(cid)) {
        map.set(cid, {
          id: cid,
          classId: Number(c.classId || cid),
          name: c.className || c.name.split(' - ')[0] || `Class ${c.grade}`,
        });
      }
    }
    return Array.from(map.values());
  }, [assignedClasses]);

  const [mistakes, setMistakes] = useState<StudentMistake[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClassId, selectedStatus, selectedSeverity, selectedType, searchQuery]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMistake, setEditingMistake] = useState<StudentMistake | null>(null);
  const [classStudents, setClassStudents] = useState<{ id: number; name: string; rollNo?: string }[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Form fields
  const [formClassId, setFormClassId] = useState<string>('');
  const [formSubjectId, setFormSubjectId] = useState<string>('');
  const [formStudentId, setFormStudentId] = useState<string>('');
  const [formTopic, setFormTopic] = useState<string>('');
  const [formMistakeType, setFormMistakeType] = useState<string>('CONCEPTUAL');
  const [formSeverity, setFormSeverity] = useState<string>('MEDIUM');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formRemediation, setFormRemediation] = useState<string>('');
  const [formPrivateNotes, setFormPrivateNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const loadMistakes = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await mistakesApi.getMistakes({
        classId: selectedClassId,
        status: selectedStatus,
        severity: selectedSeverity,
        search: searchQuery,
        page: currentPage,
        limit: pageSize,
      });
      setMistakes(res.mistakes || []);
      setTotalRecords(res.total || res.mistakes?.length || 0);
      setTotalPages(res.totalPages || Math.max(1, Math.ceil((res.total || 0) / pageSize)));
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to load student mistake records.');
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, selectedStatus, selectedSeverity, searchQuery, currentPage, pageSize]);

  useEffect(() => {
    loadMistakes();
  }, [loadMistakes]);

  // Load students when formClassId changes in Modal
  useEffect(() => {
    if (!formClassId) {
      setClassStudents([]);
      return;
    }
    let isMounted = true;
    (async () => {
      try {
        setLoadingStudents(true);
        const res = await requestApi<any[]>(`/api/v1/students?classId=${formClassId}&status=Active`);
        if (isMounted) {
          const list = Array.isArray(res) ? res : res?.data || [];
          setClassStudents(
            list.map((s: any) => ({
              id: s.id,
              name: s.name || s.fullName || s.studentName,
              rollNo: s.rollNo || s.roll_no,
            }))
          );
        }
      } catch {
        if (isMounted) setClassStudents([]);
      } finally {
        if (isMounted) setLoadingStudents(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [formClassId]);

  const handleOpenCreateModal = () => {
    setEditingMistake(null);
    const defaultClass = uniqueClasses[0]?.id || '';
    setFormClassId(defaultClass);
    // Find subjects for this class
    const matchingAssignment = assignedClasses.find((a) => String(a.classId || a.id) === defaultClass);
    setFormSubjectId(matchingAssignment ? String(matchingAssignment.subjectId || 1) : '1');
    setFormStudentId('');
    setFormTopic('');
    setFormMistakeType('CONCEPTUAL');
    setFormSeverity('MEDIUM');
    setFormDescription('');
    setFormRemediation('');
    setFormPrivateNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (m: StudentMistake) => {
    setEditingMistake(m);
    setFormClassId(String(m.classId));
    setFormSubjectId(String(m.subjectId));
    setFormStudentId(String(m.studentId));
    setFormTopic(m.topic);
    setFormMistakeType(m.mistakeType);
    setFormSeverity(m.severity);
    setFormDescription(m.description);
    setFormRemediation(m.remediationPlan || '');
    setFormPrivateNotes(m.teacherPrivateNotes || '');
    setIsModalOpen(true);
  };

  const handleSaveMistake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClassId || !formSubjectId || !formStudentId || !formTopic.trim() || !formDescription.trim()) {
      dispatch(addToast({ message: 'Please fill in all required fields (Class, Student, Topic, and Description).', type: 'error' }));
      return;
    }

    try {
      setIsSaving(true);
      const payload: CreateMistakePayload = {
        classId: Number(formClassId),
        subjectId: Number(formSubjectId),
        studentId: Number(formStudentId),
        topic: formTopic.trim(),
        mistakeType: formMistakeType,
        severity: formSeverity,
        description: formDescription.trim(),
        remediationPlan: formRemediation.trim() || undefined,
        teacherPrivateNotes: formPrivateNotes.trim() || undefined,
      };

      if (editingMistake) {
        await mistakesApi.updateMistake(editingMistake.id, payload);
        dispatch(addToast({ message: 'Learning gap evaluation updated successfully.', type: 'success' }));
      } else {
        await mistakesApi.recordMistake(payload);
        dispatch(addToast({ message: 'Student mistake recorded and added to remediation tracking.', type: 'success' }));
      }

      setIsModalOpen(false);
      loadMistakes();
    } catch (err: any) {
      dispatch(addToast({ message: err.message || 'Failed to save mistake evaluation.', type: 'error' }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickStatusChange = async (mistakeId: number, nextStatus: string) => {
    try {
      await mistakesApi.updateMistake(mistakeId, { status: nextStatus });
      dispatch(
        addToast({
          message: nextStatus === 'RESOLVED' ? 'Mistake marked as Resolved / Mastered!' : `Status updated to ${nextStatus}.`,
          type: 'success',
        })
      );
      loadMistakes();
    } catch (err: any) {
      dispatch(addToast({ message: err.message || 'Failed to update status.', type: 'error' }));
    }
  };

  const handleDeleteMistake = async (m: StudentMistake) => {
    if (!window.confirm(`Permanently delete learning gap record for "${m.studentName}" on topic "${m.topic}"?`)) {
      return;
    }
    try {
      await mistakesApi.deleteMistake(m.id);
      dispatch(addToast({ message: 'Mistake record deleted.', type: 'info' }));
      loadMistakes();
    } catch (err: any) {
      dispatch(addToast({ message: err.message || 'Failed to delete record.', type: 'error' }));
    }
  };

  // Metrics
  const totalCount = mistakes.length;
  const identifiedCount = mistakes.filter((m) => m.status === 'IDENTIFIED').length;
  const practicingCount = mistakes.filter((m) => m.status === 'PRACTICING').length;
  const resolvedCount = mistakes.filter((m) => m.status === 'RESOLVED').length;
  const resolutionRate = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0;

  // Filtered Mistakes
  const filteredMistakes = useMemo(() => {
    return mistakes.filter((m) => {
      if (selectedType !== 'ALL' && m.mistakeType !== selectedType) return false;
      return true;
    });
  }, [mistakes, selectedType]);

  // Subjects assigned to selected formClassId
  const availableSubjectsForForm = useMemo(() => {
    if (!formClassId) return [];
    return assignedClasses.filter((a) => String(a.classId || a.id) === String(formClassId));
  }, [assignedClasses, formClassId]);

  return (
    <div className="flex flex-col w-full pb-12 space-y-5 animate-in fade-in duration-150">
      {/* ------------------------------------------------------------- */}
      {/* 1. HERO HEADER BANNER                                         */}
      {/* ------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#36348e] text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
              <TrendingUp className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  Diagnostic Evaluation &amp; Remediation
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500 font-semibold">Continuous Improvement</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#1e1b4b] tracking-tight mt-1">
                Student Mistakes &amp; Weak Areas Ledger
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Log recurring conceptual errors, assign targeted practice, and track resolution until concept mastery.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
            <button
              type="button"
              onClick={loadMistakes}
              disabled={loading}
              className="p-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl transition shadow-2xs cursor-pointer"
              title="Refresh ledger"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 bg-[#36348e] hover:bg-[#2c2a75] text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-100 flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Log Learning Gap</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. TOP 4 KPI CARDS                                            */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Gaps */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-blue-100/80 hover:border-blue-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-blue-50 text-blue-700 border-blue-100">
              Total Logged
            </span>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              {totalCount}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Learning Gaps Identified
            </div>
          </div>
        </div>

        {/* Card 2: Active Remediation */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-amber-100/80 hover:border-amber-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-amber-50 text-amber-900 border-amber-200">
              In Practice
            </span>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-amber-900 tracking-tight leading-tight">
              {practicingCount + identifiedCount}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Remediation in Progress
            </div>
          </div>
        </div>

        {/* Card 3: Resolved */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-emerald-100/80 hover:border-emerald-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-emerald-50 text-emerald-700 border-emerald-100">
              Mastered
            </span>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight leading-tight">
              {resolvedCount}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Concepts Fully Resolved
            </div>
          </div>
        </div>

        {/* Card 4: Resolution Rate */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-purple-100/80 hover:border-purple-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white shadow-sm shadow-purple-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-purple-50 text-purple-700 border-purple-100">
              Success Rate
            </span>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-purple-900 tracking-tight leading-tight">
              {resolutionRate}%
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Overall Remediation Mastery
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. DEDICATED FILTER TOOLBAR                                   */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        {/* Row 1: Search & Class Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student, roll #, topic, or description..."
              className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white placeholder:text-slate-400 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Class Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-indigo-600" />
              Class:
            </span>
            <button
              type="button"
              onClick={() => setSelectedClassId('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedClassId === 'ALL'
                  ? 'bg-[#36348e] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Classes ({totalCount})
            </button>
            {uniqueClasses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedClassId(c.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedClassId === c.id
                    ? 'bg-[#36348e] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Status & Severity Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'ALL', label: 'All Statuses' },
              { id: 'IDENTIFIED', label: 'Identified', count: identifiedCount },
              { id: 'PRACTICING', label: 'In Remediation', count: practicingCount },
              { id: 'RESOLVED', label: 'Resolved / Mastered', count: resolvedCount },
            ].map((tab) => {
              const isSelected = selectedStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedStatus(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-[#36348e] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Mistake Types</option>
              <option value="CONCEPTUAL">Conceptual Misunderstanding</option>
              <option value="CALCULATION">Calculation Slip</option>
              <option value="CARELESS">Careless Error</option>
              <option value="INCOMPLETE">Incomplete Steps</option>
              <option value="FORMAT">Formatting / Notation</option>
            </select>

            {(selectedClassId !== 'ALL' || selectedStatus !== 'ALL' || selectedSeverity !== 'ALL' || selectedType !== 'ALL' || searchQuery.trim()) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedClassId('ALL');
                  setSelectedStatus('ALL');
                  setSelectedSeverity('ALL');
                  setSelectedType('ALL');
                  setSearchQuery('');
                }}
                className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer transition py-1 ml-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. MAIN MISTAKES LEDGER TABLE                                 */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center flex items-center justify-center">
            <BrandLoader message="Loading diagnostic records..." size="sm" />
          </div>
        ) : errorMsg ? (
          <div className="p-10 text-center">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <p className="text-sm text-rose-700 font-bold">{errorMsg}</p>
            <button
              onClick={loadMistakes}
              className="mt-3 px-4 py-2 rounded-xl bg-[#36348e] hover:bg-[#2c2a75] text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              Retry Loading
            </button>
          </div>
        ) : filteredMistakes.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Sparkles className="w-9 h-9 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700 text-sm">No learning gaps logged for the current filter</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Click &quot;+ Log Learning Gap&quot; to record conceptual errors or weak topics observed during assignments, quizzes, or classroom work.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/70 h-11 select-none text-[11px]">
                  <th className="px-5 py-2 min-w-[170px]">Student Details</th>
                  <th className="px-5 py-2 min-w-[130px]">Class &amp; Subject</th>
                  <th className="px-5 py-2 min-w-[160px]">Topic / Concept</th>
                  <th className="px-5 py-2 min-w-[140px]">Type &amp; Severity</th>
                  <th className="px-5 py-2 min-w-[200px]">Diagnostic Notes</th>
                  <th className="px-5 py-2 min-w-[160px]">Remediation Plan</th>
                  <th className="px-5 py-2 text-center w-36">Status</th>
                  <th className="px-5 py-2 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMistakes.map((m) => {
                  const severityBadge = SEVERITY_BADGES[m.severity] || SEVERITY_BADGES.MEDIUM;
                  const statusBadge = STATUS_BADGES[m.status] || STATUS_BADGES.IDENTIFIED;

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-bold text-slate-900 block">{m.studentName}</span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {m.admissionNo} {m.rollNo ? `· Roll #${m.rollNo}` : ''}
                        </span>
                      </td>

                      <td className="px-5 py-3">
                        <span className="font-bold text-slate-900 block">{m.className}</span>
                        <span className="text-[11px] text-slate-500">{m.subjectName}</span>
                      </td>

                      <td className="px-5 py-3">
                        <span className="font-bold text-[#1e1b4b] block">{m.topic}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Logged on {new Date(m.createdAt).toLocaleDateString()}
                        </span>
                      </td>

                      <td className="px-5 py-3">
                        <div className="space-y-1">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${severityBadge.cls}`}>
                            {severityBadge.label}
                          </span>
                          <span className="text-[10px] text-slate-500 block truncate max-w-[130px]" title={MISTAKE_TYPE_LABELS[m.mistakeType] || m.mistakeType}>
                            {MISTAKE_TYPE_LABELS[m.mistakeType] || m.mistakeType}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3">
                        <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed" title={m.description}>
                          {m.description}
                        </p>
                        {m.teacherPrivateNotes && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-indigo-700 bg-indigo-50/70 px-2 py-0.5 rounded-md border border-indigo-100 max-w-fit">
                            <Lock className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span className="truncate max-w-[180px]" title={`Private Note: ${m.teacherPrivateNotes}`}>
                              Private: {m.teacherPrivateNotes}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        {m.remediationPlan ? (
                          <p className="text-xs text-emerald-800 line-clamp-2 leading-relaxed" title={m.remediationPlan}>
                            {m.remediationPlan}
                          </p>
                        ) : (
                          <span className="text-slate-400 text-xs italic">No specific plan assigned</span>
                        )}
                      </td>

                      <td className="px-5 py-3 text-center">
                        <div className="relative inline-block">
                          <select
                            value={m.status}
                            onChange={(e) => handleQuickStatusChange(m.id, e.target.value)}
                            className={`text-xs font-bold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none transition-all ${statusBadge.cls}`}
                          >
                            <option value="IDENTIFIED">Identified</option>
                            <option value="PRACTICING">In Remediation</option>
                            <option value="RETESTED">Re-tested</option>
                            <option value="RESOLVED">Resolved / Mastered</option>
                          </select>
                        </div>
                      </td>

                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(m)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="Edit mistake evaluation"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMistake(m)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete record"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Pagination Bar */}
      {totalRecords > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalRecords}
          itemsPerPage={pageSize}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          loading={loading}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. CREATE / EDIT MISTAKE EVALUATION MODAL                     */}
      {/* ------------------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#1b1a47] text-white flex items-center justify-between border-b border-indigo-900/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold">
                    {editingMistake ? 'Edit Learning Gap Evaluation' : 'Log Student Mistake / Weak Area'}
                  </h2>
                  <p className="text-xs text-indigo-200">
                    Record diagnostic findings, assign remediation, and track progress
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveMistake} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-slate-800">
              {/* Row 1: Class & Subject */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Class *
                  </label>
                  <select
                    value={formClassId}
                    onChange={(e) => {
                      const cid = e.target.value;
                      setFormClassId(cid);
                      const matching = assignedClasses.find((a) => String(a.classId || a.id) === cid);
                      if (matching) setFormSubjectId(String(matching.subjectId || 1));
                    }}
                    className="w-full text-xs font-bold border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    {uniqueClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subject *
                  </label>
                  <select
                    value={formSubjectId}
                    onChange={(e) => setFormSubjectId(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    {availableSubjectsForForm.length > 0 ? (
                      availableSubjectsForForm.map((s, idx) => (
                        <option key={idx} value={s.subjectId || s.id}>
                          {s.subject}
                        </option>
                      ))
                    ) : (
                      <option value="1">General Subject</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Row 2: Student */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Student *
                </label>
                {loadingStudents ? (
                  <div className="text-xs text-slate-400 py-2">Loading enrolled class students...</div>
                ) : (
                  <select
                    value={formStudentId}
                    onChange={(e) => setFormStudentId(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">-- Select Student --</option>
                    {classStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.rollNo ? `(Roll #${s.rollNo})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Row 3: Topic / Concept */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Topic / Concept Identified *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Quadratic Equations - Factoring by grouping"
                  value={formTopic}
                  onChange={(e) => setFormTopic(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Row 4: Mistake Type & Severity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mistake Classification *
                  </label>
                  <select
                    value={formMistakeType}
                    onChange={(e) => setFormMistakeType(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="CONCEPTUAL">Conceptual Misunderstanding</option>
                    <option value="CALCULATION">Calculation Slip</option>
                    <option value="CARELESS">Careless Error</option>
                    <option value="INCOMPLETE">Incomplete Steps</option>
                    <option value="FORMAT">Formatting / Notation</option>
                    <option value="OTHER">Other Weak Area</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Severity *
                  </label>
                  <select
                    value={formSeverity}
                    onChange={(e) => setFormSeverity(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="LOW">Low (Occasional slip)</option>
                    <option value="MEDIUM">Medium (Recurring difficulty)</option>
                    <option value="HIGH">High (Major gap needing re-teaching)</option>
                    <option value="CRITICAL">Critical (Fundamental impediment)</option>
                  </select>
                </div>
              </div>

              {/* Row 5: Exact Mistake Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Detailed Diagnostic Observation *
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe the exact error observed (e.g. Forgets to distribute negative sign when expanding -(3x - 5)...)"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Row 6: Remediation & Assigned Practice */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Remediation Plan &amp; Practice Assigned
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Assigned Exercise 3.2 odd questions; reviewed parentheses precedence in 1-on-1 session."
                  value={formRemediation}
                  onChange={(e) => setFormRemediation(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Row 7: Teacher Private Clinical Notes (Hidden from students/parents) */}
              <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Private Teacher Clinical Notes (Protected)</span>
                </div>
                <p className="text-[10px] text-amber-700">
                  These notes are confidential to faculty and administration. They are NEVER displayed on student or parent portals.
                </p>
                <textarea
                  rows={2}
                  placeholder="Confidential observations or behavioral context..."
                  value={formPrivateNotes}
                  onChange={(e) => setFormPrivateNotes(e.target.value)}
                  className="w-full text-xs border border-amber-200 rounded-lg px-3 py-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#1b1a47] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                >
                  {isSaving ? 'Saving...' : editingMistake ? 'Update Evaluation' : 'Save Learning Gap'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

