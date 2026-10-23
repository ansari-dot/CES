/**
 * Geo/Timezone service
 *
 * Resolves a client's IANA timezone from its public IP (primary), falling back
 * to the browser-reported timezone, then to the school timezone.
 *
 * IP geolocation is approximate (VPNs, proxies, mobile carriers and ISP routing
 * can place a user in the wrong region). The result is only used to display
 * class times – never for authentication or authorisation.
 */

import { config } from '../../config/index.js';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // per-IP result
const FAILURE_TTL_MS = 5 * 60 * 1000; // back off after a failed lookup
const MAX_CACHE_ENTRIES = 5000;
const LOOKUP_TIMEOUT_MS = 3000;

export function isValidTimeZone(tz) {
  if (!tz || typeof tz !== 'string' || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function isPrivateIp(ip) {
  if (!ip) return true;
  const clean = String(ip).replace(/^::ffff:/i, '').toLowerCase();
  if (clean === '::1' || clean === 'localhost') return true;
  if (clean.includes(':')) {
    // IPv6 unique-local (fc00::/7) and link-local (fe80::/10)
    return /^f[cd]/.test(clean) || /^fe[89ab]/.test(clean);
  }
  return (
    clean.startsWith('127.') ||
    clean.startsWith('10.') ||
    clean.startsWith('192.168.') ||
    clean.startsWith('169.254.') ||
    clean === '0.0.0.0' ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(clean) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(clean) // carrier-grade NAT
  );
}

export function createTimezoneResolver({
  fetchImpl = globalThis.fetch,
  lookupUrl = config.GEO_LOOKUP_URL,
  fallbackTimezone = config.SCHOOL_TIMEZONE,
  now = () => Date.now()
} = {}) {
  const cache = new Map(); // ip -> { timezone, expiresAt }

  function remember(ip, timezone, ttl) {
    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
    cache.set(ip, { timezone, expiresAt: now() + ttl });
  }

  async function lookup(ip) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
    try {
      const res = await fetchImpl(lookupUrl.replace('{ip}', encodeURIComponent(ip)), { signal: controller.signal });
      if (!res.ok) return null;
      const body = await res.json();
      if (body?.status && body.status !== 'success') return null;
      return isValidTimeZone(body?.timezone) ? body.timezone : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * @returns {Promise<{ timezone: string, source: 'ip'|'browser'|'fallback', schoolTimezone: string }>}
   */
  async function resolve({ ip, browserTimezone }) {
    const browserTz = isValidTimeZone(browserTimezone) ? browserTimezone : null;
    const fallback = (source) =>
      browserTz
        ? { timezone: browserTz, source: 'browser', schoolTimezone: fallbackTimezone }
        : { timezone: fallbackTimezone, source, schoolTimezone: fallbackTimezone };

    if (isPrivateIp(ip)) return fallback('fallback');

    const cached = cache.get(ip);
    if (cached && cached.expiresAt > now()) {
      return cached.timezone
        ? { timezone: cached.timezone, source: 'ip', schoolTimezone: fallbackTimezone }
        : fallback('fallback');
    }

    const timezone = await lookup(ip);
    remember(ip, timezone, timezone ? CACHE_TTL_MS : FAILURE_TTL_MS);
    return timezone ? { timezone, source: 'ip', schoolTimezone: fallbackTimezone } : fallback('fallback');
  }

  return { resolve, _cache: cache };
}

export const timezoneResolver = createTimezoneResolver();
