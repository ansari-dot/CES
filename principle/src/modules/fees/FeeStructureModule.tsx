import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { ClassFeeStructure, StudentConcession, Student, FeeHeadType } from '../../types';
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
  Trash2,
  Calendar,
  CheckCircle2,
  Layers,
  XCircle,
  AlertCircle
} from 'lucide-react';

export const FeeStructureModule: React.FC = () => {
  const [structures, setStructures] = useState<ClassFeeStructure[]>([]);
  const [concessions, setConcessions] = useState<StudentConcession[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClassNum, setSelectedClassNum] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit / Add Fee Modal
  const [isEditFeeOpen, setIsEditFeeOpen] = useState(false);
  const [modalTargetClass, setModalTargetClass] = useState<number>(1);
  const [editingHeads, setEditingHeads] = useState<
    Array<{
      id: string;
      head: FeeHeadType;
      amount: number | '';
      isRecurring: boolean;
      description?: string;
    }>
  >([]);
  const [editReason, setEditReason] = useState('');
  const [feeSubmitting, setFeeSubmitting] = useState(false);

  // Concession Modal
  const [isConcessionModalOpen, setIsConcessionModalOpen] = useState(false);
  const [concessionForm, setConcessionForm] = useState<{
    studentId: string;
    concessionType: StudentConcession['concessionType'];
    value: number | '';
    reason: string;
  }>({
    studentId: '',
    concessionType: 'Sibling Discount',
    value: '',
    reason: ''
  });
  const [concessionSubmitting, setConcessionSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

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

  const handleOpenEdit = (targetClass: number = selectedClassNum) => {
    setModalTargetClass(targetClass);
    const existing = structures.find((s) => s.classNumber === targetClass);
    if (existing && existing.heads && existing.heads.length > 0) {
      setEditingHeads(
        existing.heads.map((h) => ({
          id: String(h.id || Date.now() + Math.random()),
          head: h.head,
          amount: Number(h.amount) || '',
          isRecurring: Boolean(h.isRecurring),
          description: h.description || `${h.head} Fee`
        }))
      );
    } else {
      // Start with clean default head with empty amount so user types their own values
      setEditingHeads([
        {
          id: String(Date.now()),
          head: 'Tuition',
          amount: '',
          isRecurring: true,
          description: 'Monthly Tuition Fee'
        }
      ]);
    }
    setEditReason('');
    setIsEditFeeOpen(true);
  };

  const handleTargetClassChangeInModal = (newClass: number) => {
    setModalTargetClass(newClass);
    const existing = structures.find((s) => s.classNumber === newClass);
    if (existing && existing.heads && existing.heads.length > 0) {
      setEditingHeads(
        existing.heads.map((h) => ({
          id: String(h.id || Date.now() + Math.random()),
          head: h.head,
          amount: Number(h.amount) || '',
          isRecurring: Boolean(h.isRecurring),
          description: h.description || `${h.head} Fee`
        }))
      );
    } else {
      setEditingHeads([
        {
          id: String(Date.now()),
          head: 'Tuition',
          amount: '',
          isRecurring: true,
          description: 'Monthly Tuition Fee'
        }
      ]);
    }
  };

  const handleAddHead = () => {
    setEditingHeads((prev) => [
      ...prev,
      {
        id: String(Date.now() + Math.random()),
        head: 'Other',
        amount: '',
        isRecurring: true,
        description: ''
      }
    ]);
  };

  const handleRemoveHead = (idx: number) => {
    setEditingHeads((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHeads.length) {
      toast.warning('Please add at least one fee head.');
      return;
    }
    const hasInvalid = editingHeads.some((h) => h.amount === '' || Number(h.amount) <= 0);
    if (hasInvalid) {
      toast.warning('Please enter a valid amount greater than 0 for each fee head.');
      return;
    }
    if (!editReason.trim()) {
      toast.warning('A reason or administrative note is required.');
      return;
    }

    try {
      setFeeSubmitting(true);
      const headsPayload = editingHeads.map((h) => ({
        id: h.id,
        head: h.head,
        amount: Number(h.amount),
        isRecurring: Boolean(h.isRecurring),
        description: h.description || `${h.head} Fee`
      }));

      await api.updateFeeStructure(modalTargetClass, headsPayload, editReason.trim());
      toast.success(`Fee structure saved and published for Class ${modalTargetClass}.`);
      setSelectedClassNum(modalTargetClass);
      setIsEditFeeOpen(false);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update fees');
    } finally {
      setFeeSubmitting(false);
    }
  };

  const handleAddConcession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!concessionForm.studentId) {
      toast.warning('Please select an enrolled student.');
      return;
    }
    if (concessionForm.value === '' || Number(concessionForm.value) <= 0) {
      toast.warning('Please enter a concession discount value greater than 0.');
      return;
    }
    if (!concessionForm.reason.trim()) {
      toast.warning('Please provide authorization reason and policy reference.');
      return;
    }

    const student = students.find((s) => s.id === concessionForm.studentId);
    if (!student) {
      toast.error('Selected student record not found.');
      return;
    }

    try {
      setConcessionSubmitting(true);
      await api.addConcession({
        studentId: student.id,
        studentName: student.name,
        classNumber: student.classNumber,
        concessionType: concessionForm.concessionType,
        value: Number(concessionForm.value),
        reason: concessionForm.reason.trim(),
        effectiveSession: activeSession || '2026-27',
        status: 'Active'
      });
      toast.success(`Concession authorized for ${student.name}.`);
      setIsConcessionModalOpen(false);
      setConcessionForm({
        studentId: '',
        concessionType: 'Sibling Discount',
        value: '',
        reason: ''
      });
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add concession');
    } finally {
      setConcessionSubmitting(false);
    }
  };

  const handleRevokeConcession = async (id: string, studentName: string) => {
    if (!window.confirm(`Are you sure you want to revoke the fee concession for ${studentName}?`)) {
      return;
    }
    try {
      setRevokingId(id);
      await api.revokeConcession(id);
      toast.success(`Concession for ${studentName} has been revoked.`);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke concession');
    } finally {
      setRevokingId(null);
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenEdit(selectedClassNum)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{activeStruct ? `Edit Class ${selectedClassNum} Fees` : `+ Add Class ${selectedClassNum} Fees`}</span>
          </button>

          <button
            onClick={() => {
              setConcessionForm({
                studentId: '',
                concessionType: 'Sibling Discount',
                value: '',
                reason: ''
              });
              setIsConcessionModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <BadgePercent className="w-3.5 h-3.5" />
            <span>Authorize Student Concession</span>
          </button>
        </div>
      </div>

      {/* Grade / Class Controls: Dropdown Selector + Non-Clipped Tab Pills */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2.5 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2">
          <label htmlFor="class-select" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
            Select Grade Level:
          </label>
          <select
            id="class-select"
            value={selectedClassNum}
            onChange={(e) => setSelectedClassNum(Number(e.target.value))}
            className="bg-slate-50 border border-slate-300 hover:border-amber-500 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => {
              const configured = structures.some((s) => s.classNumber === c);
              return (
                <option key={c} value={c}>
                  Class {c} {configured ? '✓ (Configured)' : '(Not Configured)'}
                </option>
              );
            })}
          </select>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto text-xs py-0.5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => {
            const isConfigured = structures.some((s) => s.classNumber === c);
            const isSelected = selectedClassNum === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedClassNum(c)}
                className={`shrink-0 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-500 text-amber-950 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Class {c}</span>
                {isConfigured && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`}
                    title="Configured"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Class Fee Structure Box */}
      {!activeStruct ? (
        <div className="p-8 rounded-2xl bg-white border border-slate-200/90 shadow-xs text-xs text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
            <FileText className="w-6 h-6" />
          </div>
          <div className="text-slate-900 font-semibold text-sm">
            No Fee Schedule Configured for Class {selectedClassNum}
          </div>
          <p className="text-slate-500 max-w-md mx-auto">
            No fee heads have been set for Class {selectedClassNum} yet. Click below to add Tuition, Admission, Examination, Books, or other custom fees to define official monthly rates for this class.
          </p>
          <button
            onClick={() => handleOpenEdit(selectedClassNum)}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Class {selectedClassNum} Fee Schedule</span>
          </button>
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
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
                onClick={() => handleOpenEdit(selectedClassNum)}
                className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
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
                {h.description && (
                  <div className="text-[11px] text-slate-400 truncate">{h.description}</div>
                )}
              </div>
            ))}
          </div>

          <div className="text-[11px] text-slate-400 italic">
            * Modifications update future billing cycles; previously issued challans preserve their original billing breakdown.
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
            {concessions.length} fee {concessions.length === 1 ? 'adjustment' : 'adjustments'} on record
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
                <th className="px-3.5 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {concessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3.5 py-8 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <BadgePercent className="w-6 h-6 text-slate-300" />
                      <span className="font-medium text-slate-600">No Authorized Student Concessions On Record</span>
                      <span className="text-[11px] text-slate-400">
                        Click "Authorize Student Concession" above to add a verified discount or scholarship.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                concessions.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-3.5 py-2.5 font-semibold text-slate-900">{c.studentName}</td>
                    <td className="px-3.5 py-2.5 text-slate-600">Class {c.classNumber}</td>
                    <td className="px-3.5 py-2.5 text-amber-700 font-medium">{c.concessionType}</td>
                    <td className="px-3.5 py-2.5 font-mono text-right text-emerald-700 font-bold">
                      {c.concessionType === 'Percentage'
                        ? `- ${c.value}%`
                        : `- Rs. ${c.value.toLocaleString()}`}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-500 max-w-xs truncate">{c.reason}</td>
                    <td className="px-3.5 py-2.5 text-slate-400">{c.approvedBy}</td>
                    <td className="px-3.5 py-2.5 text-center">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      {c.status === 'Active' ? (
                        <button
                          onClick={() => handleRevokeConcession(c.id, c.studentName)}
                          disabled={revokingId === c.id}
                          className="px-2 py-0.5 rounded text-[11px] font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {revokingId === c.id ? 'Revoking...' : 'Revoke'}
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configure Fee Heads Modal */}
      <Modal
        isOpen={isEditFeeOpen}
        onClose={() => setIsEditFeeOpen(false)}
        title={
          structures.some((s) => s.classNumber === modalTargetClass)
            ? `Edit Fee Schedule · Class ${modalTargetClass}`
            : `Add Fee Schedule · Class ${modalTargetClass}`
        }
        description="Configure approved fee heads for this grade level. You can add, edit, or remove heads freely."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveFee} className="space-y-4 text-xs">
          {/* Grade Level Dropdown in Form */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <label htmlFor="modal-class-select" className="font-semibold text-slate-700">
                Target Grade Level:
              </label>
              <select
                id="modal-class-select"
                value={modalTargetClass}
                onChange={(e) => handleTargetClassChangeInModal(Number(e.target.value))}
                className="bg-slate-50 border border-slate-300 hover:border-amber-500 rounded-lg px-2.5 py-1 text-slate-800 font-semibold cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
                  <option key={c} value={c}>
                    Class {c}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-slate-400 text-[11px]">
              {editingHeads.length} {editingHeads.length === 1 ? 'fee head' : 'fee heads'} added
            </span>
          </div>

          <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
            {editingHeads.map((head, idx) => (
              <div
                key={head.id || idx}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3"
              >
                <div className="w-36">
                  <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Fee Head</label>
                  <select
                    value={head.head}
                    onChange={(e) => {
                      const copy = [...editingHeads];
                      copy[idx].head = e.target.value as FeeHeadType;
                      if (!copy[idx].description || copy[idx].description.endsWith('Fee')) {
                        copy[idx].description = `${e.target.value} Fee`;
                      }
                      setEditingHeads(copy);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800 font-semibold focus:border-amber-500 cursor-pointer"
                  >
                    {['Tuition', 'Admission', 'Technology', 'Books', 'Examination', 'Other'].map((hType) => (
                      <option key={hType} value={hType}>
                        {hType} Fee
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Description (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Monthly Tuition Fee"
                    value={head.description || ''}
                    onChange={(e) => {
                      const copy = [...editingHeads];
                      copy[idx].description = e.target.value;
                      setEditingHeads(copy);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800 focus:border-amber-500 text-xs"
                  />
                </div>

                <div className="w-28">
                  <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Amount (PKR)</label>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 font-mono text-xs">Rs.</span>
                    <input
                      type="number"
                      min="1"
                      placeholder="0"
                      required
                      value={head.amount}
                      onChange={(e) => {
                        const copy = [...editingHeads];
                        copy[idx].amount = e.target.value === '' ? '' : Number(e.target.value);
                        setEditingHeads(copy);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-slate-900 font-mono font-bold focus:border-amber-500 text-xs"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer select-none">
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
                    <span>Monthly</span>
                  </label>
                </div>

                {editingHeads.length > 1 && (
                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => handleRemoveHead(idx)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title="Remove fee head"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddHead}
              className="w-full py-2.5 border border-dashed border-slate-300 hover:border-amber-500 hover:bg-amber-50/50 rounded-xl text-amber-800 font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Another Fee Head</span>
            </button>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Administrative Rationale / Note <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              required
              rows={2}
              placeholder="State reason (e.g. Standard academic year 2026-27 fee schedule approved by administration)..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:bg-white resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="font-mono text-slate-700 font-semibold">
              Monthly Recurring Total:{' '}
              <span className="text-emerald-700 font-bold">
                Rs.{' '}
                {editingHeads
                  .filter((h) => h.isRecurring)
                  .reduce((sum, h) => sum + Number(h.amount || 0), 0)
                  .toLocaleString()}
              </span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditFeeOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={feeSubmitting}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs cursor-pointer disabled:opacity-50"
              >
                {feeSubmitting ? 'Saving...' : 'Save & Publish Fee Schedule'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Authorize Concession Modal */}
      <Modal
        isOpen={isConcessionModalOpen}
        onClose={() => setIsConcessionModalOpen(false)}
        title="Authorize Student Fee Concession"
        description="Grant a verified fee discount for an enrolled student. You specify the student, discount, and authorization reason."
        maxWidth="md"
      >
        <form onSubmit={handleAddConcession} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-medium mb-1">Select Enrolled Student *</label>
            <select
              value={concessionForm.studentId}
              onChange={(e) => setConcessionForm({ ...concessionForm, studentId: e.target.value })}
              required
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:bg-white"
            >
              <option value="">-- Choose Enrolled Student --</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (Class {s.classNumber} · Roll {s.rollNumber || s.admissionNumber})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Concession Type *</label>
            <select
              value={concessionForm.concessionType}
              onChange={(e) =>
                setConcessionForm({
                  ...concessionForm,
                  concessionType: e.target.value as StudentConcession['concessionType']
                })
              }
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 font-semibold focus:bg-white"
            >
              <option value="Sibling Discount">Sibling Discount</option>
              <option value="Merit Scholarship">Merit Scholarship</option>
              <option value="Need Based">Need-Based Financial Aid</option>
              <option value="Fixed Amount">Fixed Amount Discount</option>
              <option value="Percentage">Percentage Discount (%)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              {concessionForm.concessionType === 'Percentage'
                ? 'Discount Percentage (%) *'
                : 'Discount Amount (PKR) *'}
            </label>
            <input
              type="number"
              min="1"
              required
              placeholder={concessionForm.concessionType === 'Percentage' ? 'e.g. 25' : 'e.g. 1500'}
              value={concessionForm.value}
              onChange={(e) =>
                setConcessionForm({
                  ...concessionForm,
                  value: e.target.value === '' ? '' : Number(e.target.value)
                })
              }
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 font-mono focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Authorization Reason & Policy Reference <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={concessionForm.reason}
              onChange={(e) => setConcessionForm({ ...concessionForm, reason: e.target.value })}
              required
              rows={3}
              placeholder="State reason (e.g. Sibling concession policy verified, 1st position merit award)..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:bg-white resize-none"
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
              {concessionSubmitting ? 'Authorizing...' : 'Authorize Concession'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
