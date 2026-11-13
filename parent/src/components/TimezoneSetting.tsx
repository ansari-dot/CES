import React, { useEffect, useState } from 'react';
import { requestApi } from '../services/api';
import { COMMON_TIMEZONES, getBrowserTimeZone, getUserTimeZone, setUserTimeZone, formatDateTime } from '../lib/format';

/** Parent profile setting: the timezone used to show dates and times in this portal. */
export default function TimezoneSetting() {
  const [isManual, setIsManual] = useState(false);
  const [current, setCurrent] = useState(getUserTimeZone());
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    requestApi<{ timezone: string | null; source: string }>('/api/v1/geo/my-timezone')
      .then((p) => setIsManual(String(p?.source).toUpperCase() === 'MANUAL'))
      .catch(() => undefined);
  }, []);

  const choose = async (value: string) => {
    setSaving(true);
    setStatus(null);
    try {
      if (value === '__auto__') {
        await requestApi('/api/v1/geo/my-timezone', { method: 'DELETE' });
        const tz = getBrowserTimeZone();
        await requestApi('/api/v1/geo/my-timezone', { method: 'PUT', body: JSON.stringify({ timezone: tz, source: 'browser' }) });
        setUserTimeZone(tz);
        setCurrent(tz);
        setIsManual(false);
      } else {
        await requestApi('/api/v1/geo/my-timezone', { method: 'PUT', body: JSON.stringify({ timezone: value, source: 'manual' }) });
        setUserTimeZone(value);
        setCurrent(value);
        setIsManual(true);
      }
      setStatus('Saved. Reopen a page to see times in the new timezone.');
    } catch (err: any) {
      setStatus(err?.message || 'Could not save timezone');
    } finally {
      setSaving(false);
    }
  };

  const options = COMMON_TIMEZONES.some((t) => t.value === current) ? COMMON_TIMEZONES : [{ value: current, label: current }, ...COMMON_TIMEZONES];

  return (
    <div className="mt-5">
      <div className="font-headings font-bold text-sm text-foreground mb-2">Display timezone</div>
      <select
        value={isManual ? current : '__auto__'}
        disabled={saving}
        onChange={(e) => choose(e.target.value)}
        className="w-full border border-border rounded-sm px-3 py-2 text-sm bg-card text-foreground"
      >
        <option value="__auto__">Automatic — this device ({getBrowserTimeZone()})</option>
        {options.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-muted-foreground mt-1.5">
        Now: {formatDateTime(new Date().toISOString())}. School holidays always keep their school calendar date.
      </p>
      {status && <p className="text-[11px] text-primary mt-1">{status}</p>}
    </div>
  );
}
