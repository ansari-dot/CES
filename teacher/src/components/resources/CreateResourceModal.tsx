import React, { useState, useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { createResourceThunk } from '../../store/slices/resourcesSlice';
import { addToast } from '../../store/slices/uiSlice';
import { Modal } from '../common/Modal';

const ACCEPT_BY_TYPE: Record<string, string> = {
  pdf: '.pdf',
  slides: '.ppt,.pptx,.pdf',
  recording: '.mp4,.webm,.mov,.mkv,.ogg',
  notes: '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,.zip',
};

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
  const [file, setFile] = useState<File | null>(null);
  const [isPublished, setIsPublished] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

    const selectedCls = uniqueAssignedClasses.find((c) => c.id === targetClassId);
    const selectedSubjObj = availableSubjects.find((s) => s.name === subject);
    if (!selectedCls || !selectedSubjObj) {
      dispatch(addToast({ message: 'Select one of your assigned classes and subjects.', type: 'error' }));
      return;
    }

    const isLink = type === 'link';
    if (isLink && !/^https?:\/\/\S+$/i.test(fileUrl.trim())) {
      dispatch(addToast({ message: 'Enter a valid link starting with http:// or https://', type: 'error' }));
      return;
    }
    if (!isLink && !file) {
      dispatch(addToast({ message: 'Please choose a file to upload.', type: 'error' }));
      return;
    }

    setUploading(true);
    const result = await dispatch(
      createResourceThunk({
        classId: selectedCls.classId,
        subjectId: selectedSubjObj.id,
        title: title.trim(),
        description: description.trim(),
        type,
        file: isLink ? null : file,
        linkUrl: isLink ? fileUrl.trim() : undefined,
        isPublished,
      })
    );
    setUploading(false);

    if (createResourceThunk.fulfilled.match(result)) {
      dispatch(
        addToast({
          message: isPublished
            ? `Learning resource "${title.trim()}" published to ${selectedCls.name} (${subject}).`
            : `Learning resource "${title.trim()}" saved as a draft (not visible to students).`,
          type: 'success',
        })
      );
      setTitle('');
      setDescription('');
      setFileUrl('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onClose();
    } else {
      // Nothing is shown as uploaded unless the server accepted the file
      dispatch(addToast({ message: String(result.payload || 'Upload failed. Please try again.'), type: 'error' }));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upload Learning Resource"
      subtitle="Share study guides, slides, recordings, or worksheets with students"
      icon="upload_file"
      iconBgColor="bg-[#cdd4fb] text-[#36348e]"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
        <div>
          <label className="block text-xs font-semibold text-[#292929] mb-1">Resource Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Unit 4 Fraction Division Study Notes"
            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[#292929] focus:border-[#36348e] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#292929] mb-1">Description</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Summarize the resource content and recommended usage..."
            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-[#292929] focus:border-[#36348e] focus:outline-none"
          ></textarea>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#292929] mb-1">Target Class</label>
            <select
              value={targetClassId}
              onChange={(e) => handleClassChange(e.target.value)}
              disabled={uniqueAssignedClasses.length === 0}
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[#292929] focus:border-[#36348e] focus:outline-none"
            >
              {uniqueAssignedClasses.length === 0 ? (
                <option value="" disabled>No classes assigned</option>
              ) : (
                uniqueAssignedClasses.map((c, idx) => (
                  <option key={`res-modal-cls-${c.id}-${idx}`} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#292929] mb-1">Subject</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={availableSubjects.length === 0}
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[#292929] focus:border-[#36348e] focus:outline-none"
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
            <label className="block text-xs font-semibold text-[#292929] mb-1">Resource Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[#292929] focus:border-[#36348e] focus:outline-none"
            >
              <option value="pdf">PDF Document</option>
              <option value="slides">Presentation Slides</option>
              <option value="recording">Zoom Recording</option>
              <option value="notes">Notes / Guide</option>
              <option value="link">External Link / Simulation</option>
            </select>
          </div>

          {type === 'link' ? (
            <div>
              <label className="block text-xs font-semibold text-[#292929] mb-1">Access URL</label>
              <input
                type="url"
                required
                placeholder="e.g. https://..."
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[#292929] focus:border-[#36348e] focus:outline-none"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-[#292929] mb-1">File</label>
              <input
                ref={fileInputRef}
                type="file"
                required
                accept={ACCEPT_BY_TYPE[type]}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full h-10 px-2 py-2 bg-white border border-slate-200 rounded-lg text-[#292929] text-xs focus:border-[#36348e] focus:outline-none file:mr-2 file:px-2 file:py-0.5 file:rounded file:border-0 file:bg-[#f1f1fa] file:text-[#36348e] file:font-semibold"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="resourcePublishCheck"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="w-4 h-4 rounded accent-[#36348e] cursor-pointer"
          />
          <label htmlFor="resourcePublishCheck" className="text-xs text-[#545454] cursor-pointer font-medium">
            Publish now (visible to students of the selected class)
          </label>
        </div>

        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#e8e8f6] text-[#292929] hover:bg-[#ffedc2] text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={uploading}
            className="px-5 py-2 rounded-lg bg-[#36348e] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white font-semibold text-xs shadow-md transition-all disabled:opacity-60"
          >
            {uploading ? 'Uploading…' : isPublished ? 'Publish Resource' : 'Save Resource'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
