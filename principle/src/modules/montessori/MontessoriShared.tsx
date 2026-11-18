import React from 'react';
import { MSection, ProgressStatus, PROGRESS_LABELS, PROGRESS_STYLES, AttendanceStatus, ATTENDANCE_LABELS } from './montessoriApi';

export const MPageHeader: React.FC<{ title: string; description: string; action?: React.ReactNode }> = ({ title, description, action }) => (
  <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">Montessori Management</div>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="text-xs text-slate-500 mt-0.5">{description}</p>
    </div>
    {action}
  </div>
);

export const ProgressBadge: React.FC<{ status: ProgressStatus }> = ({ status }) => (
  <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold ${PROGRESS_STYLES[status]}`}>{PROGRESS_LABELS[status]}</span>
);

const ATT_STYLES: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  LATE: 'bg-amber-50 text-amber-700 border-amber-200',
  LEAVE: 'bg-sky-50 text-sky-700 border-sky-200',
  ABSENT: 'bg-rose-50 text-rose-700 border-rose-200'
};
export const AttendanceBadge: React.FC<{ status: AttendanceStatus }> = ({ status }) => (
  <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold ${ATT_STYLES[status]}`}>{ATTENDANCE_LABELS[status]}</span>
);

export const inputCls = 'w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none';
export const selectCls = 'text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none shadow-2xs';
export const primaryBtn = 'px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium shadow-xs disabled:opacity-50';
export const ghostBtn = 'px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs';

export const SectionSelect: React.FC<{
  sections: MSection[];
  value: number | '';
  onChange: (id: number | '') => void;
  allowAll?: boolean;
}> = ({ sections, value, onChange, allowAll }) => (
  <select value={value} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')} className={selectCls}>
    {allowAll ? <option value="">All sections</option> : <option value="">Select section</option>}
    {sections.map((s) => (
      <option key={s.id} value={s.id}>
        {s.name}
        {s.isActive ? '' : ' (inactive)'}
      </option>
    ))}
  </select>
);

/** Error message from an API error, including per-item problems when present. */
export function errorText(err: any, fallback: string) {
  const problems: any[] = err?.details?.problems || [];
  if (problems.length) return `${err.message} ${problems.map((p) => `${p.studentName || `#${p.studentId}`}: ${p.reason}`).join('; ')}`;
  return err?.message || fallback;
}
