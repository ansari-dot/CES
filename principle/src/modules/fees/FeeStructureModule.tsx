import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { ClassFeeStructure, StudentConcession, Student } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  FileText,
  BadgePercent,
  Plus,
  Edit2,
  Calendar,
  CheckCircle2
} from 'lucide-react';

export const FeeStructureModule: React.FC = () => {
  const [structures, setStructures] = useState<ClassFeeStructure[]>([]);
  const [concessions, setConcessions] = useState<StudentConcession[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClassNum, setSelectedClassNum] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Fee Modal
  const [isEditFeeOpen, setIsEditFeeOpen] = useState(false);
  const [editingHeads, setEditingHeads] = useState<ClassFeeStructure['heads']>([]);
  const [editReason, setEditReason] = useState('');
  const [feeSubmitting, setFeeSubmitting] = useState(false);

  // Concession Modal
  const [isConcessionModalOpen, setIsConcessionModalOpen] = useState(false);
  const [concessionForm, setConcessionForm] = useState({
    studentId: '',
    concessionType: 'Sibling Discount' as StudentConcession['concessionType'],
    value: 1500,
    reason: ''
  });
  const [concessionSubmitting, setConcessionSubmitting] = useState(false);

  const toast = useToast();
  const { activeSession } = useAuth();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [fData, cData, sData] = await Promise.all([
        api.getFeeStructures(),
        api.getConcessions(),
        api.getStudents()
      ]);
      setStructures(fData);
      setConcessions(cData);
      setStudents(sData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load fee structures');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeStruct = structures.find((s) => s.classNumber === selectedClassNum);

  const handleOpenEdit = () => {
    if (!activeStruct) return;
    setEditingHeads(JSON.parse(JSON.stringify(activeStruct.heads)));
    setEditReason('');
    setIsEditFeeOpen(true);
  };

  const handleSaveFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editReason.trim()) {
      toast.warning('A reason is required to modify fee structures.');
      return;
    }

    try {
      setFeeSubmitting(true);
      await api.updateFeeStructure(selectedClassNum, editingHeads, editReason);
      toast.success(`Fee structure updated for Class ${selectedClassNum}. Past issued challans preserved.`);
      setIsEditFeeOpen(false);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update fees');
    } finally {
      setFeeSubmitting(false);
    }
  };

  const handleAddConcession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!concessionForm.studentId || !concessionForm.reason.trim()) {
      toast.warning('Please select student and provide authorization reason.');
      return;
    }

    const student = students.find((s) => s.id === concessionForm.studentId);
    if (!student) return;

    try {
      setConcessionSubmitting(true);
      await api.addConcession({
        studentId: student.id,
        studentName: student.name,
        classNumber: student.classNumber,
        concessionType: concessionForm.concessionType,
        value: Number(concessionForm.value),
        reason: concessionForm.reason,
        effectiveSession: activeSession,
        status: 'Active'
      });
      toast.success(`Concession approved for ${student.name}.`);
      setIsConcessionModalOpen(false);
      setConcessionForm({
        studentId: '',
        concessionType: 'Sibling Discount',
        value: 1500,
        reason: ''
      });
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add concession');
    } finally {
      setConcessionSubmitting(false);
    }
  };

  if (loading) return <LoadingState message="Loading fee structures & concessions..." rows={6} />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Fee Structure & Concession Oversight</h2>
          <p className="text-xs text-slate-500">
            Configure class-specific fee heads (Classes 1–8) and authorize verified student concessions.
          </p>
        </div>

        <button
          onClick={() => setIsConcessionModalOpen(true)}
          className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs"
        >
          <BadgePercent className="w-3.5 h-3.5" />
          <span>Authorize Student Concession</span>
        </button>
      </div>

      {/* Class Selector Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200/90 rounded-xl overflow-x-auto text-xs shadow-2xs">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
          <button
            key={c}
            onClick={() => setSelectedClassNum(c)}
            className={`px-3.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedClassNum === c
                ? 'bg-amber-600 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Class {c} Structure
          </button>
        ))}
      </div>

      {/* Active Class Fee Structure Box in Clean White */}
      {!activeStruct ? (
        <div className="p-8 rounded-2xl bg-white border border-slate-200/90 shadow-xs text-xs text-slate-400 text-center">
          No fee structure configured for Class {selectedClassNum}.
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Class {activeStruct.classNumber} Approved Fee Breakdown
              </h3>
              <p className="text-xs text-slate-500">
                Effective Session: {activeStruct.academicSession} · Effective From: {activeStruct.effectiveFrom}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-emerald-800 font-semibold bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-md">
                Monthly Total: Rs. {activeStruct.totalMonthlyRecurring.toLocaleString()}
              </span>
              <button
                onClick={handleOpenEdit}
                className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1 shadow-2xs"
              >
                <Edit2 className="w-3 h-3 text-slate-500" />
                <span>Edit Heads</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {activeStruct.heads.map((h) => (
              <div
                key={h.id}
                className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex flex-col justify-between gap-2 shadow-2xs"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{h.head}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {h.isRecurring ? 'Monthly' : 'One-Time'}
                  </span>
                </div>
                <div className="text-lg font-bold font-mono tabular-nums text-amber-700">
                  Rs. {h.amount.toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-slate-400 italic">
            * SRS Rule 11.3: Modifications update future billing cycles; previously issued challans preserve their original billing breakdown.
          </div>
        </div>
      )}

      {/* Approved Student Concessions List */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <BadgePercent className="w-4 h-4 text-amber-600" />
            <span>Authorized Student Concessions & Scholarships</span>
          </h3>
          <span className="text-[11px] text-slate-500">
            {concessions.length} active fee adjustments on record
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[11px]">
              <tr>
                <th className="px-3.5 py-2.5">Student</th>
                <th className="px-3.5 py-2.5">Class</th>
                <th className="px-3.5 py-2.5">Concession Type</th>
                <th className="px-3.5 py-2.5 font-mono text-right">Discount Value</th>
                <th className="px-3.5 py-2.5">Authorization Reason</th>
                <th className="px-3.5 py-2.5">Approved By</th>
                <th className="px-3.5 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {concessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3.5 py-6 text-center text-slate-400">
                    No authorized fee concessions or scholarships on record.
                  </td>
                </tr>
              ) : (
                concessions.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-3.5 py-2.5 font-semibold text-slate-900">{c.studentName}</td>
                    <td className="px-3.5 py-2.5 text-slate-600">Class {c.classNumber}</td>
                    <td className="px-3.5 py-2.5 text-amber-700 font-medium">{c.concessionType}</td>
                    <td className="px-3.5 py-2.5 font-mono text-right text-emerald-700 font-bold">
                      - Rs. {c.value.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-500 max-w-xs truncate">{c.reason}</td>
                    <td className="px-3.5 py-2.5 text-slate-400">{c.approvedBy}</td>
                    <td className="px-3.5 py-2.5 text-center">
                      <StatusBadge status={c.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Fee Heads Modal */}
      {activeStruct && (
        <Modal
          isOpen={isEditFeeOpen}
          onClose={() => setIsEditFeeOpen(false)}
          title={`Edit Fee Schedule · Class ${selectedClassNum}`}
          description="Adjust approved fee heads. All modifications are logged to the school audit history."
          maxWidth="lg"
        >
          <form onSubmit={handleSaveFee} className="space-y-4 text-xs">
            <div className="space-y-2">
              {editingHeads.map((head, idx) => (
                <div
                  key={head.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3"
                >
                  <span className="font-semibold text-slate-900 w-32">{head.head}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Rs.</span>
                    <input
                      type="number"
                      required
                      value={head.amount}
                      onChange={(e) => {
                        const copy = [...editingHeads];
                        copy[idx].amount = Number(e.target.value);
                        setEditingHeads(copy);
                      }}
                      className="w-28 bg-white border border-slate-200 rounded-lg p-1.5 text-slate-900 font-mono focus:border-amber-500"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={head.isRecurring}
                      onChange={(e) => {
                        const copy = [...editingHeads];
                        copy[idx].isRecurring = e.target.checked;
                        setEditingHeads(copy);
                      }}
                      className="rounded border-slate-300 text-amber-600 focus:ring-0"
                    />
                    <span>Monthly recurring</span>
                  </label>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Reason for Fee Modification <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                required
                rows={2}
                placeholder="State the administrative rationale (e.g. Technology infrastructure upgrade, annual inflation adjustment)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditFeeOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={feeSubmitting}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs"
              >
                {feeSubmitting ? 'Saving...' : 'Update Fee Structure'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Authorize Concession Modal */}
      <Modal
        isOpen={isConcessionModalOpen}
        onClose={() => setIsConcessionModalOpen(false)}
        title="Authorize Student Fee Concession"
        description="Grant a policy-based fee discount for eligible students (sibling discount, merit award, or need-based aid)."
        maxWidth="md"
      >
        <form onSubmit={handleAddConcession} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-medium mb-1">Select Student *</label>
            <select
              value={concessionForm.studentId}
              onChange={(e) => setConcessionForm({ ...concessionForm, studentId: e.target.value })}
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white"
            >
              <option value="">-- Choose Enrolled Student --</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (Class {s.classNumber} · Roll {s.rollNumber})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Concession Type *</label>
            <select
              value={concessionForm.concessionType}
              onChange={(e) => setConcessionForm({ ...concessionForm, concessionType: e.target.value as any })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-semibold focus:bg-white"
            >
              <option value="Sibling Discount">Sibling Discount</option>
              <option value="Merit Scholarship">Merit Scholarship</option>
              <option value="Need Based">Need-Based Financial Aid</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Monthly Discount Amount (PKR) *</label>
            <input
              type="number"
              required
              value={concessionForm.value}
              onChange={(e) => setConcessionForm({ ...concessionForm, value: Number(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-mono focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Approval Justification & Policy Reference <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={concessionForm.reason}
              onChange={(e) => setConcessionForm({ ...concessionForm, reason: e.target.value })}
              required
              rows={3}
              placeholder="State reason (e.g. Sibling discount policy rule, 1st position merit certificate verified)..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsConcessionModalOpen(false)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={concessionSubmitting}
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs"
            >
              {concessionSubmitting ? 'Recording...' : 'Authorize Concession'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
