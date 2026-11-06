import React, { useState, useEffect } from 'react';
import { datesheetsApi } from '../../services/datesheetsApi';
import { api } from '../../services/api';
import {
  ExaminationDateSheet,
  CreateDateSheetPayload,
  ExamType,
  DateSheetEntry
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
  FileSpreadsheet
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

  // Applicable Classes (Classes 1-8)
  const [selectedClasses, setSelectedClasses] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8]);

  // Teachers for dropdown
  const [teachersList, setTeachersList] = useState<{ id: number; name: string }[]>([]);

  // Papers
  const [papers, setPapers] = useState<LocalPaper[]>([
    {
      id: 'p1',
      classId: 4,
      subjectId: 1,
      teacherId: null,
      examDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      dayOfWeek: calculateDay(new Date(Date.now() + 86400000).toISOString().split('T')[0]),
      startTime: '08:00 AM',
      endTime: '09:30 AM',
      subjectType: 'Scholastic',
      instructions: ''
    }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Load teachers
    api.getTeachers().then((res) => {
      if (Array.isArray(res)) {
        setTeachersList(res.map((t: any) => ({ id: Number(t.id), name: t.name || t.fullName })));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (editItem) {
      setExamType(editItem.exam_type);
      setTitle(editItem.title);
      setDescription(editItem.description || '');

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
            instructions: e.instructions || ''
          }))
        );
      }
    } else {
      // Default new date sheet
      setExamType('MID_TERM');
      setTitle('Timetable for HALF YEARLY');
      setDescription('ATTENTION: Multiple Examinations on a Single Day. Check timings carefully.');
      setSelectedClasses([1, 2, 3, 4, 5, 6, 7, 8]);
      setPapers([
        {
          id: 'p1',
          classId: 4,
          subjectId: 1,
          teacherId: null,
          examDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          dayOfWeek: calculateDay(new Date(Date.now() + 86400000).toISOString().split('T')[0]),
          startTime: '08:00 AM',
          endTime: '09:30 AM',
          subjectType: 'Scholastic',
          instructions: ''
        }
      ]);
    }
  }, [editItem, isOpen]);

  if (!isOpen) return null;

  const handleToggleClass = (classId: number) => {
    if (selectedClasses.includes(classId)) {
      if (selectedClasses.length === 1) return; // Must have at least 1 class
      setSelectedClasses(selectedClasses.filter((c) => c !== classId));
    } else {
      setSelectedClasses([...selectedClasses, classId].sort((a, b) => a - b));
    }
  };

  const handleAddPaper = () => {
    const lastPaper = papers[papers.length - 1];
    const newPaper: LocalPaper = {
      id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      classId: lastPaper ? lastPaper.classId : (selectedClasses[0] || 1),
      subjectId: 1,
      teacherId: null,
      examDate: lastPaper ? lastPaper.examDate : new Date().toISOString().split('T')[0],
      dayOfWeek: lastPaper ? lastPaper.dayOfWeek : calculateDay(new Date().toISOString().split('T')[0]),
      startTime: lastPaper ? lastPaper.startTime : '08:00 AM',
      endTime: lastPaper ? lastPaper.endTime : '09:30 AM',
      subjectType: 'Scholastic',
      instructions: ''
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

      const payload: CreateDateSheetPayload = {
        academicSessionId: 1,
        examType,
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
          orderIndex: idx
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
                {editItem ? 'Edit Examination Date Sheet' : 'Create Examination Date Sheet'}
              </h2>
              <p className="text-xs text-indigo-200">
                Author and schedule multi-class examination timetables and instructions
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
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-slate-800">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Category, Title & Session */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Examination Category *</label>
              <select
                value={examType}
                onChange={(e) => setExamType(e.target.value as ExamType)}
                className="w-full text-xs font-bold border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="MONTHLY_TEST">1. Monthly Tests</option>
                <option value="MID_TERM">2. Mid-Term Examinations</option>
                <option value="FINAL_TERM">3. Final-Term Examinations</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date Sheet Title *</label>
              <input
                type="text"
                placeholder="e.g. Timetable for HALF YEARLY or Final Term Exam 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs font-bold border border-slate-200 rounded-lg px-3.5 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

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
              placeholder="e.g. ATTENTION: Multiple Examinations on a Single Day. Students must be seated 15 minutes prior."
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
                  <span>Examination Papers &amp; Schedule ({papers.length} Papers)</span>
                </h3>
                <p className="text-[11px] text-slate-500">Configure class, subject, date, and timings for each paper</p>
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

                  {/* Teacher & Notes Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs pt-1 border-t border-slate-100">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                        Assigned Teacher / Invigilator (Optional)
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
                        <option value="">-- No specific teacher assigned --</option>
                        {teachersList.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                        Paper Specific Notes / Instructions (e.g. calculator allowed)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Bring geometry box"
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

