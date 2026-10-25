import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { TimetableLesson, SchoolClass, Teacher, DayOfWeek, LessonHistoryEntry } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  CalendarDays,
  Plus,
  Clock,
  History,
  AlertTriangle,
  Send,
  Video,
  XCircle,
  Edit2,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const TimetableModule: React.FC = () => {
  const [lessons, setLessons] = useState<TimetableLesson[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedClassNum, setSelectedClassNum] = useState<number | 'All'>('All');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | 'All'>('Monday');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Zoom Server-to-Server Syncing state
  const [syncingLessonId, setSyncingLessonId] = useState<string | null>(null);

  // Modal states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<TimetableLesson | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedLessonHistory, setSelectedLessonHistory] = useState<LessonHistoryEntry[]>([]);

  // Cancel Lesson Modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [lessonToCancel, setLessonToCancel] = useState<TimetableLesson | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    classNumber: 1,
    subjectId: '',
    subjectName: '',
    teacherId: '',
    teacherName: '',
    dayOfWeek: 'Monday' as DayOfWeek,
    startTime: '09:00',
    endTime: '09:45',
    reason: ''
  });

  const toast = useToast();
  const { activeSession } = useAuth();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [lData, cData, tData] = await Promise.all([
        api.getTimetableLessons(),
        api.getClasses(),
        api.getTeachers()
      ]);
      setLessons(lData);
      setClasses(cData);
      setTeachers(tData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load timetable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenAdd = () => {
    const firstClass = classes[0];
    const firstSubject = firstClass?.subjects[0];
    const defaultTeacher = teachers.find((t) => t.accountStatus === 'Active');

    setEditingLesson(null);
    setFormData({
      classNumber: selectedClassNum === 'All' ? (classes[0]?.classNumber ?? 1) : selectedClassNum,
      subjectId: firstSubject?.id || '',
      subjectName: firstSubject?.name || 'Mathematics',
      teacherId: defaultTeacher?.id || '',
      teacherName: defaultTeacher?.name || '',
      dayOfWeek: selectedDay === 'All' ? 'Monday' : selectedDay,
      startTime: '09:00',
      endTime: '09:45',
      reason: 'Standard timetable scheduling'
    });
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (lesson: TimetableLesson) => {
    setEditingLesson(lesson);
    setFormData({
      classNumber: lesson.classNumber,
      subjectId: lesson.subjectId,
      subjectName: lesson.subjectName,
      teacherId: lesson.teacherId,
      teacherName: lesson.teacherName,
      dayOfWeek: lesson.dayOfWeek,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      reason: ''
    });
    setIsEditorOpen(true);
  };

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLesson && !formData.reason.trim()) {
      toast.warning('Please state the reason for modifying a timetable lesson.');
      return;
    }

    try {
      const zoomMeetingId = editingLesson ? editingLesson.zoomMeetingId : '';

      await api.saveTimetableLesson(
        {
          classNumber: Number(formData.classNumber),
          subjectId: formData.subjectId,
          subjectName: formData.subjectName,
          teacherId: formData.teacherId,
          teacherName: formData.teacherName,
          dayOfWeek: formData.dayOfWeek,
          startTime: formData.startTime,
          endTime: formData.endTime,
          timezone: 'Asia/Karachi (UTC+5)',
          academicSession: activeSession,
          publicationStatus: editingLesson ? editingLesson.publicationStatus : 'Published',
          lessonStatus: editingLesson ? editingLesson.lessonStatus : 'Scheduled',
          zoomMeetingId
        },
        editingLesson ? editingLesson.id : undefined,
        formData.reason || 'Timetable creation'
      );

      toast.success(
        editingLesson
          ? `Lesson ${formData.subjectName} updated and audited.`
          : `New lesson scheduled for Class ${formData.classNumber}.`
      );
      setIsEditorOpen(false);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Scheduling validation error');
    }
  };

  const handleCancelLessonSubmit = async () => {
    if (!lessonToCancel) return;
    if (!cancelReason.trim()) {
      toast.warning('A reason is required to cancel a scheduled online lesson.');
      return;
    }

    try {
      await api.cancelTimetableLesson(lessonToCancel.id, cancelReason);
      toast.success(`Lesson Class ${lessonToCancel.classNumber} (${lessonToCancel.subjectName}) marked as cancelled.`);
      setIsCancelModalOpen(false);
      setCancelReason('');
      setLessonToCancel(null);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Cancellation failed');
    }
  };

  const handlePublishTimetable = async () => {
    try {
      await api.publishTimetable(selectedClassNum === 'All' ? undefined : selectedClassNum);
      toast.success(
        selectedClassNum === 'All'
          ? 'School-wide timetable published to Teacher & Student portals.'
          : `Class ${selectedClassNum} timetable published.`
      );
      loadData();
    } catch {
      toast.error('Failed to publish timetable');
    }
  };

  const handleSyncZoomAttendance = async (lessonId: string) => {
    try {
      setSyncingLessonId(lessonId);
      const result = await api.syncLessonZoomAttendance(lessonId);
      if (result?.teacherFound) {
        toast.success(`Zoom Server-to-Server Sync: Teacher verified! Attended ${result.durationHours} hrs. Status: COMPLETED.`);
      } else {
        toast.info(result?.message || 'Sync completed. Teacher attendance updated from Zoom Cloud.');
      }
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to sync with Zoom');
    } finally {
      setSyncingLessonId(null);
    }
  };

  // Filter lessons
  const filteredLessons = lessons.filter((l) => {
    if (selectedClassNum !== 'All' && l.classNumber !== selectedClassNum) return false;
    if (selectedDay !== 'All' && l.dayOfWeek !== selectedDay) return false;
    return true;
  });

  filteredLessons.sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (loading) return <LoadingState message="Loading timetable schedules & Zoom linkages..." rows={6} />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Online School Timetable & Scheduling</h2>
          <p className="text-xs text-slate-500">
            Validated schedules for Classes 1–8 with automated teacher clash and class Zoom overlap prevention.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePublishTimetable}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <Send className="w-3.5 h-3.5 text-amber-600" />
            <span>Publish Official Timetable</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule Lesson</span>
          </button>
        </div>
      </div>

      {/* Class and Day Selection Bars */}
      <div className="space-y-2">
        {/* Class Filter */}
        <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200/90 rounded-xl overflow-x-auto text-xs shadow-2xs">
          <span className="text-[11px] text-slate-400 font-semibold px-2 shrink-0">Class:</span>
          <button
            onClick={() => setSelectedClassNum('All')}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedClassNum === 'All'
                ? 'bg-amber-600 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            All Classes
          </button>
          {classes.map((c) => (
            <button
              key={c.classNumber}
              onClick={() => setSelectedClassNum(c.classNumber)}
              className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedClassNum === c.classNumber
                  ? 'bg-amber-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {c.name || `Class ${c.classNumber}`}
            </button>
          ))}
        </div>

        {/* Day Filter */}
        <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200/90 rounded-xl overflow-x-auto text-xs shadow-2xs">
          <span className="text-[11px] text-slate-400 font-semibold px-2 shrink-0">Day:</span>
          <button
            onClick={() => setSelectedDay('All')}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedDay === 'All'
                ? 'bg-slate-800 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            All Days
          </button>
          {DAYS.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedDay === day
                  ? 'bg-slate-100 text-amber-900 font-semibold border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      {/* Timetable Table Grid */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        {filteredLessons.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            No lessons scheduled for the selected class and day criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Day & Time</th>
                  <th className="px-4 py-3">Class & Subject</th>
                  <th className="px-4 py-3">Assigned Faculty</th>
                  <th className="px-4 py-3">Class Zoom Room</th>
                  <th className="px-4 py-3">Publication</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredLessons.map((lesson) => (
                  <tr key={lesson.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap font-mono">
                      <div className="font-semibold text-slate-900">{lesson.dayOfWeek}</div>
                      <div className="text-[11px] text-slate-500">
                        {lesson.startTime} – {lesson.endTime} (UTC+5)
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">Class {lesson.classNumber}</div>
                      <div className="text-[11px] text-amber-700 font-medium">{lesson.subjectName}</div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-slate-700 font-medium">{lesson.teacherName}</div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        <Video className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span>{lesson.zoomMeetingId}</span>
                      </span>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        title={`Publication: ${lesson.publicationStatus}`}
                        className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                          lesson.publicationStatus === 'Published'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {lesson.publicationStatus === 'Published' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.75} />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-amber-600" strokeWidth={1.75} />
                        )}
                        <span>{lesson.publicationStatus}</span>
                      </span>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <StatusBadge status={lesson.lessonStatus} />
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedLessonHistory(lesson.history);
                            setIsHistoryOpen(true);
                          }}
                          title="View change history & audits"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shadow-2xs"
                        >
                          <History className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </button>
                        <button
                          onClick={() => handleSyncZoomAttendance(lesson.id)}
                          disabled={syncingLessonId === lesson.id}
                          title="Sync verified attendance & hours from Zoom Server-to-Server API"
                          className="p-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors shadow-2xs"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${syncingLessonId === lesson.id ? 'animate-spin' : ''}`} strokeWidth={1.75} />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(lesson)}
                          title="Reschedule Lesson"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-amber-800 hover:border-amber-300 hover:bg-amber-50 transition-colors shadow-2xs"
                        >
                          <Edit2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </button>
                        {lesson.lessonStatus !== 'Cancelled' && (
                          <button
                            onClick={() => {
                              setLessonToCancel(lesson);
                              setIsCancelModalOpen(true);
                            }}
                            title="Cancel lesson"
                            className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors shadow-2xs"
                          >
                            <XCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Lesson Modal */}
      <Modal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={editingLesson ? `Reschedule Lesson · Class ${formData.classNumber}` : 'Schedule New Online Lesson'}
        description="Backend detects teacher double-booking and simultaneous class Zoom overlaps."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveLesson} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Class *</label>
              <select
                value={formData.classNumber}
                onChange={(e) => {
                  const cNum = Number(e.target.value);
                  const cls = classes.find((c) => c.classNumber === cNum);
                  const firstSub = cls?.subjects[0];
                  setFormData({
                    ...formData,
                    classNumber: cNum,
                    subjectId: firstSub?.id || '',
                    subjectName: firstSub?.name || ''
                  });
                }}
                disabled={!!editingLesson}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white"
              >
                {classes.map((c) => (
                  <option key={c.classNumber} value={c.classNumber}>{c.name || `Class ${c.classNumber}`}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Subject *</label>
              <select
                value={formData.subjectId}
                onChange={(e) => {
                  const sId = e.target.value;
                  const cls = classes.find((c) => c.classNumber === formData.classNumber);
                  const sub = cls?.subjects.find((s) => s.id === sId);
                  setFormData({
                    ...formData,
                    subjectId: sId,
                    subjectName: sub?.name || ''
                  });
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-semibold focus:bg-white"
              >
                {classes
                  .find((c) => c.classNumber === formData.classNumber)
                  ?.subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-slate-700 font-medium mb-1">Assigned Faculty Member *</label>
              <select
                value={formData.teacherId}
                onChange={(e) => {
                  const tId = e.target.value;
                  const teacher = teachers.find((t) => t.id === tId);
                  setFormData({
                    ...formData,
                    teacherId: tId,
                    teacherName: teacher?.name || ''
                  });
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white"
              >
                <option value="">-- Select Active Teacher --</option>
                {teachers
                  .filter((t) => t.accountStatus === 'Active')
                  .map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.designation})</option>
                  ))}
              </select>
              {teachers.filter((t) => t.accountStatus === 'Active').length === 0 && (
                <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>No active teachers found in database. Please add teachers in the Faculty/Teachers module first.</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Day of Week *</label>
              <select
                value={formData.dayOfWeek}
                onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value as DayOfWeek })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Start Time *</label>
                <input
                  type="time"
                  required
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-mono focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">End Time *</label>
                <input
                  type="time"
                  required
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-mono focus:bg-white"
                />
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-slate-700 font-medium mb-1">
                Scheduling / Rescheduling Rationale <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={2}
                placeholder="State the reason for adding or changing this timetable slot..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white resize-none"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-tight">
            Validation Active: System checks start time &lt; end time, verifies teacher availability, and confirms no concurrent subjects in the Class {formData.classNumber} Zoom room.
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditorOpen(false)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs"
            >
              {editingLesson ? 'Save Lesson Changes' : 'Confirm & Schedule Lesson'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Cancel Lesson Modal */}
      {lessonToCancel && (
        <Modal
          isOpen={isCancelModalOpen}
          onClose={() => setIsCancelModalOpen(false)}
          title={`Cancel Online Lesson · Class ${lessonToCancel.classNumber} (${lessonToCancel.subjectName})`}
          description={`Scheduled: ${lessonToCancel.dayOfWeek} ${lessonToCancel.startTime}–${lessonToCancel.endTime}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <span>Notice will be logged and dispatched to enrolled students and parents.</span>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Formal Cancellation Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder="State why this lesson is cancelled (e.g. Teacher emergency leave, gazetted public holiday, technical ISP outage)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCancelLessonSubmit}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium shadow-xs"
              >
                Confirm Lesson Cancellation
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Lesson Change History Modal */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title="Lesson Audit & Modification Trail"
        description="Preserved historical record of timetable changes and cancellations."
        maxWidth="lg"
      >
        <div className="space-y-3 text-xs">
          {selectedLessonHistory.length === 0 ? (
            <div className="p-6 text-center text-slate-500 italic bg-slate-50 rounded-xl border border-slate-200">
              No modifications recorded yet for this timetable entry.
            </div>
          ) : (
            selectedLessonHistory.map((entry) => (
              <div
                key={entry.id}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-semibold text-amber-800">{entry.changeType}</span>
                  <span className="font-mono text-[10px]">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-slate-700">{entry.reason}</p>
                <span className="text-[10px] text-slate-400">Changed by: {entry.changedBy}</span>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
};
