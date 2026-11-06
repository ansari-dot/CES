import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Star, Award, Trophy, ScrollText, MessageSquareText } from 'lucide-react';
import { RootState } from '../store';
import { requestApi } from '../services/api';
import { LoadingBlock } from '../components/common/LoadingBlock';

interface AchievementRecord {
  id: number;
  badgeType: string;
  title: string;
  reason: string;
  starsCount: number;
  subjectName: string | null;
  awardedByTeacher: string;
  awardedAt: string;
}

const BADGE_STYLES: Record<string, { icon: React.ElementType; color: string }> = {
  star: { icon: Star, color: 'bg-warning-bg text-warning' },
  medal: { icon: Award, color: 'bg-secondary text-primary' },
  trophy: { icon: Trophy, color: 'bg-amber-100 text-amber-700' },
  certificate: { icon: ScrollText, color: 'bg-emerald-100 text-emerald-700' },
  feedback: { icon: MessageSquareText, color: 'bg-sky-100 text-sky-700' },
};

const formatDate = (value: string) =>
  value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export default function Achievements() {
  const profile = useSelector((state: RootState) => state.student.profile);
  const [records, setRecords] = useState<AchievementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only published records for the signed-in student are returned by the server
    requestApi<AchievementRecord[]>('/api/v1/tasks/achievements')
      .then((data) => setRecords(Array.isArray(data) ? data : []))
      .catch((err: any) => setError(err.message || 'Failed to load achievements'))
      .finally(() => setLoading(false));
  }, []);

  const badges = records.filter((r) => (r.badgeType || '').toLowerCase() !== 'feedback');
  const feedback = records.filter((r) => (r.badgeType || '').toLowerCase() === 'feedback');
  const totalStars = records.reduce((sum, r) => sum + Number(r.starsCount || 0), 0);
  const firstName = (profile.name || 'Student').split(' ')[0];

  if (loading) {
    return <LoadingBlock message="Loading achievements..." />;
  }

  if (error) {
    return <div className="bg-card border border-border rounded-md p-10 text-center text-error text-sm">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-primary text-white rounded-lg p-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="font-headings font-bold text-2xl">
              {totalStars} Stars · {badges.length} Badges
            </div>
            <div className="text-xs opacity-80 mt-0.5">
              {records.length > 0
                ? `Keep it up, ${firstName}! Your teachers have recognised your work.`
                : `No awards yet, ${firstName}. Your teachers' recognition will appear here.`}
            </div>
          </div>
        </div>
        <div className="hidden sm:flex gap-1 text-white/80">
          <Star className="w-5 h-5 fill-white/80" />
          <Star className="w-5 h-5 fill-white/80" />
          <Star className="w-5 h-5 fill-white/80" />
        </div>
      </div>

      <div className="font-headings font-bold text-base text-foreground">Your badges</div>
      {badges.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-md p-8 text-center text-sm text-muted-foreground">
          You have not been awarded any badges yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {badges.map((badge) => {
            const style = BADGE_STYLES[(badge.badgeType || 'star').toLowerCase()] || BADGE_STYLES.star;
            const Icon = style.icon;
            return (
              <div key={badge.id} className="bg-card border border-border rounded-md p-4 flex gap-3.5 items-center shadow-sm">
                <div className={`w-11 h-11 rounded-sm flex items-center justify-center shrink-0 ${style.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-foreground">{badge.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{badge.reason}</div>
                  <div className="text-[11px] text-muted-foreground/80 mt-0.5">
                    {[badge.subjectName, badge.awardedByTeacher, formatDate(badge.awardedAt)].filter(Boolean).join(' · ')}
                    {badge.starsCount > 0 ? ` · +${badge.starsCount} stars` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {feedback.length > 0 && (
        <>
          <div className="font-headings font-bold text-base text-foreground">Teacher feedback</div>
          <div className="bg-card border border-border rounded-md divide-y divide-border shadow-sm">
            {feedback.map((f) => (
              <div key={f.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-bold text-foreground">{f.title}</div>
                  <div className="text-[11px] text-muted-foreground shrink-0">{formatDate(f.awardedAt)}</div>
                </div>
                <p className="text-xs text-muted-foreground italic bg-muted/40 p-3 rounded-sm border-l-2 border-primary mt-2">
                  “{f.reason}”
                </p>
                <div className="text-[11px] text-muted-foreground/80 mt-1.5">
                  {[f.awardedByTeacher, f.subjectName].filter(Boolean).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
