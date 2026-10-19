import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { Student } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  UserPlus,
  ArrowRightLeft,
  ShieldAlert,
  AlertTriangle,
  History,
  GraduationCap,
  Eye
} from 'lucide-react';

export const StudentsView: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [classFilter, setClassFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Add Student Form
  const [addForm, setAddForm] = useState({
    name: '',
    admissionNumber: '',
    rollNumber: '',
    classNumber: 1,
    contactPhone: '',
    contactEmail: '',
    admissionDate: new Date().toISOString().split('T')[0]
  });

  // Transfer / Promotion Form
  const [destClass, setDestClass] = useState<number>(2);
  const [transferReason, setTransferReason] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  // Status Change Form
  const [statusAction, setStatusAction] = useState<'Activate' | 'Temporarily Suspend' | 'Deactivate' | 'Reactivate'>('Temporarily Suspend');
  const [statusReason, setStatusReason] = useState('');
  const [isFeeNonPayment, setIsFeeNonPayment] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  const toast = useToast();
  const { activeSession } = useAuth();

  const loadStudents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getStudents();
      setStudents(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name || !addForm.admissionNumber || !addForm.rollNumber) {
      toast.warning('Please fill in required student fields.');
      return;
    }

    try {
      await api.addStudent({
        name: addForm.name,
        admissionNumber: addForm.admissionNumber,
        rollNumber: addForm.rollNumber,
        classNumber: Number(addForm.classNumber),
        academicSession: activeSession,
        admissionDate: addForm.admissionDate,
        parentIds: [],
        contactPhone: addForm.contactPhone,
        contactEmail: addForm.contactEmail,
        enrolmentStatus: 'Active',
        accountStatus: 'Active'
      });
      toast.success(`Student ${addForm.name} admitted to Class ${addForm.classNumber}.`);
      setIsAddModalOpen(false);
      setAddForm({
        name: '',
        admissionNumber: '',
        rollNumber: '',
        classNumber: 1,
        contactPhone: '',
        contactEmail: '',
        admissionDate: new Date().toISOString().split('T')[0]
      });
      loadStudents();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to admit student');
    }
  };

  const handleTransferSubmit = async () => {
    if (!selectedStudent) return;
    if (!transferReason.trim()) {
      toast.warning('Please state the formal reason for class transfer / promotion.');
      return;
    }

    try {
      setTransferSubmitting(true);
      await api.transferOrPromoteStudent(
        selectedStudent.id,
        destClass,
        activeSession,
        transferReason
      );
      toast.success(`Student ${selectedStudent.name} successfully transferred to Class ${destClass}.`);
      setIsTransferModalOpen(false);
      setTransferReason('');
      loadStudents();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setTransferSubmitting(false);
    }
  };

  const handleStatusSubmit = async () => {
    if (!selectedStudent) return;
    if ((statusAction === 'Temporarily Suspend' || statusAction === 'Deactivate') && !statusReason.trim()) {
      toast.warning('An administrative justification is mandatory for suspension.');
      return;
    }

    try {
      setStatusSubmitting(true);
      await api.changeStudentStatus(
        selectedStudent.id,
        statusAction,
        statusReason,
        isFeeNonPayment
      );
      toast.success(`Account status for ${selectedStudent.name} updated to ${statusAction}.`);
      setIsStatusModalOpen(false);
      setStatusReason('');
      setIsFeeNonPayment(false);
      loadStudents();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setStatusSubmitting(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    if (classFilter !== 'All' && s.classNumber !== Number(classFilter)) return false;
    if (statusFilter !== 'All' && s.accountStatus !== statusFilter) return false;
    return true;
  });

  const columns: Column<Student>[] = [
    {
      key: 'rollNumber',
      header: 'Roll / Adm No',
      width: '130px',
      render: (s) => (
        <div className="flex flex-col">
          <span className="font-mono text-slate-900 font-bold">Roll {s.rollNumber}</span>
          <span className="font-mono text-[10px] text-slate-500">{s.admissionNumber}</span>
        </div>
      )
    },
    {
      key: 'name',
      header: 'Student Name',
      render: (s) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900">{s.name}</span>
          <span className="text-[11px] text-slate-500">
            Admitted: {s.admissionDate} (Session: {s.academicSession})
          </span>
        </div>
      )
    },
    {
      key: 'classNumber',
      header: 'Enrolled Class',
      align: 'center',
      render: (s) => (
        <span className="font-semibold text-slate-900 text-xs font-mono">
          Class {s.classNumber}
        </span>
      )
    },
    {
      key: 'parentNames',
      header: 'Linked Guardian',
      render: (s) => (
        <div className="flex flex-col max-w-xs">
          {s.parentNames && s.parentNames.length > 0 ? (
            <span className="text-slate-800 font-medium truncate text-xs">{s.parentNames.join(', ')}</span>
          ) : (
            <span className="text-slate-400 italic text-[11px]">No guardian linked</span>
          )}
          <span className="text-[10px] text-slate-500 font-mono">{s.contactPhone}</span>
        </div>
      )
    },
    {
      key: 'accountStatus',
      header: 'Portal Status',
      align: 'center',
      render: (s) => <StatusBadge status={s.accountStatus} />
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (s) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => {
              setSelectedStudent(s);
              setIsDetailsModalOpen(true);
            }}
            title="View Student Dossier & Payment History"
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors shadow-2xs"
          >
            <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          <button
            onClick={() => {
              setSelectedStudent(s);
              setDestClass(Math.min(8, s.classNumber + 1));
              setIsTransferModalOpen(true);
            }}
            title="Promote or Transfer Student Class"
            className="p-1.5 rounded-lg border border-amber-200 bg-amber-50/60 text-amber-700 hover:bg-amber-100 transition-colors shadow-2xs"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          <button
            onClick={() => {
              setSelectedStudent(s);
              setStatusAction(s.accountStatus === 'Active' ? 'Temporarily Suspend' : 'Activate');
              setIsStatusModalOpen(true);
            }}
            title={s.accountStatus === 'Active' ? 'Suspend Student Portal Access' : 'Reactivate Student Access'}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-500 transition-colors shadow-2xs"
          >
            <ShieldAlert className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </div>
      )
    }
  ];

  if (loading) return <LoadingState message="Loading student enrolment records..." rows={6} />;
  if (error) return <ErrorState message={error} onRetry={loadStudents} />;

  return (
    <div className="space-y-4">
      {/* Header Action Bar in clean white card */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Student Enrolment (Classes 1–8)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Class rosters, parent linkages, transfer/promotion history, and automated fee non-payment access suspensions.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
        >
          <UserPlus className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Enrol New Student</span>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={filteredStudents}
        keyExtractor={(s) => s.id}
        searchPlaceholder="Search by student name, roll number, admission number..."
        searchFilter={(s, q) =>
          s.name.toLowerCase().includes(q) ||
          s.admissionNumber.toLowerCase().includes(q) ||
          s.rollNumber.toLowerCase().includes(q)
        }
        filtersSlot={
          <div className="flex items-center gap-2">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:bg-white"
            >
              <option value="All">All Classes (1 to 8)</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:bg-white"
            >
              <option value="All">All Portal Statuses</option>
              <option value="Active">Active</option>
              <option value="Temporarily Suspend">Temporarily Suspended</option>
              <option value="Deactivated">Deactivated</option>
            </select>
          </div>
        }
      />

      {/* Add Student Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Admit New Student"
        description="Register an online student into Classes 1 through 8. Initial login credentials will be generated."
        maxWidth="lg"
      >
        <form onSubmit={handleAddStudent} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Student Full Name *</label>
              <input
                type="text"
                required
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="e.g. Maryam Farooq"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Target Class *</label>
              <select
                value={addForm.classNumber}
                onChange={(e) => setAddForm({ ...addForm, classNumber: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-semibold focus:bg-white"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
                  <option key={c} value={c}>Class {c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Admission Number *</label>
              <input
                type="text"
                required
                value={addForm.admissionNumber}
                onChange={(e) => setAddForm({ ...addForm, admissionNumber: e.target.value })}
                placeholder="ADM-2024-109"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-mono focus:bg-white focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Class Roll Number *</label>
              <input
                type="text"
                required
                value={addForm.rollNumber}
                onChange={(e) => setAddForm({ ...addForm, rollNumber: e.target.value })}
                placeholder="e.g. 21"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-mono focus:bg-white focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Guardian Contact Phone</label>
              <input
                type="tel"
                value={addForm.contactPhone}
                onChange={(e) => setAddForm({ ...addForm, contactPhone: e.target.value })}
                placeholder="+92 300 1234567"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Guardian Email</label>
              <input
                type="email"
                value={addForm.contactEmail}
                onChange={(e) => setAddForm({ ...addForm, contactEmail: e.target.value })}
                placeholder="guardian@example.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white"
              />
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
              Complete Admission
            </button>
          </div>
        </form>
      </Modal>

      {/* Class Transfer & Promotion Modal */}
      {selectedStudent && (
        <Modal
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          title={`Class Promotion / Transfer · ${selectedStudent.name}`}
          description={`Current Enrolment: Class ${selectedStudent.classNumber} (Roll: ${selectedStudent.rollNumber})`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-slate-500 block text-[10px]">Current Class</span>
                <span className="text-sm font-semibold text-slate-900">Class {selectedStudent.classNumber}</span>
              </div>
              <ArrowRightLeft className="w-4 h-4 text-amber-600" />
              <div>
                <span className="text-slate-500 block text-[10px]">Destination Class</span>
                <select
                  value={destClass}
                  onChange={(e) => setDestClass(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded p-1 text-sm font-semibold text-amber-800"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
                    <option key={c} value={c}>Class {c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Transfer / Promotion Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                rows={3}
                placeholder="State the academic justification (e.g. Annual Promotion after successful final term evaluation)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white resize-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-tight">
              Preservation Rule: Historical attendance, grades, past fee challans, and assignment submissions remain intact and linked to previous session records.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTransferSubmit}
                disabled={transferSubmitting}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs"
              >
                {transferSubmitting ? 'Transferring...' : 'Confirm Class Transfer'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Student Account Control Modal */}
      {selectedStudent && (
        <Modal
          isOpen={isStatusModalOpen}
          onClose={() => setIsStatusModalOpen(false)}
          title={`Student Portal Access Control · ${selectedStudent.name}`}
          description={`Admission: ${selectedStudent.admissionNumber} · Class: ${selectedStudent.classNumber}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Action *</label>
              <select
                value={statusAction}
                onChange={(e) => setStatusAction(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-semibold focus:bg-white"
              >
                <option value="Activate">Activate Portal Access</option>
                <option value="Temporarily Suspend">Temporarily Suspend Portal Access</option>
                <option value="Deactivate">Deactivate Student Account</option>
                <option value="Reactivate">Reactivate Account</option>
              </select>
            </div>

            {statusAction === 'Temporarily Suspend' && (
              <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeeNonPayment}
                  onChange={(e) => setIsFeeNonPayment(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-0"
                />
                <span className="text-slate-700 font-medium">
                  Suspension is due to overdue fee non-payment policy (auto-restored upon fee clearance)
                </span>
              </label>
            )}

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Formal Administrative Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                rows={3}
                placeholder="Detail reason for access restriction..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white resize-none"
              />
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
                onClick={handleStatusSubmit}
                disabled={statusSubmitting}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs"
              >
                {statusSubmitting ? 'Updating...' : 'Save Account Status'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Student Details & History Modal */}
      {selectedStudent && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          title={`Student Record · ${selectedStudent.name}`}
          description={`Class ${selectedStudent.classNumber} · Roll: ${selectedStudent.rollNumber}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            {selectedStudent.suspensionDetails && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                <div className="flex items-center gap-1.5 font-semibold text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Portal Suspended: {selectedStudent.suspensionDetails.reason}</span>
                </div>
                <div className="text-[11px] text-rose-700 mt-1">
                  Enforced by: {selectedStudent.suspensionDetails.suspendedBy} · Effective: {new Date(selectedStudent.suspensionDetails.effectiveDate).toLocaleDateString()}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-slate-500 block text-[10px]">Admission No</span>
                <p className="font-mono text-slate-800 mt-0.5">{selectedStudent.admissionNumber}</p>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Enrolment Date</span>
                <p className="font-mono text-slate-800 mt-0.5">{selectedStudent.admissionDate}</p>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Academic Session</span>
                <p className="text-slate-800 mt-0.5">{selectedStudent.academicSession}</p>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Status</span>
                <p className="text-slate-800 mt-0.5 font-medium">{selectedStudent.enrolmentStatus} ({selectedStudent.accountStatus})</p>
              </div>
            </div>

            {/* Transfer & Promotion History */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-amber-600" />
                <span>Class Transfer & Promotion Audit History</span>
              </h4>
              {selectedStudent.transferHistory.length === 0 ? (
                <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 italic">
                  No historical class transfers on record. Admitted directly into Class {selectedStudent.classNumber}.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedStudent.transferHistory.map((trf) => (
                    <div
                      key={trf.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between text-slate-500 text-[11px]">
                        <span className="font-semibold text-amber-800">
                          Class {trf.previousClass} → Class {trf.newClass}
                        </span>
                        <span className="font-mono text-[10px]">
                          {new Date(trf.effectiveDate).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-slate-700">{trf.reason}</p>
                      <span className="text-[10px] text-slate-400">Authorized by: {trf.transferredBy}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
