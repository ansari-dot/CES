import React, { useState } from 'react';
import { useAppSelector } from '../../store';
import { assessmentsApi } from '../../services/assessmentsApi';
import { teacherDatesheetsApi } from '../../services/datesheetsApi';
import { CreateTestPayload, QuestionType, QuestionOption, ExamType } from '../../types/assessments';
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
  HelpCircle,
  Clock,
  Calendar,
  AlertCircle,
  FileText
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface LocalQuestion {
  id: string;
  sectionName: string;
  questionType: QuestionType;
  prompt: string;
  marks: number;
  options: QuestionOption[];
  correctOption: string;
  rubricGuide: string;
}

export const CreateTestModal: React.FC<Props> = ({ isOpen, onClose, onCreated }) => {
  const teacher = useAppSelector((state) => state.auth.teacher);
  const assignedClasses = teacher?.assignedClasses || [];

  // Deduplicated assigned classes for this teacher
  const uniqueAssignedClasses = React.useMemo(() => {
    const map = new Map<number, { classId: number; name: string }>();
    for (const c of assignedClasses) {
      const cid = Number(c.classId || c.id);
      if (!map.has(cid)) {
        map.set(cid, {
          classId: cid,
          name: c.className || c.name?.split(' - ')[0] || `Class ${c.grade || cid}`
        });
      }
    }
    return Array.from(map.values());
  }, [assignedClasses]);

  const [examType, setExamType] = useState<ExamType>('MONTHLY_TEST');
  const [selectedClassId, setSelectedClassId] = useState<number>(() => {
    return uniqueAssignedClasses[0]?.classId || (assignedClasses[0]?.classId ? Number(assignedClasses[0].classId) : 1);
  });

  // Keep selectedClassId in sync with teacher's assigned classes
  React.useEffect(() => {
    if (uniqueAssignedClasses.length > 0) {
      const exists = uniqueAssignedClasses.some((c) => c.classId === selectedClassId);
      if (!exists) {
        setSelectedClassId(uniqueAssignedClasses[0].classId);
      }
    }
  }, [uniqueAssignedClasses, selectedClassId]);

  // Subjects assigned to this teacher specifically for the selected class
  const availableSubjects = React.useMemo(() => {
    const matching = assignedClasses.filter(
      (c) => Number(c.classId || c.id) === Number(selectedClassId)
    );
    const pool = matching.length > 0 ? matching : assignedClasses;
    const map = new Map<number, { id: number; name: string }>();
    for (const c of pool) {
      const subId = Number(c.subjectId || 1);
      const subName = c.subject || 'General';
      if (!map.has(subId)) {
        map.set(subId, {
          id: subId,
          name: subName
        });
      }
    }
    return Array.from(map.values());
  }, [assignedClasses, selectedClassId]);

  const [selectedSubjectId, setSelectedSubjectId] = useState<number>(() => {
    return availableSubjects[0]?.id || (assignedClasses[0]?.subjectId ? Number(assignedClasses[0].subjectId) : 1);
  });

  // Keep selectedSubjectId in sync when availableSubjects change (e.g. when changing class)
  React.useEffect(() => {
    if (availableSubjects.length > 0) {
      const exists = availableSubjects.some((s) => s.id === selectedSubjectId);
      if (!exists) {
        setSelectedSubjectId(availableSubjects[0].id);
      }
    }
  }, [availableSubjects, selectedSubjectId]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [passingMarks, setPassingMarks] = useState<number>(20);

  // Default availability: today now to +2 days
  const nowStr = new Date().toISOString().slice(0, 16);
  const nextWeekStr = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const [availableFrom, setAvailableFrom] = useState(nowStr);
  const [availableUntil, setAvailableUntil] = useState(nextWeekStr);

  const [dateSheetEntries, setDateSheetEntries] = useState<any[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);

  React.useEffect(() => {
    teacherDatesheetsApi
      .getActiveDateSheets()
      .then((res) => {
        const teacherClassIds = new Set(assignedClasses.map((c) => Number(c.classId || c.id)));
        const teacherSubjectIds = new Set(assignedClasses.map((c) => Number(c.subjectId || 0)));

        const entries = (res.activeDateSheets || []).flatMap((ds) =>
          (ds.entries || []).map((e) => ({ ...e, exam_title: ds.title, exam_type: ds.exam_type }))
        );

        // Strictly show only entries for classes & subjects this teacher teaches
        const myEntries = entries.filter((e) => {
          const matchClass = teacherClassIds.size === 0 || teacherClassIds.has(Number(e.class_id));
          const matchSubj = teacherSubjectIds.size === 0 || teacherSubjectIds.has(Number(e.subject_id)) || !e.subject_id;
          return matchClass && matchSubj;
        });

        setDateSheetEntries(myEntries);
      })
      .catch(() => {});
  }, [assignedClasses]);

  const handleDateSheetEntrySelect = (entryId: number) => {
    setSelectedEntryId(entryId || null);
    if (!entryId) return;
    const entry = dateSheetEntries.find((e) => Number(e.id) === entryId);
    if (!entry) return;

    setSelectedClassId(Number(entry.class_id));
    setSelectedSubjectId(Number(entry.subject_id));
    if (entry.exam_type) setExamType(entry.exam_type as ExamType);
    setTitle(`${entry.exam_title || 'Examination'} — ${entry.subject_name}`);

    if (entry.exam_date) {
      try {
        const parseTime = (dateStr: string, timeStr: string) => {
          const [time, modifier] = timeStr.trim().split(' ');
          let [hours, minutes] = time.split(':').map(Number);
          if (modifier?.toUpperCase() === 'PM' && hours < 12) hours += 12;
          if (modifier?.toUpperCase() === 'AM' && hours === 12) hours = 0;
          const hStr = String(hours).padStart(2, '0');
          const mStr = String(minutes || 0).padStart(2, '0');
          return `${dateStr}T${hStr}:${mStr}`;
        };

        if (entry.start_time) {
          setAvailableFrom(parseTime(entry.exam_date, entry.start_time));
        }
        if (entry.end_time) {
          setAvailableUntil(parseTime(entry.exam_date, entry.end_time));
        }
      } catch {
        // Fallback to default
      }
    }
  };

  const [questions, setQuestions] = useState<LocalQuestion[]>([
    {
      id: 'q1',
      sectionName: 'Part 1: Objective (MCQs)',
      questionType: 'MCQ',
      prompt: '',
      marks: 2,
      options: [
        { key: 'A', text: '' },
        { key: 'B', text: '' },
        { key: 'C', text: '' },
        { key: 'D', text: '' }
      ],
      correctOption: 'A',
      rubricGuide: ''
    }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculate total marks dynamically
  const calculatedTotalMarks = questions.reduce((acc, q) => acc + (Number(q.marks) || 0), 0);

  const handleClassChange = (cId: number) => {
    setSelectedClassId(cId);
    const matching = assignedClasses.filter((c) => Number(c.classId || c.id) === cId);
    if (matching.length > 0 && matching[0].subjectId) {
      setSelectedSubjectId(Number(matching[0].subjectId));
    }
  };

  const handleAddQuestion = (type: QuestionType) => {
    const defaultSection =
      type === 'MCQ'
        ? 'Part 1: Objective (MCQs)'
        : type === 'SHORT_ANSWER'
        ? 'Part 2: Short Questions'
        : 'Part 3: Long Questions';

    const newQ: LocalQuestion = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sectionName: defaultSection,
      questionType: type,
      prompt: '',
      marks: type === 'MCQ' ? 2 : type === 'SHORT_ANSWER' ? 5 : 10,
      options:
        type === 'MCQ'
          ? [
              { key: 'A', text: '' },
              { key: 'B', text: '' },
              { key: 'C', text: '' },
              { key: 'D', text: '' }
            ]
          : [],
      correctOption: type === 'MCQ' ? 'A' : '',
      rubricGuide: ''
    };
    setQuestions([...questions, newQ]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length <= 1) {
      setErrorMsg('A test must contain at least one question.');
      return;
    }
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index: number, updates: Partial<LocalQuestion>) => {
    setQuestions(
      questions.map((q, i) => (i === index ? { ...q, ...updates } : q))
    );
  };

  const handleOptionChange = (qIndex: number, optKey: string, text: string) => {
    setQuestions(
      questions.map((q, i) => {
        if (i !== qIndex) return q;
        const newOpts = q.options.map((opt) =>
          opt.key === optKey ? { ...opt, text } : opt
        );
        return { ...q, options: newOpts };
      })
    );
  };

  const handleSubmit = async (publishImmediately: boolean) => {
    setErrorMsg(null);

    // Validation
    if (!title.trim()) {
      setErrorMsg('Please enter a test title.');
      return;
    }
    if (durationMinutes <= 0) {
      setErrorMsg('Test duration must be at least 1 minute.');
      return;
    }
    if (calculatedTotalMarks <= 0) {
      setErrorMsg('Total marks must be greater than 0.');
      return;
    }
    if (new Date(availableUntil) <= new Date(availableFrom)) {
      setErrorMsg('End availability window must be after the start time.');
      return;
    }

    // Validate all questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.prompt.trim()) {
        setErrorMsg(`Question #${i + 1} prompt cannot be empty.`);
        return;
      }
      if (q.questionType === 'MCQ') {
        const emptyOpt = q.options.find((o) => !o.text.trim());
        if (emptyOpt) {
          setErrorMsg(`Question #${i + 1} option (${emptyOpt.key}) cannot be empty.`);
          return;
        }
        if (!q.correctOption) {
          setErrorMsg(`Question #${i + 1} must have a designated correct option.`);
          return;
        }
      }
    }

    try {
      setIsSubmitting(true);

      const payload: CreateTestPayload = {
        classId: selectedClassId,
        subjectId: selectedSubjectId,
        examType,
        dateSheetEntryId: selectedEntryId || undefined,
        termName: examType === 'MID_TERM' ? 'Mid-Term Exam' : examType === 'FINAL_TERM' ? 'Final-Term Exam' : 'Monthly Test',
        title: title.trim(),
        description: description.trim() || undefined,
        durationMinutes: Number(durationMinutes),
        totalMarks: calculatedTotalMarks,
        passingMarks: Number(passingMarks) || Math.floor(calculatedTotalMarks * 0.4),
        availableFrom: new Date(availableFrom).toISOString(),
        availableUntil: new Date(availableUntil).toISOString(),
        status: publishImmediately ? 'PUBLISHED' : 'DRAFT',
        questions: questions.map((q) => ({
          sectionName: q.sectionName || 'Part 1',
          questionType: q.questionType,
          prompt: q.prompt.trim(),
          marks: Number(q.marks),
          options: q.questionType === 'MCQ' ? q.options : null,
          correctOption: q.questionType === 'MCQ' ? q.correctOption : null,
          rubricGuide: q.rubricGuide.trim() || null
        }))
      };

      await assessmentsApi.createTest(payload);
      onCreated();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create monthly test.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#1b1a47] text-white flex items-center justify-between border-b border-indigo-900/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center">
              <FileText className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Create Test &amp; Examination</h2>
              <p className="text-xs text-indigo-200">Author Monthly Tests, Mid-Term, or Final-Term exam papers with auto-grading</p>
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

          {/* Examination Category Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Examination Category *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'MONTHLY_TEST', label: 'Monthly Test', desc: 'Continuous Assessment' },
                { id: 'MID_TERM', label: 'Mid-Term Exam', desc: 'Half-Yearly Paper' },
                { id: 'FINAL_TERM', label: 'Final-Term Exam', desc: 'Annual Examination' },
                { id: 'CLASS_QUIZ', label: 'Class Quiz', desc: 'Quick Evaluation' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setExamType(cat.id as ExamType)}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    examType === cat.id
                      ? 'border-[#1b1a47] bg-[#1b1a47]/5 ring-1 ring-[#1b1a47]'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`text-xs font-bold ${examType === cat.id ? 'text-[#1b1a47]' : 'text-slate-700'}`}>
                    {cat.label}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{cat.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Date Sheet Synchronization Option */}
          {dateSheetEntries.length > 0 && (
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shadow-2xs">
              <div className="flex items-center gap-2 text-amber-900 font-semibold">
                <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Auto-Fill from Principal&apos;s Date Sheet:</span>
              </div>
              <select
                value={selectedEntryId || ''}
                onChange={(e) => handleDateSheetEntrySelect(Number(e.target.value))}
                className="text-xs bg-white border border-amber-300 rounded-lg px-3 py-1.5 font-bold text-amber-950 focus:outline-hidden focus:ring-1 focus:ring-amber-500 shadow-2xs"
              >
                <option value="">-- Manual Schedule (No Date Sheet) --</option>
                {dateSheetEntries.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.class_name} — {e.subject_name} ({e.exam_date} {e.start_time})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 1. Basic Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Class *</label>
              <select
                value={selectedClassId}
                onChange={(e) => handleClassChange(Number(e.target.value))}
                className="w-full text-xs font-medium border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                {uniqueAssignedClasses.map((c) => (
                  <option key={c.classId} value={c.classId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject *</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                className="w-full text-xs font-medium border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                {availableSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                Duration (Minutes) *
              </label>
              <input
                type="number"
                min="5"
                max="180"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Passing Marks *</label>
              <input
                type="number"
                min="1"
                max={calculatedTotalMarks || 100}
                value={passingMarks}
                onChange={(e) => setPassingMarks(Number(e.target.value))}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Test Title & Instructions */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Test Title *</label>
              <input
                type="text"
                placeholder="e.g. October Monthly Assessment — Algebra &amp; Geometry"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs font-medium border border-slate-200 rounded-lg px-3.5 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Instructions for Students</label>
              <textarea
                rows={2}
                placeholder="e.g. Attempt all questions. The test will automatically close once time expires."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Availability Window */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>Availability Window (Server-Authoritative Test Room Access)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Available From (Start Time)</label>
                <input
                  type="datetime-local"
                  value={availableFrom}
                  onChange={(e) => setAvailableFrom(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Available Until (End Cutoff)</label>
                <input
                  type="datetime-local"
                  value={availableUntil}
                  onChange={(e) => setAvailableUntil(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Question Builder Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Questions ({questions.length}) — Total Marks: <span className="text-indigo-600 font-extrabold">{calculatedTotalMarks}</span>
                </h3>
                <p className="text-[11px] text-slate-500">Add MCQs, Short Answers, or Essay questions to this monthly test</p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleAddQuestion('MCQ')}
                  className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + MCQ
                </button>
                <button
                  type="button"
                  onClick={() => handleAddQuestion('SHORT_ANSWER')}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Short Answer
                </button>
                <button
                  type="button"
                  onClick={() => handleAddQuestion('LONG_ANSWER')}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Long Answer
                </button>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-4">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3 relative hover:border-indigo-200 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-6 h-6 rounded-md bg-[#1b1a47] text-white text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        placeholder="Part (e.g. Part 1)"
                        value={q.sectionName}
                        onChange={(e) => handleQuestionChange(idx, { sectionName: e.target.value })}
                        className="text-[11px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5 w-36 focus:outline-hidden focus:bg-white"
                        title="Question group/part (e.g. Part 1, Part 2)"
                      />
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          q.questionType === 'MCQ'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : q.questionType === 'SHORT_ANSWER'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {q.questionType === 'MCQ'
                          ? 'Multiple Choice (MCQ)'
                          : q.questionType === 'SHORT_ANSWER'
                          ? 'Short Answer'
                          : 'Long Answer'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <label className="text-[11px] text-slate-500 font-semibold">Marks:</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={q.marks}
                          onChange={(e) => handleQuestionChange(idx, { marks: Number(e.target.value) })}
                          className="w-14 text-xs font-bold text-center border border-slate-200 rounded-md py-1 bg-slate-50 focus:bg-white focus:outline-hidden"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition"
                        title="Remove question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Question Prompt */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Question Prompt *
                    </label>
                    <textarea
                      rows={2}
                      placeholder={`Enter question #${idx + 1} description...`}
                      value={q.prompt}
                      onChange={(e) => handleQuestionChange(idx, { prompt: e.target.value })}
                      className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* MCQ Options */}
                  {q.questionType === 'MCQ' && (
                    <div className="space-y-2 pt-1">
                      <label className="block text-[11px] font-semibold text-slate-600">
                        Options &amp; Correct Answer (Click radio to mark correct option):
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {q.options.map((opt) => (
                          <div
                            key={opt.key}
                            className={`flex items-center gap-2 p-2 rounded-lg border transition ${
                              q.correctOption === opt.key
                                ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`correct_${q.id}`}
                              checked={q.correctOption === opt.key}
                              onChange={() => handleQuestionChange(idx, { correctOption: opt.key })}
                              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-700 w-4">{opt.key}.</span>
                            <input
                              type="text"
                              placeholder={`Option ${opt.key}`}
                              value={opt.text}
                              onChange={(e) => handleOptionChange(idx, opt.key, e.target.value)}
                              className="flex-1 text-xs bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-hidden px-1 py-0.5"
                            />
                            {q.correctOption === opt.key && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Subjective Rubric Guide */}
                  {q.questionType !== 'MCQ' && (
                    <div className="pt-1">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                        Teacher Grading Rubric / Answer Key Notes (Hidden from students):
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 2 marks for formula, 3 marks for correct final answer with units"
                        value={q.rubricGuide}
                        onChange={(e) => handleQuestionChange(idx, { rubricGuide: e.target.value })}
                        className="w-full text-xs border border-dashed border-slate-300 rounded-lg px-3 py-2 bg-slate-50/60 focus:bg-white focus:outline-hidden"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            Total: <span className="font-bold text-slate-900">{questions.length} Questions</span> |{' '}
            <span className="font-bold text-indigo-700">{calculatedTotalMarks} Marks</span> | Pass at{' '}
            <span className="font-bold text-slate-900">{passingMarks} Marks</span>
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
              Save Draft
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit(true)}
              className="px-5 py-2 bg-[#1b1a47] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
            >
              {isSubmitting ? 'Publishing...' : 'Publish Test Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

