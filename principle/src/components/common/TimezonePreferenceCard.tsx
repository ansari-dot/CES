import React, { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import { requestApi } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  COMMON_TIMEZONES,
  getBrowserTimeZone,
  getUserTimeZone,
  onTimeZoneChange,
  setUserTimeZone,
  zoneAbbreviation,
  formatDateTime
} from '../../lib/timezone';

/** Profile setting: the timezone used to display every date and time in this portal. */
export const TimezonePreferenceCard: React.FC = () => {
  const toast = useToast();
  const [current, setCurrent] = useState(getUserTimeZone());
  const [isManual, setIsManual] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => onTimeZoneChange(setCurrent), []);

  useEffect(() => {
    requestApi<{ timezone: string | null; source: string }>('/api/v1/geo/my-timezone')
      .then((p) => setIsManual(String(p?.source).toUpperCase() === 'MANUAL'))
      .catch(() => undefined);
  }, []);

  const choose = async (value: string) => {
    try {
      setSaving(true);
      if (value === '__auto__') {
        await requestApi('/api/v1/geo/my-timezone', { method: 'DELETE' });
        const browserTz = getBrowserTimeZone();
        await requestApi('/api/v1/geo/my-timezone', { method: 'PUT', body: JSON.stringify({ timezone: browserTz, source: 'browser' }) });
        setUserTimeZone(browserTz);
        setIsManual(false);
        toast.success(`Timezone set to automatic (${browserTz}).`);
      } else {
        await requestApi('/api/v1/geo/my-timezone', { method: 'PUT', body: JSON.stringify({ timezone: value, source: 'manual' }) });
        setUserTimeZone(value);
        setIsManual(true);
        toast.success(`Times will now be shown in ${value}.`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save timezone');
    } finally {
      setSaving(false);
    }
  };

  const options = COMMON_TIMEZONES.some((t) => t.value === current)
    ? COMMON_TIMEZONES
    : [{ value: current, label: current }, ...COMMON_TIMEZONES];

  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3 text-xs">
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-slate-600" />
        <span className="font-semibold text-slate-900 font-heading">Display Timezone</span>
      </div>
      <select
        value={isManual ? current : '__auto__'}
        disabled={saving}
        onChange={(e) => choose(e.target.value)}
        className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 font-medium"
      >
        <option value="__auto__">Automatic — this device ({getBrowserTimeZone()})</option>
        {options.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Now: <strong>{formatDateTime(new Date(), { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</strong> ({zoneAbbreviation(current)}).
        Chat, notifications, attendance and payroll times use this timezone. School holidays keep their school calendar date.
      </p>
    </div>
  );
};
