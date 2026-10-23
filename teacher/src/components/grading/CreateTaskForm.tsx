import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { createNewTask } from '../../store/slices/tasksSlice';
import { addToast } from '../../store/slices/uiSlice';
import { Task } from '../../types';
import { requestApi } from '../../services/api';

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
  const [attachedFile, setAttachedFile] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const classNum = Number(targetClassId) || (uniqueAssignedClasses[0]?.classId || 1);
    const selectedSubjObj = availableSubjects.find((s) => s.name === subject);
    const subjectNum = selectedSubjObj?.id || 1;

    try {
      await requestApi('/api/v1/tasks', {
        method: 'POST',
        body: JSON.stringify({
          classId: classNum,
          subjectId: subjectNum,
          title: title.trim(),
          instructions: instructions || 'Complete all assignment questions with step-by-step working.',
          deadline,
          totalMarks,
          gradingScale: gradingScale.toUpperCase()
        })
      });
    } catch (err) {
      console.warn('Backend task create failed, fallback to local state:', err);
    }

    const selectedCls = uniqueAssignedClasses.find((c) => c.id === targetClassId);

    const newTask: Task = {
      id: `TASK-${Date.now().toString().slice(-4)}`,
      title: title.trim(),
      instructions: instructions || 'Complete all assignment questions with step-by-step working.',
      classId: targetClassId,
      className: selectedCls ? selectedCls.name : `Class ${classNum}`,
      subject: subject || 'General',
      assignedDate: 'Today',
      deadline: deadline ? new Date(deadline).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) : 'No deadline',
      totalMarks,
      gradingScale,
      status: 'active',
      submittedCount: 0,
      totalStudents: assignedClasses.find(c => String(c.classId || c.id) === targetClassId)?.enrolledCount || 0,
      gradedCount: 0,
      pendingCount: 0,
      lateCount: 0,
      missingCount: assignedClasses.find(c => String(c.classId || c.id) === targetClassId)?.enrolledCount || 0,
      handoutName: attachedFile || undefined,
    };

    dispatch(createNewTask(newTask));
    dispatch(
      addToast({
        message: `Assignment "${title}" published to ${newTask.className} (${newTask.subject}). ${
          notifyParents ? 'Guardian broadcast sent.' : ''
        }`,
        type: 'success',
      })
    );

    // Reset fields
    setTitle('');
    setInstructions('');
    setAttachedFile(null);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100 mb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-[#e2dfff] text-[#0f0069]">
              <span className="material-symbols-outlined text-[18px]">post_add</span>
            </span>
            <h2 className="text-xl font-bold text-[#121c2a]">Create New Assignment</h2>
          </div>
          <p className="text-xs text-[#464555]">
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
            className="px-3 py-1.5 rounded-lg bg-[#eff4ff] text-[#464555] hover:text-[#121c2a] text-xs font-semibold flex items-center gap-1 border border-indigo-100/60"
          >
            <span className="material-symbols-outlined text-[18px]">library_books</span> Load from
            Template
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
        {/* Row 1: Title & Class & Subject */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-6 space-y-1">
            <label className="text-xs font-semibold text-[#121c2a]">Assignment Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chapter Assessment: Problem Solving Practice"
              className="w-full bg-[#eff4ff] px-3.5 py-2.5 rounded-lg text-[#121c2a] placeholder:text-[#777587] focus:outline-none focus:ring-2 focus:ring-[#3525cd]/20 border border-indigo-100/60"
            />
          </div>

          <div className="md:col-span-3 space-y-1">
            <label className="text-xs font-semibold text-[#121c2a]">Target Class</label>
            <select
              value={targetClassId}
              onChange={(e) => handleClassChange(e.target.value)}
              disabled={uniqueAssignedClasses.length === 0}
              className="w-full bg-[#eff4ff] px-3.5 py-2.5 rounded-lg text-[#121c2a] focus:outline-none focus:ring-2 focus:ring-[#3525cd]/20 cursor-pointer border border-indigo-100/60"
            >
              {uniqueAssignedClasses.length === 0 ? (
                <option value="" disabled>No classes assigned</option>
              ) : (
                uniqueAssignedClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="md:col-span-3 space-y-1">
            <label className="text-xs font-semibold text-[#121c2a]">Subject</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={availableSubjects.length === 0}
              className="w-full bg-[#eff4ff] px-3.5 py-2.5 rounded-lg text-[#121c2a] focus:outline-none focus:ring-2 focus:ring-[#3525cd]/20 cursor-pointer border border-indigo-100/60"
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
          <label className="text-xs font-semibold text-[#121c2a]">Instructions &amp; Requirements</label>
          <textarea
            rows={2}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Specify expectations, acceptable formats, and rubric guidance..."
            className="w-full bg-[#eff4ff] px-3.5 py-2 rounded-lg text-[#121c2a] placeholder:text-[#777587] focus:outline-none focus:ring-2 focus:ring-[#3525cd]/20 border border-indigo-100/60"
          ></textarea>
        </div>

        {/* Row 3: Due Date, Total Marks, Grading Scale */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#121c2a]">Due Date &amp; Deadline</label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-[#eff4ff] px-3.5 py-2 rounded-lg text-[#121c2a] focus:outline-none focus:ring-2 focus:ring-[#3525cd]/20 cursor-pointer border border-indigo-100/60"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#121c2a]">Total Max Marks</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="100"
                value={totalMarks}
                onChange={(e) => setTotalMarks(Number(e.target.value))}
                className="w-full bg-[#eff4ff] px-3.5 py-2 rounded-lg text-[#121c2a] font-bold focus:outline-none focus:ring-2 focus:ring-[#3525cd]/20 border border-indigo-100/60"
              />
              <span className="text-xs text-[#777587] font-semibold shrink-0">points</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#121c2a]">Grading Scale</label>
            <select
              value={gradingScale}
              onChange={(e) => setGradingScale(e.target.value as any)}
              className="w-full bg-[#eff4ff] px-3.5 py-2 rounded-lg text-[#121c2a] focus:outline-none focus:ring-2 focus:ring-[#3525cd]/20 cursor-pointer border border-indigo-100/60"
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
          <label className="text-xs font-semibold text-[#121c2a]">
            Task Handout / Reference Worksheet Upload
          </label>
          <div
            onClick={() => {
              if (!attachedFile) {
                setAttachedFile('Worksheet_Handout.pdf');
                dispatch(addToast({ message: 'Worksheet attached: Worksheet_Handout.pdf', type: 'info' }));
              }
            }}
            className="bg-[#eff4ff] p-5 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#dee9fc]/70 transition-all border border-dashed border-indigo-200"
          >
            <div className="w-10 h-10 rounded-full bg-white text-[#3525cd] flex items-center justify-center shadow-xs mb-1.5">
              <span className="material-symbols-outlined text-[24px]">cloud_upload</span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-[#121c2a]">
              Click to upload worksheet or drag &amp; drop document
            </p>
            <p className="text-[11px] text-[#777587] mt-0.5">
              Supports PDF, DOCX, PNG or Google Drive links (Max 25 MB per file)
            </p>
            {attachedFile ? (
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-0.5 rounded bg-indigo-100 text-[11px] font-semibold text-[#3525cd] font-mono">
                  {attachedFile}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAttachedFile(null);
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
              className="w-4 h-4 rounded text-[#3525cd] accent-[#3525cd] cursor-pointer"
            />
            <label
              htmlFor="notifyParentsCheck"
              className="text-xs text-[#464555] cursor-pointer font-medium"
            >
              Broadcast announcement notification to parent portals
            </label>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => dispatch(addToast({ message: 'Task saved to drafts.', type: 'info' }))}
              className="px-4 py-2.5 rounded-lg bg-[#e6eeff] text-[#121c2a] hover:bg-[#dee9fc] text-xs font-semibold"
            >
              Save as Draft
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-lg bg-[#3525cd] hover:bg-[#4f46e5] text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 active:scale-98"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              Publish Task to Class
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
