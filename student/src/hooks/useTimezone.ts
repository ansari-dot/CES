/**
 * useTimezone
 *
 * Detects the student's IANA timezone and keeps the timetable display in sync:
 *   1. Server-side IP geolocation (/api/v1/geo/timezone) – primary source.
 *   2. Browser-reported timezone – used by the server, or here, when IP lookup fails.
 *   3. School timezone – final fallback.
 *
 * Re-checks on mount, every 15 minutes, when the network comes back online and
 * when the tab becomes visible again (catches network/location changes). The
 * server caches lookups per IP, so repeated checks are cheap.
 *
 * Only the display changes; the authoritative schedule and billing deadlines
 * (school timezone) are unaffected. Not used for authentication/authorisation.
 */

import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { setTimezone, TimezoneSource } from '../store/slices/classesSlice';
import { requestApi } from '../services/api';
import { getBrowserTimeZone, isValidTimeZone } from '../lib/timezone';

const RECHECK_INTERVAL_MS = 15 * 60 * 1000;
const MIN_GAP_MS = 60 * 1000;

export function useTimezone() {
  const dispatch = useDispatch<AppDispatch>();
  const timezone = useSelector((state: RootState) => state.classes.timezone);
  const source = useSelector((state: RootState) => state.classes.timezoneSource);
  const currentRef = useRef({ timezone, source });
  currentRef.current = { timezone, source };
  const lastCheckRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function detect(force = false) {
      const now = Date.now();
      if (!force && now - lastCheckRef.current < MIN_GAP_MS) return;
      lastCheckRef.current = now;

      const browserTz = getBrowserTimeZone();
      let next: { timezone: string; source: TimezoneSource; schoolTimezone?: string } | null = null;
      try {
        const data = await requestApi<{ timezone: string; source: TimezoneSource; schoolTimezone: string }>(
          `/api/v1/geo/timezone${browserTz ? `?browserTz=${encodeURIComponent(browserTz)}` : ''}`
        );
        if (isValidTimeZone(data?.timezone)) {
          next = { timezone: data.timezone, source: data.source, schoolTimezone: data.schoolTimezone };
        }
      } catch {
        // Geolocation unavailable – fall through to the browser timezone
      }
      if (!next && browserTz) next = { timezone: browserTz, source: 'browser' };
      if (cancelled || !next) return;

      const cur = currentRef.current;
      if (cur.source === 'manual') return;
      if (next.timezone !== cur.timezone || next.source !== cur.source || next.schoolTimezone !== undefined) {
        dispatch(setTimezone(next));
      }
    }

    detect(true);
    const interval = setInterval(() => detect(true), RECHECK_INTERVAL_MS);
    const onOnline = () => detect(true);
    const onVisible = () => {
      if (document.visibilityState === 'visible') detect();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [dispatch]);
}
