import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Eye, ClipboardEdit, Download, X } from 'lucide-react';
import { requestApi } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatTime, formatDateOnly, formatDateTime, zoneAbbreviation } from '../../lib/timezone';

interface SummaryRow {
  teacherId: number;
  teacherName: string;
  employeeNo: string;
  salaryType: string;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  earlyDepartures: number;
  leaveDays: number;
  dutyHours: number;
  teachingHours: number | null;
  projectedAmount: number | null;
  adjustments: number;
  payrollStatus: string;
  netPayable: number | null;
}

const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const SALARY_TYPE_LABELS: Record<string, string> = {
  HOURLY: 'Hourly',
  FIXED: 'Fixed monthly',
  PER_LESSON: 'Per lesson',
  HYBRID: 'Hybrid',
  NOT_CONFIGURED: 'Not configured'
};

const STATUS_LABELS: Record<string, string> = {
  NOT_GENERATED: 'Not generated',
  SUBMITTED_FOR_APPROVAL: 'Awaiting approval',
  APPROVED: 'Approved',
  RETURNED_FOR_CORRECTION: 'Returned',
  REJECTED: 'Rejected',
  PAID: 'Paid',
  DRAFT: 'Draft'
};

const minutesLabel = (mins: number) => {
  const m = Math.round(Number(mins) || 0);
  if (m <= 0) return '—';
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
};

const rs = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `Rs. ${Number(n).toLocaleString()}`);

