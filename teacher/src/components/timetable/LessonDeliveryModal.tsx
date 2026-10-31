import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  closeLessonModal,
  markLessonCompleted,
  openProblemModal,
} from '../../store/slices/timetableSlice';
import { addToast } from '../../store/slices/uiSlice';
import { Modal } from '../common/Modal';

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
      subtitle={`${activeLesson.className} • ${activeLesson.subject} • SRS 5.4 Delivery Log`}
      icon="receipt_long"
      iconBgColor="bg-[#cdd4fb] text-[#36348e]"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
        {/* Topic Covered */}
        <div>
          <label className="block text-xs font-semibold text-[#292929] mb-1">
            Lesson Topic Covered
          </label>
          <input
            type="text"
            required
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[#292929] focus:border-[#36348e] focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        {/* Start / End Actual Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#292929] mb-1">
              Actual Start Time
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full h-10 px-3 pl-9 bg-white border border-slate-200 rounded-lg text-[#292929] focus:border-[#36348e] focus:outline-none"
              />
              <span className="material-symbols-outlined text-[18px] text-[#777587] absolute left-2.5 top-1/2 -translate-y-1/2">
                schedule
              </span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#292929] mb-1">
              Actual End Time
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full h-10 px-3 pl-9 bg-white border border-slate-200 rounded-lg text-[#292929] focus:border-[#36348e] focus:outline-none"
              />
              <span className="material-symbols-outlined text-[18px] text-[#777587] absolute left-2.5 top-1/2 -translate-y-1/2">
                timer_off
              </span>
            </div>
          </div>
        </div>

        {/* Lesson Notes */}
        <div>
          <label className="block text-xs font-semibold text-[#292929] mb-1">
            Lesson Summary &amp; Teacher Observation Notes
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Detail student engagement, syllabus coverage, or homework assigned..."
            className="w-full p-3 bg-white border border-slate-200 rounded-lg text-[#292929] focus:border-[#36348e] focus:outline-none"
          ></textarea>
        </div>

        {/* Resource Attachment */}
        <div>
          <label className="block text-xs font-semibold text-[#292929] mb-1">
            Resource Attachment / Whiteboard Export URL
          </label>
          <div className="relative">
            <input
              type="url"
              value={resourceUrl}
              onChange={(e) => setResourceUrl(e.target.value)}
              className="w-full h-10 px-3 pl-9 bg-white border border-slate-200 rounded-lg text-[#292929] focus:border-[#36348e] focus:outline-none"
            />
            <span className="material-symbols-outlined text-[18px] text-[#777587] absolute left-2.5 top-1/2 -translate-y-1/2">
              attachment
            </span>
          </div>
        </div>

        {/* Incident / Problem category */}
        <div>
          <label className="block text-xs font-semibold text-[#292929] mb-1.5">
            Problem Category Experienced
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors ${
                problemCategory === 'none'
                  ? 'border-[#006c49] bg-emerald-50 text-[#065f46]'
                  : 'border-slate-200 bg-[#f1f1fa] text-[#545454]'
              }`}
            >
              <input
                type="radio"
                name="probCat"
                checked={problemCategory === 'none'}
                onChange={() => setProblemCategory('none')}
                className="accent-[#006c49]"
              />
              <span className="text-xs font-semibold">None / Clean</span>
            </label>

            <label
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors ${
                problemCategory === 'attendance'
                  ? 'border-[#7a5b00] bg-amber-50 text-[#8a6400]'
                  : 'border-slate-200 bg-[#f1f1fa] text-[#545454]'
              }`}
            >
              <input
                type="radio"
                name="probCat"
                checked={problemCategory === 'attendance'}
                onChange={() => setProblemCategory('attendance')}
                className="accent-[#7a5b00]"
              />
              <span className="text-xs font-semibold">Attendance</span>
            </label>

            <label
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors ${
                problemCategory === 'technical'
                  ? 'border-[#ba1a1a] bg-red-50 text-[#991b1b]'
                  : 'border-slate-200 bg-[#f1f1fa] text-[#545454]'
              }`}
            >
              <input
                type="radio"
                name="probCat"
                checked={problemCategory === 'technical'}
                onChange={() => setProblemCategory('technical')}
                className="accent-[#ba1a1a]"
              />
              <span className="text-xs font-semibold">Technical/Zoom</span>
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
            className="w-full sm:w-auto px-3 py-2 text-[#ba1a1a] hover:bg-red-50 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">report_problem</span>
            Report Delivery Issue
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => dispatch(closeLessonModal())}
              className="px-4 py-2 rounded-lg bg-[#e8e8f6] text-[#292929] hover:bg-[#ffedc2] text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#006c49] hover:bg-[#005236] text-white font-semibold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">verified</span>
              Mark Lesson Completed
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
