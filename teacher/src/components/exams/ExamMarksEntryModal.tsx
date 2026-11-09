import React, { useState, useEffect } from 'react';
import { requestApi } from '../../services/api';
import { useAppDispatch } from '../../store';
import { addToast } from '../../store/slices/uiSlice';
import { BrandLoader } from '../common/BrandLoader';
import {
  X,
  Save,
  Send,
  AlertCircle,
  CheckCircle2,
  Lock,
  UserCheck,
  UserX
} from 'lucide-react';

interface StudentRosterRow {
  studentId: number;
  admissionNumber: string;
  enrollmentId: number;
  rollNo: string | null;
  studentName: string;
  theoryObtained: number | null;
  practicalObtained: number | null;
  totalObtained: number | null;
  percentage: number | null;
  grade: string | null;
  isAbsent: boolean;
  isExempt: boolean;
  isPassed: boolean | null;
  teacherRemarks: string | null;
  status: string;
}

interface PaperDetail {
  id: number;
  examId: number;
  examTitle: string;
  classId: number;
  className: string;
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  maxTheoryMarks: number;
  maxPracticalMarks: number;
  totalMarks: number;
  passingMarks: number;
  status: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  classId: number;
  subjectId: number;
  subjectName: string;
  termId: number;
  onSaved: () => void;
}

