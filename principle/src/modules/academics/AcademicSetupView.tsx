import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { AcademicSession, SchoolClass, Teacher } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { BookOpen, UserPlus, Calendar, CheckCircle2 } from 'lucide-react';

export const AcademicSetupView: React.FC = () => {
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedClassNum, setSelectedClassNum] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assignment Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [assignReason, setAssignReason] = useState<string>('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const toast = useToast();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [sData, cData, tData] = await Promise.all([
        api.getAcademicSessions(),
        api.getClasses(),
        api.getTeachers()
      ]);
      setSessions(sData);
      setClasses(cData);
      setTeachers(tData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load academic setup');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeClass = classes.find((c) => c.classNumber === selectedClassNum);

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId || !selectedTeacherId) {
      toast.warning('Please select subject and teacher.');
      return;
    }

    try {
      setAssignSubmitting(true);
      await api.assignTeacherToSubject(
        selectedClassNum,
        selectedSubjectId,
        selectedTeacherId,
        assignReason || 'Principal assigned faculty member to subject curriculum'
      );
      toast.success('Teacher assigned successfully.');
      setIsAssignModalOpen(false);
      setSelectedSubjectId('');
      setSelectedTeacherId('');
      setAssignReason('');
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setAssignSubmitting(false);
    }
  };

  if (loading) return <LoadingState message="Loading academic curriculum & classes..." rows={6} />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div className="space-y-6">
      {/* Sessions Strip in clean white card */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Academic Sessions Oversight
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            Sessions govern timetables, result transcripts & fee structures
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {sessions.map((ses) => (
            <div
              key={ses.id}
              className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                ses.status === 'Active'
                  ? 'bg-amber-50/60 border-amber-200/90 shadow-2xs'
                  : 'bg-slate-50/70 border-slate-200/80'
              }`}
            >
              <div>
                <span className="text-xs font-semibold text-slate-900">{ses.name}</span>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  {ses.startDate} to {ses.endDate}
                </div>
              </div>
              <StatusBadge status={ses.status} />
            </div>
          ))}
        </div>
      </div>

      {/* Class 1–8 Switcher and Subject Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Classrooms & Subject Matrix (Classes 1–8)</h3>
            <p className="text-xs text-slate-500">Assign authorized teachers to subjects and inspect class curricula.</p>
          </div>
          <button
            onClick={() => setIsAssignModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Assign Teacher to Subject</span>
          </button>
        </div>

        {/* Grade tabs in light styling */}
        <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200/90 rounded-xl overflow-x-auto shadow-2xs">
          {classes.map((cls) => (
            <button
              key={cls.classNumber}
              onClick={() => setSelectedClassNum(cls.classNumber)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedClassNum === cls.classNumber
                  ? 'bg-amber-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Class {cls.classNumber}
            </button>
          ))}
        </div>

        {/* Selected Class Subjects */}
        {activeClass && (
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  {activeClass.name} Curriculum & Teaching Roster
                </h4>
                <p className="text-xs text-slate-500">
                  {activeClass.totalStudents} enrolled students · {activeClass.subjects.length} active subjects
                </p>
              </div>
              <span className="text-xs font-mono font-medium text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                Session: {activeClass.academicSession}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {activeClass.subjects.map((sub) => {
                const assignedFaculty = teachers.filter((t) =>
                  sub.assignedTeacherIds.includes(t.id)
                );

                return (
                  <div
                    key={sub.id}
                    className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 flex flex-col justify-between gap-3 shadow-2xs hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                          <span className="font-semibold text-slate-900 text-xs">{sub.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">
                          Code: {sub.code} · {sub.weeklyLessons} lessons / week
                        </span>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Assigned Faculty:</span>
                      {assignedFaculty.length > 0 ? (
                        <span className="font-medium text-emerald-700">
                          {assignedFaculty.map((f) => f.name).join(', ')}
                        </span>
                      ) : (
                        <span className="text-rose-600 italic font-medium">Unassigned</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Assign Teacher Modal */}
      {activeClass && (
        <Modal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          title={`Assign Teacher · Class ${selectedClassNum}`}
          description="Map an authorized teacher to a classroom subject. Timetable scheduling relies on active assignments."
          maxWidth="md"
        >
          <form onSubmit={handleAssignSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Subject *</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white"
              >
                <option value="">-- Choose Subject in Class {selectedClassNum} --</option>
                {activeClass.subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Faculty Member *</label>
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white"
              >
                <option value="">-- Select Active Faculty Member --</option>
                {teachers
                  .filter((t) => t.accountStatus === 'Active')
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.designation})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Assignment Rationale</label>
              <textarea
                value={assignReason}
                onChange={(e) => setAssignReason(e.target.value)}
                rows={2}
                placeholder="Reason or term syllabus coverage note..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={assignSubmitting}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs"
              >
                {assignSubmitting ? 'Saving...' : 'Confirm Assignment'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
