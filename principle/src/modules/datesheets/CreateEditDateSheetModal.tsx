import React, { useState, useEffect } from 'react';
import { datesheetsApi } from '../../services/datesheetsApi';
import { api } from '../../services/api';
import {
  ExaminationDateSheet,
  CreateDateSheetPayload,
  ExamType,
  SchedulingMode,
  AssessmentTiming
} from '../../types/datesheet';
import {
  X,
  Plus,
  Trash2,
  Copy,
  Calendar,
  Clock,
  BookOpen,
  Users,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ShieldAlert,
  Info
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editItem?: ExaminationDateSheet | null;
}

interface LocalPaper {
  id: string;
  classId: number;
  subjectId: number;
  teacherId?: number | null;
  examDate: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  subjectType: string;
  instructions: string;
  assessmentTiming?: AssessmentTiming;
  durationMinutes?: number | null;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function calculateDay(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return WEEKDAYS[d.getUTCDay()] || WEEKDAYS[d.getDay()];
}

const DEFAULT_SUBJECTS = [
  { id: 1, name: 'Mathematics', code: 'MATH' },
  { id: 2, name: 'English Language', code: 'ENG' },
  { id: 3, name: 'General Science', code: 'SCI' },
  { id: 4, name: 'Urdu Literature', code: 'URD' },
  { id: 5, name: 'Islamic Studies', code: 'ISL' },
  { id: 6, name: 'Social Studies', code: 'PST' },
  { id: 7, name: 'Computer Studies', code: 'CS' },
  { id: 8, name: 'Creative Arts', code: 'ART' }
];

export const CreateEditDateSheetModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSaved,
  editItem
}) => {
  const [examType, setExamType] = useState<ExamType>('MID_TERM');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Applicable Classes (Classes 1-8)
  const [selectedClasses, setSelectedClasses] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8]);

  // Teachers for dropdown
  const [teachersList, setTeachersList] = useState<{ id: number; name: string }[]>([]);

  // Papers
  const [papers, setPapers] = useState<LocalPaper[]>([
    {
      id: 'p1',
      classId: 1,
      subjectId: 1,
      teacherId: null,
      examDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      dayOfWeek: calculateDay(new Date(Date.now() + 86400000).toISOString().split('T')[0]),
      startTime: '08:00 AM',
      endTime: '09:30 AM',
      subjectType: 'Scholastic',
      instructions: '',
      assessmentTiming: 'ENTIRE_LECTURE',
      durationMinutes: 90
    }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isDedicatedExam = true;

  useEffect(() => {
    // Load teachers
    api.getTeachers().then((res) => {
      if (Array.isArray(res)) {
        setTeachersList(
          res
            .filter((t: any) => !t.accountStatus || t.accountStatus === 'Active')
            .map((t: any) => ({
              // Backend list ids are display strings like "TCH-34"; the numeric
              // teachers.id (rawId) is what date_sheet_entries.teacher_id stores.
              id: Number(t.rawId) || Number(String(t.id).replace(/\D/g, '')),
              name: t.name || t.fullName
            }))
            .filter((t: any) => Number.isFinite(t.id) && t.id > 0)
        );
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (editItem) {
      setExamType(editItem.exam_type);
      setTitle(editItem.title);
      setDescription(editItem.description || '');
      setStartDate(editItem.start_date ? editItem.start_date.split('T')[0] : '');
      setEndDate(editItem.end_date ? editItem.end_date.split('T')[0] : '');

      if (editItem.entries && editItem.entries.length > 0) {
        const uniqueClasses = [...new Set(editItem.entries.map((e) => e.class_id))];
        setSelectedClasses(uniqueClasses);

        setPapers(
          editItem.entries.map((e, idx) => ({
            id: `edit_${e.id || idx}`,
            classId: e.class_id,
            subjectId: e.subject_id,
            teacherId: e.teacher_id || null,
            examDate: e.exam_date,
            dayOfWeek: e.day_of_week || calculateDay(e.exam_date),
            startTime: e.start_time,
            endTime: e.end_time,
            subjectType: e.subject_type || 'Scholastic',
            instructions: e.instructions || '',
            assessmentTiming: e.assessment_timing || 'ENTIRE_LECTURE',
            durationMinutes: e.duration_minutes || null
          }))
        );
      }
    } else {
      // Default new date sheet
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      setExamType('MID_TERM');
      setTitle('Timetable for MID TERM EXAMINATION');
      setDescription('ATTENTION: School-wide examination period. Regular timetable lectures are suspended. Please follow schedule carefully.');
      setStartDate(tomorrow);
      setEndDate(nextWeek);
      setSelectedClasses([1, 2, 3, 4, 5, 6, 7, 8]);
      setPapers([
        {
          id: 'p1',
          classId: 1,
          subjectId: 1,
          teacherId: null,
          examDate: tomorrow,
          dayOfWeek: calculateDay(tomorrow),
          startTime: '08:00 AM',
          endTime: '09:30 AM',
          subjectType: 'Scholastic',
          instructions: '',
          assessmentTiming: 'ENTIRE_LECTURE',
          durationMinutes: 90
        }
      ]);
    }
  }, [editItem, isOpen]);

  if (!isOpen) return null;

  const handleToggleClass = (classId: number) => {
    if (selectedClasses.includes(classId)) {
      if (selectedClasses.length === 1) return; // Must have at least 1 class
      const next = selectedClasses.filter((c) => c !== classId);
      setSelectedClasses(next);
      // A paper must never point at a deselected class: its dropdown would
      // display one class while the saved state silently keeps another.
      setPapers((prev) => prev.map((p) => (p.classId === classId ? { ...p, classId: next[0] } : p)));
    } else {
      setSelectedClasses([...selectedClasses, classId].sort((a, b) => a - b));
    }
  };

  const handleAddPaper = () => {
    const lastPaper = papers[papers.length - 1];
    const newPaper: LocalPaper = {
      id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      classId:
        lastPaper && selectedClasses.includes(lastPaper.classId)
          ? lastPaper.classId
          : (selectedClasses[0] || 1),
      subjectId: 1,
      teacherId: null,
      examDate: lastPaper ? lastPaper.examDate : new Date().toISOString().split('T')[0],
      dayOfWeek: lastPaper ? lastPaper.dayOfWeek : calculateDay(new Date().toISOString().split('T')[0]),
      startTime: lastPaper ? lastPaper.startTime : '08:00 AM',
      endTime: lastPaper ? lastPaper.endTime : '09:30 AM',
      subjectType: 'Scholastic',
      instructions: '',
      assessmentTiming: 'ENTIRE_LECTURE',
      durationMinutes: isDedicatedExam ? 90 : 30
    };
    setPapers([...papers, newPaper]);
  };

  const handleDuplicatePaper = (idx: number) => {
    const src = papers[idx];
    const dup: LocalPaper = {
      ...src,
      id: `dup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    };
    const nextPapers = [...papers];
    nextPapers.splice(idx + 1, 0, dup);
    setPapers(nextPapers);
  };

  const handleRemovePaper = (idx: number) => {
    if (papers.length <= 1) {
      setErrorMsg('A date sheet must contain at least one examination paper.');
      return;
    }
    setPapers(papers.filter((_, i) => i !== idx));
  };

  const handlePaperChange = (idx: number, updates: Partial<LocalPaper>) => {
    setPapers(
      papers.map((p, i) => {
        if (i !== idx) return p;
        const updated = { ...p, ...updates };
        if (updates.examDate) {
          updated.dayOfWeek = calculateDay(updates.examDate);
        }
        return updated;
      })
    );
  };

  // Client-side conflict checks
  const getDuplicateClassDateConflicts = () => {
    if (!isDedicatedExam) return [];
    const seen = new Map<string, number[]>();
    papers.forEach((p, idx) => {
      const key = `${p.classId}_${p.examDate}`;
      if (!seen.has(key)) {
        seen.set(key, []);
      }
      seen.get(key)!.push(idx + 1);
    });

    const conflicts: string[] = [];
    seen.forEach((indices, key) => {
      if (indices.length > 1) {
        const [cls, date] = key.split('_');
        conflicts.push(`Class ${cls} has multiple papers on ${date} (Papers: #${indices.join(', #')})`);
      }
    });
    return conflicts;
  };

  const getTeacherSimultaneousConflicts = () => {
    const seen = new Map<string, number[]>();
    papers.forEach((p, idx) => {
      if (!p.teacherId) return;
      const key = `${p.teacherId}_${p.examDate}_${p.startTime}`;
      if (!seen.has(key)) {
        seen.set(key, []);
      }
      seen.get(key)!.push(idx + 1);
    });

    const warnings: string[] = [];
    seen.forEach((indices, key) => {
      if (indices.length > 1) {
        const [tid, date, time] = key.split('_');
        const teacherName = teachersList.find((t) => t.id === Number(tid))?.name || `Teacher #${tid}`;
        warnings.push(`${teacherName} is assigned to multiple simultaneous sessions on ${date} at ${time} (Papers: #${indices.join(', #')})`);
      }
    });
    return warnings;
  };

  const classDateConflicts = getDuplicateClassDateConflicts();
  const teacherWarnings = getTeacherSimultaneousConflicts();

  const handleSubmit = async (publishImmediately: boolean) => {
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg('Please enter an examination title.');
      return;
    }
    if (papers.length === 0) {
      setErrorMsg('Please add at least one examination paper to the date sheet.');
      return;
    }

    if (isDedicatedExam && (!startDate || !endDate)) {
      setErrorMsg('Please provide both Start Date and End Date for the school-wide examination period.');
      return;
    }

    if (isDedicatedExam && classDateConflicts.length > 0) {
      setErrorMsg(`Dedicated Exam Mode Violation: Each class may only have ONE subject examination per day. ${classDateConflicts.join('; ')}`);
      return;
    }

    for (let i = 0; i < papers.length; i++) {
      const p = papers[i];
      if (!p.examDate) {
        setErrorMsg(`Paper #${i + 1} must have an examination date.`);
        return;
      }
      if (!p.startTime || !p.endTime) {
        setErrorMsg(`Paper #${i + 1} must have start and end times.`);
        return;
      }
    }

    try {
      setIsSubmitting(true);

      const schedulingMode: SchedulingMode = isDedicatedExam ? 'DEDICATED_EXAM' : 'TIMETABLE_ASSESSMENT';

      const payload: CreateDateSheetPayload = {
        // Omitted session id: the backend resolves the active academic session.
        examType,
        schedulingMode,
        startDate: isDedicatedExam ? startDate : undefined,
        endDate: isDedicatedExam ? endDate : undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        status: publishImmediately ? 'PUBLISHED' : (editItem?.status || 'DRAFT'),
        entries: papers.map((p, idx) => ({
          classId: Number(p.classId),
          subjectId: Number(p.subjectId),
          teacherId: p.teacherId ? Number(p.teacherId) : null,
          examDate: p.examDate,
          dayOfWeek: p.dayOfWeek || calculateDay(p.examDate),
          startTime: p.startTime,
          endTime: p.endTime,
          subjectType: p.subjectType || 'Scholastic',
          instructions: p.instructions || null,
          orderIndex: idx,
          assessmentTiming: isDedicatedExam ? undefined : (p.assessmentTiming || 'ENTIRE_LECTURE'),
          durationMinutes: p.durationMinutes ? Number(p.durationMinutes) : undefined
        }))
      };

      if (editItem) {
        await datesheetsApi.updateDateSheet(editItem.id, payload);
      } else {
        await datesheetsApi.createDateSheet(payload);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save examination date sheet.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#1b1a47] text-white flex items-center justify-between border-b border-indigo-900/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                {editItem ? 'Edit Examination Schedule' : 'Create Examination Schedule'}
              </h2>
              <p className="text-xs text-indigo-200">
                Author and schedule multi-class examination timetables and invigilation duties
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-slate-800">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Institutional Examination Protocol Banner */}
          <div className="p-4 bg-indigo-50/90 border border-indigo-200 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-950">
              <ShieldAlert className="w-4 h-4 text-indigo-600" />
              <span>OFFICIAL INSTITUTIONAL EXAMINATION PROTOCOL (Dedicated Mid-Term &amp; Final-Term Only)</span>
            </div>
            <p className="text-xs text-indigo-900 leading-relaxed">
              • <strong>Regular Timetable Suspension:</strong> Standard daily timetable periods and teacher attendance alerts are completely suspended for Classes 1–8 during this scheduled window.<br />
              • <strong>1 Exam Per Class Per Day:</strong> Each class may only have ONE subject examination scheduled per calendar date.<br />
              • <strong>Invigilation Tracking:</strong> Invigilators start assigned classroom Zoom sessions; student join links are sanitized without host key exposure.
            </p>
          </div>

          {/* 1. Category, Title & Session */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Examination Category *</label>
              <select
                value={examType}
                onChange={(e) => {
                  const nextType = e.target.value as ExamType;
                  setExamType(nextType);
                  if (title.startsWith('Timetable for')) {
                    setTitle(nextType === 'FINAL_TERM' ? 'Timetable for FINAL / TERMINAL EXAMINATION' : 'Timetable for MID TERM EXAMINATION');
                  }
                }}
                className="w-full text-xs font-bold border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="MID_TERM">1. Mid-Term Examination (Dedicated Schedule)</option>
                <option value="FINAL_TERM">2. Final / Terminal Examination (Dedicated Schedule)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date Sheet Title *</label>
              <input
                type="text"
                placeholder="e.g. Timetable for MID TERM EXAMINATION"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs font-bold border border-slate-200 rounded-lg px-3.5 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* School-Wide Exam Window (For Mode A) */}
          {isDedicatedExam && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  School-Wide Exam Start Date *
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400">Regular classes suppressed starting this day</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  School-Wide Exam End Date *
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400">Normal timetable automatically resumes the following day</span>
              </div>
            </div>
          )}

          {/* Conflict Warnings */}
          {classDateConflicts.length > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Dedicated Exam Constraint Violation:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                {classDateConflicts.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {teacherWarnings.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Invigilator Scheduling Warning:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                {teacherWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Applicable Classes Selection */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                Applicable Classes (Grades 1 to 8):
              </label>
              <button
                type="button"
                onClick={() => setSelectedClasses([1, 2, 3, 4, 5, 6, 7, 8])}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
              >
                Select All Classes
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => {
                const isSelected = selectedClasses.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleToggleClass(c)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#1b1a47] text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>Class {c}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Instructions / Attention Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              General Examination Instructions / Attention Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Students must connect their camera on Zoom 15 minutes prior. Late entries will not be allowed."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Examination Papers Table / Schedule Builder */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Scheduled Papers &amp; Sessions ({papers.length} Papers)</span>
                </h3>
                <p className="text-[11px] text-slate-500">Configure class, subject, date, timings, and invigilation assignment</p>
              </div>

              <button
                type="button"
                onClick={handleAddPaper}
                className="px-3 py-1.5 bg-[#1b1a47] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Paper</span>
              </button>
            </div>

            {/* Papers List */}
            <div className="space-y-3">
              {papers.map((p, idx) => (
                <div
                  key={p.id}
                  className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3 hover:border-indigo-300 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-slate-800 text-white text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        Paper #{idx + 1}
                      </span>
                      {p.dayOfWeek && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {p.dayOfWeek}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDuplicatePaper(idx)}
                        className="text-slate-500 hover:text-indigo-600 p-1 rounded-md transition text-xs font-medium flex items-center gap-0.5"
                        title="Duplicate Paper"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Duplicate</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemovePaper(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition"
                        title="Delete Paper"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Grid Inputs */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Class</label>
                      <select
                        value={p.classId}
                        onChange={(e) => handlePaperChange(idx, { classId: Number(e.target.value) })}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 font-bold focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      >
                        {selectedClasses.map((c) => (
                          <option key={c} value={c}>
                            Class {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Subject</label>
                      <select
                        value={p.subjectId}
                        onChange={(e) => handlePaperChange(idx, { subjectId: Number(e.target.value) })}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 font-medium focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      >
                        {DEFAULT_SUBJECTS.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Exam Date</label>
                      <input
                        type="date"
                        value={p.examDate}
                        onChange={(e) => handlePaperChange(idx, { examDate: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 bg-white font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Start Time</label>
                      <input
                        type="text"
                        placeholder="08:00 AM"
                        value={p.startTime}
                        onChange={(e) => handlePaperChange(idx, { startTime: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 bg-white font-mono font-bold focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">End Time</label>
                      <input
                        type="text"
                        placeholder="09:30 AM"
                        value={p.endTime}
                        onChange={(e) => handlePaperChange(idx, { endTime: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 bg-white font-mono font-bold focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Subject Type</label>
                      <select
                        value={p.subjectType}
                        onChange={(e) => handlePaperChange(idx, { subjectType: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 font-medium focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="Scholastic">Scholastic</option>
                        <option value="Co-Scholastic">Co-Scholastic</option>
                      </select>
                    </div>
                  </div>

                  {/* Mode B specific row or invigilator assignment */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs pt-1 border-t border-slate-100">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                        Assigned Invigilator / Teacher
                      </label>
                      <select
                        value={p.teacherId || ''}
                        onChange={(e) =>
                          handlePaperChange(idx, {
                            teacherId: e.target.value ? Number(e.target.value) : null
                          })
                        }
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">-- No specific invigilator assigned --</option>
                        {teachersList.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                        Duration (Minutes)
                      </label>
                      <input
                        type="number"
                        min={15}
                        max={240}
                        placeholder="90"
                        value={p.durationMinutes || 90}
                        onChange={(e) =>
                          handlePaperChange(idx, {
                            durationMinutes: e.target.value ? Number(e.target.value) : 90
                          })
                        }
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="sm:col-span-1">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                        Paper Specific Instructions
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Bring scientific calculator & geometry box"
                        value={p.instructions}
                        onChange={(e) => handlePaperChange(idx, { instructions: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            Total: <span className="font-bold text-slate-900">{papers.length} Papers</span> across{' '}
            <span className="font-bold text-indigo-700">{selectedClasses.length} Classes</span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit(false)}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition"
            >
              Save as Draft
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit(true)}
              className="px-5 py-2 bg-[#1b1a47] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
            >
              {isSubmitting ? 'Publishing...' : 'Publish / Unhide Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
