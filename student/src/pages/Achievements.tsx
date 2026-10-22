import React from 'react';
import { Star, Zap, BookOpen, Users, Edit3, Award, Lock } from 'lucide-react';

export default function Achievements() {
  const earnedBadges = [
    { title: "Maths Star", desc: "Scored 90%+ in 3 quizzes", date: "18 Oct", icon: Star, color: "bg-warning-bg text-warning" },
    { title: "Fast Finisher", desc: "Submitted 5 tasks early", date: "12 Oct", icon: Zap, color: "bg-secondary text-primary" },
    { title: "Book Buddy", desc: "Read 4 library books", date: "05 Oct", icon: BookOpen, color: "bg-emerald-100 text-emerald-700" },
    { title: "Team Helper", desc: "Helped in group project", date: "28 Sep", icon: Users, color: "bg-sky-100 text-sky-700" },
    { title: "Neat Writer", desc: "Best handwriting week", date: "20 Sep", icon: Edit3, color: "bg-teal-100 text-teal-700" },
    { title: "Attendance Hero", desc: "Full month present", date: "30 Sep", icon: Award, color: "bg-amber-100 text-amber-700" },
  ];

  const lockedBadges = [
    { title: "Gold Club — 15 stars", desc: "Locked · earn 3 more stars" },
    { title: "Science Explorer", desc: "Locked · finish Solar project" },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-primary text-white rounded-lg p-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="font-headings font-bold text-2xl">12 Stars · 5 Badges</div>
            <div className="text-xs opacity-80 mt-0.5">Keep it up, Ahmed! 3 more stars to Gold Club.</div>
          </div>
        </div>
        <div className="hidden sm:flex gap-1 text-white/80">
          <Star className="w-5 h-5 fill-white/80" />
          <Star className="w-5 h-5 fill-white/80" />
          <Star className="w-5 h-5 fill-white/80" />
        </div>
      </div>

      <div className="font-headings font-bold text-base text-foreground">Your badges</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {earnedBadges.map((badge, idx) => {
          const Icon = badge.icon;
          return (
            <div key={idx} className="bg-card border border-border rounded-md p-4 flex gap-3.5 items-center shadow-sm">
              <div className={`w-11 h-11 rounded-sm flex items-center justify-center shrink-0 ${badge.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">{badge.title}</div>
                <div className="text-xs text-muted-foreground">{badge.desc}</div>
                <div className="text-[11px] text-muted-foreground/80 mt-0.5">{badge.date}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {lockedBadges.map((locked, idx) => (
          <div key={idx} className="bg-card border border-dashed border-border rounded-md p-4 flex gap-3.5 items-center opacity-70">
            <div className="w-11 h-11 rounded-sm bg-muted flex items-center justify-center text-muted-foreground shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">{locked.title}</div>
              <div className="text-xs text-muted-foreground">{locked.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
