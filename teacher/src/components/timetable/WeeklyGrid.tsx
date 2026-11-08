import React from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { openLessonModal } from '../../store/slices/timetableSlice';
import { addToast } from '../../store/slices/uiSlice';
import { TimetableLesson } from '../../types';
import { CheckCircle2, Video } from 'lucide-react';

export const WeeklyGrid: React.FC = () => {
  const dispatch = useAppDispatch();
  const lessons = useAppSelector((state) => state.timetable.lessons);
  const sessions = useAppSelector((state) => state.schoolTimetable.sessions);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Normalize grid items from published lessons or recurring slots
  const gridItems: TimetableLesson[] = lessons.length > 0
    ? lessons
    : sessions.map((s) => ({
        id: s.id,
        classId: s.classId,
        className: s.className,
        subject: s.subject,
        topic: s.topic,
        date: new Date().toISOString().split('T')[0],
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        periodNumber: s.periodNumber || 1,
        room: s.roomNumber || `Class ${s.grade} Room`,
        status: (s.status === 'live' ? 'live' : s.status === 'completed' ? 'completed' : 'scheduled') as any,
        zoomRoomId: s.zoomMeetingId || '',
        zoomPasscode: s.zoomPasscode || '',
        deliveryLogged: false,
        attendanceSubmitted: false,
      }));

  // Derive unique time slots from actual items (sorted)
  const timeSlots = Array.from(
    new Map(
      gridItems.map((l) => [`${l.startTime}-${l.endTime}`, { startTime: l.startTime, endTime: l.endTime }])
    ).values()
  ).sort((a, b) => a.startTime.localeCompare(b.startTime));

  const getLessonForSlot = (day: string, startTime: string): TimetableLesson | undefined =>
    gridItems.find(
      (l) => l.dayOfWeek.toLowerCase() === day.toLowerCase() && l.startTime === startTime
    );

  const handleLaunchZoom = (lesson: TimetableLesson, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(
      addToast({
        message: `Launching Zoom meeting for ${lesson.className} (${lesson.zoomRoomId || 'Online Room'})...`,
        type: 'info',
      })
    );
  };

  if (timeSlots.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-10 text-center text-xs text-slate-400">
        No lessons scheduled yet. Classes scheduled by the Principal will appear here.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-[#f1f1fa] text-[#545454] text-xs font-bold uppercase tracking-wider select-none border-b border-slate-100">
              <th className="p-3 w-36 border-r border-slate-100 text-center">Time</th>
              {days.map((day) => {
                const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
                const isToday = day.toLowerCase() === todayName.toLowerCase();
                const hasLesson = gridItems.some((l) => l.dayOfWeek.toLowerCase() === day.toLowerCase());
                if (!hasLesson) return null;
                return (
                  <th
                    key={day}
                    className={`p-3 text-center border-r border-slate-100 ${
                      isToday ? 'bg-indigo-100/60 text-[#36348e]' : ''
                    }`}
                  >
                    {day} {isToday ? '(Today)' : ''}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {timeSlots.map((slot) => (
              <tr key={slot.startTime} className="hover:bg-slate-50/50">
                <td className="p-3 text-center bg-[#f9f9fc] font-semibold border-r border-slate-100">
                  <span className="block text-sm font-bold text-[#292929] font-mono">{slot.startTime}</span>
                  <span className="text-[11px] text-[#777587] font-mono">– {slot.endTime}</span>
                </td>
                {days.map((day) => {
                  const hasLesson = gridItems.some((l) => l.dayOfWeek.toLowerCase() === day.toLowerCase());
                  if (!hasLesson) return null;
                  const lesson = getLessonForSlot(day, slot.startTime);
                  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
                  const isToday = day.toLowerCase() === todayName.toLowerCase();

                  return (
                    <td
                      key={day}
                      className={`p-2.5 border-r border-slate-100 align-top ${
                        isToday ? 'bg-indigo-50/20' : ''
                      }`}
                    >
                      {lesson ? (
                        <div
                          onClick={() => dispatch(openLessonModal(lesson))}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer hover:shadow-md flex flex-col justify-between min-h-[92px] ${
                            lesson.status === 'completed'
                              ? 'bg-emerald-50/70 border-emerald-200'
                              : lesson.status === 'started' || lesson.status === 'live'
                              ? 'bg-amber-50/70 border-amber-200'
                              : 'bg-white border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-[#36348e] text-[10px] font-bold">
                                {lesson.className}
                              </span>
                            </div>
                            <h4 className="font-bold text-xs text-[#292929] leading-tight">
                              {lesson.subject}
                            </h4>
                            <p className="text-[11px] text-[#545454] line-clamp-1 mt-0.5">
                              {lesson.topic}
                            </p>
                          </div>

                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/60">
                            <span
                              className={`text-[10px] font-bold flex items-center gap-1 ${
                                lesson.status === 'completed' ? 'text-emerald-700' : 'text-[#36348e]'
                              }`}
                            >
                              {lesson.status === 'completed' ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Video className="w-3 h-3 text-[#36348e]" />
                              )}
                              {lesson.status === 'completed' ? 'Done' : 'Ready'}
                            </span>
                            <button
                              onClick={(e) => handleLaunchZoom(lesson, e)}
                              className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-[#36348e] hover:bg-[#ffedc2] font-semibold"
                            >
                              Zoom
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full min-h-[85px] rounded-xl flex items-center justify-center text-slate-300 border border-dashed border-slate-200 text-[11px]">
                          Free Period
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
