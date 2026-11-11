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
  Info,
  Radio,
  Clock,
  Layers,
  ArrowRight
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
  const liveCount = lessons.filter((l) => l.status === 'live').length;
  const totalEnrolled = assignedClasses.reduce((acc, c) => acc + (c.enrolledCount || 25), 0);

  return (
    <div className="flex flex-col w-full pb-12 space-y-5 animate-in fade-in duration-150">
      {/* ------------------------------------------------------------- */}
      {/* 1. HERO HEADER BANNER                                         */}
      {/* ------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#36348e]/10 border border-[#36348e]/20 flex items-center justify-center text-[#36348e] shrink-0 shadow-2xs">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold text-[#36348e] uppercase tracking-wider">
                  Virtual Campus
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500 font-semibold">Permanent Zoom Classrooms</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Live Lessons &amp; Zoom Hub
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Dedicated virtual video rooms for your assigned classes with instant single-click launch and host controls.
              </p>
            </div>
          </div>

          {/* Quick Host PIN Card */}
          <div className="flex items-center gap-3 bg-amber-50/80 hover:bg-amber-50 px-4 py-2.5 rounded-xl border border-amber-200/80 text-amber-950 shadow-2xs transition self-start md:self-auto">
            <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-amber-800 uppercase font-black tracking-wider block">
                Universal Host PIN
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-sm text-amber-950">884422</span>
                <button
                  type="button"
                  onClick={() => handleCopy('884422', 'Host Claim PIN')}
                  className="text-amber-700 hover:text-amber-900 text-xs transition cursor-pointer"
                  title="Copy PIN"
                >
                  {copiedKey === 'Host Claim PIN' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Subtle Decorative Background Element */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#36348e]/5 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. FOUR TOP WAVE KPI STAT CARDS                               */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Assigned Classrooms */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-indigo-100/80 hover:border-indigo-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-[#36348e] text-white shadow-sm shadow-indigo-900/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-indigo-50 text-[#36348e] border-indigo-100">
              Assigned
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-2xl sm:text-2xl xl:text-3xl font-black text-slate-900 tracking-tight">
              {assignedClasses.length}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">
              Permanent Classrooms
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(69, 67, 168, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#4543a8" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 2: Live Now */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-emerald-100/80 hover:border-emerald-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Radio className="w-5 h-5" />
            </div>
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
              liveCount > 0
                ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
            }`}>
              {liveCount > 0 ? 'Broadcasting' : 'Standby'}
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-2xl sm:text-2xl xl:text-3xl font-black text-slate-900 tracking-tight">
              {liveCount}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">
              Live Sessions Now
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(16, 185, 129, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#10b981" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 3: Total Enrolled */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-blue-100/80 hover:border-blue-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-blue-50 text-blue-700 border-blue-100">
              Active Roster
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-2xl sm:text-2xl xl:text-3xl font-black text-slate-900 tracking-tight">
              {totalEnrolled}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">
              Total Enrolled Students
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(59, 130, 246, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 4: Security Host Claim PIN */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-amber-100/80 hover:border-amber-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Shield className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-amber-50 text-amber-800 border-amber-200">
              Faculty Access
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-2xl sm:text-2xl xl:text-3xl font-mono font-black text-amber-950 tracking-tight">
              884422
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">
              Universal Host Claim PIN
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(245, 158, 11, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. ACTIVE LIVE BROADCAST BANNER (IF ANY CLASS IN PROGRESS)   */}
      {/* ------------------------------------------------------------- */}
      {activeLiveLesson && (
        <div className="relative overflow-hidden p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-[#36348e] text-white shadow-md border border-red-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner">
              <Video className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-red-100">
                  Broadcast in Progress
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-0.5">
                {activeLiveLesson.className} • {activeLiveLesson.subject}
              </h2>
              <p className="text-xs text-red-100/90 flex items-center gap-2 mt-0.5">
                <span>Room ID:</span>
                <span className="font-mono font-bold bg-black/20 px-2 py-0.5 rounded text-white">
                  {activeLiveLesson.zoomRoomId}
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={() =>
              handleLaunchRoom(
                activeLiveLesson.className,
                activeLiveLesson.zoomRoomId,
                activeLiveLesson.joinUrl,
                activeLiveLesson.zoomPasscode,
                activeLiveLesson.hostKey || '884422'
              )
            }
            className="px-6 py-3 bg-white text-[#36348e] hover:bg-slate-100 font-black text-xs sm:text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer active:scale-98 relative z-10"
          >
            <Video className="w-4 h-4 text-red-600" />
            <span>Re-Join Classroom</span>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. PERMANENT CLASSROOMS GRID                                  */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {assignedClasses.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs text-slate-500">
            <Video className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="font-bold text-base text-slate-800">No Classrooms Assigned</p>
            <p className="text-xs text-slate-400 mt-1">
              Contact Cambridge administration if your teaching schedule has not yet been assigned.
            </p>
          </div>
        ) : (
          assignedClasses.map((cls) => {
            const classLive = lessons.find(
              (l) => (l.className === cls.name || l.classId?.includes(String(cls.id))) && l.status === 'live'
            );
            const isLive = Boolean(classLive);
            const targetJoinUrl =
              classLive?.joinUrl ||
              cls.joinUrl ||
              `https://zoom.us/j/${cls.zoomRoomId.replace(/-/g, '')}?pwd=${cls.zoomPasscode}`;

            return (
              <div
                key={cls.id}
                className={`bg-white rounded-2xl p-5 sm:p-6 shadow-xs border transition-all duration-200 flex flex-col justify-between ${
                  isLive
                    ? 'border-red-400 ring-4 ring-red-100/60 shadow-md'
                    : 'border-slate-200/80 hover:border-indigo-300 hover:shadow-sm'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-3 py-1 rounded-xl bg-indigo-50 text-[#36348e] font-black text-xs border border-indigo-100/80">
                      {cls.name}
                    </span>
                    {isLive ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-red-700 bg-red-100 px-3 py-1 rounded-full border border-red-300">
                        <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                        Teaching Live
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Ready to Launch
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900">
                    {cls.subject || 'All Curriculum Subjects'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Assigned Grade Curriculum</p>

                  {/* Room Details Strip */}
                  <div className="mt-4 p-4 bg-slate-50/80 rounded-xl space-y-2.5 text-xs border border-slate-200/80">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Meeting ID:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{cls.zoomRoomId}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(cls.zoomRoomId, `${cls.name} Meeting ID`)}
                          className="text-slate-400 hover:text-slate-600 transition"
                          title="Copy Meeting ID"
                        >
                          {copiedKey === `${cls.name} Meeting ID` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Security Passcode:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {cls.zoomPasscode}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(cls.zoomPasscode, `${cls.name} Passcode`)}
                          className="text-slate-400 hover:text-slate-600 transition"
                          title="Copy Passcode"
                        >
                          {copiedKey === `${cls.name} Passcode` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Host Claim PIN:</span>
                      <span className="font-mono font-black text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-lg border border-amber-300">
                        {cls.hostKey || '884422'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Class Enrolment:</span>
                      <span className="font-bold text-slate-700">{cls.enrolledCount || 25} Students</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(targetJoinUrl, `${cls.name} Zoom Link`)}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
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
                      type="button"
                      onClick={() => dispatch(setCurrentTab('student-attendance'))}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Open attendance for this class"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-[#36348e]" />
                      <span>Roster</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleLaunchRoom(
                        cls.name,
                        cls.zoomRoomId,
                        targetJoinUrl,
                        cls.zoomPasscode,
                        cls.hostKey || '884422'
                      )
                    }
                    disabled={startingClassId === cls.zoomRoomId}
                    className={`px-4.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-xs transition-all cursor-pointer active:scale-98 ${
                      isLive
                        ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                        : 'bg-[#36348e] hover:bg-[#2c2a75] text-white shadow-indigo-100'
                    }`}
                  >
                    <Video className="w-4 h-4" />
                    <span>
                      {startingClassId === cls.zoomRoomId
                        ? 'Starting...'
                        : isLive
                        ? 'Re-Join Room'
                        : 'Start Class'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. CAMBRIDGE HOST INSTRUCTIONS GUIDANCE BOX                    */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-indigo-50/70 rounded-2xl p-4 sm:p-5 border border-indigo-100/90 flex items-start gap-3.5">
        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-[#36348e] flex items-center justify-center shrink-0">
          <Info className="w-4.5 h-4.5" />
        </div>
        <div className="text-xs text-indigo-950 space-y-1">
          <p className="font-extrabold text-sm text-[#36348e]">How to Claim Host Privileges in Zoom:</p>
          <p className="text-indigo-900 leading-relaxed">
            When you join your classroom meeting, click <strong>Participants</strong> in the bottom toolbar, select <strong>Claim Host</strong> at the bottom of the participants panel, and enter your 6-digit Host PIN (<span className="font-mono font-black text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">884422</span>) to activate screen sharing, recording, and breakout room permissions.
          </p>
        </div>
      </div>
    </div>
  );
};