export const ExamMarksEntryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  classId,
  subjectId,
  subjectName,
  termId,
  onSaved
}) => {
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [roster, setRoster] = useState<StudentRosterRow[]>([]);
  const [examId, setExamId] = useState<number | null>(null);
  const [needsPaperSetup, setNeedsPaperSetup] = useState(false);
  const [setupMaxTheory, setSetupMaxTheory] = useState<number>(100);
  const [setupPassingMarks, setSetupPassingMarks] = useState<number>(40);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const fetchExamAndPaper = async () => {
      try {
        setLoading(true);
        setError(null);
        setNeedsPaperSetup(false);

        // 1. Find the examination series for this term, initializing it on first use
        const examsRes = await requestApi<any[]>(`/api/v1/exams?termId=${termId}`);
        const examList = Array.isArray(examsRes) ? examsRes : [];
        let currentExam = examList.find((e) => e.status !== 'CANCELLED') || null;
        if (!currentExam) {
          currentExam = await requestApi<any>('/api/v1/exams/ensure', {
            method: 'POST',
            body: JSON.stringify({ termId })
          });
        }
        if (!currentExam) {
          setError('No examination series is scheduled for this academic term.');
          setLoading(false);
          return;
        }
        setExamId(currentExam.id);

        // 2. Fetch papers for this exam and class
        const papersRes = await requestApi<any[]>(`/api/v1/exams/${currentExam.id}/papers?classId=${classId}`);
        const paperList = Array.isArray(papersRes) ? papersRes : [];
        const existingPaper = paperList.find((p) => Number(p.subject_id) === Number(subjectId));

        if (!existingPaper) {
          setNeedsPaperSetup(true);
          setLoading(false);
          return;
        }

        // 3. Fetch marks sheet for this paper
        const sheetRes = await requestApi<{ paper: PaperDetail; roster: StudentRosterRow[] }>(
          `/api/v1/exams/papers/${existingPaper.id}/marks-sheet`
        );

        if (mounted) {
          setPaper(sheetRes.paper);
          setRoster(sheetRes.roster || []);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Failed to load exam marks sheet.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchExamAndPaper();
    return () => {
      mounted = false;
    };
  }, [isOpen, classId, subjectId, termId]);

  const handleCreatePaper = async () => {
    if (!examId) return;
    try {
      setSaving(true);
      setError(null);
      const today = new Date().toISOString().slice(0, 10);
      const created = await requestApi<any>(`/api/v1/exams/${examId}/papers`, {
        method: 'POST',
        body: JSON.stringify({
          classId,
          subjectId,
          paperDate: today,
          startTime: '09:00 AM',
          endTime: '12:00 PM',
          maxTheoryMarks: setupMaxTheory,
          maxPracticalMarks: 0,
          passingMarks: setupPassingMarks
        })
      });

      // Reload marks sheet
      const sheetRes = await requestApi<{ paper: PaperDetail; roster: StudentRosterRow[] }>(
        `/api/v1/exams/papers/${created.id}/marks-sheet`
      );
      setPaper(sheetRes.paper);
      setRoster(sheetRes.roster || []);
      setNeedsPaperSetup(false);
      dispatch(
        addToast({
          title: 'Paper Initialized',
          message: 'Exam paper configured. You can now enter student marks.',
          type: 'success'
        })
      );
    } catch (err: any) {
      setError(err.message || 'Failed to initialize paper.');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkChange = (studentId: number, field: 'theory' | 'practical', value: string) => {
    setRoster((prev) =>
      prev.map((row) => {
        if (row.studentId !== studentId) return row;
        const numVal = value === '' ? null : Number(value);
        const theory = field === 'theory' ? numVal : row.theoryObtained;
        const practical = field === 'practical' ? numVal : row.practicalObtained;
        const totalMax = (paper?.totalMarks || 100);
        const total = (theory || 0) + (practical || 0);
        const pct = totalMax > 0 ? Math.round((total / totalMax) * 100 * 100) / 100 : null;

        let grade = 'U';
        if (pct !== null) {
          if (pct >= 90) grade = 'A*';
          else if (pct >= 80) grade = 'A';
          else if (pct >= 70) grade = 'B';
          else if (pct >= 60) grade = 'C';
          else if (pct >= 50) grade = 'D';
          else if (pct >= 40) grade = 'E';
        }

        const isPassed = total >= (paper?.passingMarks || 40);

        return {
          ...row,
          theoryObtained: theory,
          practicalObtained: practical,
          totalObtained: total,
          percentage: pct,
          grade,
          isPassed,
          isAbsent: false
        };
      })
    );
  };

  const toggleAbsent = (studentId: number) => {
    setRoster((prev) =>
      prev.map((row) => {
        if (row.studentId !== studentId) return row;
        const willBeAbsent = !row.isAbsent;
        return {
          ...row,
          isAbsent: willBeAbsent,
          theoryObtained: willBeAbsent ? null : row.theoryObtained,
          practicalObtained: willBeAbsent ? null : row.practicalObtained,
          totalObtained: willBeAbsent ? 0 : row.totalObtained,
          percentage: willBeAbsent ? 0 : row.percentage,
          grade: willBeAbsent ? 'ABSENT' : row.grade,
          isPassed: willBeAbsent ? false : row.isPassed
        };
      })
    );
  };

  const handleRemarksChange = (studentId: number, remarks: string) => {
    setRoster((prev) =>
      prev.map((row) => (row.studentId === studentId ? { ...row, teacherRemarks: remarks } : row))
    );
  };

  const handleSaveMarks = async (action: 'DRAFT' | 'SUBMIT') => {
    if (!paper) return;
    try {
      setSaving(true);
      setError(null);

      const payload = {
        action,
        marks: roster.map((r) => ({
          studentId: r.studentId,
          theoryObtained: r.theoryObtained,
          practicalObtained: r.practicalObtained,
          isAbsent: r.isAbsent,
          isExempt: r.isExempt,
          teacherRemarks: r.teacherRemarks
        }))
      };

      await requestApi(`/api/v1/exams/papers/${paper.id}/marks`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      dispatch(
        addToast({
          title: action === 'SUBMIT' ? 'Marks Submitted' : 'Draft Saved',
          message:
            action === 'SUBMIT'
              ? `${subjectName} examination marks have been submitted for principal review.`
              : 'Marks entries have been saved as draft.',
          type: 'success'
        })
      );

      onSaved();
      if (action === 'SUBMIT') {
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save marks.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#1b1a47] text-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-400 text-[#1b1a47]">
                Online Terminal Exam Tabulation
              </span>
              {paper?.status === 'LOCKED' && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-red-200">
                  <Lock className="w-3 h-3" /> Locked by Principal
                </span>
              )}
            </div>
            <h2 className="text-lg font-extrabold mt-1">
              Class {classId} · {subjectName}
            </h2>
            <p className="text-xs text-slate-300">
              {paper ? `${paper.examTitle} · Max Marks: ${paper.totalMarks} · Pass: ${paper.passingMarks}` : 'Configuring examination paper'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-16 flex items-center justify-center">
              <BrandLoader message="Loading student tabulation roster..." size="sm" />
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold">Error loading marks sheet</p>
                <p className="text-xs mt-0.5">{error}</p>
              </div>
            </div>
          ) : needsPaperSetup ? (
            <div className="text-center py-10 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Configure Examination Paper</h3>
              <p className="text-xs text-slate-500 mt-1 mb-6">
                No formal paper has been initialized for this subject in the current examination series. Set maximum marks to start marks entry.
              </p>
              <div className="grid grid-cols-2 gap-4 text-left mb-6">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Max Total Marks</label>
                  <input
                    type="number"
                    min={1}
                    value={setupMaxTheory}
                    onChange={(e) => setSetupMaxTheory(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#1b1a47]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Passing Marks</label>
                  <input
                    type="number"
                    min={1}
                    value={setupPassingMarks}
                    onChange={(e) => setSetupPassingMarks(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#1b1a47]"
                  />
                </div>
              </div>
              <button
                onClick={handleCreatePaper}
                disabled={saving}
                className="w-full px-4 py-2.5 rounded-xl bg-[#1b1a47] text-white hover:bg-[#ffc53a] hover:text-[#1b1a47] font-bold text-xs transition"
              >
                {saving ? 'Initializing Paper...' : 'Initialize Exam Paper & Begin Marks Entry'}
              </button>
            </div>
          ) : roster.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500">
              No active students enrolled in this class for the current session.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-600 border-b border-slate-100 pb-2">
                <span>
                  Students: <strong className="text-slate-900">{roster.length}</strong>
                </span>
                <span className="text-[11px] text-slate-400">
                  Tab or Enter moves through marks inputs smoothly
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-3 py-2.5">Roll</th>
                      <th className="px-3 py-2.5">Student</th>
                      <th className="px-3 py-2.5 text-right w-24">Marks ({paper?.totalMarks})</th>
                      <th className="px-3 py-2.5 text-center w-20">Absent</th>
                      <th className="px-3 py-2.5 text-center w-16">Grade</th>
                      <th className="px-3 py-2.5 text-center w-20">Status</th>
                      <th className="px-3 py-2.5">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {roster.map((row) => (
                      <tr
                        key={row.studentId}
                        className={`hover:bg-slate-50/70 transition ${row.isAbsent ? 'bg-red-50/30' : ''}`}
                      >
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                          {row.rollNo || row.admissionNumber}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-900">
                          {row.studentName}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            max={paper?.totalMarks || 100}
                            step="0.5"
                            disabled={row.isAbsent || paper?.status === 'LOCKED'}
                            value={row.theoryObtained ?? ''}
                            onChange={(e) => handleMarkChange(row.studentId, 'theory', e.target.value)}
                            placeholder="0"
                            className="w-20 px-2 py-1 text-right text-xs font-mono font-bold border border-slate-300 rounded-md focus:ring-2 focus:ring-[#1b1a47] focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => toggleAbsent(row.studentId)}
                            disabled={paper?.status === 'LOCKED'}
                            className={`px-2 py-1 rounded text-[10px] font-bold border transition ${
                              row.isAbsent
                                ? 'bg-red-100 border-red-300 text-red-700'
                                : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {row.isAbsent ? 'ABSENT' : 'Present'}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              row.isAbsent
                                ? 'bg-slate-100 text-slate-500'
                                : row.isPassed
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {row.grade || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`text-[10px] font-bold ${
                              row.isAbsent
                                ? 'text-slate-400'
                                : row.isPassed
                                ? 'text-emerald-700'
                                : 'text-red-600'
                            }`}
                          >
                            {row.isAbsent ? 'ABS' : row.isPassed ? 'PASS' : 'FAIL'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            maxLength={255}
                            disabled={paper?.status === 'LOCKED'}
                            value={row.teacherRemarks ?? ''}
                            onChange={(e) => handleRemarksChange(row.studentId, e.target.value)}
                            placeholder="Optional remark..."
                            className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:ring-1 focus:ring-[#1b1a47] focus:outline-none"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!needsPaperSetup && paper && (
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-100">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
            >
              Cancel
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSaveMarks('DRAFT')}
                disabled={saving || paper.status === 'LOCKED'}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                Save Draft
              </button>
              <button
                onClick={() => handleSaveMarks('SUBMIT')}
                disabled={saving || paper.status === 'LOCKED'}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#1b1a47] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white text-xs font-bold transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                Submit for Review
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

