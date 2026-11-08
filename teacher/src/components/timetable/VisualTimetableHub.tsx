import React from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  setActiveDay,
  setActiveViewTab,
  setSelectedGrade,
  updateDutyStatus,
  fetchSchoolTimetable,
} from '../../store/slices/schoolTimetableSlice';
import { openLessonModal } from '../../store/slices/timetableSlice';
import { addToast } from '../../store/slices/uiSlice';
import { SchoolClassSession, TeacherDutyRosterItem } from '../../types';
import {
  Clock,
  Video,
  Shield,
  Bell,
  RotateCw,
  CalendarX,
  MapPin,
  BookOpen,
  Calendar,
  Layers,
  CheckCircle2,
  BellOff,
  ShieldOff
} from 'lucide-react';

export const VisualTimetableHub: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    activeDay,
    activeViewTab,
    selectedGrade,
    periods,
    sessions,
    dutyRosters,
    isLoading,
  } = useAppSelector((state) => state.schoolTimetable);
  const teacherTz = useAppSelector((state) => state.timetable.timezone);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const filteredSessions = sessions.filter((s) => {
    if (s.dayOfWeek.toLowerCase() !== activeDay.toLowerCase()) return false;
    if (selectedGrade !== 'all' && s.grade !== selectedGrade) return false;
    return true;
  });

  const filteredDuties = dutyRosters.filter((d) => {
    return d.dayOfWeek.toLowerCase() === activeDay.toLowerCase();
  });

  const handleLaunchZoom = (session: SchoolClassSession) => {
    dispatch(
      addToast({
        message: `Launching Zoom for ${session.className} (${session.zoomMeetingId})`,
        type: 'success',
      })
    );
  };

  const handleDutyCheckIn = (duty: TeacherDutyRosterItem) => {
    const nextStatus =
      duty.status === 'upcoming'
        ? 'checked_in'
        : duty.status === 'checked_in'
        ? 'completed'
        : 'upcoming';

    dispatch(updateDutyStatus({ dutyId: duty.id, status: nextStatus }));
    dispatch(
      addToast({
        message: `${duty.dutyName}: ${nextStatus.replace('_', ' ').toUpperCase()}`,
        type: 'info',
      })
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Bar: Clean Day Selector + Tab Switcher */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Days Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {days.map((day) => {
            const isSelected = activeDay.toLowerCase() === day.toLowerCase();
            return (
              <button
                key={day}
                onClick={() => dispatch(setActiveDay(day))}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-[#36348e] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Timezone badge & Tab Buttons */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-[#36348e] text-xs font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>{teacherTz}</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => dispatch(setActiveViewTab('sessions'))}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeViewTab === 'sessions'
                  ? 'bg-white text-[#36348e] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Sessions ({filteredSessions.length})</span>
            </button>

            <button
              onClick={() => dispatch(setActiveViewTab('duty_roster'))}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeViewTab === 'duty_roster'
                  ? 'bg-white text-[#36348e] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Duties ({filteredDuties.length})</span>
            </button>

            <button
              onClick={() => dispatch(setActiveViewTab('bell_schedule'))}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeViewTab === 'bell_schedule'
                  ? 'bg-white text-[#36348e] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Bells ({periods.length})</span>
            </button>

            <button
              onClick={() => dispatch(fetchSchoolTimetable())}
              disabled={isLoading}
              className="p-1.5 rounded-lg text-[#36348e] hover:bg-white ml-0.5 cursor-pointer"
              title="Refresh"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: Clean Sessions Table (Rows) */}
      {activeViewTab === 'sessions' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200 h-10 select-none">
                  <th className="px-4 w-32">Time</th>
                  <th className="px-3 w-24">Class</th>
                  <th className="px-4 min-w-[160px]">Subject &amp; Topic</th>
                  <th className="px-3 w-28">Room</th>
                  <th className="px-3 text-center w-24">Status</th>
                  <th className="px-4 text-right w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <CalendarX className="w-8 h-8 mb-2 text-slate-300 mx-auto" />
                      <p className="font-bold text-xs text-slate-700">No class sessions scheduled for {activeDay}.</p>
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((s) => {
                    const isLive = s.status === 'live';
                    const isDone = s.status === 'completed';

                    return (
                      <tr
                        key={s.id}
                        className={`hover:bg-slate-50/80 transition-colors h-14 ${
                          isLive ? 'bg-red-50/30 font-medium' : ''
                        }`}
                      >
                        {/* Time */}
                        <td className="px-4 font-mono font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#36348e]" />
                            <span>{s.startTime} - {s.endTime}</span>
                          </div>
                        </td>

                        {/* Class */}
                        <td className="px-3">
                          <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-[#36348e] font-bold text-[11px] border border-indigo-100">
                            {s.className}
                          </span>
                        </td>

                        {/* Subject */}
                        <td className="px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 text-[#36348e] flex items-center justify-center shrink-0">
                              <BookOpen className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block">{s.subject}</span>
                              <span className="text-[11px] text-slate-500 truncate max-w-[200px] block">
                                {s.topic}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Room */}
                        <td className="px-3 font-semibold text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {s.roomNumber}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-3 text-center">
                          {isLive ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px] inline-flex items-center gap-1 border border-red-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping"></span>
                              LIVE
                            </span>
                          ) : isDone ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold text-[10px] border border-emerald-100">
                              Delivered
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-[10px] border border-slate-200">
                              Scheduled
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleLaunchZoom(s)}
                              className="px-2.5 py-1 rounded-lg bg-[#36348e] hover:bg-[#2c2a75] text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer"
                            >
                              <Video className="w-3 h-3" />
                              Zoom
                            </button>
                            <button
                              onClick={() => {
                                const legacy = {
                                  id: s.id,
                                  classId: s.classId,
                                  className: s.className,
                                  subject: s.subject,
                                  topic: s.topic,
                                  date: new Date().toISOString().split('T')[0],
                                  dayOfWeek: s.dayOfWeek,
                                  startTime: s.startTime,
                                  endTime: s.endTime,
                                  periodNumber: s.periodNumber,
                                  room: s.roomNumber,
                                  status: s.status === 'live' ? 'started' : s.status,
                                  zoomRoomId: s.zoomMeetingId || '',
                                  zoomPasscode: s.zoomPasscode || '',
                                  deliveryLogged: false,
                                  attendanceSubmitted: false,
                                };
                                dispatch(openLessonModal(legacy as any));
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold border border-slate-200 cursor-pointer"
                            >
                              Log
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: Clean Duty Roster Table (Rows) */}
      {activeViewTab === 'duty_roster' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200 h-10 select-none">
                  <th className="px-4 w-32">Shift Time</th>
                  <th className="px-4 min-w-[160px]">Duty Post</th>
                  <th className="px-4 min-w-[150px]">Zone</th>
                  <th className="px-4 w-36">Faculty</th>
                  <th className="px-3 text-center w-28">Status</th>
                  <th className="px-4 text-right w-32">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDuties.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <ShieldOff className="w-8 h-8 mb-2 text-slate-300 mx-auto" />
                      <p className="font-bold text-xs text-slate-700">No faculty duties scheduled for {activeDay}.</p>
                    </td>
                  </tr>
                ) : (
                  filteredDuties.map((d) => {
                    const isCheckedIn = d.status === 'checked_in';
                    const isDone = d.status === 'completed';

                    return (
                      <tr key={d.id} className="hover:bg-slate-50 h-14 transition-colors">
                        <td className="px-4 font-mono font-bold text-slate-900">
                          {d.startTime.split(' ')[0]} - {d.endTime.split(' ')[0]}
                        </td>

                        <td className="px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
                              <Shield className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-bold text-slate-900">{d.dutyName}</span>
                          </div>
                        </td>

                        <td className="px-4 text-slate-600 font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#36348e]" />
                            {d.zone}
                          </span>
                        </td>

                        <td className="px-4">
                          <div className="flex items-center gap-2">
                            <img
                              src={d.teacherAvatar}
                              alt={d.teacherName}
                              className="w-6 h-6 rounded-full object-cover border border-slate-200"
                            />
                            <span className="truncate font-semibold text-slate-800">{d.teacherName.split(',')[0]}</span>
                          </div>
                        </td>

                        <td className="px-3 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
                              isCheckedIn
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : isDone
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {d.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>

                        <td className="px-4 text-right">
                          <button
                            onClick={() => handleDutyCheckIn(d)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              isDone
                                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                : isCheckedIn
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                                : 'bg-[#36348e] text-white hover:bg-[#2c2a75] shadow-2xs'
                            }`}
                          >
                            {isDone ? 'Reset' : isCheckedIn ? 'Done' : 'Check In'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: Clean Bell Schedule Table (Rows) */}
      {activeViewTab === 'bell_schedule' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200 h-10 select-none">
                  <th className="px-4 w-16 text-center">#</th>
                  <th className="px-4 min-w-[200px]">Period Name</th>
                  <th className="px-4 w-40">Bell Window</th>
                  <th className="px-4 w-32 text-center">Duration</th>
                  <th className="px-4 text-right w-32">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periods.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <BellOff className="w-8 h-8 mb-2 text-slate-300 mx-auto" />
                      <p className="font-bold text-xs text-slate-700">No bell schedule periods configured.</p>
                    </td>
                  </tr>
                ) : (
                  periods.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 h-13 transition-colors">
                      <td className="px-4 text-center font-bold text-slate-500">
                        {p.periodNumber > 0 ? `P${p.periodNumber}` : '—'}
                      </td>
                      <td className="px-4">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-slate-500" />
                          <span className="font-bold text-slate-900">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 font-mono font-semibold text-slate-900">
                        {p.startTime} – {p.endTime}
                      </td>
                      <td className="px-4 text-center font-semibold text-slate-600">
                        {p.durationMinutes} min
                      </td>
                      <td className="px-4 text-right">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            p.type === 'break'
                              ? 'bg-amber-100 text-amber-900 border-amber-200'
                              : p.type === 'duty'
                              ? 'bg-blue-100 text-blue-900 border-blue-200'
                              : 'bg-indigo-100 text-[#36348e] border-indigo-200'
                          }`}
                        >
                          {p.type}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
