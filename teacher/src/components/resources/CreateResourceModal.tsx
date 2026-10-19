import React, { useState } from 'react';
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
  const assignedClasses = useAppSelector((state) => state.auth.teacher.assignedClasses);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetClassId, setTargetClassId] = useState('5-math-a');
  const [subject, setSubject] = useState('Mathematics');
  const [type, setType] = useState<'pdf' | 'recording' | 'slides' | 'notes' | 'link'>('pdf');
  const [fileUrl, setFileUrl] = useState('https://resources.edupulse.org/uploads/fraction_study_guide.pdf');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const classNum = parseInt(targetClassId.replace(/\D/g, ''), 10) || 1;
      await fetch('/api/v1/tasks/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          classId: classNum,
          subjectId: 1,
          title,
          description,
          resourceType: type.toUpperCase(),
          fileUrl,
          fileSize: '2.4 MB'
        })
      });
    } catch (err) {
      console.warn('Backend resource create failed, fallback to local state:', err);
    }

    const selectedCls = assignedClasses.find((c) => c.id === targetClassId);

    const newRes: LearningResource = {
      id: `RES-${Date.now().toString().slice(-4)}`,
      title,
      description,
      classId: targetClassId,
      className: selectedCls ? selectedCls.name.split(' - ')[0] : 'Class 5-A',
      subject,
      type,
      fileUrl,
      fileSize: '2.4 MB',
      uploadDate: 'Today',
      isPublished: true,
    };

    dispatch(addResource(newRes));
    dispatch(
      addToast({
        message: `Learning resource "${title}" published to ${newRes.className}.`,
        type: 'success',
      })
    );
    setTitle('');
    setDescription('');
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
              onChange={(e) => setTargetClassId(e.target.value)}
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[#121c2a] focus:border-[#3525cd] focus:outline-none"
            >
              {assignedClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#121c2a] mb-1">Subject</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[#121c2a] focus:border-[#3525cd] focus:outline-none"
            >
              <option value="Mathematics">Mathematics</option>
              <option value="General Science">General Science</option>
              <option value="Science Lab">Science Lab</option>
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
