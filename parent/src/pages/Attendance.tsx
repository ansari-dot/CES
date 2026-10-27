import React, { useMemo, useState } from 'react';
import { CalendarCheck, XCircle, Clock, ShieldCheck } from 'lucide-react';
import { useChildData } from '../context/ParentContext';
import { MetricCard, StatusChip, RequireChild, LoadingBlock, ErrorBlock, EmptyBlock } from '../components/common';
import { pct, formatDate } from '../lib/format';

interface AttendanceData {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number | null;
  records: {
    id: number;
    lessonDate: string;
    startAt: string;
    subjectName: string;
    teacherName: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    remarks: string | null;
  }[];
}

const STATUS_LABEL: Record<string, string> = { PRESENT: 'Present', ABSENT: 'Absent', LATE: 'Late', EXCUSED: 'Excused' };

function AttendanceContent() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const { data, loading, error, reload } = useChildData<AttendanceData>((id) => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const qs = params.toString();
    return `/api/v1/parents/me/children/${id}/attendance${qs ? `?${qs}` : ''}`;
  });

  const records = useMemo(
    () => (data?.records || []).filter((r) => statusFilter === 'All' || r.status === statusFilter),
    [data, statusFilter]
  );

  if (loading && !data) return <LoadingBlock message="Loading attendance records…" />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={CalendarCheck}
          title="Attendance Rate"
          value={pct(data.attendanceRate)}
          subtitle={`${data.total} lessons recorded`}
          colorScheme="success"
        />
        <MetricCard icon={ShieldCheck} title="Present" value={data.present} colorScheme="primary" />
        <MetricCard icon={XCircle} title="Absent" value={data.absent} colorScheme="error" />
        <MetricCard icon={Clock} title="Late / Excused" value={`${data.late} / ${data.excused}`} colorScheme="warning" />
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-card border border-border rounded-md p-4 shadow-sm">
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">From</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-card border border-border rounded-sm px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">To</label>
          <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} className="bg-card border border-border rounded-sm px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-card border border-border rounded-sm px-3 py-1.5 text-sm cursor-pointer">
            <option value="All">All</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        {(startDate || endDate || statusFilter !== 'All') && (
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setStatusFilter('All');
            }}
            className="text-xs font-semibold text-primary hover:underline cursor-pointer pb-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {records.length === 0 ? (
        <EmptyBlock title="No attendance records" description="No lessons have been marked for the selected period." />
      ) : (
        <div className="bg-card border border-border rounded-md shadow-sm overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Subject</th>
                <th className="px-4 py-2.5">Teacher</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {formatDate(r.lessonDate)}
                    {r.startAt && (
                      <span className="text-xs text-muted-foreground ml-1.5">
                        {new Date(r.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-medium">{r.subjectName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.teacherName}</td>
                  <td className="px-4 py-2.5"><StatusChip status={STATUS_LABEL[r.status] || r.status} /></td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Attendance() {
  return (
    <RequireChild>
      <AttendanceContent />
    </RequireChild>
  );
}
