import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { createTaskThunk, fetchTasksThunk } from '../../store/slices/tasksSlice';
import { addToast } from '../../store/slices/uiSlice';
import { Task } from '../../types';
import { FilePlus, BookOpen, UploadCloud, Send } from 'lucide-react';

const MAX_HANDOUT_BYTES = 25 * 1024 * 1024;

export const CreateTaskForm: React.FC = () => {
  const dispatch = useAppDispatch();
  const assignedClasses = useAppSelector((state) => state.auth.teacher.assignedClasses || []);

  // Unique classes assigned to this teacher
  const uniqueAssignedClasses = React.useMemo(() => {
    const map = new Map<string, { id: string; classId: number; name: string }>();
    for (const c of assignedClasses) {
      const cid = String(c.classId || c.id);
      if (!map.has(cid)) {
        map.set(cid, {
          id: cid,
          classId: Number(c.classId || cid),
          name: c.className || c.name.split(' - ')[0] || `Class ${c.grade}`
        });
      }
    }
    return Array.from(map.values());
  }, [assignedClasses]);

  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [targetClassId, setTargetClassId] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 16);
  });
  const [totalMarks, setTotalMarks] = useState<number>(20);
  const [gradingScale, setGradingScale] = useState<'numeric' | 'letter' | 'rubric' | 'passfail'>('numeric');
  const [notifyParents, setNotifyParents] = useState(true);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [taskType, setTaskType] = useState<Task['taskType']>('ASSIGNMENT');
  const [saving, setSaving] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Sync targetClassId with teacher's assigned classes
  React.useEffect(() => {
    if (uniqueAssignedClasses.length > 0) {
      const exists = uniqueAssignedClasses.some((c) => c.id === targetClassId);
      if (!exists || !targetClassId) {
        setTargetClassId(uniqueAssignedClasses[0].id);
      }
    }
  }, [uniqueAssignedClasses, targetClassId]);

  // Subjects assigned to this teacher for the selected class
  const availableSubjects = React.useMemo(() => {
    const matching = assignedClasses.filter(
      (c) => String(c.classId || c.id) === String(targetClassId)
    );
    const pool = matching.length > 0 ? matching : assignedClasses;
    const map = new Map<string, { id: number; name: string }>();
    for (const c of pool) {
      if (c.subject && !map.has(c.subject)) {
        map.set(c.subject, {
          id: Number(c.subjectId || 1),
          name: c.subject
        });
      }
    }
    return Array.from(map.values());
  }, [assignedClasses, targetClassId]);

  // Sync subject with selected class
  React.useEffect(() => {
    if (availableSubjects.length > 0) {
      const exists = availableSubjects.some((s) => s.name === subject);
      if (!exists || !subject) {
        setSubject(availableSubjects[0].name);
      }
    }
  }, [availableSubjects, subject]);

  const handleClassChange = (newClassId: string) => {
    setTargetClassId(newClassId);
    const matching = assignedClasses.filter(
      (c) => String(c.classId || c.id) === String(newClassId)
    );
    if (matching.length > 0 && matching[0].subject) {
      setSubject(matching[0].subject);
    }
  };

  const saveTask = async (status: 'ACTIVE' | 'DRAFT') => {
    if (!title.trim()) {
      dispatch(addToast({ message: 'Please enter an assignment title.', type: 'error' }));
      return;
    }
    if (!instructions.trim()) {
      dispatch(addToast({ message: 'Please enter instructions for students.', type: 'error' }));
      return;
    }
    if (!deadline || Number.isNaN(new Date(deadline).getTime())) {
      dispatch(addToast({ message: 'Please choose a valid due date and time.', type: 'error' }));
      return;
    }
    if (!Number.isInteger(totalMarks) || totalMarks < 1) {
      dispatch(addToast({ message: 'Maximum marks must be a whole number of at least 1.', type: 'error' }));
      return;
    }

    const selectedCls = uniqueAssignedClasses.find((c) => c.id === targetClassId);
    const selectedSubjObj = availableSubjects.find((s) => s.name === subject);
    if (!selectedCls || !selectedSubjObj) {
      dispatch(addToast({ message: 'Select one of your assigned classes and subjects.', type: 'error' }));
      return;
    }

    setSaving(true);
    const result = await dispatch(
      createTaskThunk({
        classId: selectedCls.classId,
        subjectId: selectedSubjObj.id,
        title: title.trim(),
        instructions: instructions.trim(),
        deadline,
        totalMarks,
        gradingScale: gradingScale === 'passfail' ? 'NUMERIC' : gradingScale.toUpperCase(),
        taskType,
        status,
        notifyParents,
        handout: attachedFile,
      })
    );
    setSaving(false);

    if (createTaskThunk.fulfilled.match(result)) {
      dispatch(
        addToast({
          message:
            status === 'DRAFT'
              ? `"${title.trim()}" saved as a draft. Students cannot see it until you publish it.`
              : `"${title.trim()}" published to ${selectedCls.name} (${subject}).${notifyParents ? ' Parents were notified in their portal.' : ''}`,
          type: 'success',
        })
      );
      dispatch(fetchTasksThunk());
      // Reset fields
      setTitle('');
      setInstructions('');
      setAttachedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else {
      dispatch(addToast({ message: String(result.payload || 'Failed to save the assignment.'), type: 'error' }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveTask('ACTIVE');
  };

  const handleFileChosen = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_HANDOUT_BYTES) {
      dispatch(addToast({ message: 'The handout exceeds the 25 MB limit.', type: 'error' }));
      return;
    }
    setAttachedFile(file);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100 mb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-[#36348e] border border-indigo-100">
              <FilePlus className="w-4.5 h-4.5" />
            </span>
            <h2 className="text-xl font-bold text-[#292929]">Create New Assignment</h2>
          </div>
          <p className="text-xs text-[#545454]">
            Publish curriculum-aligned homework tasks, problem sets, or projects directly to class
            streams.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTitle('Weekly Assessment & Practice Set');
              setInstructions('Solve all assigned questions showing complete step-by-step working.');
              setTotalMarks(20);
              dispatch(addToast({ message: 'Loaded template: Standard Assessment Set', type: 'info' }));
            }}
            className="px-3 py-1.5 rounded-lg bg-[#f1f1fa] text-[#545454] hover:text-[#292929] text-xs font-semibold flex items-center gap-1.5 border border-indigo-100/60"
          >
            <BookOpen className="w-4 h-4 text-slate-500" />
            Load from Template
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
        {/* Row 1: Title & Class & Subject */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-6 space-y-1">
            <label className="text-xs font-semibold text-[#292929]">Assignment Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chapter Assessment: Problem Solving Practice"
              className="w-full bg-[#f1f1fa] px-3.5 py-2.5 rounded-lg text-[#292929] placeholder:text-[#777587] focus:outline-none focus:ring-2 focus:ring-[#36348e]/20 border border-indigo-100/60"
            />
          </div>

          <div className="md:col-span-3 space-y-1">
            <label className="text-xs font-semibold text-[#292929]">Target Class</label>
            <select
              value={targetClassId}
              onChange={(e) => handleClassChange(e.target.value)}
              disabled={uniqueAssignedClasses.length === 0}
              className="w-full bg-[#f1f1fa] px-3.5 py-2.5 rounded-lg text-[#292929] focus:outline-none focus:ring-2 focus:ring-[#36348e]/20 cursor-pointer border border-indigo-100/60"
            >
              {uniqueAssignedClasses.length === 0 ? (
                <option value="" disabled>No classes assigned</option>
              ) : (
                uniqueAssignedClasses.map((c, idx) => (
                  <option key={`task-form-cls-${c.id}-${idx}`} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="md:col-span-3 space-y-1">
            <label className="text-xs font-semibold text-[#292929]">Subject</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={availableSubjects.length === 0}
              className="w-full bg-[#f1f1fa] px-3.5 py-2.5 rounded-lg text-[#292929] focus:outline-none focus:ring-2 focus:ring-[#36348e]/20 cursor-pointer border border-indigo-100/60"
            >
              {availableSubjects.length > 0 ? (
                availableSubjects.map((subj) => (
                  <option key={subj.name} value={subj.name}>{subj.name}</option>
                ))
              ) : (
                <option value="">No subject assigned</option>
              )}
            </select>
          </div>
        </div>

        {/* Row 2: Instructions */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#292929]">Instructions &amp; Requirements</label>
          <textarea
            rows={2}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Specify expectations, acceptable formats, and rubric guidance..."
            className="w-full bg-[#f1f1fa] px-3.5 py-2 rounded-lg text-[#292929] placeholder:text-[#777587] focus:outline-none focus:ring-2 focus:ring-[#36348e]/20 border border-indigo-100/60"
          ></textarea>
        </div>

        {/* Row 3: Assessment Type, Due Date, Total Marks, Grading Scale */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#292929]">Assessment Type</label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as Task['taskType'])}
              className="w-full bg-[#f1f1fa] px-3.5 py-2 rounded-lg text-[#292929] focus:outline-none focus:ring-2 focus:ring-[#36348e]/20 cursor-pointer border border-indigo-100/60"
            >
              <option value="ASSIGNMENT">Assignment / Homework</option>
              <option value="QUIZ">Quiz</option>
              <option value="TEST">Class Test</option>
              <option value="EXAM">Examination</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#292929]">Due Date &amp; Deadline</label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-[#f1f1fa] px-3.5 py-2 rounded-lg text-[#292929] focus:outline-none focus:ring-2 focus:ring-[#36348e]/20 cursor-pointer border border-indigo-100/60"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#292929]">Total Max Marks</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="100"
                value={totalMarks}
                onChange={(e) => setTotalMarks(Number(e.target.value))}
                className="w-full bg-[#f1f1fa] px-3.5 py-2 rounded-lg text-[#292929] font-bold focus:outline-none focus:ring-2 focus:ring-[#36348e]/20 border border-indigo-100/60"
              />
              <span className="text-xs text-[#777587] font-semibold shrink-0">points</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#292929]">Grading Scale</label>
            <select
              value={gradingScale}
              onChange={(e) => setGradingScale(e.target.value as any)}
              className="w-full bg-[#f1f1fa] px-3.5 py-2 rounded-lg text-[#292929] focus:outline-none focus:ring-2 focus:ring-[#36348e]/20 cursor-pointer border border-indigo-100/60"
            >
              <option value="numeric">Points (0 - Max Marks)</option>
              <option value="letter">Letter Grades (A+ to F)</option>
              <option value="rubric">3-Tier Standardized Rubric</option>
              <option value="passfail">Pass / Incomplete</option>
            </select>
          </div>
        </div>

        {/* Row 4: File Attachment Drag and Drop */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#292929]">
            Task Handout / Reference Worksheet Upload
          </label>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.txt,.zip"
            onChange={(e) => handleFileChosen(e.target.files?.[0])}
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileChosen(e.dataTransfer.files?.[0]);
            }}
            className="bg-[#f1f1fa] p-5 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#ffedc2]/70 transition-all border border-dashed border-indigo-200"
          >
            <div className="w-10 h-10 rounded-full bg-white text-[#36348e] flex items-center justify-center shadow-xs mb-1.5 border border-indigo-100">
              <UploadCloud className="w-5 h-5 text-[#36348e]" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-[#292929]">
              Click to upload worksheet or drag &amp; drop document
            </p>
            <p className="text-[11px] text-[#777587] mt-0.5">
              Supports PDF, Word, PowerPoint, images or ZIP (Max 25 MB per file)
            </p>
            {attachedFile ? (
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-0.5 rounded bg-indigo-100 text-[11px] font-semibold text-[#36348e] font-mono">
                  {attachedFile.name} ({(attachedFile.size / (1024 * 1024)).toFixed(1)} MB)
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAttachedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-xs text-rose-500 hover:text-rose-700 underline font-medium"
                >
                  Remove
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-[#777587] mt-1.5 italic">No file attached</p>
            )}
          </div>
        </div>

        {/* Row 5: Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="notifyParentsCheck"
              checked={notifyParents}
              onChange={(e) => setNotifyParents(e.target.checked)}
              className="w-4 h-4 rounded text-[#36348e] accent-[#36348e] cursor-pointer"
            />
            <label
              htmlFor="notifyParentsCheck"
              className="text-xs text-[#545454] cursor-pointer font-medium"
            >
              Broadcast announcement notification to parent portals
            </label>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => saveTask('DRAFT')}
              className="px-4 py-2.5 rounded-lg bg-[#e8e8f6] text-[#292929] hover:bg-[#ffedc2] text-xs font-semibold disabled:opacity-60"
            >
              Save as Draft
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-lg bg-[#36348e] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 active:scale-98 disabled:opacity-60 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              {saving ? 'Saving...' : 'Publish Task to Class'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
