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

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

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
      <div className="bg-white rounded-xl p-3 shadow-xs border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Days Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          {days.map((day) => {
            const isSelected = activeDay.toLowerCase() === day.toLowerCase();
            return (
              <button
                key={day}
                onClick={() => dispatch(setActiveDay(day))}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  isSelected
                    ? 'bg-[#3525cd] text-white shadow-xs'
                    : 'bg-[#eff4ff] text-[#464555] hover:bg-[#dee9fc]'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 bg-[#eff4ff] p-1 rounded-lg border border-indigo-100">
          <button
            onClick={() => dispatch(setActiveViewTab('sessions'))}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-colors flex items-center gap-1 ${
              activeViewTab === 'sessions'
                ? 'bg-white text-[#3525cd] shadow-xs'
                : 'text-[#464555] hover:text-[#121c2a]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">co_present</span>
            <span>Sessions ({filteredSessions.length})</span>
          </button>

          <button
            onClick={() => dispatch(setActiveViewTab('duty_roster'))}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-colors flex items-center gap-1 ${
              activeViewTab === 'duty_roster'
                ? 'bg-white text-[#3525cd] shadow-xs'
                : 'text-[#464555] hover:text-[#121c2a]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">shield_person</span>
            <span>Duties ({filteredDuties.length})</span>
          </button>

          <button
            onClick={() => dispatch(setActiveViewTab('bell_schedule'))}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-colors flex items-center gap-1 ${
              activeViewTab === 'bell_schedule'
                ? 'bg-white text-[#3525cd] shadow-xs'
                : 'text-[#464555] hover:text-[#121c2a]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">notifications_active</span>
            <span>Bells ({periods.length})</span>
          </button>

          <button
            onClick={() => dispatch(fetchSchoolTimetable())}
            disabled={isLoading}
            className="p-1 rounded-md text-[#3525cd] hover:bg-white/60 ml-1"
            title="Refresh"
          >
            <span className={`material-symbols-outlined text-[16px] ${isLoading ? 'animate-spin' : ''}`}>
              refresh
            </span>
          </button>
        </div>
      </div>

      {/* VIEW 1: Clean Sessions Table (Rows) */}
      {activeViewTab === 'sessions' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#eff4ff] text-[#464555] font-bold uppercase tracking-wider border-b border-slate-200 h-10 select-none">
                  <th className="px-3 w-28">Time</th>
                  <th className="px-3 w-20">Class</th>
                  <th className="px-3 min-w-[150px]">Subject &amp; Topic</th>
                  <th className="px-3 w-24">Room</th>
                  <th className="px-3 w-24">Faculty</th>
                  <th className="px-3 text-center w-20">Status</th>
                  <th className="px-3 text-right w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSessions.map((s) => {
                  const isLive = s.status === 'live';
                  const isDone = s.status === 'completed';

                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-[#eff4ff]/40 transition-colors h-13 ${
                        isLive ? 'bg-emerald-50/40 font-medium' : ''
                      }`}
                    >
                      {/* Time */}
                      <td className="px-3 font-mono font-bold text-[#121c2a]">
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-[#3525cd]">schedule</span>
                          <span>{s.startTime.split(' ')[0]} - {s.endTime.split(' ')[0]}</span>
                        </div>
                      </td>

                      {/* Class */}
                      <td className="px-3">
                        <span className="px-2 py-0.5 rounded bg-[#eff4ff] text-[#3525cd] font-bold text-[11px] border border-indigo-100">
                          {s.className}
                        </span>
                      </td>

                      {/* Subject */}
                      <td className="px-3">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px] text-[#3525cd]">
                            {s.subjectIcon}
                          </span>
                          <div>
                            <span className="font-bold text-[#121c2a] block">{s.subject}</span>
                            <span className="text-[11px] text-[#777587] truncate max-w-[200px] block">
                              {s.topic}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Room */}
                      <td className="px-3 font-semibold text-[#464555]">
                        <span className="inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-[#777587]">meeting_room</span>
                          {s.roomNumber}
                        </span>
                      </td>

                      {/* Faculty */}
                      <td className="px-3">
                        <div className="flex items-center gap-1.5">
                          <img
                            src={s.teacherAvatar}
                            alt={s.teacherName}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                          <span className="truncate max-w-[90px]">{s.teacherName.split(',')[0]}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-3 text-center">
                        {isLive ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#065f46] font-bold text-[10px] inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#006c49] animate-ping"></span>
                            LIVE
                          </span>
                        ) : isDone ? (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[#065f46] font-bold text-[10px]">
                            Delivered
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[#777587] font-semibold text-[10px]">
                            Scheduled
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleLaunchZoom(s)}
                            className="px-2.5 py-1 rounded-lg bg-[#4f46e5] hover:bg-[#3525cd] text-white font-bold text-[11px] flex items-center gap-1 shadow-xs"
                          >
                            <span className="material-symbols-outlined text-[14px]">videocam</span>
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
                                date: '2024-10-23',
                                dayOfWeek: s.dayOfWeek,
                                startTime: s.startTime,
                                endTime: s.endTime,
                                periodNumber: s.periodNumber,
                                room: s.roomNumber,
                                status: s.status === 'live' ? 'started' : s.status,
                                zoomRoomId: s.zoomMeetingId || '849-2039-1102',
                                zoomPasscode: s.zoomPasscode || 'PASS',
                                deliveryLogged: false,
                                attendanceSubmitted: false,
                              };
                              dispatch(openLessonModal(legacy as any));
                            }}
                            className="px-2 py-1 rounded-lg bg-[#eff4ff] hover:bg-[#dee9fc] text-[#121c2a] text-[11px] font-semibold"
                          >
                            Log
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: Clean Duty Roster Table (Rows) */}
      {activeViewTab === 'duty_roster' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#eff4ff] text-[#464555] font-bold uppercase tracking-wider border-b border-slate-200 h-10 select-none">
                  <th className="px-3 w-28">Shift Time</th>
                  <th className="px-3 min-w-[160px]">Duty Post</th>
                  <th className="px-3 min-w-[150px]">Zone</th>
                  <th className="px-3 w-32">Faculty</th>
                  <th className="px-3 text-center w-24">Status</th>
                  <th className="px-3 text-right w-32">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDuties.map((d) => {
                  const isCheckedIn = d.status === 'checked_in';
                  const isDone = d.status === 'completed';

                  return (
                    <tr key={d.id} className="hover:bg-slate-50 h-13 transition-colors">
                      <td className="px-3 font-mono font-bold text-[#121c2a]">
                        {d.startTime.split(' ')[0]} - {d.endTime.split(' ')[0]}
                      </td>

                      <td className="px-3">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-[#92400e]">
                            {d.icon}
                          </span>
                          <span className="font-bold text-[#121c2a]">{d.dutyName}</span>
                        </div>
                      </td>

                      <td className="px-3 text-[#464555] font-medium">
                        <span className="inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-[#3525cd]">
                            location_on
                          </span>
                          {d.zone}
                        </span>
                      </td>

                      <td className="px-3">
                        <div className="flex items-center gap-1.5">
                          <img
                            src={d.teacherAvatar}
                            alt={d.teacherName}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                          <span className="truncate">{d.teacherName.split(',')[0]}</span>
                        </div>
                      </td>

                      <td className="px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            isCheckedIn
                              ? 'bg-amber-100 text-[#92400e]'
                              : isDone
                              ? 'bg-emerald-100 text-[#065f46]'
                              : 'bg-slate-100 text-[#464555]'
                          }`}
                        >
                          {d.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>

                      <td className="px-3 text-right">
                        <button
                          onClick={() => handleDutyCheckIn(d)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                            isDone
                              ? 'bg-slate-100 text-[#464555] hover:bg-slate-200'
                              : isCheckedIn
                              ? 'bg-[#006c49] text-white hover:bg-[#005236]'
                              : 'bg-[#4f46e5] text-white hover:bg-[#3525cd]'
                          }`}
                        >
                          {isDone ? 'Reset' : isCheckedIn ? 'Done' : 'Check In'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: Clean Bell Schedule Table (Rows) */}
      {activeViewTab === 'bell_schedule' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#eff4ff] text-[#464555] font-bold uppercase tracking-wider border-b border-slate-200 h-10 select-none">
                  <th className="px-3 w-16 text-center">#</th>
                  <th className="px-3 min-w-[200px]">Period Name</th>
                  <th className="px-3 w-36">Bell Window</th>
                  <th className="px-3 w-28 text-center">Duration</th>
                  <th className="px-3 text-right w-28">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periods.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 h-12 transition-colors">
                    <td className="px-3 text-center font-bold text-[#777587]">
                      {p.periodNumber > 0 ? `P${p.periodNumber}` : '—'}
                    </td>
                    <td className="px-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[17px]" style={{ color: p.color }}>
                          {p.icon}
                        </span>
                        <span className="font-bold text-[#121c2a]">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-3 font-mono font-semibold text-[#121c2a]">
                      {p.startTime} – {p.endTime}
                    </td>
                    <td className="px-3 text-center font-semibold text-[#464555]">
                      {p.durationMinutes} min
                    </td>
                    <td className="px-3 text-right">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          p.type === 'break'
                            ? 'bg-amber-100 text-[#92400e]'
                            : p.type === 'duty'
                            ? 'bg-blue-100 text-[#0284c7]'
                            : 'bg-indigo-100 text-[#3525cd]'
                        }`}
                      >
                        {p.type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
