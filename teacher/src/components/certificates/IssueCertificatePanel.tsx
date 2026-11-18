import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye,
  CheckCircle2,
  Users,
  User,
  UsersRound,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Send
} from 'lucide-react';
import {
  certificatesApi,
  newRequestKey,
  CertificateCategory,
  CertificateTemplate,
  RecipientData,
  IssuedCertificate
} from '../../services/certificatesApi';
import { CertificatePdfModal } from './CertificatePdfModal';

type Mode = 'ONE' | 'SELECTED' | 'CLASS';
const STEPS = ['Template', 'Recipients', 'Details', 'Confirm'];
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

interface Props {
  onIssued: () => void;
}

export const IssueCertificatePanel: React.FC<Props> = ({ onIssued }) => {
  const [step, setStep] = useState(0);
  const [catalog, setCatalog] = useState<CertificateCategory[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryId, setCategoryId] = useState<number | 'ALL'>('ALL');
  const [template, setTemplate] = useState<CertificateTemplate | null>(null);

  const [recipients, setRecipients] = useState<RecipientData | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>('ONE');
  const [selected, setSelected] = useState<number[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [achievementTitle, setAchievementTitle] = useState('');
  const [achievementDescription, setAchievementDescription] = useState('');
  const [remarks, setRemarks] = useState('');
  const [subjectId, setSubjectId] = useState<number | ''>('');
  const [academicSessionId, setAcademicSessionId] = useState<number | ''>('');
  const [issueDate, setIssueDate] = useState(today());

  const [preview, setPreview] = useState<{ title: string; load: () => Promise<Blob> } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidRecipients, setInvalidRecipients] = useState<{ studentName: string | null; reason: string }[]>([]);
  const [result, setResult] = useState<IssuedCertificate[] | null>(null);
  // Same request id while retrying the same request; a fresh one after success or changes
  const requestKey = useRef<{ key: string; fingerprint: string } | null>(null);

  useEffect(() => {
    Promise.all([certificatesApi.catalog(), certificatesApi.recipients()])
      .then(([cat, rec]) => {
        setCatalog(cat);
        setRecipients(rec);
        const current = rec.academicSessions.find((s) => s.isCurrent);
        if (current) setAcademicSessionId(current.id);
        if (rec.classes.length === 1) setClassId(rec.classes[0].id);
      })
      .catch((err: any) => setCatalogError(err?.message || 'Failed to load certificate templates.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!classId) return;
    setLoadingStudents(true);
    setSelected([]);
    certificatesApi
      .recipients(classId)
      .then((rec) => setRecipients((prev) => (prev ? { ...prev, students: rec.students, subjects: rec.subjects } : rec)))
      .catch((err: any) => setError(err?.message || 'Failed to load students.'))
      .finally(() => setLoadingStudents(false));
  }, [classId]);

  const templates = useMemo(
    () => catalog.filter((c) => categoryId === 'ALL' || c.id === categoryId).flatMap((c) => c.templates),
    [catalog, categoryId]
  );
  const students = recipients?.students || [];
  const filteredStudents = students.filter((s) => s.name.toLowerCase().includes(studentSearch.trim().toLowerCase()));
  const recipientList = mode === 'CLASS' ? students : students.filter((s) => selected.includes(s.id));
  const className = recipients?.classes.find((c) => c.id === classId)?.name || '';

  const toggleStudent = (id: number) => {
    setConfirmed(false);
    if (mode === 'ONE') setSelected([id]);
    else setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const fields = () => ({
    achievementTitle: achievementTitle.trim(),
    achievementDescription: achievementDescription.trim(),
    remarks: remarks.trim(),
    subjectId: subjectId || null,
    academicSessionId: academicSessionId || null,
    issueDate
  });

  const canContinue = [
    Boolean(template),
    Boolean(classId) && recipientList.length > 0,
    achievementTitle.trim().length >= 3 && Boolean(issueDate),
    true
  ][step];

  const openPersonalizedPreview = (studentId?: number) => {
    if (!template || !classId) return;
    const name = students.find((s) => s.id === studentId)?.name;
    setPreview({
      title: `Preview · ${template.certificateTitle}${name ? ` · ${name}` : ''}`,
      load: () => certificatesApi.personalizedPreview({ ...fields(), templateId: template.id, classId, studentId })
    });
  };

  const handleIssue = async () => {
    if (!template || !classId || !confirmed) return;
    const payload = {
      ...fields(),
      templateId: template.id,
      classId,
      mode: mode === 'CLASS' ? ('CLASS' as const) : ('SELECTED' as const),
      studentIds: mode === 'CLASS' ? [] : selected
    };
    const fingerprint = JSON.stringify(payload);
    const key = requestKey.current?.fingerprint === fingerprint ? requestKey.current.key : newRequestKey();
    requestKey.current = { key, fingerprint };
    setIssuing(true);
    setError(null);
    setInvalidRecipients([]);
    try {
      const res = await certificatesApi.issue({ ...payload, idempotencyKey: key });
      requestKey.current = null;
      setResult(res.certificates);
      onIssued();
    } catch (err: any) {
      setError(err?.message || 'Certificates could not be issued.');
      if (Array.isArray(err?.details?.invalidRecipients)) setInvalidRecipients(err.details.invalidRecipients);
    } finally {
      setIssuing(false);
    }
  };

  const restart = () => {
    setResult(null);
    setStep(0);
    setSelected([]);
    setConfirmed(false);
    setAchievementTitle('');
    setAchievementDescription('');
    setRemarks('');
    setError(null);
  };

  const input = 'w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500';

  if (loading) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading certificate templates…
      </div>
    );
  }
  if (catalogError) {
    return <div className="rounded-2xl bg-rose-50 border border-rose-200 p-6 text-xs text-rose-700">{catalogError}</div>;
  }

  if (result) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-[#1e1b4b]">{result.length} certificate{result.length === 1 ? '' : 's'} issued</h3>
            <p className="text-xs text-slate-500">Each student can now view and download their certificate from Achievements.</p>
          </div>
        </div>
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-80 overflow-y-auto">
          {result.map((c) => (
            <div key={c.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <div className="font-bold text-slate-800 truncate">{c.studentName}</div>
                <div className="text-slate-500 font-mono">{c.certificateNumber}</div>
              </div>
              <button
                type="button"
                onClick={() => setPreview({ title: `${c.certificateTitle} · ${c.studentName}`, load: () => certificatesApi.pdf(c.id) })}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" /> View
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={restart} className="px-4 py-2 bg-[#1b1a47] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white rounded-xl text-xs font-bold transition">
          Issue another certificate
        </button>
        {preview && <CertificatePdfModal title={preview.title} load={preview.load} fileName="certificate.pdf" onClose={() => setPreview(null)} />}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
      {/* Stepper */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2 shrink-0">
            <span
              className={`w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center ${
                i < step ? 'bg-emerald-600 text-white' : i === step ? 'bg-[#36348e] text-white' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {i < step ? '✓' : i + 1}
            </span>
            <span className={`text-xs font-bold ${i === step ? 'text-[#1e1b4b]' : 'text-slate-400'}`}>{label}</span>
            {i < STEPS.length - 1 && <span className="w-6 h-px bg-slate-200" />}
          </div>
        ))}
      </div>

      {/* Step 1: template */}
      {step === 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {[{ id: 'ALL' as const, name: 'All categories' }, ...catalog].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                  categoryId === c.id ? 'bg-[#36348e] text-white border-[#36348e]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
          {templates.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
              No active templates in this category. Ask the Principal to add one.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className={`rounded-xl border p-3.5 flex flex-col gap-2 transition ${
                    template?.id === t.id ? 'border-[#36348e] ring-1 ring-[#36348e] bg-indigo-50/40' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${t.primaryColor}, ${t.accentColor})` }} />
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">{t.categoryName}</div>
                  <div className="text-sm font-black text-slate-900 leading-tight">{t.certificateTitle}</div>
                  <div className="text-[11px] text-slate-500">
                    {t.name} · {t.orientation === 'LANDSCAPE' ? 'Landscape' : 'Portrait'} · {t.pageSize}
                  </div>
                  <div className="flex gap-1.5 mt-auto pt-1">
                    <button
                      type="button"
                      onClick={() => setPreview({ title: `Template preview · ${t.name}`, load: () => certificatesApi.templatePreview(t.id) })}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-bold flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplate(t)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#36348e] hover:bg-[#1b1a47] text-white text-[11px] font-bold"
                    >
                      {template?.id === t.id ? 'Selected' : 'Select'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: recipients */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Class *</label>
              <select value={classId || ''} onChange={(e) => setClassId(Number(e.target.value) || null)} className={input}>
                <option value="">Select one of your classes</option>
                {recipients?.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Recipients *</label>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  ['ONE', 'One student', User],
                  ['SELECTED', 'Selected', Users],
                  ['CLASS', 'Entire class', UsersRound]
                ] as const).map(([m, label, Icon]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      setConfirmed(false);
                      if (m === 'ONE') setSelected((prev) => prev.slice(0, 1));
                    }}
                    className={`py-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 ${
                      mode === m ? 'bg-[#36348e] text-white border-[#36348e]' : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {classId && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700">
                  {mode === 'CLASS'
                    ? `All ${students.length} active students of ${className}`
                    : `${selected.length} selected of ${students.length}`}
                </span>
                {mode !== 'CLASS' && (
                  <input
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search students…"
                    className="text-xs border border-slate-200 rounded-lg px-2.5 py-1 bg-white w-44"
                  />
                )}
              </div>
              {loadingStudents ? (
                <div className="p-6 text-center text-xs text-slate-500">Loading students…</div>
              ) : students.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">This class has no active students.</div>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {(mode === 'CLASS' ? students : filteredStudents).map((s) => (
                    <label key={s.id} className={`flex items-center gap-3 px-3 py-2 text-xs ${mode === 'CLASS' ? '' : 'cursor-pointer hover:bg-slate-50'}`}>
                      {mode !== 'CLASS' && (
                        <input
                          type={mode === 'ONE' ? 'radio' : 'checkbox'}
                          name="certificate-recipient"
                          checked={selected.includes(s.id)}
                          onChange={() => toggleStudent(s.id)}
                          className="accent-indigo-600"
                        />
                      )}
                      <span className="font-semibold text-slate-800 flex-1">{s.name}</span>
                      <span className="text-slate-400 font-mono">Roll {s.rollNo || '—'}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3: details + personalised preview */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Achievement title *</label>
              <input
                value={achievementTitle}
                maxLength={150}
                onChange={(e) => setAchievementTitle(e.target.value)}
                placeholder="e.g. securing first position in the Science Fair"
                className={input}
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Printed as “in recognition of …”.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Short description / reason</label>
              <textarea
                rows={2}
                maxLength={600}
                value={achievementDescription}
                onChange={(e) => setAchievementDescription(e.target.value)}
                className={input}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject (optional)</label>
              <select value={subjectId} onChange={(e) => setSubjectId(Number(e.target.value) || '')} className={input}>
                <option value="">Not shown</option>
                {recipients?.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Academic year (optional)</label>
              <select value={academicSessionId} onChange={(e) => setAcademicSessionId(Number(e.target.value) || '')} className={input}>
                <option value="">Not shown</option>
                {recipients?.academicSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Issue date *</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={input} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Additional remarks (optional)</label>
              <input value={remarks} maxLength={300} onChange={(e) => setRemarks(e.target.value)} className={input} />
            </div>
          </div>
          <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-indigo-900 font-semibold">Preview with a student’s real details:</span>
            {recipientList.slice(0, 3).map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={achievementTitle.trim().length < 3}
                onClick={() => openPersonalizedPreview(s.id)}
                className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-800 font-bold hover:bg-indigo-50 disabled:opacity-50 flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" /> {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: confirmation */}
      {step === 3 && template && (
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-slate-500">Certificate</div>
              <div className="font-bold text-slate-900">{template.certificateTitle}</div>
              <div className="text-slate-500">{template.categoryName}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-slate-500">Achievement</div>
              <div className="font-bold text-slate-900 break-words">{achievementTitle}</div>
              <div className="text-slate-500">Issue date {issueDate}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-slate-500">Recipients · {className}</div>
              <div className="font-black text-2xl text-[#36348e]">{recipientList.length}</div>
              <div className="text-slate-500">{mode === 'CLASS' ? 'Entire class' : 'Selected students'}</div>
            </div>
          </div>
          <div className="border border-slate-200 rounded-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
            {recipientList.map((s) => (
              <div key={s.id} className="px-3 py-1.5 flex justify-between">
                <span className="font-semibold text-slate-800">{s.name}</span>
                <span className="text-slate-400 font-mono">Roll {s.rollNo || '—'}</span>
              </div>
            ))}
          </div>
          <label className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-semibold">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 accent-amber-600" />
            <span>
              Issue {recipientList.length} individual certificate{recipientList.length === 1 ? '' : 's'}. Each student receives their own
              PDF with a unique certificate ID. Issued certificates cannot be edited.
            </span>
          </label>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs space-y-1">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
          {invalidRecipients.length > 0 && (
            <ul className="list-disc pl-6">
              {invalidRecipients.map((r, i) => (
                <li key={i}>
                  {r.studentName || 'Unknown student'}: {r.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
          className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        {step < 3 ? (
          <button
            type="button"
            disabled={!canContinue}
            onClick={() => {
              setError(null);
              setStep((s) => s + 1);
            }}
            className="px-4 py-2 bg-[#36348e] hover:bg-[#1b1a47] text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={!confirmed || issuing}
            onClick={handleIssue}
            className="px-5 py-2 bg-[#1b1a47] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 transition"
          >
            {issuing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {issuing ? 'Issuing…' : `Issue ${recipientList.length} Certificate${recipientList.length === 1 ? '' : 's'}`}
          </button>
        )}
      </div>

      {preview && <CertificatePdfModal title={preview.title} load={preview.load} onClose={() => setPreview(null)} />}
    </div>
  );
};
