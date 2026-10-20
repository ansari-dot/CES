import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { awardAchievement } from '../store/slices/performanceSlice';
import { addToast } from '../store/slices/uiSlice';
import { AchievementItem } from '../types';

export const AchievementsFeedbackPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const achievements = useAppSelector((state) => state.performance.achievements);
  const metrics = useAppSelector((state) => state.performance.metrics);

  const [studentId, setStudentId] = useState(metrics[0]?.studentId || '');
  const [badgeType, setBadgeType] = useState<'star' | 'medal' | 'trophy' | 'certificate'>('star');
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [starsCount, setStarsCount] = useState<number>(3);

  const handleAward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !reason.trim()) return;

    const student = metrics.find((m) => m.studentId === studentId);

    const newAch: AchievementItem = {
      id: `ACH-${Date.now().toString().slice(-4)}`,
      studentId: student ? student.studentId : studentId,
      studentName: student ? student.name : 'Student',
      classId: student ? student.classId : '',
      className: student ? student.className : '',
      badgeType,
      title,
      reason,
      awardedDate: 'Today',
      starsCount,
    };

    dispatch(awardAchievement(newAch));
    dispatch(
      addToast({
        message: `Awarded "${title}" to ${newAch.studentName} with ${starsCount} stars!`,
        type: 'success',
      })
    );

    setTitle('');
    setReason('');
  };

  return (
    <div className="flex flex-col w-full pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold text-[#684000] uppercase tracking-wider">
              Student Recognition
            </span>
            <span className="text-[#c7c4d8]">•</span>
            <span className="text-xs text-[#464555]">SRS Section 12</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#121c2a] tracking-tight">
            Achievements, Stars &amp; Feedback
          </h1>
          <p className="text-xs sm:text-sm text-[#464555] mt-0.5">
            Motivate students with verified digital stars, subject mastery badges, and positive reinforcement
            feedback logged directly to student portals.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Award Form (5 cols) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
            <span className="material-symbols-outlined text-[#684000] text-[22px]">
              military_tech
            </span>
            <h3 className="text-base font-bold text-[#121c2a]">Award Student Honor</h3>
          </div>

          <form onSubmit={handleAward} className="space-y-4 text-xs sm:text-sm">
            <div>
              <label className="block text-xs font-semibold text-[#121c2a] mb-1">
                Recipient Student
              </label>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full h-10 px-3 bg-[#eff4ff] border border-indigo-100/60 rounded-lg text-[#121c2a] focus:outline-none"
              >
                {metrics.length === 0 ? (
                  <option value="" disabled>No students enrolled</option>
                ) : (
                  metrics.map((m) => (
                    <option key={m.studentId} value={m.studentId}>
                      {m.name} ({m.className} • Roll {m.rollNumber})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#121c2a] mb-1">Badge Type</label>
                <select
                  value={badgeType}
                  onChange={(e) => setBadgeType(e.target.value as any)}
                  className="w-full h-10 px-3 bg-[#eff4ff] border border-indigo-100/60 rounded-lg text-[#121c2a] focus:outline-none"
                >
                  <option value="star">⭐ Golden Star</option>
                  <option value="medal">🏅 Academic Medal</option>
                  <option value="trophy">🏆 Class Trophy</option>
                  <option value="certificate">📜 Certificate of Merit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#121c2a] mb-1">
                  Stars Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={starsCount}
                  onChange={(e) => setStarsCount(Number(e.target.value))}
                  className="w-full h-10 px-3 bg-[#eff4ff] border border-indigo-100/60 rounded-lg text-[#121c2a] font-bold focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#121c2a] mb-1">
                Achievement Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Master of Reciprocal Fraction Logic"
                className="w-full h-10 px-3 bg-[#eff4ff] border border-indigo-100/60 rounded-lg text-[#121c2a] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#121c2a] mb-1">
                Commendation Reason
              </label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe how the student demonstrated excellence, helpfulness, or diligence..."
                className="w-full p-2.5 bg-[#eff4ff] border border-indigo-100/60 rounded-lg text-[#121c2a] focus:outline-none"
              ></textarea>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#3525cd] hover:bg-[#4f46e5] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-98"
            >
              <span className="material-symbols-outlined text-[18px]">verified</span>
              Award &amp; Post to Student Profile
            </button>
          </form>
        </div>

        {/* Honors Wall Feed (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="text-base font-bold text-[#121c2a]">Recent Honors Wall</h3>
            <span className="text-xs text-[#777587]">{achievements.length} Badges Awarded</span>
          </div>

          <div className="space-y-3">
            {achievements.length === 0 ? (
              <div className="py-12 text-center text-[#777587]">
                <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">military_tech</span>
                <p className="font-semibold text-sm text-[#121c2a]">No Honors Awarded Yet</p>
                <p className="text-xs text-[#777587] mt-1">Use the award form on the left to commend student achievements.</p>
              </div>
            ) : (
              achievements.map((ach) => (
                <div
                  key={ach.id}
                  className="p-4 bg-[#eff4ff]/60 rounded-xl border border-indigo-100/50 flex items-start gap-4"
                >
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-[#92400e] flex items-center justify-center text-2xl shrink-0 shadow-xs">
                    {ach.badgeType === 'medal'
                      ? '🏅'
                      : ach.badgeType === 'trophy'
                      ? '🏆'
                      : ach.badgeType === 'certificate'
                      ? '📜'
                      : '⭐'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-[#121c2a] truncate">{ach.title}</h4>
                      <span className="text-[11px] text-[#777587] shrink-0 font-medium">
                        {ach.awardedDate}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#3525cd] font-bold mt-0.5">
                      <span>{ach.studentName}</span>
                      <span>•</span>
                      <span>{ach.className}</span>
                      <span>•</span>
                      <span className="text-[#92400e]">+{ach.starsCount} Stars</span>
                    </div>
                    <p className="text-xs text-[#464555] mt-1 leading-relaxed">{ach.reason}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
