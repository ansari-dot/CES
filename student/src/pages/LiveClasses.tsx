import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Video, PhoneCall, PlayCircle, FileText, XCircle, Info } from 'lucide-react';
import { RootState } from '../store';
import StatusChip from '../components/common/StatusChip';
import ZoomMeetingModal from '../components/dialogs/ZoomMeetingModal';

export default function LiveClasses() {
  const nextClass = useSelector((state: RootState) => state.classes.nextClass);
  const recentlyCompleted = useSelector((state: RootState) => state.classes.recentlyCompleted);
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="space-y-6">
      {/* Live Now Card */}
      <div className="bg-card border-2 border-success rounded-md p-6 flex flex-col md:flex-row gap-5 items-start md:items-center shadow-sm">
        <div className="w-14 h-14 rounded-md bg-success-bg flex items-center justify-center shrink-0">
          <Video className="w-7 h-7 text-success" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <StatusChip status="LiveNow" />
            <span className="text-xs text-muted-foreground">
              Science · Mr. Usman Tariq · ends 11:15 AM
            </span>
          </div>
          <div className="font-headings font-bold text-xl text-foreground mt-1">
            Mathematics — Fractions &amp; Decimals
          </div>
          <div className="text-sm text-muted-foreground">
            Same Zoom link for all Grade 6-B lessons
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-success hover:bg-emerald-700 text-white text-sm font-bold px-7 py-3 rounded-sm flex items-center gap-2 transition w-full md:w-auto justify-center cursor-pointer shadow-sm"
        >
          <PhoneCall className="w-4 h-4" />
          <span>Join Now</span>
        </button>
      </div>

      {/* Today's Upcoming Section */}
      <div className="font-headings font-bold text-base text-foreground">
        Today's upcoming
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-md p-5 flex gap-4 items-center shadow-sm">
          <div className="w-12 h-12 rounded-sm bg-secondary flex flex-col items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary leading-none">12</span>
            <span className="text-[10px] text-primary">PM</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-foreground truncate">English — Essay Writing</div>
            <div className="text-xs text-muted-foreground">Ms. Ayesha Noor · 45 min</div>
          </div>
          <StatusChip status="Upcoming" />
        </div>

        <div className="bg-card border border-border rounded-md p-5 flex gap-4 items-center shadow-sm">
          <div className="w-12 h-12 rounded-sm bg-secondary flex flex-col items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary leading-none">02</span>
            <span className="text-[10px] text-primary">PM</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-foreground truncate">Science — Solar System</div>
            <div className="text-xs text-muted-foreground">Mr. Usman Tariq · 45 min</div>
          </div>
          <StatusChip status="Upcoming" />
        </div>
      </div>

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
