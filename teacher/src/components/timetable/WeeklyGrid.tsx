import React from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { openLessonModal } from '../../store/slices/timetableSlice';
import { addToast } from '../../store/slices/uiSlice';
import { TimetableLesson } from '../../types';

export const WeeklyGrid: React.FC = () => {
  const dispatch = useAppDispatch();
  const lessons = useAppSelector((state) => state.timetable.lessons);
  const selectedClassId = useAppSelector((state) => state.auth.selectedClassId);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const periods = [
    { period: 1, time: '09:00 – 09:45 AM' },
    { period: 2, time: '10:30 – 11:15 AM' },
    { period: 3, time: '01:00 – 01:45 PM' },
    { period: 4, time: '02:15 – 03:00 PM' },
  ];

  const filteredLessons =
    selectedClassId === 'all'
      ? lessons
      : lessons.filter((l) => l.classId === selectedClassId);

  const getLessonForSlot = (day: string, periodNumber: number): TimetableLesson | undefined => {
    return filteredLessons.find(
      (l) => l.dayOfWeek.toLowerCase() === day.toLowerCase() && l.periodNumber === periodNumber
    );
  };

  const handleLaunchZoom = (lesson: TimetableLesson, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(
      addToast({
        message: `Launching Zoom meeting for ${lesson.className} (${lesson.zoomRoomId})...`,
        type: 'info',
      })
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-[#eff4ff] text-[#464555] text-xs font-bold uppercase tracking-wider select-none border-b border-slate-100">
              <th className="p-3 w-36 border-r border-slate-100 text-center">Period / Time</th>
              {days.map((day) => (
                <th
                  key={day}
                  className={`p-3 text-center border-r border-slate-100 ${
                    day === 'Wednesday' ? 'bg-indigo-100/60 text-[#3525cd]' : ''
                  }`}
                >
                  {day} {day === 'Wednesday' ? '(Today)' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {periods.map((p) => (
              <tr key={p.period} className="hover:bg-slate-50/50">
                <td className="p-3 text-center bg-[#f8f9ff] font-semibold border-r border-slate-100">
                  <span className="block text-sm font-bold text-[#121c2a]">Period {p.period}</span>
                  <span className="text-[11px] text-[#777587] font-mono">{p.time}</span>
                </td>
                {days.map((day) => {
                  const lesson = getLessonForSlot(day, p.period);
                  const isToday = day === 'Wednesday';

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
                              : lesson.status === 'started'
                              ? 'bg-amber-50/70 border-amber-200'
                              : 'bg-white border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-[#3525cd] text-[10px] font-bold">
                                {lesson.className}
                              </span>
                              <span className="text-[10px] text-[#777587] truncate">
                                {lesson.room}
                              </span>
                            </div>
                            <h4 className="font-bold text-xs text-[#121c2a] leading-tight">
                              {lesson.subject}
                            </h4>
                            <p className="text-[11px] text-[#464555] line-clamp-1 mt-0.5">
                              {lesson.topic}
                            </p>
                          </div>

                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/60">
                            <span
                              className={`text-[10px] font-bold flex items-center gap-0.5 ${
                                lesson.status === 'completed'
                                  ? 'text-[#006c49]'
                                  : 'text-[#3525cd]'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[13px]">
                                {lesson.status === 'completed' ? 'check_circle' : 'videocam'}
                              </span>
                              {lesson.status === 'completed' ? 'Done' : 'Room Ready'}
                            </span>
                            <button
                              onClick={(e) => handleLaunchZoom(lesson, e)}
                              className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-[#3525cd] hover:bg-indigo-100 font-semibold"
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
