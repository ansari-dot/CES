import React from 'react';
import { Star, Award, Trophy, ScrollText, MessageSquareText } from 'lucide-react';
import { useChildData, useParent } from '../context/ParentContext';
import { RequireChild, LoadingBlock, ErrorBlock, EmptyBlock } from '../components/common';
import { formatDate } from '../lib/format';

interface AchievementRow {
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

function AchievementsContent() {
  const { selectedChild } = useParent();
  const { data, loading, error, reload } = useChildData<AchievementRow[]>((id) => `/api/v1/parents/me/children/${id}/achievements`);

  if (loading && !data) return <LoadingBlock message="Loading achievements…" />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  const items = data || [];
  const badges = items.filter((i) => (i.badgeType || '').toLowerCase() !== 'feedback');
  const feedback = items.filter((i) => (i.badgeType || '').toLowerCase() === 'feedback');
  const stars = items.reduce((s, i) => s + Number(i.starsCount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="bg-primary text-white rounded-lg p-6 flex items-center gap-4 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <Award className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="font-headings font-bold text-2xl">{stars} Stars · {badges.length} Badges</div>
          <div className="text-xs opacity-80 mt-0.5">Recognition earned by {selectedChild?.studentName}</div>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyBlock title="No achievements or feedback yet" description="Badges and comments shared by teachers will appear here." />
      ) : (
        <>
          {badges.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {badges.map((b) => {
                const style = BADGE_STYLES[(b.badgeType || 'star').toLowerCase()] || BADGE_STYLES.star;
                const Icon = style.icon;
                return (
                  <div key={b.id} className="bg-card border border-border rounded-md p-4 flex gap-3.5 items-center shadow-sm">
                    <div className={`w-11 h-11 rounded-sm flex items-center justify-center shrink-0 ${style.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-foreground">{b.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{b.reason}</div>
                      <div className="text-[11px] text-muted-foreground/80 mt-0.5">
                        {[b.subjectName, b.awardedByTeacher, formatDate(b.awardedAt)].filter(Boolean).join(' · ')}
                        {b.starsCount > 0 ? ` · +${b.starsCount} stars` : ''}
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
                    <p className="text-xs text-muted-foreground italic bg-muted/40 p-3 rounded-sm border-l-2 border-primary mt-2">“{f.reason}”</p>
                    <div className="text-[11px] text-muted-foreground/80 mt-1.5">{[f.awardedByTeacher, f.subjectName].filter(Boolean).join(' · ')}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function Achievements() {
  return (
    <RequireChild>
      <AchievementsContent />
    </RequireChild>
  );
}
