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
import {
  Award,
  Sparkles,
  Pencil,
  Trash2,
  CheckCircle2,
  Star,
  Users,
  Eye,
  Lock,
  X,
  Send,
  FileText
} from 'lucide-react';

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
      badgeType,
      title: title.trim(),
      reason: reason.trim(),
      starsCount,
      visibility,
      subjectId: subjectId ? Number(subjectId) : undefined,
    };

    setSaving(true);
    try {
      if (editingId) {
        const result = await dispatch(updateAchievementThunk({ id: editingId, ...payload }));
        if (updateAchievementThunk.fulfilled.match(result)) {
          dispatch(addToast({ message: 'Achievement updated.', type: 'success' }));
          resetForm();
        } else {
          dispatch(addToast({ message: String(result.payload || 'Failed to update.'), type: 'error' }));
        }
      } else {
        const result = await dispatch(awardAchievementThunk(payload));
        if (awardAchievementThunk.fulfilled.match(result)) {
          dispatch(
            addToast({
              message:
                visibility === 'INTERNAL'
                  ? 'Internal faculty feedback note recorded.'
                  : 'Student honor awarded and published.',
              type: 'success',
            })
          );
          resetForm();
        } else {
          dispatch(addToast({ message: String(result.payload || 'Failed to award honor.'), type: 'error' }));
        }
      }
    } finally {
      setSaving(false);
    }
  };

  // Metrics
  const totalHonors = achievements.length;
  const publishedHonors = achievements.filter((a) => a.visibility !== 'INTERNAL').length;
  const internalNotes = achievements.filter((a) => a.visibility === 'INTERNAL').length;
  const totalStarsGiven = achievements.reduce((acc, a) => acc + (a.starsCount || 0), 0);

  return (
    <div className="flex flex-col w-full pb-16 space-y-5 bg-[#f6f7fb] min-h-screen p-3 sm:p-5 lg:p-6 rounded-2xl">
      {/* ------------------------------------------------------------- */}
      {/* 1. HERO HEADER BANNER */}
      {/* ------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#36348e] text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
              <Award className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  Recognition &amp; Feedback
                </span>
                <span className="text-[11px] font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  Student Motivation Hub
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#1e1b4b] tracking-tight mt-1">
                Student Honors &amp; Faculty Feedback
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Commend exemplary conduct, academic excellence, or log internal faculty notes for student profiles.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. TOP 4 WAVE KPI CARDS */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Honors */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-blue-100/80 hover:border-blue-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Award className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-blue-50 text-blue-700 border-blue-100">
              <span>All Awards</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              {totalHonors}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Honors Commended
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(59, 130, 246, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Published to Portals */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-emerald-100/80 hover:border-emerald-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Eye className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-emerald-50 text-emerald-700 border-emerald-100">
              <span>Public</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight leading-tight">
              {publishedHonors}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Visible on Student Portals
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(16, 185, 129, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#10b981" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Stars Given */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-amber-100/80 hover:border-amber-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Star className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-amber-50 text-amber-800 border-amber-200">
              <span>Points</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-amber-800 tracking-tight leading-tight">
              {totalStarsGiven}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Honor Stars Awarded
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(245, 158, 11, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Faculty-Only Notes */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-purple-100/80 hover:border-purple-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white shadow-sm shadow-purple-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Lock className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-purple-50 text-purple-700 border-purple-100">
              <span>Internal</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-purple-800 tracking-tight leading-tight">
              {internalNotes}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Private Faculty Notes
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(139, 92, 246, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. AWARD FORM & HONORS WALL */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Award Form (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200/80">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#36348e] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#1e1b4b]">
                {editingId ? 'Edit Recognition / Feedback' : 'Award Student Honor'}
              </h3>
              <p className="text-xs text-slate-500">Post commendable badges and feedback to student profiles</p>
            </div>
          </div>

          <form onSubmit={handleAward} className="space-y-4 text-xs sm:text-sm">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Recipient Student
              </label>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer shadow-2xs"
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
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Badge Type</label>
                <select
                  value={badgeType}
                  onChange={(e) => setBadgeType(e.target.value as AchievementItem['badgeType'])}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer shadow-2xs"
                >
                  <option value="star">⭐ Golden Star</option>
                  <option value="medal">🏅 Academic Medal</option>
                  <option value="trophy">🏆 Class Trophy</option>
                  <option value="certificate">📜 Certificate of Merit</option>
                  <option value="feedback">📝 Faculty Written Feedback</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Stars (1-5)</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={starsCount}
                  onChange={(e) => setStarsCount(Math.max(0, Math.min(5, Number(e.target.value) || 0)))}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-2xs"
                />
              </div>
            </div>

            {subjectOptions.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Linked Subject (Optional)
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer shadow-2xs"
                >
                  <option value="">General Class Achievement (No subject)</option>
                  {subjectOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Visibility Audience
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVisibility('PUBLISHED')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    visibility === 'PUBLISHED'
                      ? 'border-[#36348e] bg-indigo-50 text-indigo-700 shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Public to Student</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility('INTERNAL')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    visibility === 'INTERNAL'
                      ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Faculty-Only Note</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Honor Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Exceptional Mathematics Project, Star Scholar"
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Commendation Details
              </label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe the student's achievement, dedication, or constructive feedback..."
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-2xs resize-none"
              ></textarea>
            </div>

            <div className="flex items-center gap-2 pt-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={saving || metrics.length === 0}
                className="flex-1 py-2.5 bg-[#36348e] hover:bg-[#2c2a75] text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 active:scale-[0.98]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {saving
                    ? 'Saving…'
                    : editingId
                    ? 'Save Changes'
                    : visibility === 'INTERNAL'
                    ? 'Save Internal Note'
                    : 'Award & Post to Profile'}
                </span>
              </button>
            </div>
          </form>
        </div>

        {/* Honors Wall Feed (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200/80">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div>
              <h3 className="text-base font-extrabold text-[#1e1b4b]">Recent Honors Wall</h3>
              <p className="text-xs text-slate-500">Commendations and teacher feedback on record</p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 font-mono text-xs font-bold text-slate-600">
              {achievements.length} Records
            </span>
          </div>

          <div className="space-y-3">
            {achievements.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Award className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-xs text-slate-700">No Honors Awarded Yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Use the award form on the left to commend student achievements.</p>
              </div>
            ) : (
              achievements.map((ach) => (
                <div
                  key={ach.id}
                  className="p-4 bg-slate-50/60 rounded-xl border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50 transition-all flex items-start gap-3.5"
                >
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs">
                    {BADGE_ICONS[ach.badgeType] || '⭐'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-slate-900 truncate">{ach.title}</h4>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] text-slate-400 font-mono mr-1">{ach.awardedDate}</span>
                        <button
                          type="button"
                          onClick={() => startEdit(ach)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(ach)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-indigo-700 font-bold mt-0.5 flex-wrap">
                      <span>{ach.studentName}</span>
                      <span>•</span>
                      <span className="text-slate-600">{ach.className}</span>
                      {ach.subjectName && (
                        <>
                          <span>•</span>
                          <span className="text-slate-600">{ach.subjectName}</span>
                        </>
                      )}
                      {ach.starsCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-amber-600 font-mono font-bold">
                            {'⭐'.repeat(Math.min(5, ach.starsCount))}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{ach.reason}</p>
                    {ach.visibility === 'INTERNAL' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 mt-2">
                        <Lock className="w-3 h-3" /> Faculty-Only Internal Record
                      </span>
                    )}
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
