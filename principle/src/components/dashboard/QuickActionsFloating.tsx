import React, { useState, useEffect } from 'react';
import {
  Plus,
  X,
  Clock,
  Receipt,
  UserPlus,
  CalendarDays,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Search,
  Check,
  AlertCircle
} from 'lucide-react';
import { api } from '../../services/api';
import { Student, Teacher, StudentAttendanceRecord, SalaryModel } from '../../types';
import { Modal } from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import { ActiveModule } from '../common/Sidebar';

interface QuickActionsFloatingProps {
  onNavigate: (module: ActiveModule) => void;
  onRefreshMetrics: () => void;
}

export const QuickActionsFloating: React.FC<QuickActionsFloatingProps> = ({
  onNavigate,
  onRefreshMetrics
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const toast = useToast();

  // Active quick modal
  const [activeModal, setActiveModal] = useState<
    'attendance' | 'challan' | 'teacher' | 'notice' | null
  >(null);

  // Common data cache
  const [students, setStudents] = useState<Student[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 1. Mark Attendance Form State
  const [attClassNumber, setAttClassNumber] = useState<number>(1);
  const [attSubject, setAttSubject] = useState<string>('Mathematics');
  const [attDate, setAttDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attStartTime, setAttStartTime] = useState<string>('09:00');
  const [attEndTime, setAttEndTime] = useState<string>('09:45');
  const [rosterRecords, setRosterRecords] = useState<StudentAttendanceRecord[]>([]);

  // 2. Create Challan Form State
  const [challanStudentId, setChallanStudentId] = useState<string>('');
  const [challanMonth, setChallanMonth] = useState<string>(
    new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
  );
  const [challanDueDate, setChallanDueDate] = useState<string>(
    new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [challanLateFee, setChallanLateFee] = useState<number>(500);

  // 3. New Teacher Form State
  const [teacherName, setTeacherName] = useState<string>('');
  const [teacherEmail, setTeacherEmail] = useState<string>('');
  const [teacherPhone, setTeacherPhone] = useState<string>('+92 300 ');
  const [teacherDesignation, setTeacherDesignation] = useState<string>('Subject Teacher');
  const [teacherSalaryModel, setTeacherSalaryModel] = useState<SalaryModel>('Fixed monthly');
  const [teacherBasePay, setTeacherBasePay] = useState<number>(55000);
  const [teacherClassNum, setTeacherClassNum] = useState<number>(1);
  const [teacherSubject, setTeacherSubject] = useState<string>('Mathematics');

  // Load students for forms
  useEffect(() => {
    api.getStudents().then((res) => setStudents(res)).catch(() => {});
  }, []);

  // Update attendance roster when class changes
  useEffect(() => {
    const classStudents = students.filter((s) => s.classNumber === attClassNumber);
    const initialRecords: StudentAttendanceRecord[] = classStudents.map((s) => ({
      studentId: s.id,
      studentName: s.name,
      rollNumber: s.rollNumber,
      status: 'Present',
      markedAt: new Date().toISOString(),
      markedBy: 'Principal Operations Desk'
    }));
    setRosterRecords(initialRecords);
  }, [attClassNumber, students]);

  // Close speed dial on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Actions
  const handleMarkAllPresent = () => {
    setRosterRecords((prev) =>
      prev.map((r) => ({
        ...r,
        status: 'Present'
      }))
    );
  };

  const handleUpdateRecordStatus = (
    studentId: string,
    status: 'Present' | 'Absent' | 'Late'
  ) => {
    setRosterRecords((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, status } : r))
    );
  };

  const handleSubmitAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rosterRecords.length === 0) {
      toast.warning(`No enrolled students found in Class ${attClassNumber}.`);
      return;
    }

    try {
      setSubmitting(true);
      await api.submitDailyAttendance({
        classNumber: attClassNumber,
        subjectName: attSubject,
        teacherName: 'Dr. Tariq Mahmood (Principal Override)',
        date: attDate,
        startTime: attStartTime,
        endTime: attEndTime,
        records: rosterRecords
      });
      const presentCount = rosterRecords.filter((r) => r.status === 'Present').length;
      toast.success(
        `Class ${attClassNumber} attendance submitted: ${presentCount}/${rosterRecords.length} students marked present.`
      );
      setActiveModal(null);
      onRefreshMetrics();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challanStudentId) {
      toast.warning('Please select an enrolled student.');
      return;
    }

    try {
      setSubmitting(true);
      const student = students.find((s) => s.id === challanStudentId);
      const created = await api.createIndividualChallan({
        studentId: challanStudentId,
        billingMonth: challanMonth,
        dueDate: challanDueDate,
        lateFeeAmount: challanLateFee
      });
      toast.success(
        `Challan ${created.challanNumber} issued for ${student?.name || 'student'} (Total: Rs. ${created.breakdown.totalPayable.toLocaleString()}).`
      );
      setActiveModal(null);
      setChallanStudentId('');
      onRefreshMetrics();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to issue challan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherName.trim() || !teacherEmail.trim()) {
      toast.warning('Teacher name and official email are required.');
      return;
    }

    try {
      setSubmitting(true);
      const newTeacher = await api.addTeacher({
        staffIdentifier: `FAC-${Math.floor(100 + Math.random() * 899)}`,
        name: teacherName.trim(),
        email: teacherEmail.trim(),
        phone: teacherPhone.trim(),
        designation: teacherDesignation,
        joiningDate: new Date().toISOString().split('T')[0],
        employmentStatus: 'Full-Time',
        accountStatus: 'Active',
        salaryConfig: {
          model: teacherSalaryModel,
          baseMonthlySalary: teacherSalaryModel === 'Fixed monthly' ? teacherBasePay : 0,
          perLessonRate: teacherSalaryModel === 'Per completed lesson' ? 1800 : 0,
          perHourRate: teacherSalaryModel === 'Per hour' ? 1200 : 0,
          allowances: 0,
          standardDeductions: 0,
          effectiveDate: new Date().toISOString().split('T')[0]
        },
        assignments: [
          {
            id: `ASG-${Date.now()}`,
            classNumber: teacherClassNum,
            subjectName: teacherSubject,
            startDate: new Date().toISOString().split('T')[0],
            status: 'Active'
          }
        ]
      });

      toast.success(
        `Faculty member ${newTeacher.name} registered and assigned to Class ${teacherClassNum} (${teacherSubject}).`
      );
      setActiveModal(null);
      setTeacherName('');
      setTeacherEmail('');
      onRefreshMetrics();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to register teacher');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedStudentForChallan = students.find((s) => s.id === challanStudentId);

  return (
    <>
      {/* Dimmed mobile backdrop when speed dial is open */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-2xs z-35 transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Floating Speed Dial Container */}
      <div className="fixed bottom-5 right-5 sm:bottom-7 sm:right-7 z-40 flex flex-col items-end select-none">
        {/* Speed Dial Menu Popover */}
        {isOpen && (
          <div className="mb-3 w-[calc(100vw-2.5rem)] sm:w-80 max-w-sm bg-white border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden p-2 transition-all duration-200 transform origin-bottom-right animate-in fade-in slide-in-from-bottom-3">
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-900 font-heading block">
                  Quick Administrative Actions
                </span>
                <span className="text-[10px] text-slate-400">
                  Rapid operations for Classes 1–8
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200/80">
                Principal
              </span>
            </div>

            <div className="p-1 space-y-1 text-xs">
              {/* Action 1: Mark Attendance */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  setActiveModal('attendance');
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                    <Clock className="w-4 h-4" strokeWidth={1.75} />
                  </div>
                  <div className="truncate">
                    <div className="font-semibold text-slate-800 font-heading text-xs">
                      Mark Attendance
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      Daily session roster for Classes 1–8
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0" />
              </button>

              {/* Action 2: Create Fee Challan */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  setActiveModal('challan');
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                    <Receipt className="w-4 h-4" strokeWidth={1.75} />
                  </div>
                  <div className="truncate">
                    <div className="font-semibold text-slate-800 font-heading text-xs">
                      Create Fee Challan
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      Issue monthly bill or student challan
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0" />
              </button>

              {/* Action 3: New Teacher Entry */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  setActiveModal('teacher');
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                    <UserPlus className="w-4 h-4" strokeWidth={1.75} />
                  </div>
                  <div className="truncate">
                    <div className="font-semibold text-slate-800 font-heading text-xs">
                      New Teacher Entry
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      Onboard faculty with salary model
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0" />
              </button>

              {/* Action 4: Schedule Lesson Shortcut */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  onNavigate('timetable');
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 border border-sky-100 flex items-center justify-center shrink-0 group-hover:bg-sky-100 transition-colors">
                    <CalendarDays className="w-4 h-4" strokeWidth={1.75} />
                  </div>
                  <div className="truncate">
                    <div className="font-semibold text-slate-800 font-heading text-xs">
                      Schedule Lesson
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      Open weekly timetable scheduler
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0" />
              </button>

              {/* Action 5: Dispatch Circular */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  onNavigate('notices');
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 border border-rose-100 flex items-center justify-center shrink-0 group-hover:bg-rose-100 transition-colors">
                    <BellRing className="w-4 h-4" strokeWidth={1.75} />
                  </div>
                  <div className="truncate">
                    <div className="font-semibold text-slate-800 font-heading text-xs">
                      School Circular
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      Publish official notice to portal
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* Primary Floating Trigger Button (FAB) */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close quick actions menu' : 'Open quick actions menu'}
          aria-expanded={isOpen}
          className={`group flex items-center gap-2 px-3.5 py-3 sm:px-4 sm:py-3 rounded-full font-medium shadow-lg transition-all duration-200 active:scale-95 cursor-pointer ${
            isOpen
              ? 'bg-slate-900 text-white shadow-slate-900/20 hover:bg-slate-800 ring-4 ring-slate-900/10'
              : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30 ring-4 ring-amber-600/15'
          }`}
        >
          <div
            className={`transition-transform duration-200 ${isOpen ? 'rotate-45' : 'rotate-0'}`}
          >
            <Plus className="w-5 h-5" strokeWidth={2.25} />
          </div>
          <span className="hidden sm:inline text-xs font-semibold tracking-tight font-heading">
            {isOpen ? 'Close' : 'Quick Actions'}
          </span>
        </button>
      </div>

      {/* 1. Rapid Mark Attendance Modal */}
      <Modal
        isOpen={activeModal === 'attendance'}
        onClose={() => setActiveModal(null)}
        title="Quick Mark Attendance"
        description="Select class & subject to register or update daily attendance records."
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmitAttendance} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 text-xs">
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                Class (1–8)
              </label>
              <select
                value={attClassNumber}
                onChange={(e) => setAttClassNumber(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-amber-500"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
                  <option key={c} value={c}>
                    Class {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                Subject
              </label>
              <select
                value={attSubject}
                onChange={(e) => setAttSubject(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-amber-500"
              >
                <option value="Mathematics">Mathematics</option>
                <option value="English">English</option>
                <option value="Science">Science</option>
                <option value="Urdu">Urdu</option>
                <option value="Islamic Studies">Islamic Studies</option>
                <option value="Social Studies">Social Studies</option>
                <option value="Computer Science">Computer Science</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                Date
              </label>
              <input
                type="date"
                value={attDate}
                onChange={(e) => setAttDate(e.target.value)}
                required
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                Session Time
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={attStartTime}
                  onChange={(e) => setAttStartTime(e.target.value)}
                  placeholder="09:00"
                  className="w-1/2 p-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-center font-mono focus:outline-none"
                />
                <span className="text-slate-400">–</span>
                <input
                  type="text"
                  value={attEndTime}
                  onChange={(e) => setAttEndTime(e.target.value)}
                  placeholder="09:45"
                  className="w-1/2 p-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-center font-mono focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Roster Controls */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-900 font-heading">
                Class {attClassNumber} Roster
              </span>{' '}
              · {rosterRecords.length} enrolled students
            </div>
            <button
              type="button"
              onClick={handleMarkAllPresent}
              className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-medium transition-colors flex items-center gap-1 shadow-2xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark All Present</span>
            </button>
          </div>

          {/* Roster Table */}
          {rosterRecords.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
              No enrolled students registered in Class {attClassNumber}.
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white">
              {rosterRecords.map((record) => (
                <div
                  key={record.studentId}
                  className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-mono text-[11px] text-slate-400 w-12 shrink-0">
                      R-{record.rollNumber}
                    </span>
                    <span className="font-medium text-slate-800 truncate">
                      {record.studentName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleUpdateRecordStatus(record.studentId, 'Present')}
                      className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                        record.status === 'Present'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                    >
                      Present
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateRecordStatus(record.studentId, 'Absent')}
                      className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                        record.status === 'Absent'
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                      }`}
                    >
                      Absent
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateRecordStatus(record.studentId, 'Late')}
                      className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                        record.status === 'Late'
                          ? 'bg-amber-500 text-amber-950 shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                      }`}
                    >
                      Late
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setActiveModal(null);
                onNavigate('attendance');
              }}
              className="text-xs text-amber-700 hover:underline font-medium"
            >
              Open Full Attendance Module →
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || rosterRecords.length === 0}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-medium transition-colors shadow-xs"
              >
                {submitting ? 'Submitting...' : 'Save Attendance Session'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* 2. Rapid Create Fee Challan Modal */}
      <Modal
        isOpen={activeModal === 'challan'}
        onClose={() => setActiveModal(null)}
        title="Quick Create Fee Challan"
        description="Issue an individual verified challan for any enrolled student."
        maxWidth="md"
      >
        <form onSubmit={handleSubmitChallan} className="space-y-4 text-xs">
          <div>
            <label className="text-[11px] font-medium text-slate-600 block mb-1">
              Select Student (Classes 1–8) *
            </label>
            <select
              value={challanStudentId}
              onChange={(e) => setChallanStudentId(e.target.value)}
              required
              className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:border-amber-500"
            >
              <option value="">-- Choose enrolled student --</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (Class {s.classNumber} · Roll {s.rollNumber})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                Billing Month *
              </label>
              <select
                value={challanMonth}
                onChange={(e) => setChallanMonth(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-amber-500"
              >
                <option value="November 2024">November 2024</option>
                <option value="December 2024">December 2024</option>
                <option value="January 2025">January 2025</option>
                <option value="February 2025">February 2025</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                Due Date *
              </label>
              <input
                type="date"
                value={challanDueDate}
                onChange={(e) => setChallanDueDate(e.target.value)}
                required
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-600 block mb-1">
              Late Fee Surcharge (After Due Date)
            </label>
            <input
              type="number"
              value={challanLateFee}
              onChange={(e) => setChallanLateFee(Number(e.target.value))}
              min={0}
              step={100}
              className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Dynamic Preview if student is picked */}
          {selectedStudentForChallan && (
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-800 font-heading">
                Fee Estimate · Class {selectedStudentForChallan.classNumber}
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tuition & Core Academic:</span>
                <span className="font-mono text-slate-800">Rs. 7,000</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Technology & Zoom License:</span>
                <span className="font-mono text-slate-800">Rs. 1,000</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Examination Fee:</span>
                <span className="font-mono text-slate-800">Rs. 800</span>
              </div>
              <div className="pt-1.5 border-t border-slate-200 flex justify-between font-semibold text-amber-900 font-heading">
                <span>Estimated Total Payable:</span>
                <span className="font-mono text-sm">Rs. 8,800</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setActiveModal(null);
                onNavigate('challans');
              }}
              className="text-xs text-amber-700 hover:underline font-medium"
            >
              Batch Challan Module →
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !challanStudentId}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-medium transition-colors shadow-xs"
              >
                {submitting ? 'Generating...' : 'Issue Challan'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* 3. Rapid New Teacher Entry Modal */}
      <Modal
        isOpen={activeModal === 'teacher'}
        onClose={() => setActiveModal(null)}
        title="Quick New Teacher Entry"
        description="Register a faculty member and assign them to an active class curriculum."
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitTeacher} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                Teacher Full Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Dr. Hamza Farooq"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                required
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                Official Email Address *
              </label>
              <input
                type="email"
                placeholder="teacher@onlineschool.edu.pk"
                value={teacherEmail}
                onChange={(e) => setTeacherEmail(e.target.value)}
                required
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                placeholder="+92 300 1234567"
                value={teacherPhone}
                onChange={(e) => setTeacherPhone(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                Designation
              </label>
              <input
                type="text"
                placeholder="Senior Mathematics Teacher"
                value={teacherDesignation}
                onChange={(e) => setTeacherDesignation(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
            <span className="text-[11px] font-semibold text-slate-800 font-heading block">
              Salary & Payroll Model
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Compensation Type</label>
                <select
                  value={teacherSalaryModel}
                  onChange={(e) =>
                    setTeacherSalaryModel(e.target.value as SalaryModel)
                  }
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none"
                >
                  <option value="Fixed monthly">Fixed Monthly Contract</option>
                  <option value="Per completed lesson">Per Completed Lesson Model</option>
                  <option value="Per hour">Per Teaching Hour Model</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 block mb-1">
                  {teacherSalaryModel === 'Fixed monthly' ? 'Monthly Base Pay (PKR)' : 'Rate / Lesson (PKR)'}
                </label>
                <input
                  type="number"
                  value={teacherBasePay}
                  onChange={(e) => setTeacherBasePay(Number(e.target.value))}
                  min={1000}
                  step={1000}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
            <span className="text-[11px] font-semibold text-slate-800 font-heading block">
              Initial Classroom Assignment
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Class</label>
                <select
                  value={teacherClassNum}
                  onChange={(e) => setTeacherClassNum(Number(e.target.value))}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
                    <option key={c} value={c}>
                      Class {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Subject</label>
                <select
                  value={teacherSubject}
                  onChange={(e) => setTeacherSubject(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none"
                >
                  <option value="Mathematics">Mathematics</option>
                  <option value="English">English</option>
                  <option value="Science">Science</option>
                  <option value="Urdu">Urdu</option>
                  <option value="Islamic Studies">Islamic Studies</option>
                  <option value="Social Studies">Social Studies</option>
                  <option value="Computer Science">Computer Science</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setActiveModal(null);
                onNavigate('teachers');
              }}
              className="text-xs text-amber-700 hover:underline font-medium"
            >
              Full Teachers Directory →
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-medium transition-colors shadow-xs"
              >
                {submitting ? 'Registering...' : 'Register Faculty Member'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
};
