import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck, ClipboardList, TrendingUp, Receipt,
  Video, User, Info, CheckCircle2, Star, Award,
} from 'lucide-react';
import { RootState, AppDispatch } from '../store';
import StatusChip from '../components/common/StatusChip';
import MetricCard from '../components/common/MetricCard';
import ZoomMeetingModal from '../components/dialogs/ZoomMeetingModal';
import { joinLesson } from '../store/slices/classesSlice';
import { setToast } from '../store/slices/studentSlice';

export default function Dashboard() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const nextClass = useSelector((state: RootState) => state.classes.nextClass);
  const todayClasses = useSelector((state: RootState) => state.classes.todayClasses);
  const { profile, dashboard, dashboardLoading } = useSelector((state: RootState) => state.student);
  const [showZoomModal, setShowZoomModal] = useState(false);

  const attendanceRate = dashboard?.attendanceRate ?? 0;
  const outstandingFee = dashboard?.totalOutstandingFee ?? 0;
  const pendingTasks = (dashboard?.tasks ?? []).filter((t: any) => t.submissionStatus === 'PENDING').length;

  const handleJoinClass = async () => {
    if (nextClass.lessonId) {
      const result = await dispatch(joinLesson(nextClass.lessonId));
      if (joinLesson.rejected.match(result)) {
        dispatch(setToast(String(result.payload) || 'Unable to join class right now.'));
        return;
      }
    }
    setShowZoomModal(true);
  };

  if (dashboardLoading && !dashboard) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Loading dashboard…
      </div>
    );
  }

  // A fee/account restriction is rendered by PortalLayout (RestrictedNotice)

  const dueSoonTasks = (dashboard?.tasks ?? []).slice(0, 3);
  const recentAchievements = (dashboard?.achievements ?? []).slice(0, 3);

  return (
    <>
      {/* Next Class Hero Card */}
      <div className="bg-navy text-white rounded-lg p-6 flex gap-6 items-center relative overflow-hidden shadow-sm">
        <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-primary opacity-30 pointer-events-none" />
        <div className="absolute right-24 bottom-0 w-32 h-32 rounded-full bg-primary opacity-20 pointer-events-none" />
        <div className="flex-1 relative z-10">
          <div className="flex items-center gap-2">
            <StatusChip status={nextClass.isLiveNow ? 'LiveNow' : 'Upcoming'} />
            <span className="text-xs opacity-70">
              {nextClass.time ? `Starts in ${nextClass.startsInMinutes} min · ${nextClass.time}` : 'No upcoming class today'}
            </span>
          </div>
          <div className="font-headings font-bold text-2xl mt-2">
            {nextClass.subject
              ? `Next: ${nextClass.subject}${nextClass.topic ? ` — ${nextClass.topic}` : ''}`
              : 'No class scheduled'}
          </div>
          {nextClass.teacher && (
            <div className="text-sm opacity-80 mt-1 flex items-center gap-2">
              <User className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{nextClass.teacher} · {nextClass.duration}</span>
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleJoinClass}
              disabled={!nextClass.subject}
              className="bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-sm flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              type="button"
            >
              <Video className="w-4 h-4 stroke-[2.5]" />
              <span>Join Class</span>
            </button>
            <button
              onClick={() => navigate('/student/timetable')}
              className="text-sm font-medium px-4 py-2.5 rounded-sm border border-white/30 hover:bg-white/10 transition cursor-pointer"
              type="button"
            >
              View timetable
            </button>
          </div>
          <div className="text-xs opacity-60 mt-2 flex items-center gap-1">
            <Info className="w-3 h-3 stroke-[2.5]" />
            <span>Join button activates 10 min before start</span>
          </div>
        </div>
        <div className="hidden md:flex flex-col items-center bg-white/10 rounded-md px-6 py-4 relative z-10 backdrop-blur-xs">
          <span className="text-3xl font-headings font-bold">
            {String(nextClass.startsInMinutes).padStart(2, '0')}:00
          </span>
          <span className="text-xs opacity-70">min to start</span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={CalendarCheck} title="Attendance" value={`${attendanceRate}%`} subtitle="Session total" colorScheme="success" />
        <MetricCard icon={ClipboardList} title="Pending Tasks" value={String(pendingTasks)} subtitle="Active assignments" colorScheme="warning" />
        <MetricCard icon={TrendingUp} title="Stars Earned" value={String(profile.stars)} subtitle={`${profile.badges} badges`} colorScheme="secondary" />
        <MetricCard
          icon={Receipt}
          title="Outstanding Fees"
          value={outstandingFee > 0 ? `Rs. ${outstandingFee.toLocaleString('en-PK')}` : 'Paid'}
          subtitle={outstandingFee > 0 ? 'Pending payment' : 'All clear'}
          colorScheme={outstandingFee > 0 ? 'error' : 'success'}
        />
      </div>

      {/* Today's Timetable & Due Soon */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-md p-5 shadow-sm">
          <div className="flex items-center">
            <span className="font-headings font-bold text-base text-foreground">Today's Timetable</span>
            <button onClick={() => navigate('/student/timetable')} className="ml-auto text-sm text-primary font-semibold hover:underline cursor-pointer">
              Full week
            </button>
          </div>
          <div className="mt-2 divide-y divide-border">
            {todayClasses.length === 0 ? (
              <div className="py-4 text-sm text-muted-foreground">No classes scheduled for today.</div>
            ) : (
              todayClasses.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-3">
                  <div className={`w-1 self-stretch rounded-full ${item.joinable ? 'bg-primary' : 'bg-border'}`} />
                  <div className="text-xs font-semibold text-muted-foreground w-16">{item.time}</div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-foreground">{item.subject}</div>
                    <div className="text-xs text-muted-foreground">{item.teacher} · {item.duration}</div>
                  </div>
                  <StatusChip status={item.status} />
                  {item.joinable && (
                    <button onClick={handleJoinClass} className="text-xs font-semibold bg-muted hover:bg-primary hover:text-white text-muted-foreground px-3 py-1.5 rounded-sm transition cursor-pointer">
                      Join
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-md p-5 shadow-sm flex flex-col">
          <div className="flex items-center">
            <span className="font-headings font-bold text-base text-foreground">Due Soon</span>
            <button onClick={() => navigate('/student/homework')} className="ml-auto text-sm text-primary font-semibold hover:underline cursor-pointer">
              View all
            </button>
          </div>
          <div className="flex flex-col gap-3 mt-3 flex-1">
            {dueSoonTasks.length === 0 ? (
              <div className="text-sm text-muted-foreground">No pending tasks.</div>
            ) : (
              dueSoonTasks.map((t: any) => (
                <div key={t.id} className={`border border-border rounded-sm p-3 ${t.submissionStatus === 'PENDING' ? 'bg-warning-bg/50' : ''}`}>
                  <div className="text-sm font-semibold text-foreground">{t.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t.subjectName} · {t.maxMarks} marks</div>
                  {t.submissionStatus === 'GRADED' ? (
                    <div className="text-xs text-success font-semibold flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Graded {t.marksAwarded != null ? `(${t.marksAwarded}/${t.maxMarks})` : ''}
                    </div>
                  ) : t.submissionStatus === 'SUBMITTED' ? (
                    <div className="text-xs text-info font-semibold flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Submitted (Awaiting Grade)
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Stars, Achievements, Fee */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-md p-5 shadow-sm">
          <div className="font-headings font-bold text-sm text-foreground">Stars &amp; Badges</div>
          <div className="flex gap-2 mt-3">
            <div className="flex-1 bg-warning-bg rounded-sm py-2.5 flex flex-col items-center">
              <Star className="w-5 h-5 text-warning stroke-[2.4]" />
              <span className="text-xs font-bold text-foreground mt-1">{profile.stars}</span>
              <span className="text-[11px] text-muted-foreground">Stars</span>
            </div>
            <div className="flex-1 bg-secondary rounded-sm py-2.5 flex flex-col items-center">
              <Award className="w-5 h-5 text-primary stroke-[2.4]" />
              <span className="text-xs font-bold text-foreground mt-1">{profile.badges}</span>
              <span className="text-[11px] text-muted-foreground">Badges</span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-md p-5 shadow-sm">
          <div className="font-headings font-bold text-base text-foreground mb-3">Recent Achievements</div>
          <div className="flex flex-col gap-2.5">
            {recentAchievements.length === 0 ? (
              <div className="text-xs text-muted-foreground">No achievements yet.</div>
            ) : (
              recentAchievements.map((a: any) => (
                <div key={a.id} className="flex gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-foreground">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{a.reason}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-md p-5 shadow-sm flex items-center gap-3">
          <div>
            <div className="font-headings font-bold text-sm text-foreground">
              {outstandingFee > 0 ? `Rs. ${outstandingFee.toLocaleString('en-PK')} due` : 'Fees up to date'}
            </div>
            <div className="text-xs text-muted-foreground">
              {outstandingFee > 0 ? 'Outstanding balance' : 'No pending dues'}
            </div>
          </div>
          <button
            onClick={() => navigate('/student/fees')}
            className="ml-auto text-sm font-semibold bg-primary hover:bg-primary-hover text-primary-foreground px-4 py-2 rounded-sm transition cursor-pointer"
          >
            View Fees
          </button>
        </div>
      </div>

      <ZoomMeetingModal isOpen={showZoomModal} onClose={() => setShowZoomModal(false)} lesson={nextClass} />
    </>
  );
}
