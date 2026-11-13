import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { Teacher, SalaryModel } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { AcademicPerformancePanel } from './accountability/AcademicPerformancePanel';
import { WorkPoliciesPanel } from './accountability/WorkPoliciesPanel';
import {
  UserPlus,
  ShieldAlert,
  BookOpen,
  Calendar,
  AlertTriangle,
  Briefcase,
  Eye,
  Settings2,
  CheckCircle2,
  Clock,
  Video,
  RefreshCw
} from 'lucide-react';

/** Existing faculty directory screen (unchanged). */
const FacultyDirectory: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [modelFilter, setModelFilter] = useState<string>('All');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // Zoom Server-to-Server Tracked Duty state
  const [dailyDuty, setDailyDuty] = useState<any>(null);
  const [loadingDuty, setLoadingDuty] = useState(false);

  // Account Status Form
  const [statusAction, setStatusAction] = useState<'Activate' | 'Temporarily Suspend' | 'Deactivate' | 'Reactivate'>('Temporarily Suspend');
  const [statusReason, setStatusReason] = useState('');
  const [statusExpiry, setStatusExpiry] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  // Add Teacher Form
  const [addForm, setAddForm] = useState({
    name: '',
    staffIdentifier: '',
    email: '',
    phone: '',
    designation: '',
    joiningDate: new Date().toISOString().split('T')[0],
    employmentStatus: 'Full-Time' as const,
    salaryModel: 'Fixed monthly' as SalaryModel,
    baseMonthlySalary: 65000,
    perLessonRate: 1200,
    perHourRate: 1500,
    allowances: 5000,
    standardDeductions: 2500
  });

  const toast = useToast();

  const loadTeachers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getTeachers();
      setTeachers(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load teachers list');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name || !addForm.staffIdentifier || !addForm.email) {
      toast.warning('Please complete all required fields.');
      return;
    }
    try {
      await api.addTeacher({
        name: addForm.name,
        staffIdentifier: addForm.staffIdentifier,
        email: addForm.email,
        phone: addForm.phone,
        designation: addForm.designation,
        joiningDate: addForm.joiningDate,
        employmentStatus: addForm.employmentStatus,
        accountStatus: 'Active',
        salaryConfig: {
          model: addForm.salaryModel,
          baseMonthlySalary: Number(addForm.baseMonthlySalary) || 0,
          perLessonRate: Number(addForm.perLessonRate) || 0,
          perHourRate: Number(addForm.perHourRate) || 0,
          allowances: Number(addForm.allowances) || 0,
          standardDeductions: Number(addForm.standardDeductions) || 0,
          effectiveDate: addForm.joiningDate
        },
        assignments: []
      });
      toast.success(`Teacher ${addForm.name} onboarded successfully.`);
      setIsAddModalOpen(false);
      loadTeachers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add teacher');
    }
  };

  const handleStatusChangeSubmit = async () => {
    if (!selectedTeacher) return;
    if ((statusAction === 'Temporarily Suspend' || statusAction === 'Deactivate') && !statusReason.trim()) {
      toast.warning('A recorded reason is mandatory for suspension or deactivation.');
      return;
    }

    try {
      setStatusSubmitting(true);
      await api.changeTeacherStatus(
        selectedTeacher.id,
        statusAction,
        statusReason,
        statusExpiry || undefined,
        internalNote || undefined
      );
      toast.success(`Teacher ${selectedTeacher.name} status updated to ${statusAction}.`);
      setIsStatusModalOpen(false);
      setStatusReason('');
      setStatusExpiry('');
      setInternalNote('');
      loadTeachers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update teacher status');
    } finally {
      setStatusSubmitting(false);
    }
  };

  const handleOpenDetails = async (t: Teacher) => {
    setSelectedTeacher(t);
    setIsDetailsModalOpen(true);
    setLoadingDuty(true);
    setDailyDuty(null);
    try {
      const duty = await api.getTeacherDailyDuty(t.id);
      setDailyDuty(duty);
    } catch {
      // quiet fallback
    } finally {
      setLoadingDuty(false);
    }
  };

  const filteredTeachers = teachers.filter((t) => {
    if (statusFilter !== 'All' && t.accountStatus !== statusFilter) return false;
    if (modelFilter !== 'All' && t.salaryConfig.model !== modelFilter) return false;
    return true;
  });

  const columns: Column<Teacher>[] = [
    {
      key: 'staffIdentifier',
      header: 'Staff ID',
      width: '110px',
      render: (t) => <span className="font-mono text-slate-500 font-semibold">{t.staffIdentifier}</span>
    },
    {
      key: 'name',
      header: 'Faculty Name & Email',
      render: (t) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900">{t.name}</span>
          <span className="text-[11px] text-slate-500">{t.email}</span>
        </div>
      )
    },
    {
      key: 'designation',
      header: 'Designation & Type',
      render: (t) => (
        <div className="flex flex-col">
          <span className="text-slate-700 font-medium">{t.designation}</span>
          <span className="text-[11px] text-slate-400">{t.employmentStatus}</span>
        </div>
      )
    },
    {
      key: 'assignments',
      header: 'Assigned Classes',
      render: (t) => {
        if (!t.assignments || t.assignments.length === 0) {
          return <span className="text-slate-400 italic text-[11px]">Unassigned</span>;
        }
        return (
          <div className="flex items-center gap-1.5 text-xs text-slate-700 max-w-xs">
            <BookOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" strokeWidth={1.75} />
            <span
              className="truncate font-medium text-slate-700"
              title={t.assignments.map((a) => `Class ${a.classNumber}: ${a.subjectName}`).join(', ')}
            >
              {t.assignments.map((a) => `Cls ${a.classNumber} (${a.subjectName})`).join(' · ')}
            </span>
          </div>
        );
      }
    },
    {
      key: 'salaryModel',
      header: 'Salary Model',
      render: (t) => (
        <span className="text-[11px] font-mono font-medium text-amber-700">
          {t.salaryConfig.model}
        </span>
      )
    },
    {
      key: 'accountStatus',
      header: 'Status',
      align: 'center',
      render: (t) => <StatusBadge status={t.accountStatus} />
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (t) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleOpenDetails(t)}
            title="View Teacher Profile, Zoom Tracked Hours & Duty"
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors shadow-2xs"
          >
            <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          <button
            onClick={() => {
              setSelectedTeacher(t);
              setStatusAction(t.accountStatus === 'Active' ? 'Temporarily Suspend' : 'Activate');
              setIsStatusModalOpen(true);
            }}
            title={t.accountStatus === 'Active' ? 'Account Access Control & Suspension' : 'Reactivate Teacher Access'}
            className="p-1.5 rounded-lg border border-amber-200 bg-amber-50/60 text-amber-700 hover:bg-amber-100 transition-colors shadow-2xs"
          >
            <ShieldAlert className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </div>
      )
    }
  ];

  if (loading) return <LoadingState message="Loading teacher records from backend..." rows={5} />;
  if (error) return <ErrorState message={error} onRetry={loadTeachers} />;

  return (
    <div className="space-y-4">
      {/* Header Action Bar in clean white card */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Faculty & Teacher Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Oversee staff profiles, Class 1–8 subject assignments, salary models, and authorized account status control.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
        >
          <UserPlus className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Add New Teacher</span>
        </button>
      </div>

      {/* Filter Slot */}
      <DataTable
        columns={columns}
        data={filteredTeachers}
        keyExtractor={(t) => t.id}
        searchPlaceholder="Search by teacher name, staff ID, designation..."
        searchFilter={(t, q) =>
          t.name.toLowerCase().includes(q) ||
          t.staffIdentifier.toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q) ||
          t.designation.toLowerCase().includes(q)
        }
        filtersSlot={
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:bg-white"
            >
              <option value="All">All Account Statuses</option>
              <option value="Active">Active</option>
              <option value="Temporarily Suspend">Temporarily Suspended</option>
              <option value="Deactivated">Deactivated</option>
            </select>

            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:bg-white"
            >
              <option value="All">All Salary Models</option>
              <option value="Fixed monthly">Fixed Monthly</option>
              <option value="Per completed lesson">Per Completed Lesson</option>
              <option value="Per hour">Per Hour</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>
        }
      />

      {/* Add Teacher Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Faculty Member"
        description="Register a new teacher profile, assign initial designation, and configure payroll structure."
        maxWidth="2xl"
      >
        <form onSubmit={handleAddTeacher} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="e.g. Mrs. Saima Khalid"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Staff Identifier *</label>
              <input
                type="text"
                required
                value={addForm.staffIdentifier}
                onChange={(e) => setAddForm({ ...addForm, staffIdentifier: e.target.value })}
                placeholder="e.g. TCH-2024-007"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-mono focus:bg-white focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Official Email Address *</label>
              <input
                type="email"
                required
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                placeholder="teacher@iqraonlineacademy.edu.pk"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Contact Phone</label>
              <input
                type="tel"
                value={addForm.phone}
                onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                placeholder="+92 300 0000000"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Designation *</label>
              <input
                type="text"
                required
                value={addForm.designation}
                onChange={(e) => setAddForm({ ...addForm, designation: e.target.value })}
                placeholder="e.g. Junior Science Teacher"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Employment Type</label>
              <select
                value={addForm.employmentStatus}
                onChange={(e) => setAddForm({ ...addForm, employmentStatus: e.target.value as any })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white focus:border-amber-500"
              >
                <option value="Full-Time">Full-Time</option>
                <option value="Part-Time">Part-Time</option>
                <option value="Contract">Contract</option>
              </select>
            </div>
          </div>

          {/* Salary Model Section */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-amber-800">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Salary & Compensation Structure</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 mb-1">Configured Salary Model</label>
                <select
                  value={addForm.salaryModel}
                  onChange={(e) => setAddForm({ ...addForm, salaryModel: e.target.value as SalaryModel })}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-medium"
                >
                  <option value="Fixed monthly">Fixed Monthly Base</option>
                  <option value="Per completed lesson">Per Completed Lesson</option>
                  <option value="Per hour">Per Teaching Hour</option>
                  <option value="Hybrid">Hybrid (Base + Per Lesson)</option>
                </select>
              </div>

              {(addForm.salaryModel === 'Fixed monthly' || addForm.salaryModel === 'Hybrid') && (
                <div>
                  <label className="block text-slate-600 mb-1">Base Monthly Salary (Rs.)</label>
                  <input
                    type="number"
                    value={addForm.baseMonthlySalary}
                    onChange={(e) => setAddForm({ ...addForm, baseMonthlySalary: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-mono"
                  />
                </div>
              )}

              {(addForm.salaryModel === 'Per completed lesson' || addForm.salaryModel === 'Hybrid') && (
                <div>
                  <label className="block text-slate-600 mb-1">Rate per Completed Lesson (Rs.)</label>
                  <input
                    type="number"
                    value={addForm.perLessonRate}
                    onChange={(e) => setAddForm({ ...addForm, perLessonRate: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-mono"
                  />
                </div>
              )}

              {addForm.salaryModel === 'Per hour' && (
                <div>
                  <label className="block text-slate-600 mb-1">Rate per Verified Teaching Hour (Rs.)</label>
                  <input
                    type="number"
                    value={addForm.perHourRate}
                    onChange={(e) => setAddForm({ ...addForm, perHourRate: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-600 mb-1">Standard Allowances (Rs.)</label>
                <input
                  type="number"
                  value={addForm.allowances}
                  onChange={(e) => setAddForm({ ...addForm, allowances: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Standard Deductions (Rs.)</label>
                <input
                  type="number"
                  value={addForm.standardDeductions}
                  onChange={(e) => setAddForm({ ...addForm, standardDeductions: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs"
            >
              Save Faculty Member
            </button>
          </div>
        </form>
      </Modal>

      {/* Teacher Profile & Duty Summary Modal */}
      {selectedTeacher && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          title={`Faculty Profile · ${selectedTeacher.name}`}
          description={`Staff ID: ${selectedTeacher.staffIdentifier} · Designation: ${selectedTeacher.designation}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            {/* Account Status Alert if Suspended */}
            {selectedTeacher.accountStatus !== 'Active' && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Account Status: {selectedTeacher.accountStatus}</span>
                </div>
                {selectedTeacher.suspensionDetails && (
                  <p className="text-[11px] text-rose-700">
                    Reason: {selectedTeacher.suspensionDetails.reason}
                    {selectedTeacher.suspensionDetails.expiryDate && (
                      <span> · Expiry: {new Date(selectedTeacher.suspensionDetails.expiryDate).toLocaleDateString()}</span>
                    )}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-slate-500 block text-[10px]">Employment Type</span>
                <p className="font-semibold text-slate-800 mt-0.5">{selectedTeacher.employmentStatus}</p>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Joining Date</span>
                <p className="font-mono text-slate-800 mt-0.5">{selectedTeacher.joiningDate}</p>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Salary Model</span>
                <p className="font-semibold text-amber-700 mt-0.5">{selectedTeacher.salaryConfig.model}</p>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Contact</span>
                <p className="text-slate-800 mt-0.5">{selectedTeacher.phone}</p>
              </div>
            </div>

            {/* Zoom Server-to-Server Daily Duty & Attendance Tracking */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 border border-blue-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-blue-900 text-xs">
                  <Video className="w-4 h-4 text-blue-600" />
                  <span>Today's Zoom Server-to-Server Duty &amp; Attendance</span>
                </div>
                {dailyDuty && (
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    dailyDuty.totalCompletedLessons > 0
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    {dailyDuty.attendanceStatus}
                  </span>
                )}
              </div>

              {loadingDuty ? (
                <div className="text-center py-2 text-slate-500 text-[11px] flex items-center justify-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span>Querying Zoom Server-to-Server presence logs...</span>
                </div>
              ) : dailyDuty ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-center bg-white/80 p-2.5 rounded-lg border border-blue-100 text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Tracked Zoom Time</span>
                      <span className="font-bold font-mono text-blue-900">{dailyDuty.totalTrackedHours} hrs</span>
                      <span className="text-slate-400 text-[10px] block font-mono">({dailyDuty.totalTrackedMinutes} mins)</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Completed Classes</span>
                      <span className="font-bold text-slate-800">{dailyDuty.totalCompletedLessons} / {dailyDuty.totalScheduledLessons}</span>
                      <span className="text-slate-400 text-[10px] block">delivered today</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Payroll Calculation</span>
                      <span className="font-bold text-emerald-700">Auto-Linked</span>
                      <span className="text-slate-400 text-[10px] block">{selectedTeacher.salaryConfig.model}</span>
                    </div>
                  </div>

                  {dailyDuty.lessons && dailyDuty.lessons.length > 0 ? (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Class-by-Class Verified Session Duty Log:</span>
                      {dailyDuty.lessons.map((les: any) => (
                        <div key={les.id} className="p-2 rounded-lg bg-white border border-slate-200 text-[11px] flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900">{les.className} · {les.subjectName}</span>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Join: {les.actualJoinTime ? new Date(les.actualJoinTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Scheduled'} → 
                              Leave: {les.actualLeaveTime ? new Date(les.actualLeaveTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-blue-800">{les.trackedMinutes} mins</span>
                            <span className="text-[10px] text-slate-400 block font-mono">({les.trackedHours} hrs)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic text-center py-1">
                      No timetable lessons scheduled for this teacher today.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic text-center">No duty records found.</p>
              )}
            </div>

            {/* Active Class Assignments */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                <span>Classroom Assignments (Classes 1–8)</span>
              </h4>
              {selectedTeacher.assignments.length === 0 ? (
                <p className="text-slate-500 italic p-3 bg-slate-50 rounded-xl border border-slate-200">
                  No classroom subject assignments currently registered.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedTeacher.assignments.map((asg) => (
                    <div
                      key={asg.id}
                      className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-2xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">Class {asg.classNumber}</span>
                        <div className="text-slate-500 text-[11px]">{asg.subjectName}</div>
                      </div>
                      <StatusBadge status={asg.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Historical duty note */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
              <span>Historical Zoom lesson logs, attendance submissions, and monthly payroll records preserved permanently.</span>
              <button
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  setIsStatusModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium transition-colors shrink-0 ml-3 shadow-2xs"
              >
                Change Account Status
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Teacher Account Control Modal */}
      {selectedTeacher && (
        <Modal
          isOpen={isStatusModalOpen}
          onClose={() => setIsStatusModalOpen(false)}
          title={`Teacher Account Control · ${selectedTeacher.name}`}
          description="Enforce account status changes. All actions are logged to the school audit history."
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Administrative Action *</label>
              <select
                value={statusAction}
                onChange={(e) => setStatusAction(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-semibold focus:bg-white"
              >
                <option value="Activate">Activate Portal Access</option>
                <option value="Temporarily Suspend">Temporarily Suspend Account</option>
                <option value="Deactivate">Deactivate Account</option>
                <option value="Reactivate">Reactivate Account</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Reason / Investigation Note <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                rows={3}
                placeholder="State the formal administrative reason (recorded in immutable audit log)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white resize-none"
              />
            </div>

            {statusAction === 'Temporarily Suspend' && (
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Optional Suspension Expiry Date
                </label>
                <input
                  type="date"
                  value={statusExpiry}
                  onChange={(e) => setStatusExpiry(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-mono focus:bg-white"
                />
              </div>
            )}

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Internal Administrative Remarks (Principal Eyes Only)
              </label>
              <input
                type="text"
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Optional internal note regarding timetable reallocation..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white"
              />
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-tight">
              Rule: Historical lesson completions, grades, and payroll drafts remain intact. Suspension restricts live Zoom host permissions.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStatusChangeSubmit}
                disabled={statusSubmitting}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors shadow-xs"
              >
                {statusSubmitting ? 'Recording...' : 'Confirm Status Change'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

/**
 * Teachers module: the existing Faculty Directory plus the Teacher Academic Accountability
 * sections (performance monitoring with evidence, and work policies).
 */
export const TeachersView: React.FC = () => {
  const [tab, setTab] = useState<'directory' | 'performance' | 'policies'>('directory');
  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-white border border-slate-200/90 rounded-xl p-1 w-fit text-xs font-medium shadow-2xs">
        {([
          ['directory', 'Faculty Directory'],
          ['performance', 'Academic Performance'],
          ['policies', 'Work Policies']
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${tab === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'directory' && <FacultyDirectory />}
      {tab === 'performance' && <AcademicPerformancePanel />}
      {tab === 'policies' && <WorkPoliciesPanel />}
    </div>
  );
};
