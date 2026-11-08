import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  closeLessonModal,
  markLessonCompleted,
  openProblemModal,
} from '../../store/slices/timetableSlice';
import { addToast } from '../../store/slices/uiSlice';
import { Modal } from '../common/Modal';
import { Clock, Paperclip, AlertTriangle, CheckCircle2, ClipboardList } from 'lucide-react';

export const LessonDeliveryModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const activeLesson = useAppSelector((state) => state.timetable.activeLessonModal);

  const [topic, setTopic] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [problemCategory, setProblemCategory] = useState<'none' | 'attendance' | 'technical'>('none');

  useEffect(() => {
    if (activeLesson) {
      setTopic(activeLesson.topic || '');
      setStartTime(activeLesson.actualStartTime || activeLesson.startTime || '');
      setEndTime(activeLesson.actualEndTime || activeLesson.endTime || '');
      setNotes(activeLesson.notes || '');
      setResourceUrl(activeLesson.resourceAttachmentUrl || '');
    }
  }, [activeLesson]);

  if (!activeLesson) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(
      markLessonCompleted({
        lessonId: activeLesson.id,
        topic,
        actualStartTime: startTime,
        actualEndTime: endTime,
        notes,
        resourceAttachmentUrl: resourceUrl,
      })
    );
    dispatch(
      addToast({
        message: `${activeLesson.className} Lesson delivery logged as Completed and synced with SIS.`,
        type: 'success',
      })
    );
  };

  return (
    <Modal
      isOpen={!!activeLesson}
      onClose={() => dispatch(closeLessonModal())}
      title="Lesson Completion Record"
      subtitle={`${activeLesson.className} • ${activeLesson.subject} • Official Delivery Log`}
      icon={<ClipboardList className="w-5 h-5 text-[#36348e]" />}
      iconBgColor="bg-indigo-50 text-[#36348e] border border-indigo-100"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
        {/* Topic Covered */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">
            Lesson Topic Covered
          </label>
          <input
            type="text"
            required
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-[#36348e] focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        {/* Start / End Actual Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Actual Start Time
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full h-10 px-3 pl-9 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-[#36348e] focus:outline-hidden"
              />
              <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Actual End Time
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full h-10 px-3 pl-9 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-[#36348e] focus:outline-hidden"
              />
              <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>

        {/* Lesson Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">
            Lesson Summary &amp; Teacher Observation Notes
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Detail student engagement, syllabus coverage, or homework assigned..."
            className="w-full p-3 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-[#36348e] focus:outline-hidden"
          ></textarea>
        </div>

        {/* Resource Attachment */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">
            Resource Attachment / Whiteboard Export URL
          </label>
          <div className="relative">
            <input
              type="url"
              value={resourceUrl}
              onChange={(e) => setResourceUrl(e.target.value)}
              placeholder="https://..."
              className="w-full h-10 px-3 pl-9 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-[#36348e] focus:outline-hidden"
            />
            <Paperclip className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Incident / Problem category */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5">
            Problem Category Experienced
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label
              className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer border transition-colors ${
                problemCategory === 'none'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              <input
                type="radio"
                name="probCat"
                checked={problemCategory === 'none'}
                onChange={() => setProblemCategory('none')}
                className="accent-emerald-600"
              />
              <span className="text-xs font-bold">None / Clean</span>
            </label>

            <label
              className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer border transition-colors ${
                problemCategory === 'attendance'
                  ? 'border-amber-600 bg-amber-50 text-amber-900'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              <input
                type="radio"
                name="probCat"
                checked={problemCategory === 'attendance'}
                onChange={() => setProblemCategory('attendance')}
                className="accent-amber-600"
              />
              <span className="text-xs font-bold">Attendance</span>
            </label>

            <label
              className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer border transition-colors ${
                problemCategory === 'technical'
                  ? 'border-rose-600 bg-rose-50 text-rose-800'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              <input
                type="radio"
                name="probCat"
                checked={problemCategory === 'technical'}
                onChange={() => setProblemCategory('technical')}
                className="accent-rose-600"
              />
              <span className="text-xs font-bold">Technical/Zoom</span>
            </label>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              dispatch(closeLessonModal());
              dispatch(openProblemModal(activeLesson));
            }}
            className="w-full sm:w-auto px-3 py-2 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            Report Delivery Issue
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => dispatch(closeLessonModal())}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Mark Lesson Completed
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
