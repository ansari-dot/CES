import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { ChevronLeft, ChevronRight, BookOpen, Calendar, PartyPopper } from 'lucide-react';
import { RootState, AppDispatch } from '../store';
import { fetchTimetable } from '../store/slices/classesSlice';
import { requestApi } from '../services/api';
import { useSocketEvent } from '../hooks/useSocket';
import { RealtimeEvents } from '../services/socketService';

interface TimetableHolidayEvent {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  classesSuspended: boolean;
  isFullDayHoliday: boolean;
  description: string | null;
}
import { TimetableLesson, TimetableDay } from '../store/slices/classesSlice';
import { dateKeyInZone, dayLabelFromKey, longDateFromKey } from '../lib/timezone';
import StatusChip from '../components/common/StatusChip';
import ZoomMeetingModal from '../components/dialogs/ZoomMeetingModal';
import { LoadingBlock } from '../components/common/LoadingBlock';

export default function Timetable() {
  const weeklyTimetable = useSelector((state: RootState) => state.classes.weeklyTimetable);
  const timetableDays = useSelector((state: RootState) => state.classes.timetableDays);
  const timezone = useSelector((state: RootState) => state.classes.timezone);
  const loading = useSelector((state: RootState) => state.classes.loading);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [activeView, setActiveView] = useState<"Week" | "Day">("Week");
  const [activeModalLesson, setActiveModalLesson] = useState<TimetableLesson | null>(null);
  const dispatch = useDispatch<AppDispatch>();
  const [holidayEvents, setHolidayEvents] = useState<TimetableHolidayEvent[]>([]);

  // Days are local calendar dates in the student's detected timezone
  const todayKey = dateKeyInZone(new Date(), timezone);
  const days: TimetableDay[] = useMemo(() => {
    const list = [...timetableDays];
    if (!list.some((d) => d.key === todayKey)) list.push({ key: todayKey, label: dayLabelFromKey(todayKey) });
    return list.sort((a, b) => a.key.localeCompare(b.key));
  }, [timetableDays, todayKey]);
  const selectedDay = days.some((d) => d.key === selectedKey) ? selectedKey : todayKey;
  const selectedIdx = days.findIndex((d) => d.key === selectedDay);
  const selectedLabel = dayLabelFromKey(selectedDay);
  const currentLessons = weeklyTimetable[selectedDay] || [];

  // Calendar holidays (date-only, school calendar dates) that suspend this student's classes
  const rangeStart = days[0]?.key || todayKey;
  const rangeEnd = days[days.length - 1]?.key || todayKey;
  const loadHolidays = useCallback(() => {
    requestApi<TimetableHolidayEvent[]>(`/api/v1/calendar/events?startDate=${rangeStart}&endDate=${rangeEnd}`)
      .then((list) => setHolidayEvents((Array.isArray(list) ? list : []).filter((e) => e.classesSuspended)))
      .catch(() => setHolidayEvents([]));
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    loadHolidays();
  }, [loadHolidays]);

  const refreshAll = () => {
    dispatch(fetchTimetable());
    loadHolidays();
  };
  useSocketEvent('calendar.updated', refreshAll);
  useSocketEvent(RealtimeEvents.TIMETABLE_CHANGE, refreshAll);

  const holidayForDay = (key: string) => holidayEvents.find((e) => key >= e.startDate && key <= e.endDate) || null;
  const selectedHoliday = holidayForDay(selectedDay);

  if (loading && Object.keys(weeklyTimetable).length === 0) {
    return <LoadingBlock message="Loading your class timetable..." />;
  }

  return (
    <div className="space-y-6">
      {/* Top Date Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-card border border-border p-3.5 rounded-md shadow-sm">
        <div className="flex items-center gap-2">
          <button
            className="w-8 h-8 rounded-sm border border-border flex items-center justify-center hover:bg-muted cursor-pointer"
            aria-label="Previous day"
            onClick={() => selectedIdx > 0 && setSelectedKey(days[selectedIdx - 1].key)}
            disabled={selectedIdx <= 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSelectedKey(todayKey)}
            className="text-sm font-semibold text-primary px-3 py-1 rounded-sm border border-primary/30 bg-secondary/50 cursor-pointer"
          >
            Today
          </button>
          <button
            className="w-8 h-8 rounded-sm border border-border flex items-center justify-center hover:bg-muted cursor-pointer"
            aria-label="Next day"
            onClick={() => selectedIdx < days.length - 1 && setSelectedKey(days[selectedIdx + 1].key)}
            disabled={selectedIdx >= days.length - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold ml-2">
            {days.length > 1
              ? `${longDateFromKey(days[0].key)} – ${longDateFromKey(days[days.length - 1].key)}`
              : longDateFromKey(todayKey)}
          </span>
        </div>

        <div className="flex bg-muted p-1 rounded-sm text-xs font-semibold">
          <button
            onClick={() => setActiveView("Week")}
            className={`px-3 py-1 rounded-sm transition cursor-pointer ${activeView === "Week" ? "bg-card shadow-sm text-foreground font-bold" : "text-muted-foreground"}`}
          >
            Week
          </button>
          <button
            onClick={() => setActiveView("Day")}
            className={`px-3 py-1 rounded-sm transition cursor-pointer ${activeView === "Day" ? "bg-card shadow-sm text-foreground font-bold" : "text-muted-foreground"}`}
          >
            Day
          </button>
        </div>
      </div>

      {/* Day Pills Bar */}
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
        {days.map((day) => (
          <button
            key={day.key}
            onClick={() => setSelectedKey(day.key)}
            className={`py-2.5 text-center text-sm font-semibold rounded-md transition cursor-pointer ${
              selectedDay === day.key
                ? "bg-primary text-white shadow-sm"
                : "bg-card border border-border text-foreground hover:bg-muted"
            }`}
          >
            {day.label}
          </button>
        ))}
      </div>

      {/* Holiday exception for the selected day (the recurring timetable is unchanged) */}
      {selectedHoliday && (
        <div className="bg-rose-50 border border-rose-200 rounded-md p-4 flex items-start gap-3 text-rose-900 shadow-sm">
          <PartyPopper className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-headings font-bold text-sm">School Holiday — {selectedHoliday.title}</div>
            <div className="text-xs mt-0.5">
              {selectedHoliday.isFullDayHoliday
                ? 'Regular classes are suspended for this day.'
                : `Classes between ${selectedHoliday.startTime} and ${selectedHoliday.endTime} (school time) are suspended.`}
              {selectedHoliday.description ? ` ${selectedHoliday.description}` : ''}
            </div>
          </div>
        </div>
      )}

      {/* Cards list for the selected day */}
      {currentLessons.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {currentLessons.map((lesson) => (
            <div
              key={lesson.id}
              className={`bg-card border-t-4 ${lesson.border || 'border-primary'} border-x border-b border-border rounded-md p-5 flex flex-col justify-between shadow-sm`}
            >
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-3">
                  <span>{lesson.time}</span>
                  <StatusChip status={selectedHoliday && lesson.status === 'CANCELLED' ? 'Holiday' : lesson.status} />
                </div>
                <div className="font-headings font-bold text-lg text-foreground mb-0.5">
                  {lesson.subject}
                </div>
                <div className="text-xs text-muted-foreground mb-4">
                  {lesson.teacher}
                </div>

                <div className="bg-muted/60 p-2.5 rounded-sm flex items-center gap-2 text-xs font-medium text-foreground mb-4">
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                  <span>{lesson.topic}</span>
                </div>
              </div>

              {lesson.joinableAt ? (
                <button
                  onClick={() => setActiveModalLesson(lesson)}
                  className="w-full bg-secondary hover:bg-secondary/80 text-primary py-2 text-xs font-bold rounded-sm transition text-center cursor-pointer"
                >
                  Joinable at {lesson.joinableAt}
                </button>
              ) : (
                <button
                  onClick={() => setActiveModalLesson(lesson)}
                  className="w-full bg-muted hover:bg-[#ffc53a] text-foreground py-2 text-xs font-bold rounded-sm transition text-center cursor-pointer"
                >
                  Details
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-md p-6 flex items-center gap-4 text-left shadow-sm">
          <div className="w-12 h-12 rounded-sm bg-muted flex items-center justify-center text-muted-foreground shrink-0">
            <Calendar className="w-6 h-6 stroke-[1.8]" />
          </div>
          <div>
            <div className="font-headings font-bold text-base text-foreground">
              {selectedLabel.split(" ")[0]} — {selectedHoliday ? `School Holiday: ${selectedHoliday.title}` : 'No classes scheduled'}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Use this day for revision, homework, and family time.
            </div>
          </div>
        </div>
      )}

      <ZoomMeetingModal
        isOpen={Boolean(activeModalLesson)}
        onClose={() => setActiveModalLesson(null)}
        lesson={activeModalLesson}
      />
    </div>
  );
}
