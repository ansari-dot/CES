import React from 'react';
import Modal from '../common/Modal';
import { Video, ExternalLink, ShieldCheck } from 'lucide-react';
import { NextClass, TodayClass, TimetableLesson } from '../../store/slices/classesSlice';

interface ZoomMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: NextClass | TodayClass | TimetableLesson | null;
}

export default function ZoomMeetingModal({ isOpen, onClose, lesson }: ZoomMeetingModalProps) {
  if (!lesson) return null;

  const subject = lesson.subject || "Mathematics";
  const topic = lesson.topic || "Fractions & Decimals";
  const teacher = lesson.teacher || "Mr. Hamza Khan";
  const zoomLink = ('zoomLink' in lesson && lesson.zoomLink) ? lesson.zoomLink
    : ('joinUrl' in lesson && lesson.joinUrl) ? (lesson as any).joinUrl
    : null;
  const passcode = ('passcode' in lesson && (lesson as any).passcode) ? (lesson as any).passcode : 'Noor2026';
  const meetingId = zoomLink ? zoomLink.replace(/.*zoom\.us\/j\//, '').split('?')[0] : '892 4410 2091';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Join Grade 6-B Live Classroom">
      <div className="flex flex-col items-center text-center py-2">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
          <Video className="w-8 h-8" />
        </div>
        <div className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 mb-2">
          Class is in session
        </div>
        <h4 className="text-xl font-bold font-headings text-foreground mb-1">{subject}</h4>
        <p className="text-sm text-muted-foreground mb-4">{topic} · {teacher}</p>

        <div className="w-full bg-muted/60 p-4 rounded-md border border-border text-left mb-6 space-y-2 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span className="font-semibold text-foreground">Meeting ID:</span>
            <span className="font-mono">{meetingId}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-foreground">Passcode:</span>
            <span className="font-mono">{passcode}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-foreground">Student:</span>
            <span>{subject} class</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          {zoomLink ? (
            <a
              href={zoomLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
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
