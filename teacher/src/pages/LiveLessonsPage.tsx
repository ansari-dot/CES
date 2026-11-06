import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { addToast, setCurrentTab } from '../store/slices/uiSlice';
import { requestApi } from '../services/api';
import {
  Video,
  Copy,
  UserCheck,
  Check,
  ExternalLink,
  Shield,
  KeyRound,
  Users,
  Sparkles,
  Info
} from 'lucide-react';

export const LiveLessonsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const assignedClasses = useAppSelector((state) => state.auth.teacher.assignedClasses);
  const lessons = useAppSelector((state) => state.timetable.lessons);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [startingClassId, setStartingClassId] = useState<string | null>(null);

  const handleLaunchRoom = async (
    className: string,
    roomId: string,
    customJoinUrl?: string,
    passcode?: string,
    hostKey: string = '884422'
  ) => {
    try {
      setStartingClassId(roomId);
      const data = await requestApi<any[]>('/api/v1/zoom/my-class-session');
      if (Array.isArray(data) && data.length > 0) {
        const activeLesson = data.find((l: any) => l.canStart);
        if (activeLesson) {
          const startData = await requestApi<any>(`/api/v1/zoom/sessions/${activeLesson.id}/start`, {
            method: 'POST'
          });
          const activeHostKey = startData?.hostKey || hostKey;
          if (startData?.joinUrl) {
            window.open(startData.joinUrl, '_blank');
            dispatch(
              addToast({
                message: `Classroom launched. In Zoom, click Participants ➔ Claim Host with PIN: ${activeHostKey}`,
                type: 'success'
              })
            );
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Backend live session start call fell back to direct link:', e);
    } finally {
      setStartingClassId(null);
    }

    const targetUrl = customJoinUrl || (passcode ? `https://zoom.us/j/${roomId.replace(/-/g, '')}?pwd=${passcode}` : `https://zoom.us/j/${roomId.replace(/-/g, '')}`);
    window.open(targetUrl, '_blank');
    dispatch(
      addToast({
        message: `Launching Zoom room for ${className}. Claim Host PIN: ${hostKey}`,
        type: 'success',
      })
    );
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(label);
    dispatch(addToast({ message: `Copied ${label} to clipboard!`, type: 'info' }));
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const activeLiveLesson = lessons.find((l) => l.status === 'live');

  return (
    <div className="flex flex-col w-full pb-10 space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
              Virtual Campus
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">Permanent Zoom Rooms</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Live Classrooms &amp; Zoom
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Each grade has its own permanent virtual classroom. Launch your class with one click.
          </p>
        </div>

        {/* Universal Host PIN Badge */}
        <div className="flex items-center gap-2 bg-amber-50 px-3.5 py-2 rounded-xl border border-amber-200 text-amber-900 shadow-xs self-start sm:self-auto">
          <KeyRound className="w-4 h-4 text-amber-700" />
          <div className="text-xs">
            <span className="text-[10px] text-amber-700 uppercase font-bold block">Host Claim PIN</span>
            <span className="font-mono font-black text-sm text-amber-950">884422</span>
          </div>
        </div>
      </div>

      {/* 2. Active Session Banner (if live right now) */}
      {activeLiveLesson && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-600 to-indigo-700 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Video className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-200">Class in Progress</span>
              </div>
              <h2 className="text-base font-bold text-white mt-0.5">
                {activeLiveLesson.className} • {activeLiveLesson.subject}
              </h2>
              <p className="text-xs text-indigo-100">
                Meeting ID: <span className="font-mono font-bold">{activeLiveLesson.zoomRoomId}</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => handleLaunchRoom(activeLiveLesson.className, activeLiveLesson.zoomRoomId, activeLiveLesson.joinUrl, activeLiveLesson.zoomPasscode, activeLiveLesson.hostKey || '884422')}
            className="px-5 py-2.5 bg-white text-indigo-900 hover:bg-slate-100 font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 shrink-0"
          >
            <Video className="w-4 h-4 text-indigo-600" />
            <span>Re-Join Classroom</span>
          </button>
        </div>
      )}

      {/* 3. Classrooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {assignedClasses.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs text-slate-500">
            <Video className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="font-bold text-sm text-slate-800">No Classrooms Assigned</p>
            <p className="text-xs text-slate-400 mt-1">Contact administration if your teaching schedule has not been assigned.</p>
          </div>
        ) : (
          assignedClasses.map((cls) => {
            const classLive = lessons.find(
              (l) => (l.className === cls.name || l.classId?.includes(String(cls.id))) && l.status === 'live'
            );
            const isLive = Boolean(classLive);
            const targetJoinUrl = classLive?.joinUrl || cls.joinUrl || `https://zoom.us/j/${cls.zoomRoomId.replace(/-/g, '')}?pwd=${cls.zoomPasscode}`;

            return (
              <div
                key={cls.id}
                className={`bg-white rounded-2xl p-5 shadow-xs border transition-all flex flex-col justify-between ${
                  isLive ? 'border-red-400 ring-2 ring-red-100 shadow-md' : 'border-slate-200 hover:border-indigo-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-3 py-1 rounded-xl bg-indigo-50 text-indigo-800 font-extrabold text-xs border border-indigo-100">
                      {cls.name}
                    </span>
                    {isLive ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-100 px-2.5 py-0.5 rounded-full border border-red-300">
                        <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                        Teaching Live
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Ready to Start
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{cls.subject || 'All Subjects'}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Assigned Grade Curriculum</p>

                  {/* Room Details Strip */}
                  <div className="mt-4 p-3.5 bg-slate-50 rounded-xl space-y-2 text-xs border border-slate-200/80">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Meeting ID:</span>
                      <span className="font-mono font-bold text-slate-900">{cls.zoomRoomId}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Security Passcode:</span>
                      <span className="font-mono font-bold text-indigo-700">{cls.zoomPasscode}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Host Claim PIN:</span>
                      <span className="font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                        {cls.hostKey || '884422'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Class Enrolment:</span>
                      <span className="font-semibold text-slate-700">{cls.enrolledCount || 25} Students</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopy(targetJoinUrl, `${cls.name} Zoom Link`)}
                      className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Copy classroom join link"
                    >
                      {copiedKey === `${cls.name} Zoom Link` ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Link</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => dispatch(setCurrentTab('student-attendance'))}
                      className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Open attendance for this class"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Attendance</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleLaunchRoom(cls.name, cls.zoomRoomId, targetJoinUrl, cls.zoomPasscode, cls.hostKey || '884422')}
                    disabled={startingClassId === cls.zoomRoomId}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all ${
                      isLive
                        ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    <Video className="w-4 h-4" />
                    <span>{startingClassId === cls.zoomRoomId ? 'Starting...' : isLive ? 'Re-Join Room' : 'Start Class'}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Simple Host Instructions Box */}
      <div className="bg-indigo-50/70 rounded-2xl p-4 border border-indigo-100 flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-950 space-y-1">
          <p className="font-bold">How to claim Host in Zoom:</p>
          <p className="text-indigo-800">
            When you join your classroom, open the <strong>Participants</strong> list in Zoom, click <strong>Claim Host</strong> at the bottom, and enter your 6-digit Host PIN (<span className="font-mono font-bold">884422</span>).
          </p>
        </div>
      </div>
    </div>
  );
};
