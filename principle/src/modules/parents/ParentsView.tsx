import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { Parent, Student } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { HeartHandshake, Link, Unlink, CheckCircle2, XCircle, UserPlus } from 'lucide-react';

const emptyRegForm = () => ({
  name: '',
  email: '',
  phone: '',
  cnic: '',
  relationship: 'Father' as 'Father' | 'Mother' | 'Guardian',
  password: ''
});

export const ParentsView: React.FC = () => {
  const [parents, setParents] = useState<Parent[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [regForm, setRegForm] = useState(emptyRegForm());
  const [registering, setRegistering] = useState(false);

  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkClass, setLinkClass] = useState<string>('');
  const [linkSearch, setLinkSearch] = useState<string>('');
  const [selectedStudentToLink, setSelectedStudentToLink] = useState<string>('');
  const [linkReason, setLinkReason] = useState<string>('');
  const [linkSubmitting, setLinkSubmitting] = useState(false);

  const toast = useToast();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [pData, sData] = await Promise.all([api.getParents(), api.getStudents()]);
      setParents(pData);
      setStudents(sData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load parents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRegisterParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.name.trim() || !regForm.email.trim() || !regForm.phone.trim()) {
      toast.warning('Name, email and phone are required.');
      return;
    }
    try {
      setRegistering(true);
      await (api as any).addParent(regForm);
      toast.success(`Parent account created for ${regForm.name}. They can now log in to the Parent Portal.`);
      setIsRegisterModalOpen(false);
      setRegForm(emptyRegForm());
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to register parent');
    } finally {
      setRegistering(false);
    }
  };

  const handleVerify = async (parent: Parent, status: 'Verified' | 'Rejected') => {
    try {
      await api.verifyParent(parent.id, status, `Principal verified identity for ${parent.name}`);
      toast.success(`Parent ${parent.name} status updated to ${status}.`);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  const handleLinkSubmit = async () => {
    if (!selectedParent || !selectedStudentToLink) return;
    if (!linkReason.trim()) {
      toast.warning('Please state the relationship verification reason.');
      return;
    }

    try {
      setLinkSubmitting(true);
      await api.linkParentToStudent(selectedParent.id, selectedStudentToLink, linkReason);
      toast.success('Parent-child link successfully established.');
      setIsLinkModalOpen(false);
      setSelectedStudentToLink('');
      setLinkReason('');
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to link');
    } finally {
      setLinkSubmitting(false);
    }
  };

  const handleUnlink = async (parent: Parent, studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;

    const reason = window.prompt(`State reason for unlinking ${student.name} from ${parent.name}:`);
    if (!reason || !reason.trim()) {
      toast.warning('Unlinking requires an administrative reason.');
      return;
    }

    try {
      await api.unlinkParentFromStudent(parent.id, studentId, reason);
      toast.success(`Unlinked ${student.name} from ${parent.name}.`);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to unlink');
    }
  };

  const columns: Column<Parent>[] = [
    {
      key: 'name',
      header: 'Parent / Guardian',
      render: (p) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900">{p.name}</span>
          <span className="text-[11px] text-slate-500">
            {p.relationship} · {p.cnicOrIdNumber}
          </span>
        </div>
      )
    },
    {
      key: 'contact',
      header: 'Contact Details',
      render: (p) => (
        <div className="flex flex-col">
          <span className="text-slate-800 font-mono text-[11px] font-medium">{p.phone}</span>
          <span className="text-[11px] text-slate-400">{p.email}</span>
        </div>
      )
    },
    {
      key: 'linkedStudents',
      header: 'Linked Enrolled Children',
      render: (p) => {
        const linked = students.filter((s) => p.linkedStudentIds.includes(s.id));
        if (linked.length === 0) {
          return <span className="text-slate-400 italic text-[11px]">No children linked</span>;
        }
        return (
          <div className="flex flex-wrap items-center gap-1.5 max-w-sm">
            {linked.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-50 border border-slate-200/80 text-slate-700 font-medium"
              >
                <span>{s.name} (Cls {s.classNumber})</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUnlink(p, s.id);
                  }}
                  title="Unlink child from guardian"
                  className="text-slate-400 hover:text-rose-600 transition-colors p-0.5"
                >
                  <Unlink className="w-3 h-3" strokeWidth={1.75} />
                </button>
              </span>
            ))}
          </div>
        );
      }
    },
    {
      key: 'verificationStatus',
      header: 'Verification',
      align: 'center',
      render: (p) => <StatusBadge status={p.verificationStatus} />
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (p) => (
        <div className="flex items-center justify-end gap-1.5">
          {p.verificationStatus === 'Pending Verification' && (
            <>
              <button
                onClick={() => handleVerify(p, 'Verified')}
                title="Verify Parent ID"
                className="p-1.5 rounded-lg text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-2xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
              <button
                onClick={() => handleVerify(p, 'Rejected')}
                title="Reject Parent ID"
                className="p-1.5 rounded-lg text-rose-700 bg-rose-50/70 hover:bg-rose-100 border border-rose-200 transition-colors shadow-2xs"
              >
                <XCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </>
          )}
          <button
            onClick={() => {
              setSelectedParent(p);
              setLinkClass('');
              setLinkSearch('');
              setSelectedStudentToLink('');
              setLinkReason('');
              setIsLinkModalOpen(true);
            }}
            title="Link Student to Guardian"
            className="p-1.5 rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-slate-600 hover:text-amber-700 transition-colors shadow-2xs"
          >
            <Link className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </div>
      )
    }
  ];

  if (loading) return <LoadingState message="Loading parent directory..." rows={5} />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div className="space-y-4">
      {/* Header Action Bar in clean white card */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Parent & Guardian Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Verify parent accounts and oversee authorized parent-child linkages to protect student privacy.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium shadow-2xs">
            {parents.length} Registered Guardians
          </span>
          <button
            onClick={() => setIsRegisterModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Register New Parent</span>
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={parents}
        keyExtractor={(p) => p.id}
        searchPlaceholder="Search parent name, phone, email, CNIC..."
        searchFilter={(p, q) =>
          p.name.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.cnicOrIdNumber.includes(q)
        }
      />

      {/* Register New Parent Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Register New Parent / Guardian"
        description="Create a portal account for the parent. They will use the email and password to log in to the Parent Portal."
        maxWidth="md"
      >
        <form onSubmit={handleRegisterParent} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={regForm.name}
                onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                placeholder="e.g. Muhammad Tariq"
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Relationship</label>
              <select
                value={regForm.relationship}
                onChange={(e) => setRegForm({ ...regForm, relationship: e.target.value as any })}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800"
              >
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Guardian">Guardian</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-slate-700 font-medium mb-1">Email Address *</label>
            <input
              type="email"
              required
              value={regForm.email}
              onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
              placeholder="parent@example.com"
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">Use a different email than the student's.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Phone *</label>
              <input
                type="text"
                required
                value={regForm.phone}
                onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                placeholder="03XX-XXXXXXX"
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">CNIC</label>
              <input
                type="text"
                value={regForm.cnic}
                onChange={(e) => setRegForm({ ...regForm, cnic: e.target.value })}
                placeholder="42101-XXXXXXX-X"
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800"
              />
            </div>
          </div>
          <div>
            <label className="block text-slate-700 font-medium mb-1">Initial Password *</label>
            <input
              type="text"
              required
              value={regForm.password}
              onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
              placeholder="Temporary password to share with parent"
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-mono"
            />
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            After registration, link this parent to their child(ren) using the Link button in the table. The parent can change their password after first login.
          </p>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setIsRegisterModalOpen(false)} className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={registering} className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs">
              {registering ? 'Registering...' : 'Create Parent Account'}
            </button>
          </div>
        </form>
      </Modal>

      {selectedParent && (
        <Modal
          isOpen={isLinkModalOpen}
          onClose={() => setIsLinkModalOpen(false)}
          title={`Link Student to Parent · ${selectedParent.name}`}
          description="Select a class, then find the student by name or roll number."
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">

            {/* Step 1 — Class selector */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">Step 1 — Select Class *</label>
              <div className="flex flex-wrap gap-1.5">
                {[1,2,3,4,5,6,7,8].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { setLinkClass(String(c)); setLinkSearch(''); setSelectedStudentToLink(''); }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                      linkClass === String(c)
                        ? 'bg-amber-600 border-amber-600 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-amber-400 hover:text-amber-700'
                    }`}
                  >
                    Class {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2 — Search + pick student */}
            {linkClass && (() => {
              const classStudents = students.filter(
                (s) => String(s.classNumber) === linkClass && !selectedParent.linkedStudentIds.includes(s.id)
              );
              const q = linkSearch.toLowerCase().trim();
              const filtered = q
                ? classStudents.filter(
                    (s) => s.name.toLowerCase().includes(q) || (s.rollNumber || '').toLowerCase().includes(q)
                  )
                : classStudents;

              return (
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Step 2 — Find Student *</label>
                  <input
                    type="text"
                    value={linkSearch}
                    onChange={(e) => { setLinkSearch(e.target.value); setSelectedStudentToLink(''); }}
                    placeholder="Search by name or roll number..."
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 mb-2"
                  />
                  {filtered.length === 0 ? (
                    <p className="text-slate-400 italic py-2 text-center">
                      {classStudents.length === 0 ? 'No unlinked students in this class.' : 'No students match your search.'}
                    </p>
                  ) : (
                    <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                      {filtered.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedStudentToLink(s.id)}
                          className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${
                            selectedStudentToLink === s.id
                              ? 'bg-amber-50 border-l-2 border-amber-500'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <span className="font-medium text-slate-800">{s.name}</span>
                          <span className="text-slate-400 font-mono text-[11px]">Roll {s.rollNumber || '—'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Reason */}
            {selectedStudentToLink && (
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Relationship Verification Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={linkReason}
                  onChange={(e) => setLinkReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. B-Form verified, birth certificate checked, admission form confirmed..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white resize-none"
                />
              </div>
            )}

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-tight">
              Privacy Enforced: Parents may only view timetable, attendance, results, and fee challans for explicitly linked children.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLinkSubmit}
                disabled={linkSubmitting || !selectedStudentToLink || !linkReason.trim()}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs disabled:opacity-50"
              >
                {linkSubmitting ? 'Linking...' : 'Confirm Linkage'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
