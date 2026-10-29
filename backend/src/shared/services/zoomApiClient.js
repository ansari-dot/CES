import crypto from 'node:crypto';
import { config } from '../../config/index.js';
import { AppError } from '../errors/AppError.js';
import { ErrorCodes } from '../errors/errorCodes.js';

/**
 * Zoom REST client (Server-to-Server OAuth, account credentials grant).
 *
 * Production behaviour: every method talks to the real Zoom API or fails with a clear error.
 * There is deliberately NO simulated/fallback data path here. Tests stub `zoomApiClient.request`
 * (or `global.fetch`) to supply mock Zoom responses.
 */

let cachedToken = null;
let tokenExpiresAt = 0;

const ZOOM_API_BASE = 'https://api.zoom.us/v2';
const MAX_RETRIES = 3;
const MAX_RETRY_AFTER_MS = 15000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Zoom meeting passcodes: max 10 chars, only alphanumerics and @ - _ * are allowed. */
export function generateMeetingPasscode(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** UUIDs that begin with "/" or contain "//" must be double URL-encoded (Zoom API requirement). */
export function encodeMeetingUuid(uuid) {
  const raw = String(uuid);
  if (raw.startsWith('/') || raw.includes('//')) {
    return encodeURIComponent(encodeURIComponent(raw));
  }
  return encodeURIComponent(raw);
}

function webhookSecret() {
  // A well-known fallback secret is ONLY ever usable when NODE_ENV === 'test'.
  return config.ZOOM_WEBHOOK_SECRET_TOKEN || (config.isTest ? 'test_webhook_secret_token_12345' : null);
}

function zoomError(message, status, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

export const zoomApiClient = {
  isConfigured() {
    return Boolean(config.ZOOM_ACCOUNT_ID && config.ZOOM_CLIENT_ID && config.ZOOM_CLIENT_SECRET);
  },

  isWebhookConfigured() {
    return Boolean(webhookSecret());
  },

  _resetTokenCache() {
    cachedToken = null;
    tokenExpiresAt = 0;
  },

  async getAccessToken({ force = false } = {}) {
    if (!this.isConfigured()) {
      throw new AppError(
        'Zoom API credentials (ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET) are not configured',
        422,
        ErrorCodes.CONFIG_ERROR || 'ZOOM_NOT_CONFIGURED'
      );
    }

    const now = Date.now();
    if (!force && cachedToken && now < tokenExpiresAt - 60000) {
      return cachedToken;
    }

    const basicAuth = Buffer.from(`${config.ZOOM_CLIENT_ID}:${config.ZOOM_CLIENT_SECRET}`).toString('base64');
    const tokenUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(
      config.ZOOM_ACCOUNT_ID
    )}`;

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!res.ok) {
      const errBody = await res.text();
      let parsedMsg = errBody;
      try {
        const json = JSON.parse(errBody);
        parsedMsg = json.reason || json.message || json.error || errBody;
      } catch {
        /* keep raw body */
      }
      throw new AppError(
        `Failed to authenticate with Zoom Server-to-Server OAuth: ${String(parsedMsg).slice(0, 200)}`,
        res.status >= 500 ? 502 : 422,
        ErrorCodes.ZOOM_LINK_UNUSABLE
      );
    }

    const data = await res.json();
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    return cachedToken;
  },

  /**
   * Authenticated request with: one forced token refresh on 401, Retry-After aware retry on 429,
   * and bounded exponential backoff on 5xx. Access tokens are never logged.
   */
  async request(path, options = {}) {
    const url = path.startsWith('http') ? path : `${ZOOM_API_BASE}${path}`;
    let refreshed = false;

    for (let attempt = 0; ; attempt++) {
      const token = await this.getAccessToken({ force: refreshed && attempt > 0 });
      const res = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });

      if (res.ok) {
        if (res.status === 204) return null;
        return await res.json();
      }

      if (res.status === 401 && !refreshed) {
        refreshed = true;
        this._resetTokenCache();
        continue;
      }

      if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
        const retryAfterSec = Number(res.headers?.get?.('retry-after'));
        const waitMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? Math.min(retryAfterSec * 1000, MAX_RETRY_AFTER_MS)
          : Math.min(500 * 2 ** attempt, MAX_RETRY_AFTER_MS);
        await sleep(waitMs);
        continue;
      }

      const errBody = await res.text();
      let parsedMsg = errBody;
      let zoomCode = null;
      try {
        const json = JSON.parse(errBody);
        parsedMsg = json.message || json.reason || errBody;
        zoomCode = json.code ?? null;
      } catch {
        /* keep raw body */
      }
      const error = zoomError(`Zoom API error (${res.status}): ${String(parsedMsg).slice(0, 300)}`, res.status, parsedMsg);
      error.zoomCode = zoomCode;
      error.rateLimited = res.status === 429;
      error.missingScope = res.status === 400 && /scope/i.test(String(parsedMsg)) || res.status === 401 && /scope/i.test(String(parsedMsg));
      throw error;
    }
  },

  /** Account identity via the token owner. Returns the Zoom account id reported by Zoom itself. */
  async getAccountInfo() {
    const me = await this.request('/users/me');
    return {
      zoomAccountId: me.account_id || null,
      ownerEmail: me.email || null,
      ownerName: `${me.first_name || ''} ${me.last_name || ''}`.trim() || me.email || null,
      ownerUserId: me.id || null
    };
  },

  async testConnection() {
    if (!this.isConfigured()) {
      return {
        configured: false,
        connected: false,
        licensedHosts: 0,
        concurrencyLimit: 0,
        hasEightLicenses: false,
        message: 'Zoom API credentials are not configured on the server.'
      };
    }

    try {
      const account = await this.getAccountInfo();
      let users = [];
      let usersError = null;
      try {
        users = await this.listUsers();
      } catch (err) {
        usersError = err.message;
      }
      const licensed = users.filter((u) => u.isLicensed);
      return {
        configured: true,
        connected: true,
        configuredAccountId: config.ZOOM_ACCOUNT_ID,
        zoomAccountId: account.zoomAccountId,
        accountEmail: account.ownerEmail,
        accountName: account.ownerName,
        accountType: 'Zoom Server-to-Server OAuth Account',
        totalUsers: users.length,
        licensedCount: licensed.length,
        licensedHosts: licensed.length,
        concurrencyLimit: licensed.length,
        hasEightLicenses: licensed.length >= 8,
        usersError,
        message: usersError
          ? `Connected, but the user list could not be read (${usersError}). Grant the user:read:admin scope.`
          : `Connected. ${licensed.length} licensed user(s) found.`
      };
    } catch (err) {
      return {
        configured: true,
        connected: false,
        licensedHosts: 0,
        concurrencyLimit: 0,
        hasEightLicenses: false,
        message: err.message || 'Failed to authenticate with Zoom'
      };
    }
  },

  /** All active users in the account (paginated). Throws on API failure - callers must handle it. */
  async listUsers() {
    const users = [];
    let nextToken = '';
    for (let page = 0; page < 20; page++) {
      const qs = `status=active&page_size=300${nextToken ? `&next_page_token=${encodeURIComponent(nextToken)}` : ''}`;
      const data = await this.request(`/users?${qs}`);
      for (const u of data?.users || []) {
        users.push({
          id: u.id,
          email: u.email,
          name: `${u.first_name || u.display_name || ''} ${u.last_name || ''}`.trim() || u.email,
          type: u.type === 2 ? 'Licensed' : u.type === 1 ? 'Basic' : `Type ${u.type}`,
          isLicensed: u.type === 2,
          pmi: u.pmi
        });
      }
      nextToken = data?.next_page_token || '';
      if (!nextToken) break;
    }
    return users;
  },

  async listLicensedUsers() {
    if (!this.isConfigured()) {
      throw new AppError('Zoom API credentials are not configured on the server.', 422, ErrorCodes.CONFIG_ERROR);
    }
    const users = await this.listUsers();
    return users.filter((u) => u.isLicensed);
  },

  async getUser(userIdOrEmail) {
    return await this.request(`/users/${encodeURIComponent(userIdOrEmail)}`);
  },

  /**
   * Creates a permanent classroom: type 3 = recurring meeting with no fixed time.
   * Join-before-host means the meeting starts when the first participant joins; the licensed
   * host account never has to be logged in. Waiting room is off because Zoom does not allow
   * join-before-host together with a waiting room for ordinary attendees.
   * When registrationRequired is set every attendee needs a personal registrant link, which is
   * what allows teacher identity to be established without a Zoom account.
   */
  async createClassroomMeeting({ hostUserId, gradeLevel, topic, passcode, registrationRequired = false }) {
    if (!hostUserId) {
      throw new AppError('A licensed Zoom host user id is required to create a classroom meeting', 400, ErrorCodes.BAD_REQUEST);
    }
    const payload = {
      topic: topic || `Class ${gradeLevel} Live Classroom`,
      type: 3,
      password: passcode || generateMeetingPasscode(),
      agenda: `Permanent virtual classroom for Class ${gradeLevel}`,
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: true,
        jbh_time: 0,
        waiting_room: false,
        mute_upon_entry: true,
        use_pmi: false,
        approval_type: registrationRequired ? 0 : 2,
        ...(registrationRequired
          ? { registration_type: 1, registrants_confirmation_email: false, registrants_email_notification: false }
          : {}),
        audio: 'both',
        auto_recording: 'none'
      }
    };

    const created = await this.request(`/users/${encodeURIComponent(hostUserId)}/meetings`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return {
      meetingId: String(created.id),
      meetingUuid: created.uuid || null,
      topic: created.topic,
      joinUrl: created.join_url,
      startUrl: created.start_url || null,
      passcode: created.password || payload.password,
      hostZoomUserId: created.host_id || hostUserId,
      hostEmail: created.host_email || null,
      registrationRequired: Boolean(registrationRequired)
    };
  },

  async getMeeting(meetingId) {
    return await this.request(`/meetings/${meetingId}`);
  },

  async deleteMeeting(meetingId) {
    try {
      return await this.request(`/meetings/${meetingId}`, { method: 'DELETE' });
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  /** Registers one person; Zoom returns a personal join_url bound to the returned registrant id. */
  async addRegistrant(meetingId, { email, firstName, lastName }) {
    const created = await this.request(`/meetings/${meetingId}/registrants`, {
      method: 'POST',
      body: JSON.stringify({
        email,
        first_name: firstName || 'School',
        last_name: lastName || 'User'
      })
    });
    return {
      registrantId: created.registrant_id,
      joinUrl: created.join_url,
      participantPinCode: created.participant_pin_code || null
    };
  },

  /** Ended instances (UUIDs + start times) of a recurring meeting. */
  async listPastMeetingInstances(meetingId) {
    const data = await this.request(`/past_meetings/${meetingId}/instances`);
    return (data?.meetings || []).map((m) => ({ uuid: m.uuid, startTime: m.start_time }));
  },

  /**
   * Authoritative participant report for ONE meeting instance. Requires a Pro or higher plan
   * and the report:read:admin scope. Throws on failure so callers can flag the lesson for review
   * instead of silently reconciling against an empty list.
   */
  async getParticipantReport(meetingUuid) {
    const encoded = encodeMeetingUuid(meetingUuid);
    const rows = [];
    let nextToken = '';
    for (let page = 0; page < 20; page++) {
      const qs = `page_size=300${nextToken ? `&next_page_token=${encodeURIComponent(nextToken)}` : ''}`;
      const data = await this.request(`/report/meetings/${encoded}/participants?${qs}`);
      rows.push(...(data?.participants || []));
      nextToken = data?.next_page_token || '';
      if (!nextToken) break;
    }
    return rows.map((p) => ({
      participantId: p.participant_user_id || p.id || '',
      participantUuid: p.participant_uuid || p.user_id || '',
      registrantId: p.registrant_id || '',
      name: p.name || p.user_name || '',
      email: p.user_email || p.email || '',
      joinTime: p.join_time || null,
      leaveTime: p.leave_time || null,
      durationSeconds: Number.isFinite(Number(p.duration)) ? Number(p.duration) : null
    }));
  },

  async getMeetingParticipants(meetingIdOrUuid) {
    return await this.getParticipantReport(meetingIdOrUuid);
  },

  /** Zoom endpoint.url_validation response: HMAC-SHA256(plainToken) hex using the webhook secret token. */
  validateWebhookPlainToken(plainToken) {
    const secret = webhookSecret();
    if (!secret) {
      throw new AppError('ZOOM_WEBHOOK_SECRET_TOKEN is not configured', 503, ErrorCodes.CONFIG_ERROR);
    }
    return crypto.createHmac('sha256', secret).update(String(plainToken)).digest('hex');
  },

  /**
   * Official Zoom verification: signature = "v0=" + HMAC-SHA256(secret, `v0:${timestamp}:${rawBody}`).
   * rawBody MUST be the exact bytes received. A re-serialised JSON object is never accepted.
   */
  verifyWebhookSignature({ signature, timestamp, rawBody, secretToken = null }) {
    const secret = secretToken || webhookSecret();
    if (!secret) return false;
    if (!signature || !timestamp || rawBody === undefined || rawBody === null) return false;
    if (typeof rawBody !== 'string' && !Buffer.isBuffer(rawBody)) return false;

    const nowSec = Math.floor(Date.now() / 1000);
    const tsSec = parseInt(timestamp, 10);
    if (Number.isNaN(tsSec) || Math.abs(nowSec - tsSec) > config.ZOOM_WEBHOOK_TOLERANCE_SEC) return false;

    const payloadStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    const expected = `v0=${crypto.createHmac('sha256', secret).update(`v0:${timestamp}:${payloadStr}`).digest('hex')}`;

    const sigBuf = Buffer.from(String(signature));
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  }
};
