import React, { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  awardAchievementThunk,
  updateAchievementThunk,
  deleteAchievementThunk,
  AchievementPayload,
} from '../store/slices/performanceSlice';
import { addToast } from '../store/slices/uiSlice';
import { AchievementItem } from '../types';

const BADGE_ICONS: Record<AchievementItem['badgeType'], string> = {
  star: '⭐',
  medal: '🏅',
  trophy: '🏆',
  certificate: '📜',
  feedback: '📝',
};

export const AchievementsFeedbackPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const achievements = useAppSelector((state) => state.performance.achievements);
  const metrics = useAppSelector((state) => state.performance.metrics);
  const assignedClasses = useAppSelector((state) => state.auth.teacher.assignedClasses || []);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState(metrics[0]?.studentId || '');
  const [badgeType, setBadgeType] = useState<AchievementItem['badgeType']>('star');
  const [subjectId, setSubjectId] = useState<string>('');
  const [visibility, setVisibility] = useState<'PUBLISHED' | 'INTERNAL'>('PUBLISHED');
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [starsCount, setStarsCount] = useState<number>(3);
  const [saving, setSaving] = useState(false);

  // Default the recipient once the roster has loaded
  useEffect(() => {
    if (!studentId && metrics.length > 0) setStudentId(metrics[0].studentId);
  }, [metrics, studentId]);

  const selectedStudent = metrics.find((m) => m.studentId === studentId);

  // Subjects this teacher teaches in the selected student's class
  const subjectOptions = useMemo(() => {
    if (!selectedStudent) return [];
    const map = new Map<string, string>();
    assignedClasses
      .filter((c) => String(c.classId || c.id) === String(selectedStudent.classId))
      .forEach((c) => {
        if (c.subjectId) map.set(String(c.subjectId), c.subject);
      });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [assignedClasses, selectedStudent]);

  useEffect(() => {
    if (subjectId && !subjectOptions.some((s) => s.id === subjectId)) setSubjectId('');
  }, [subjectOptions, subjectId]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setReason('');
    setStarsCount(3);
    setBadgeType('star');
    setVisibility('PUBLISHED');
  };

  const startEdit = (ach: AchievementItem) => {
    setEditingId(ach.id);
    setStudentId(ach.studentId);
    setBadgeType(ach.badgeType);
    setSubjectId(ach.subjectId || '');
    setVisibility(ach.visibility || 'PUBLISHED');
    setTitle(ach.title);
    setReason(ach.reason);
    setStarsCount(ach.starsCount);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (ach: AchievementItem) => {
    if (!window.confirm(`Delete "${ach.title}" for ${ach.studentName}?`)) return;
    const result = await dispatch(deleteAchievementThunk(ach.id));
    if (deleteAchievementThunk.fulfilled.match(result)) {
      dispatch(addToast({ message: 'Record deleted.', type: 'info' }));
      if (editingId === ach.id) resetForm();
    } else {
      dispatch(addToast({ message: String(result.payload || 'Failed to delete record.'), type: 'error' }));
    }
  };

  const handleAward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !reason.trim()) return;
    if (!studentId) {
      dispatch(addToast({ message: 'Select a student first.', type: 'error' }));
      return;
    }

    const payload: AchievementPayload = {
      studentId,
      subjectId: subjectId || null,
      badgeType,
      title: title.trim(),
      reason: reason.trim(),
      starsCount: badgeType === 'feedback' ? 0 : starsCount,
      visibility,
    };

    setSaving(true);
    const result = editingId
      ? await dispatch(updateAchievementThunk({ id: editingId, payload }))
      : await dispatch(awardAchievementThunk(payload));
    setSaving(false);

    if (awardAchievementThunk.fulfilled.match(result) || updateAchievementThunk.fulfilled.match(result)) {
      const studentName = selectedStudent?.name || 'the student';
      dispatch(
        addToast({
          message: editingId
            ? `Updated "${payload.title}" for ${studentName}.`
            : visibility === 'INTERNAL'
            ? `Private note saved for ${studentName} (teachers only).`
            : `Recorded "${payload.title}" for ${studentName}. Visible in the student and parent portals.`,
          type: 'success',
        })
      );
      resetForm();
    } else {
      dispatch(addToast({ message: String(result.payload || 'Failed to save the record.'), type: 'error' }));
    }
  };

  return (
    <div className="flex flex-col w-full pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold text-[#7a5b00] uppercase tracking-wider">
              Student Recognition
            </span>
            <span className="text-[#c7c4d8]">•</span>
            <span className="text-xs text-[#545454]">SRS Section 12</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#292929] tracking-tight">
            Achievements, Stars &amp; Feedback
          </h1>
          <p className="text-xs sm:text-sm text-[#545454] mt-0.5">
            Motivate students with verified digital stars, subject mastery badges, and positive reinforcement
            feedback logged directly to student portals.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Award Form (5 cols) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
            <span className="material-symbols-outlined text-[#7a5b00] text-[22px]">
              {editingId ? 'edit' : 'military_tech'}
            </span>
            <h3 className="text-base font-bold text-[#292929]">
              {editingId ? 'Edit Recognition / Feedback' : 'Award Student Honor'}
            </h3>
          </div>

          <form onSubmit={handleAward} className="space-y-4 text-xs sm:text-sm">
            <div>
              <label className="block text-xs font-semibold text-[#292929] mb-1">
                Recipient Student
              </label>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full h-10 px-3 bg-[#f1f1fa] border border-indigo-100/60 rounded-lg text-[#292929] focus:outline-none"
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
                <label className="block text-xs font-semibold text-[#292929] mb-1">Badge Type</label>
                <select
                  value={badgeType}
                  onChange={(e) => setBadgeType(e.target.value as AchievementItem['badgeType'])}
                  className="w-full h-10 px-3 bg-[#f1f1fa] border border-indigo-100/60 rounded-lg text-[#292929] focus:outline-none"
                >
                  <option value="star">⭐ Golden Star</option>
                  <option value="medal">🏅 Academic Medal</option>
                  <option value="trophy">🏆 Class Trophy</option>
                  <option value="certificate">📜 Certificate of Merit</option>
                  <option value="feedback">📝 Performance Feedback</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#292929] mb-1">
                  Stars Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  disabled={badgeType === 'feedback'}
                  value={badgeType === 'feedback' ? 0 : starsCount}
                  onChange={(e) => setStarsCount(Number(e.target.value))}
                  className="w-full h-10 px-3 bg-[#f1f1fa] border border-indigo-100/60 rounded-lg text-[#292929] font-bold focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#292929] mb-1">Subject (optional)</label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full h-10 px-3 bg-[#f1f1fa] border border-indigo-100/60 rounded-lg text-[#292929] focus:outline-none"
                >
                  <option value="">General</option>
                  {subjectOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#292929] mb-1">Visibility</label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as 'PUBLISHED' | 'INTERNAL')}
                  className="w-full h-10 px-3 bg-[#f1f1fa] border border-indigo-100/60 rounded-lg text-[#292929] focus:outline-none"
                >
                  <option value="PUBLISHED">Student &amp; Parents</option>
                  <option value="INTERNAL">Teacher-only note</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292929] mb-1">
                Achievement Title
              </label>
              <input
                type="text"
                required
                maxLength={255}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Master of Reciprocal Fraction Logic"
                className="w-full h-10 px-3 bg-[#f1f1fa] border border-indigo-100/60 rounded-lg text-[#292929] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292929] mb-1">
                {badgeType === 'feedback' ? 'Feedback / Academic Comment' : 'Commendation Reason'}
              </label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe how the student demonstrated excellence, helpfulness, or diligence..."
                className="w-full p-2.5 bg-[#f1f1fa] border border-indigo-100/60 rounded-lg text-[#292929] focus:outline-none"
              ></textarea>
            </div>

            <div className="flex gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2.5 rounded-xl bg-[#e8e8f6] text-[#292929] hover:bg-[#ffedc2] text-xs font-semibold"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={saving || metrics.length === 0}
                className="flex-1 py-2.5 bg-[#36348e] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">verified</span>
                {saving
                  ? 'Saving…'
                  : editingId
                  ? 'Save Changes'
                  : visibility === 'INTERNAL'
                  ? 'Save Teacher-Only Note'
                  : <>Award &amp; Post to Student Profile</>}
              </button>
            </div>
          </form>
        </div>

        {/* Honors Wall Feed (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="text-base font-bold text-[#292929]">Recent Honors Wall</h3>
            <span className="text-xs text-[#777587]">{achievements.length} Records</span>
          </div>

          <div className="space-y-3">
            {achievements.length === 0 ? (
              <div className="py-12 text-center text-[#777587]">
                <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">military_tech</span>
                <p className="font-semibold text-sm text-[#292929]">No Honors Awarded Yet</p>
                <p className="text-xs text-[#777587] mt-1">Use the award form on the left to commend student achievements.</p>
              </div>
            ) : (
              achievements.map((ach) => (
                <div
                  key={ach.id}
                  className="p-4 bg-[#f1f1fa]/60 rounded-xl border border-indigo-100/50 flex items-start gap-4"
                >
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-[#8a6400] flex items-center justify-center text-2xl shrink-0 shadow-xs">
                    {BADGE_ICONS[ach.badgeType] || '⭐'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-[#292929] truncate">{ach.title}</h4>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] text-[#777587] font-medium mr-1">{ach.awardedDate}</span>
                        <button
                          onClick={() => startEdit(ach)}
                          className="p-1 rounded text-[#545454] hover:text-[#b98200] hover:bg-white transition-colors"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(ach)}
                          className="p-1 rounded text-[#545454] hover:text-[#ba1a1a] hover:bg-white transition-colors"
                          title="Delete"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#36348e] font-bold mt-0.5 flex-wrap">
                      <span>{ach.studentName}</span>
                      <span>•</span>
                      <span>{ach.className}</span>
                      {ach.subjectName && (
                        <>
                          <span>•</span>
                          <span>{ach.subjectName}</span>
                        </>
                      )}
                      {ach.starsCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-[#8a6400]">+{ach.starsCount} Stars</span>
                        </>
                      )}
                      {ach.visibility === 'INTERNAL' && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 text-[#545454] text-[10px] uppercase">
                          Teacher-only
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#545454] mt-1 leading-relaxed">{ach.reason}</p>
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
