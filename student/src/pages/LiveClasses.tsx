import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Video, PhoneCall, PlayCircle, FileText, XCircle, Info } from 'lucide-react';
import { RootState } from '../store';
import StatusChip from '../components/common/StatusChip';
import ZoomMeetingModal from '../components/dialogs/ZoomMeetingModal';

export default function LiveClasses() {
  const nextClass = useSelector((state: RootState) => state.classes.nextClass);
  const todayClasses = useSelector((state: RootState) => state.classes.todayClasses);
  const recentlyCompleted = useSelector((state: RootState) => state.classes.recentlyCompleted);
  const profile = useSelector((state: RootState) => state.student.profile);
  const [showModal, setShowModal] = useState(false);

  const upcomingClasses = todayClasses.filter((c) => c.status !== 'Completed');
  const classLabel = profile?.grade || nextClass.className || nextClass.grade || 'Classroom';

  return (
    <div className="space-y-6">
      {/* Live / Current Class Card */}
      <div className="bg-card border-2 border-success rounded-md p-6 flex flex-col md:flex-row gap-5 items-start md:items-center shadow-sm">
        <div className="w-14 h-14 rounded-md bg-success-bg flex items-center justify-center shrink-0">
          <Video className="w-7 h-7 text-success" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <StatusChip status={nextClass.isLiveNow ? "LiveNow" : "Upcoming"} />
            <span className="text-xs text-muted-foreground">
              {nextClass.teacher ? `${nextClass.teacher} · ` : ''}
              {nextClass.timeEnd ? `scheduled until ${nextClass.timeEnd}` : nextClass.time || 'Next class'}
            </span>
          </div>
          <div className="font-headings font-bold text-xl text-foreground mt-1">
            {nextClass.subject ? `${nextClass.subject}${nextClass.topic ? ` — ${nextClass.topic}` : ''}` : 'Scheduled Class Session'}
          </div>
          <div className="text-sm text-muted-foreground">
            Same persistent Zoom room for all {classLabel} lessons
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-success hover:bg-emerald-700 text-white text-sm font-bold px-7 py-3 rounded-sm flex items-center gap-2 transition w-full md:w-auto justify-center cursor-pointer shadow-sm"
        >
          <PhoneCall className="w-4 h-4" />
          <span>{nextClass.isLiveNow ? 'Join Now' : 'Class Details'}</span>
        </button>
      </div>

      {/* Today's Upcoming Section */}
      <div className="font-headings font-bold text-base text-foreground">
        Today's upcoming
      </div>
      {upcomingClasses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {upcomingClasses.map((cls) => {
            const timeParts = cls.time.split(' ');
            const timeDigits = timeParts[0] || '09:00';
            const ampm = timeParts[1] || '';
            return (
              <div key={cls.id} className="bg-card border border-border rounded-md p-5 flex gap-4 items-center shadow-sm">
                <div className="w-12 h-12 rounded-sm bg-secondary flex flex-col items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary leading-none">{timeDigits.split(':')[0]}</span>
                  <span className="text-[10px] text-primary">{ampm || 'AM'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-foreground truncate">{cls.subject} {cls.topic ? `— ${cls.topic}` : ''}</div>
                  <div className="text-xs text-muted-foreground">{cls.teacher} · {cls.duration}</div>
                </div>
                <StatusChip status={cls.status === 'Live' ? 'LiveNow' : 'Upcoming'} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-md p-6 text-center text-sm text-muted-foreground">
          No remaining classes scheduled for today. Check your full timetable for the week.
        </div>
      )}

      {/* Recently Completed Section */}
      <div className="font-headings font-bold text-base text-foreground">
        Recently completed
      </div>
      <div className="bg-card border border-border rounded-md divide-y divide-border shadow-sm">
        {recentlyCompleted.map((lesson) => (
          <div key={lesson.id} className="flex items-center gap-3 px-5 py-3.5">
            <div className="w-9 h-9 rounded-sm bg-muted flex items-center justify-center shrink-0">
              {lesson.status === 'Cancelled' ? (
                <XCircle className="w-4 h-4 text-muted-foreground" />
              ) : (
                <PlayCircle className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">
                {lesson.subject} — {lesson.topic}
              </div>
              <div className="text-xs text-muted-foreground">
                {lesson.teacher} · {lesson.time} {lesson.status === 'Cancelled' && '· Cancelled'}
              </div>
            </div>
            {lesson.hasNotes ? (
              <button className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer">
                <FileText className="w-3.5 h-3.5" />
                <span>Notes</span>
              </button>
            ) : (
              <StatusChip status={lesson.status} />
            )}
          </div>
        ))}
      </div>

      {/* Help Link Note */}
      <div className="bg-info-bg border border-info/20 rounded-md px-5 py-3.5 text-sm text-info flex items-center gap-2">
        <Info className="w-4 h-4 shrink-0" />
        <span>Link unavailable? “Your class link is temporarily unavailable. Please contact the school.”</span>
      </div>

      <ZoomMeetingModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        lesson={nextClass}
      />
    </div>
  );
}
