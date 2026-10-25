import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Modal from '../common/Modal';
import { Video, ExternalLink, ShieldCheck, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { RootState, AppDispatch } from '../../store';
import { NextClass, TodayClass, TimetableLesson, joinLesson } from '../../store/slices/classesSlice';

interface ZoomMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: NextClass | TodayClass | TimetableLesson | null;
}

export default function ZoomMeetingModal({ isOpen, onClose, lesson }: ZoomMeetingModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const zoomSession = useSelector((state: RootState) => state.classes.zoomSession);
  const profile = useSelector((state: RootState) => state.student.profile);

  if (!lesson) return null;

  const subject = lesson.subject || "Live Classroom Session";
  const topic = lesson.topic || "Core Curriculum & Interactive Exercises";
  const teacher = lesson.teacher || "Assigned Faculty";

  const zoomLink = ('zoomLink' in lesson && lesson.zoomLink)
    ? lesson.zoomLink
    : ('joinUrl' in lesson && (lesson as any).joinUrl)
    ? (lesson as any).joinUrl
    : zoomSession?.joinUrl || null;

  const passcode = ('passcode' in lesson && (lesson as any).passcode)
    ? (lesson as any).passcode
    : zoomSession?.passcode || 'Contact School';

  let meetingId = ('meetingId' in lesson && (lesson as any).meetingId)
    ? (lesson as any).meetingId
    : zoomSession?.meetingId || null;

  if (!meetingId && zoomLink) {
    const match = zoomLink.match(/zoom\.us\/j\/(\d+)/);
    if (match) meetingId = match[1];
  }

  const sessionState = ('sessionState' in lesson && (lesson as any).sessionState)
    ? (lesson as any).sessionState
    : zoomSession?.sessionState || 'LIVE';

  const statusMessage = ('statusMessage' in lesson && (lesson as any).statusMessage)
    ? (lesson as any).statusMessage
    : zoomSession?.statusMessage;

  const className = ('className' in lesson && (lesson as any).className)
    ? (lesson as any).className
    : ('grade' in lesson && (lesson as any).grade)
    ? (lesson as any).grade
    : profile?.grade || '';

  const modalTitle = className ? `Join ${className} Live Classroom` : 'Join Live Classroom';

  let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let badgeIcon = <CheckCircle className="w-3.5 h-3.5 mr-1" />;
  let badgeText = 'Teacher is Live in Classroom';

  if (sessionState === 'AWAITING_TEACHER') {
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
    badgeIcon = <Clock className="w-3.5 h-3.5 mr-1" />;
    badgeText = 'Waiting for Teacher to Join Room';
  } else if (sessionState === 'TEACHER_ABSENT') {
    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
    badgeIcon = <AlertCircle className="w-3.5 h-3.5 mr-1" />;
    badgeText = 'Teacher Delayed · Principal Notified';
  } else if (sessionState === 'STARTING_SOON') {
    badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
    badgeIcon = <Clock className="w-3.5 h-3.5 mr-1" />;
    badgeText = 'Class Starting Soon';
  }

  const handleLaunch = () => {
    if (lesson.lessonId) {
      dispatch(joinLesson(lesson.lessonId));
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <div className="flex flex-col items-center text-center py-2">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
          <Video className="w-8 h-8" />
        </div>
        <div className={`text-xs font-semibold px-3 py-1 rounded-full border mb-2 flex items-center ${badgeColor}`}>
          {badgeIcon}
          {badgeText}
        </div>
        <h4 className="text-xl font-bold font-headings text-foreground mb-1">{subject}</h4>
        <p className="text-sm text-muted-foreground mb-2">{topic} · {teacher}</p>

        {statusMessage && (
          <p className="text-xs text-muted-foreground/80 mb-4 max-w-sm">
            {statusMessage}
          </p>
        )}

        <div className="w-full bg-muted/60 p-4 rounded-md border border-border text-left mb-6 space-y-2 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span className="font-semibold text-foreground">Persistent Meeting ID:</span>
            <span className="font-mono font-bold text-foreground">{meetingId || 'Shared Class Room'}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-foreground">Room Passcode:</span>
            <span className="font-mono font-bold text-foreground">{passcode}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-foreground">Classroom:</span>
            <span>{className || 'Assigned Class'}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          {zoomLink ? (
            <a
              href={zoomLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleLaunch}
              className="w-full bg-success text-white py-3 rounded-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition cursor-pointer shadow-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Launch Zoom in New Tab
            </a>
          ) : (
            <div className="w-full bg-muted text-muted-foreground py-3 rounded-sm font-bold flex items-center justify-center gap-2 text-sm">
              Link available 10 min before class
            </div>
          )}
          <button
            onClick={onClose}
            className="w-full py-2.5 text-xs text-muted-foreground hover:text-foreground font-medium cursor-pointer"
          >
            Stay in Portal
          </button>
        </div>

        <div className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-success" />
          <span>Verified online school Zoom classroom session</span>
        </div>
      </div>
    </Modal>
  );
}
