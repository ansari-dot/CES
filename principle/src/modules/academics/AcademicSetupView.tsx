import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { AcademicSession, SchoolClass, Teacher } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { BookOpen, UserPlus, Calendar, Plus, X, Check } from 'lucide-react';

interface SystemSubject {
  id: string;
  name: string;
  code: string;
}

export const AcademicSetupView: React.FC = () => {
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allSubjects, setAllSubjects] = useState<SystemSubject[]>([]);
  const [selectedClassNum, setSelectedClassNum] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assignment Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [assignReason, setAssignReason] = useState<string>('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // Add Subject Modal
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
  const [addSubjectMode, setAddSubjectMode] = useState<'existing' | 'new'>('existing');
  const [existingSubjectId, setExistingSubjectId] = useState<string>('');
  const [newSubjectName, setNewSubjectName] = useState<string>('');
  const [newSubjectCode, setNewSubjectCode] = useState<string>('');
  const [addSubjectSubmitting, setAddSubjectSubmitting] = useState(false);

  const toast = useToast();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [sData, cData, tData, subData] = await Promise.all([
        api.getAcademicSessions(),
        api.getClasses(),
        api.getTeachers(),
        api.getAllSubjects()
      ]);
      setSessions(sData);
      setClasses(cData);
      setTeachers(tData);
      setAllSubjects(subData);
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

  // Handle Teacher Assignment
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId || !selectedTeacherId) {
      toast.warning('Please select both a subject and a faculty member.');
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
      toast.success('Teacher assigned to subject successfully.');
      setIsAssignModalOpen(false);
      setSelectedSubjectId('');
      setSelectedTeacherId('');
      setAssignReason('');
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Handle Unassigning a Teacher
  const handleUnassign = async (classNum: number, subjectId: string, teacherId: string, teacherName: string) => {
    if (!window.confirm(`Unassign ${teacherName} from this subject in Class ${classNum}?`)) {
      return;
    }

    try {
      await api.unassignTeacherFromSubject(classNum, subjectId, teacherId);
      toast.info(`${teacherName} unassigned successfully.`);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to unassign teacher');
    }
  };

  // Handle Adding Subject to Class
  const handleAddSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAddSubjectSubmitting(true);
      if (addSubjectMode === 'existing') {
        if (!existingSubjectId) {
          toast.warning('Please choose a subject to add.');
          return;
        }
        await api.addSubjectToClass(selectedClassNum, { subjectId: existingSubjectId });
      } else {
        if (!newSubjectName.trim() || !newSubjectCode.trim()) {
          toast.warning('Please provide subject name and curriculum code.');
          return;
        }
        await api.addSubjectToClass(selectedClassNum, {
          name: newSubjectName.trim(),
          code: newSubjectCode.trim().toUpperCase()
        });
      }

      toast.success(`Subject successfully added to Class ${selectedClassNum}.`);
      setIsAddSubjectModalOpen(false);
      setExistingSubjectId('');
      setNewSubjectName('');
      setNewSubjectCode('');
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add subject to class');
    } finally {
      setAddSubjectSubmitting(false);
    }
  };

  if (loading) return <LoadingState message="Loading academic curriculum & classes..." rows={6} />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  // Filter existing subjects not yet in this active class
  const availableExistingSubjects = allSubjects.filter(
    (s) => !activeClass?.subjects.some((cs) => cs.code.toUpperCase() === s.code.toUpperCase() || String(cs.id) === String(s.id))
  );

  return (
    <div className="space-y-6">
      {/* Sessions Strip */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Academic Sessions Oversight
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            Sessions govern timetables, result transcripts &amp; fee structures
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {sessions.length === 0 ? (
            <div className="col-span-full p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-400 text-center">
              No academic sessions configured in the system.
            </div>
          ) : (
            sessions.map((ses) => (
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
            ))
          )}
        </div>
      </div>

      {/* Class 1–8 Switcher and Subject Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Classrooms &amp; Subject Matrix (Classes 1–8)</h3>
            <p className="text-xs text-slate-500">Assign authorized teachers to subjects and manage class curricula.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddSubjectModalOpen(true)}
              className="px-3 py-1.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-amber-600" />
              <span>Add Subject to Class {selectedClassNum}</span>
            </button>
            <button
              onClick={() => {
                setSelectedSubjectId('');
                setIsAssignModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Assign Teacher to Subject</span>
            </button>
          </div>
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
                  {activeClass.name} Curriculum &amp; Teaching Roster
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
              {activeClass.subjects.length === 0 ? (
                <div className="col-span-full p-8 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-400 text-center space-y-2">
                  <p>No curriculum subjects assigned to Class {activeClass.classNumber} yet.</p>
                  <button
                    onClick={() => setIsAddSubjectModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add First Subject
                  </button>
                </div>
              ) : (
                activeClass.subjects.map((sub) => {
                  // Find all teachers assigned to this subject in this class
                  const assignedFaculty = teachers.filter((t) => {
                    const rawTeacherNum = parseInt(t.id.replace(/\D/g, ''), 10);
                    const isIdDirect =
                      sub.assignedTeacherIds.includes(t.id) ||
                      sub.assignedTeacherIds.includes(String(rawTeacherNum));
                    const isAssignmentMatch =
                      Array.isArray(t.assignments) &&
                      t.assignments.some(
                        (a: any) =>
                          Number(a.classNumber) === activeClass.classNumber &&
                          String(a.subjectId) === String(sub.id)
                      );
                    return isIdDirect || isAssignmentMatch;
                  });

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
                            Code: {sub.code} · {sub.weeklyLessons || 5} lessons / week
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSubjectId(sub.id);
                            setIsAssignModalOpen(true);
                          }}
                          className="px-2 py-1 rounded-md bg-white border border-slate-200/90 hover:border-amber-300 text-[11px] font-medium text-slate-700 hover:text-amber-700 transition-colors flex items-center gap-1 shadow-2xs"
                        >
                          <UserPlus className="w-3 h-3 text-amber-600" />
                          <span>Assign</span>
                        </button>
                      </div>

                      <div className="pt-2.5 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">Assigned Faculty:</span>
                        {assignedFaculty.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5 justify-end">
                            {assignedFaculty.map((f) => (
                              <span
                                key={f.id}
                                className="inline-flex items-center gap-1 font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 text-[11px]"
                              >
                                {f.name}
                                <button
                                  type="button"
                                  onClick={() => handleUnassign(activeClass.classNumber, sub.id, f.id, f.name)}
                                  title={`Unassign ${f.name}`}
                                  className="text-emerald-600 hover:text-rose-600 transition-colors ml-0.5 p-0.5 rounded hover:bg-rose-50"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-rose-600 italic font-medium">Unassigned</span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSubjectId(sub.id);
                                setIsAssignModalOpen(true);
                              }}
                              className="text-[11px] text-amber-700 hover:text-amber-800 font-semibold underline"
                            >
                              Assign Now
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
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
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
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
                      {t.name} ({t.designation || 'Faculty'})
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
                placeholder="Reason or syllabus coverage note..."
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

      {/* Add Subject to Class Modal */}
      {activeClass && (
        <Modal
          isOpen={isAddSubjectModalOpen}
          onClose={() => setIsAddSubjectModalOpen(false)}
          title={`Add Subject · Class ${selectedClassNum}`}
          description={`Expand curriculum for Class ${selectedClassNum} by linking an existing subject or creating a new one.`}
          maxWidth="md"
        >
          <form onSubmit={handleAddSubjectSubmit} className="space-y-4 text-xs">
            <div className="flex items-center gap-4 p-2 bg-slate-50 border border-slate-200/80 rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="addSubjectMode"
                  checked={addSubjectMode === 'existing'}
                  onChange={() => setAddSubjectMode('existing')}
                  className="accent-amber-600"
                />
                <span>Select Existing Subject</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="addSubjectMode"
                  checked={addSubjectMode === 'new'}
                  onChange={() => setAddSubjectMode('new')}
                  className="accent-amber-600"
                />
                <span>Create Brand New Subject</span>
              </label>
            </div>

            {addSubjectMode === 'existing' ? (
              <div>
                <label className="block text-slate-700 font-medium mb-1">Curriculum Subject *</label>
                {availableExistingSubjects.length === 0 ? (
                  <p className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-[11px]">
                    All available subjects are already linked to Class {selectedClassNum}. Choose &ldquo;Create Brand New Subject&rdquo; to add a new subject.
                  </p>
                ) : (
                  <select
                    value={existingSubjectId}
                    onChange={(e) => setExistingSubjectId(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white"
                  >
                    <option value="">-- Choose Subject to Add to Class {selectedClassNum} --</option>
                    {availableExistingSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Subject Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Computer Science, Quranic Studies, Environmental Science"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Subject Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS-05, QUR-01, ENV-03"
                    value={newSubjectCode}
                    onChange={(e) => setNewSubjectCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white font-mono uppercase"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddSubjectModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addSubjectSubmitting || (addSubjectMode === 'existing' && availableExistingSubjects.length === 0)}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs disabled:opacity-50"
              >
                {addSubjectSubmitting ? 'Adding...' : 'Add to Class'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