export const TeacherDutyMonitoring: React.FC = () => {
  const toast = useToast();
  const [month, setMonth] = useState(currentMonthKey());
  const [salaryType, setSalaryType] = useState('ALL');
  const [attendanceFilter, setAttendanceFilter] = useState('ALL');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [entry, setEntry] = useState<{ teacherId: number; teacherName: string } | null>(null);
  const [entryForm, setEntryForm] = useState({ dutyDate: '', checkIn: '', checkOut: '', status: 'PRESENT', leaveType: '', reason: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ month, salaryType, attendanceStatus: attendanceFilter });
      const res = await requestApi<{ rows: SummaryRow[] }>(`/api/v1/duty/report?${qs.toString()}`);
      setRows(res?.rows || []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load teacher duty report');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [month, salaryType, attendanceFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          !teacherFilter ||
          r.teacherName.toLowerCase().includes(teacherFilter.toLowerCase()) ||
          String(r.employeeNo || '').toLowerCase().includes(teacherFilter.toLowerCase())
      ),
    [rows, teacherFilter]
  );

  const openDetail = async (teacherId: number) => {
    setDetailLoading(true);
    setDetail({ loading: true });
    try {
      const res = await requestApi<any>(`/api/v1/duty/monthly-report?teacherId=${teacherId}&month=${month}`);
      setDetail(res);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load teacher duty record');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  /** Local date + time inputs (viewer's browser zone) -> ISO instant. */
  const toInstant = (date: string, time: string) => (date && time ? new Date(`${date}T${time}:00`).toISOString() : null);

  const saveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;
    if (!entryForm.dutyDate) return toast.warning('Select the duty date.');
    if (!entryForm.reason.trim()) return toast.warning('A reason is required for manual duty entries.');
    try {
      setSaving(true);
      await requestApi('/api/v1/duty/checkins', {
        method: 'POST',
        body: JSON.stringify({
          teacherId: entry.teacherId,
          dutyDate: entryForm.dutyDate,
          checkInTime: ['ABSENT', 'ON_LEAVE', 'HOLIDAY'].includes(entryForm.status) ? null : toInstant(entryForm.dutyDate, entryForm.checkIn),
          checkOutTime: ['ABSENT', 'ON_LEAVE', 'HOLIDAY'].includes(entryForm.status) ? null : toInstant(entryForm.dutyDate, entryForm.checkOut),
          attendanceStatus: entryForm.status,
          leaveType: entryForm.status === 'ON_LEAVE' ? entryForm.leaveType || null : null,
          reason: entryForm.reason.trim()
        })
      });
      toast.success(`Duty record saved for ${entry.teacherName}.`);
      setEntry(null);
      load();
      if (detail?.teacher?.id === entry.teacherId) openDetail(entry.teacherId);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save duty record');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const header = ['Teacher', 'Employee No', 'Salary Type', 'Present', 'Absent', 'Late', 'Early Departures', 'Leave', 'Duty Hours', 'Teaching Hours', 'Projected Amount', 'Adjustments', 'Payroll Status', 'Net Payable'];
    const lines = visibleRows.map((r) =>
      [r.teacherName, r.employeeNo, SALARY_TYPE_LABELS[r.salaryType] || r.salaryType, r.presentDays, r.absentDays, r.lateDays, r.earlyDepartures, r.leaveDays, r.dutyHours, r.teachingHours ?? '', r.projectedAmount ?? '', r.adjustments, STATUS_LABELS[r.payrollStatus] || r.payrollStatus, r.netPayable ?? '']
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `teacher-duty-report-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value || currentMonthKey())} className="bg-transparent font-bold text-slate-900 outline-none text-xs" />
        </div>
        <select value={salaryType} onChange={(e) => setSalaryType(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-700">
          <option value="ALL">All salary types</option>
          <option value="HOURLY">Hourly</option>
          <option value="FIXED">Fixed monthly</option>
          <option value="PER_LESSON">Per lesson</option>
          <option value="HYBRID">Hybrid</option>
          <option value="NOT_CONFIGURED">Not configured</option>
        </select>
        <select value={attendanceFilter} onChange={(e) => setAttendanceFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-700">
          <option value="ALL">All attendance</option>
          <option value="HAS_ABSENCES">With absences</option>
          <option value="HAS_LATE">With late arrivals</option>
          <option value="PERFECT">No absences / late</option>
        </select>
        <input
          type="text"
          placeholder="Search teacher…"
          value={teacherFilter}
          onChange={(e) => setTeacherFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 min-w-40"
        />
        <button onClick={exportCsv} className="ml-auto px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-1.5 cursor-pointer">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Teacher</th>
                <th className="px-4 py-3">Salary Type</th>
                <th className="px-4 py-3 text-center">Present</th>
                <th className="px-4 py-3 text-center">Absent</th>
                <th className="px-4 py-3 text-center">Late / Early</th>
                <th className="px-4 py-3 text-center">Leave</th>
                <th className="px-4 py-3 text-right">Duty Hrs</th>
                <th className="px-4 py-3 text-right">Teaching Hrs</th>
                <th className="px-4 py-3 text-right font-mono">Salary / Payable</th>
                <th className="px-4 py-3 text-center">Payroll</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-400">Loading duty records…</td></tr>
              ) : visibleRows.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-400">No teachers match these filters.</td></tr>
              ) : (
                visibleRows.map((r) => (
                  <tr key={r.teacherId} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{r.teacherName}</div>
                      <div className="font-mono text-[10px] text-slate-400">{r.employeeNo}</div>
                    </td>
                    <td className="px-4 py-3 text-amber-700 font-medium">{SALARY_TYPE_LABELS[r.salaryType] || r.salaryType}</td>
                    <td className="px-4 py-3 text-center text-emerald-700 font-semibold">{r.presentDays}</td>
                    <td className={`px-4 py-3 text-center font-semibold ${r.absentDays ? 'text-rose-600' : 'text-slate-400'}`}>{r.absentDays}</td>
                    <td className="px-4 py-3 text-center">{r.lateDays} / {r.earlyDepartures}</td>
                    <td className="px-4 py-3 text-center">{r.leaveDays}</td>
                    <td className="px-4 py-3 text-right font-mono">{r.dutyHours || '—'}</td>
                    <td className="px-4 py-3 text-right font-mono">{r.teachingHours ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <div className="font-bold text-emerald-700">{r.netPayable !== null ? rs(r.netPayable) : rs(r.projectedAmount)}</div>
                      <div className="text-[10px] text-slate-400">
                        {r.netPayable !== null ? 'payroll net' : r.projectedAmount !== null ? 'projected' : ''}
                        {r.adjustments ? ` · adj ${rs(r.adjustments)}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">{STATUS_LABELS[r.payrollStatus] || r.payrollStatus}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => openDetail(r.teacherId)} className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-900 text-white hover:bg-slate-800 inline-flex items-center gap-1 mr-1 cursor-pointer">
                        <Eye className="w-3 h-3" /> Daily record
                      </button>
                      <button
                        onClick={() => {
                          setEntry({ teacherId: r.teacherId, teacherName: r.teacherName });
                          setEntryForm({ dutyDate: '', checkIn: '', checkOut: '', status: 'PRESENT', leaveType: '', reason: '' });
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ClipboardEdit className="w-3 h-3" /> Record
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-[10px] text-slate-400 border-t border-slate-100">
          Times shown in your timezone ({zoneAbbreviation()}). Fixed salaries use the configured monthly amount; deductions apply only if a payroll rule is configured.
        </div>
      </div>

      {/* Teacher monthly detail */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[88vh] overflow-y-auto border border-slate-200 shadow-2xl">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <div className="text-sm font-bold text-slate-900">{detail.teacher?.name || 'Teacher'} · {detail.month}</div>
                <div className="text-[11px] text-slate-500">
                  {detail.salaryProfile ? `${SALARY_TYPE_LABELS[detail.salaryProfile.salaryType] || detail.salaryProfile.model} · ` : 'No salary profile in force · '}
                  {detail.salaryProfile?.model === 'PER_HOUR' ? `Rs. ${detail.salaryProfile.perHourRate}/hour` : detail.salaryProfile ? rs(detail.salaryProfile.baseAmount) + ' / month' : ''}
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
            </div>

            {detailLoading || detail.loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading…</div>
            ) : (
              <div className="p-5 space-y-5 text-xs">
                {detail.attendance && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      ['Present days', detail.attendance.presentDays],
                      ['Absences', detail.attendance.absentDays],
                      ['Late arrivals', detail.attendance.lateDays],
                      ['Early departures', detail.attendance.earlyDepartures],
                      ['Approved leave', detail.attendance.leaveDays],
                      ['Duty hours', detail.attendance.totalDutyHours],
                      ['Working days', detail.attendance.scheduledWorkingDays],
                      ['Projected deduction', rs(detail.attendance.projectedDeduction)]
                    ].map(([label, value]) => (
                      <div key={String(label)} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[10px] text-slate-500">{label}</div>
                        <div className="text-sm font-bold text-slate-900">{value as any}</div>
                      </div>
                    ))}
                  </div>
                )}
                {detail.attendance?.deductionFormula && (
                  <div className="text-[11px] text-slate-600">Deduction policy: {detail.attendance.deductionFormula}</div>
                )}

                <div>
                  <div className="font-bold text-slate-900 mb-1.5">Daily duty record</div>
                  <table className="w-full text-left">
                    <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-200">
                      <tr><th className="py-1.5">Date</th><th>Check In</th><th>Check Out</th><th>Duty Time</th><th>Attendance</th><th>Notes</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(detail.dailyRecords || []).length === 0 ? (
                        <tr><td colSpan={6} className="py-3 text-slate-400">No check-in records for this month.</td></tr>
                      ) : (
                        detail.dailyRecords.map((d: any) => (
                          <tr key={d.dutyDate}>
                            <td className="py-1.5 font-medium">{formatDateOnly(d.dutyDate, { day: '2-digit', month: 'short', weekday: 'short' })}</td>
                            <td>{formatTime(d.checkInTime)}</td>
                            <td>{formatTime(d.checkOutTime)}</td>
                            <td>{minutesLabel(d.totalDutyMinutes)}</td>
                            <td>
                              <span className={d.attendanceStatus === 'ABSENT' ? 'text-rose-600 font-semibold' : d.isLate ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                                {d.attendanceStatus === 'ON_LEAVE' ? 'Leave' : d.attendanceStatus.charAt(0) + d.attendanceStatus.slice(1).toLowerCase().replace('_', ' ')}
                              </span>
                              {d.isEarlyDeparture && <span className="text-amber-700"> · early</span>}
                              {(d.isHoliday || d.isOffDay) && d.attendanceStatus === 'ABSENT' && <span className="text-slate-400"> (holiday/off — not counted)</span>}
                            </td>
                            <td className="text-slate-500 max-w-48 truncate">{d.notes || ''}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div>
                  <div className="font-bold text-slate-900 mb-1.5">
                    Verified teaching sessions · {detail.teachingDuty?.payableHours ?? 0} payable hrs
                    {detail.teachingDuty?.projectedHourlyAmount !== null && detail.teachingDuty?.projectedHourlyAmount !== undefined && (
                      <span className="text-emerald-700"> · {rs(detail.teachingDuty.projectedHourlyAmount)} at Rs. {detail.teachingDuty.hourlyRate}/hr</span>
                    )}
                  </div>
                  {detail.teachingDuty?.pendingReviewLessons > 0 && (
                    <div className="text-[11px] text-amber-700 mb-1">{detail.teachingDuty.pendingReviewLessons} session(s) awaiting attendance review are not payable yet.</div>
                  )}
                  <table className="w-full text-left">
                    <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-200">
                      <tr><th className="py-1.5">Date</th><th>Class / Subject</th><th>Scheduled</th><th>Actual</th><th className="text-right">Verified</th><th className="text-right">Payable</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(detail.teachingDuty?.sessions || []).length === 0 ? (
                        <tr><td colSpan={6} className="py-3 text-slate-400">No teaching sessions this month.</td></tr>
                      ) : (
                        detail.teachingDuty.sessions.map((s: any) => (
                          <tr key={s.lessonId}>
                            <td className="py-1.5">{formatDateTime(s.scheduledStart, { day: '2-digit', month: 'short' })}</td>
                            <td>{s.className} · {s.subjectName}</td>
                            <td>{formatTime(s.scheduledStart)}–{formatTime(s.scheduledEnd)}</td>
                            <td>{s.actualStart ? `${formatTime(s.actualStart)}–${formatTime(s.actualEnd)}` : '—'}</td>
                            <td className="text-right">{minutesLabel(s.verifiedMinutes)}</td>
                            <td className={`text-right font-semibold ${s.payable ? 'text-emerald-700' : 'text-slate-400'}`}>{s.payable ? minutesLabel(s.payableMinutes) : 'Not payable'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {detail.payroll && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                    Payroll: <strong>{STATUS_LABELS[detail.payroll.status] || detail.payroll.status}</strong> · Net {rs(detail.payroll.netPayable)}
                    <div className="text-[11px] mt-0.5">{detail.payroll.calculationFormula}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual entry / correction */}
      {entry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50">
          <form onSubmit={saveEntry} className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-2xl space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-slate-900">Record duty · {entry.teacherName}</div>
              <button type="button" onClick={() => setEntry(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Duty date *</label>
              <input type="date" required value={entryForm.dutyDate} onChange={(e) => setEntryForm({ ...entryForm, dutyDate: e.target.value })} className="w-full border border-slate-300 rounded-lg p-2" />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Attendance</label>
              <select value={entryForm.status} onChange={(e) => setEntryForm({ ...entryForm, status: e.target.value })} className="w-full border border-slate-300 rounded-lg p-2">
                <option value="PRESENT">Present</option>
                <option value="LATE">Late</option>
                <option value="HALF_DAY">Half day</option>
                <option value="ABSENT">Absent</option>
                <option value="ON_LEAVE">Approved leave</option>
                <option value="HOLIDAY">Holiday</option>
              </select>
            </div>
            {!['ABSENT', 'ON_LEAVE', 'HOLIDAY'].includes(entryForm.status) && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Check in ({zoneAbbreviation()})</label>
                  <input type="time" value={entryForm.checkIn} onChange={(e) => setEntryForm({ ...entryForm, checkIn: e.target.value })} className="w-full border border-slate-300 rounded-lg p-2" />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Check out ({zoneAbbreviation()})</label>
                  <input type="time" value={entryForm.checkOut} onChange={(e) => setEntryForm({ ...entryForm, checkOut: e.target.value })} className="w-full border border-slate-300 rounded-lg p-2" />
                </div>
              </div>
            )}
            {entryForm.status === 'ON_LEAVE' && (
              <div>
                <label className="block font-medium text-slate-700 mb-1">Leave type</label>
                <input type="text" value={entryForm.leaveType} onChange={(e) => setEntryForm({ ...entryForm, leaveType: e.target.value })} placeholder="e.g. Sick, Casual" className="w-full border border-slate-300 rounded-lg p-2" />
              </div>
            )}
            <div>
              <label className="block font-medium text-slate-700 mb-1">Reason (audited) *</label>
              <textarea required rows={2} value={entryForm.reason} onChange={(e) => setEntryForm({ ...entryForm, reason: e.target.value })} className="w-full border border-slate-300 rounded-lg p-2 resize-none" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEntry(null)} className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50">
                {saving ? 'Saving…' : 'Save record'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
