import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { addNotice } from '../../store/slices/noticesSlice';
import { addToast } from '../../store/slices/uiSlice';
import { Modal } from '../common/Modal';
import { AcademicNotice } from '../../types';

interface CreateNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateNoticeModal: React.FC<CreateNoticeModalProps> = ({ isOpen, onClose }) => {
  const dispatch = useAppDispatch();
  const assignedClasses = useAppSelector((state) => state.auth.teacher.assignedClasses);
  const teacher = useAppSelector((state) => state.auth.teacher);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetClassId, setTargetClassId] = useState('all');
  const [isUrgent, setIsUrgent] = useState(false);
  const [category, setCategory] = useState('Homework & Reminders');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const targetCls = assignedClasses.find((c) => c.id === targetClassId);

    const newNotice: AcademicNotice = {
      id: `NOT-${Date.now().toString().slice(-4)}`,
      title,
      content,
      author: teacher.name,
      date: 'Today',
      targetClassId,
      targetClassName: targetCls ? targetCls.name : 'All Assigned Classes',
      isUrgent,
      isPublished: true,
      category,
    };

    dispatch(addNotice(newNotice));
    dispatch(
      addToast({
        message: `Notice broadcasted to ${newNotice.targetClassName}.`,
        type: 'success',
      })
    );
    setTitle('');
    setContent('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Broadcast Academic Notice"
      subtitle="Publish academic updates, quiz announcements, or classroom alerts"
      icon="campaign"
      iconBgColor="bg-[#e2dfff] text-[#3525cd]"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
        <div>
          <label className="block text-xs font-semibold text-[#121c2a] mb-1">Notice Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Bring Protractor & Ruler for Thursday Geometry Session"
            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[#121c2a] focus:border-[#3525cd] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#121c2a] mb-1">Target Class</label>
            <select
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[#121c2a] focus:border-[#3525cd] focus:outline-none"
            >
              <option value="all">All Assigned Classes</option>
              {assignedClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#121c2a] mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[#121c2a] focus:border-[#3525cd] focus:outline-none"
            >
              <option>Homework &amp; Reminders</option>
              <option>Examination &amp; Scheduling</option>
              <option>Curriculum &amp; Syllabus</option>
              <option>General Classroom Advisory</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#121c2a] mb-1">Announcement Body</label>
          <textarea
            required
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write clear instructions for students and parents..."
            className="w-full p-3 bg-white border border-slate-200 rounded-lg text-[#121c2a] focus:border-[#3525cd] focus:outline-none"
          ></textarea>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="urgentCheck"
            checked={isUrgent}
            onChange={(e) => setIsUrgent(e.target.checked)}
            className="w-4 h-4 rounded text-[#ba1a1a] accent-[#ba1a1a] cursor-pointer"
          />
          <label htmlFor="urgentCheck" className="text-xs text-[#ba1a1a] font-bold cursor-pointer">
            Mark as High Priority / Urgent Alert
          </label>
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
            Publish Notice
          </button>
        </div>
      </form>
    </Modal>
  );
};
