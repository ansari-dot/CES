import React, { useState, useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { addResource } from '../../store/slices/resourcesSlice';
import { addToast } from '../../store/slices/uiSlice';
import { Modal } from '../common/Modal';
import { LearningResource } from '../../types';

interface CreateResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateResourceModal: React.FC<CreateResourceModalProps> = ({ isOpen, onClose }) => {
  const dispatch = useAppDispatch();
  const assignedClasses = useAppSelector((state) => state.auth.teacher.assignedClasses || []);

  // Unique classes assigned to this teacher
  const uniqueAssignedClasses = useMemo(() => {
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
  const [description, setDescription] = useState('');
  const [targetClassId, setTargetClassId] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [type, setType] = useState<'pdf' | 'recording' | 'slides' | 'notes' | 'link'>('pdf');
  const [fileUrl, setFileUrl] = useState('');

  // Keep target class in sync with teacher's assigned classes
  useEffect(() => {
    if (uniqueAssignedClasses.length > 0) {
      const exists = uniqueAssignedClasses.some((c) => c.id === targetClassId);
      if (!exists || !targetClassId) {
        setTargetClassId(uniqueAssignedClasses[0].id);
      }
    }
  }, [uniqueAssignedClasses, targetClassId]);

  // Subjects assigned to this teacher for the selected class
  const availableSubjects = useMemo(() => {
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

  // Keep subject in sync with selected class
  useEffect(() => {
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
    const finalFileUrl = fileUrl.trim() || 'https://edupulse.org/resources/sample-handout.pdf';

    try {
      await fetch('/api/v1/tasks/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          classId: classNum,
          subjectId: subjectNum,
          title: title.trim(),
          description: description.trim(),
          resourceType: type.toUpperCase(),
          fileUrl: finalFileUrl,
          fileSize: '1.2 MB'
        })
      });
    } catch (err) {
      console.warn('Backend resource create failed, fallback to local state:', err);
    }

    const selectedCls = uniqueAssignedClasses.find((c) => c.id === targetClassId);

    const newRes: LearningResource = {
      id: `RES-${Date.now().toString().slice(-4)}`,
      title: title.trim(),
      description: description.trim(),
      classId: targetClassId,
      className: selectedCls ? selectedCls.name : `Class ${classNum}`,
      subject: subject || 'General',
      type,
      fileUrl: finalFileUrl,
      fileSize: '1.2 MB',
      uploadDate: 'Today',
      isPublished: true,
    };

    dispatch(addResource(newRes));
    dispatch(
      addToast({
        message: `Learning resource "${title}" published to ${newRes.className} (${newRes.subject}).`,
        type: 'success',
      })
    );
    setTitle('');
    setDescription('');
    setFileUrl('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upload Learning Resource"
      subtitle="Share study guides, slides, recordings, or worksheets with students"
      icon="upload_file"
      iconBgColor="bg-[#e2dfff] text-[#3525cd]"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
        <div>
          <label className="block text-xs font-semibold text-[#121c2a] mb-1">Resource Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Unit 4 Fraction Division Study Notes"
            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[#121c2a] focus:border-[#3525cd] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#121c2a] mb-1">Description</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Summarize the resource content and recommended usage..."
            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-[#121c2a] focus:border-[#3525cd] focus:outline-none"
          ></textarea>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#121c2a] mb-1">Target Class</label>
            <select
              value={targetClassId}
              onChange={(e) => handleClassChange(e.target.value)}
              disabled={uniqueAssignedClasses.length === 0}
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[#121c2a] focus:border-[#3525cd] focus:outline-none"
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

          <div>
            <label className="block text-xs font-semibold text-[#121c2a] mb-1">Subject</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={availableSubjects.length === 0}
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[#121c2a] focus:border-[#3525cd] focus:outline-none"
            >
              {availableSubjects.length > 0 ? (
                availableSubjects.map((subj) => (
                  <option key={subj.name} value={subj.name}>
                    {subj.name}
                  </option>
                ))
              ) : (
                <option value="">No subject assigned</option>
              )}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#121c2a] mb-1">Resource Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[#121c2a] focus:border-[#3525cd] focus:outline-none"
            >
              <option value="pdf">PDF Document</option>
              <option value="slides">Presentation Slides</option>
              <option value="recording">Zoom Recording</option>
              <option value="notes">Notes / Guide</option>
              <option value="link">External Link / Simulation</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#121c2a] mb-1">File / Access URL</label>
            <input
              type="text"
              required
              placeholder="e.g. https://... or /materials/unit1.pdf"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[#121c2a] focus:border-[#3525cd] focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#e6eeff] text-[#121c2a] hover:bg-[#dee9fc] text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-[#3525cd] hover:bg-[#4f46e5] text-white font-semibold text-xs shadow-md transition-all"
          >
            Publish Resource
          </button>
        </div>
      </form>
    </Modal>
  );
};
