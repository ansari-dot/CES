import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LogIn, LogOut, CalendarCheck } from 'lucide-react';
import { requestApi } from '../../services/api';
import { useAppSelector } from '../../store';
import { parseUtcInstant, formatTimeInZone, DEFAULT_SCHOOL_TIMEZONE } from '../../lib/timezone';

interface DailyRecord {
  dutyDate: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  totalDutyMinutes: number;
  attendanceStatus: string;
  isLate: boolean;
  isEarlyDeparture: boolean;
  isHoliday?: boolean;
  notes?: string | null;
}

interface MonthlyReport {
  month: string;
  salaryProfile: { salaryType: string; dutyStartTime: string | null; dutyEndTime: string | null } | null;
  attendance: { presentDays: number; absentDays: number; lateDays: number; earlyDepartures: number; leaveDays: number; totalDutyHours: number } | null;
  dailyRecords: DailyRecord[];
  teachingDuty: { payableHours: number; sessionCount: number; hourlyRate: number; projectedHourlyAmount: number | null };
}

const minutesLabel = (m: number) => {
  const mins = Math.round(Number(m) || 0);
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${String(mins % 60).padStart(2, '0')}m` : `${mins}m`;
};

/** Date-only duty dates are school calendar days: no timezone conversion. */
const dayLabel = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
};

/**
 * Daily duty check-in / check-out (server clock; the browser never supplies the time)
 * and the teacher's own monthly duty record.
 */
export const DailyCheckInCard: React.FC = () => {
  const timezone = useAppSelector((s: any) => s.timetable?.timezone) as string | undefined;
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await requestApi<MonthlyReport>('/api/v1/duty/monthly-report');
      setReport(res);
    } catch {
      setReport(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fmt = (v: string | null) => {
    const d = parseUtcInstant(v);
    return d ? formatTimeInZone(d, timezone || Intl.DateTimeFormat().resolvedOptions().timeZone) : '—';
  };

  const schoolTimezone = (useAppSelector((s: any) => s.timetable?.schoolTimezone) as string | undefined) || DEFAULT_SCHOOL_TIMEZONE;
  // Duty dates are school calendar days
  const schoolToday = useMemo(
    () => new Intl.DateTimeFormat('en-CA', { timeZone: schoolTimezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
    [schoolTimezone, report]
  );
  const today = report?.dailyRecords.find((r) => r.dutyDate === schoolToday) || null;

  const act = async (action: 'CHECK_IN' | 'CHECK_OUT') => {
    setBusy(true);
    setMessage(null);
    try {
      await requestApi('/api/v1/duty/checkins/me', { method: 'POST', body: JSON.stringify({ action }) });
      setMessage({ type: 'ok', text: action === 'CHECK_IN' ? 'Checked in.' : 'Checked out.' });
      load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Could not record duty time' });
    } finally {
      setBusy(false);
    }
  };

  const records = (report?.dailyRecords || []).slice().reverse();

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#36348e]/10 text-[#36348e] flex items-center justify-center">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-black text-slate-900">Daily Duty Check-in</div>
            <div className="text-xs text-slate-500">
              {today?.checkInTime ? `In ${fmt(today.checkInTime)}` : 'Not checked in today'}
              {today?.checkOutTime ? ` · Out ${fmt(today.checkOutTime)} · ${minutesLabel(today.totalDutyMinutes)}` : ''}
              {today?.isLate ? ' · Late' : ''}
              {report?.salaryProfile?.dutyStartTime && report?.salaryProfile?.dutyEndTime
                ? ` · Duty ${report.salaryProfile.dutyStartTime}–${report.salaryProfile.dutyEndTime} (school time)`
                : ''}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            disabled={busy || Boolean(today?.checkInTime)}
            onClick={() => act('CHECK_IN')}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" /> Check In
          </button>
          <button
            disabled={busy || !today?.checkInTime}
            onClick={() => act('CHECK_OUT')}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Check Out
          </button>
        </div>
      </div>

      {message && (
        <div className={`text-xs font-semibold ${message.type === 'ok' ? 'text-emerald-700' : 'text-rose-600'}`}>{message.text}</div>
      )}

      {report?.attendance && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
          {[
            ['Present', report.attendance.presentDays],
            ['Absent', report.attendance.absentDays],
            ['Late', report.attendance.lateDays],
            ['Early out', report.attendance.earlyDepartures],
            ['Leave', report.attendance.leaveDays],
            ['Duty hrs', report.attendance.totalDutyHours]
          ].map(([l, v]) => (
            <div key={String(l)} className="p-2 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-500 font-semibold">{l}</div>
              <div className="text-sm font-black text-slate-900">{v as any}</div>
            </div>
          ))}
        </div>
      )}

      {report?.salaryProfile?.salaryType === 'HOURLY' && (
        <div className="text-xs text-slate-600">
          Verified payable teaching time this month: <span className="font-bold text-slate-900">{report.teachingDuty.payableHours} hrs</span>
          {report.teachingDuty.projectedHourlyAmount !== null && (
            <> · projected <span className="font-bold text-emerald-700">Rs. {report.teachingDuty.projectedHourlyAmount.toLocaleString()}</span></>
          )}
        </div>
      )}

      {records.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-1.5">Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Duty Time</th>
                <th>Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((r) => (
                <tr key={r.dutyDate}>
                  <td className="py-1.5 font-semibold text-slate-800">{dayLabel(r.dutyDate)}</td>
                  <td>{fmt(r.checkInTime)}</td>
                  <td>{fmt(r.checkOutTime)}</td>
                  <td>{minutesLabel(r.totalDutyMinutes)}</td>
                  <td className={r.attendanceStatus === 'ABSENT' ? 'text-rose-600 font-semibold' : r.isLate ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                    {r.attendanceStatus === 'ON_LEAVE' ? 'Leave' : r.attendanceStatus.charAt(0) + r.attendanceStatus.slice(1).toLowerCase().replace('_', ' ')}
                    {r.isEarlyDeparture ? ' · early' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
