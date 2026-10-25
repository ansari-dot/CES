import crypto from 'crypto';
import { config } from '../../config/index.js';
import { AppError } from '../errors/AppError.js';
import { ErrorCodes } from '../errors/errorCodes.js';

let cachedToken = null;
let tokenExpiresAt = 0;

export const zoomApiClient = {
  isConfigured() {
    return Boolean(
      config.ZOOM_ACCOUNT_ID &&
      config.ZOOM_CLIENT_ID &&
      config.ZOOM_CLIENT_SECRET
    );
  },

  async getAccessToken() {
    if (!this.isConfigured()) {
      throw new AppError(
        'Zoom API credentials (ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET) are not configured in .env',
        422,
        ErrorCodes.CONFIG_ERROR || 'ZOOM_NOT_CONFIGURED'
      );
    }

    const now = Date.now();
    if (cachedToken && now < tokenExpiresAt - 60000) {
      return cachedToken;
    }

    const basicAuth = Buffer.from(
      `${config.ZOOM_CLIENT_ID}:${config.ZOOM_CLIENT_SECRET}`
    ).toString('base64');

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
        parsedMsg = json.message || json.reason || json.error || errBody;
      } catch (_) {}
      throw new AppError(
        `Failed to authenticate with Zoom Server-to-Server OAuth: ${parsedMsg}`,
        res.status,
        ErrorCodes.ZOOM_LINK_UNUSABLE
      );
    }

    const data = await res.json();
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    return cachedToken;
  },

  async request(path, options = {}) {
    const token = await this.getAccessToken();
    const url = path.startsWith('http') ? path : `https://api.zoom.us/v2${path}`;

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const res = await fetch(url, {
      ...options,
      headers
    });

    if (!res.ok) {
      const errBody = await res.text();
      let parsedMsg = errBody;
      try {
        const json = JSON.parse(errBody);
        parsedMsg = json.message || json.reason || errBody;
      } catch (_) {}
      const error = new Error(`Zoom API error (${res.status}): ${parsedMsg}`);
      error.status = res.status;
      error.details = parsedMsg;
      throw error;
    }

    if (res.status === 204) return null;
    return await res.json();
  },

  async testConnection() {
    if (!this.isConfigured()) {
      return {
        configured: false,
        connected: false,
        message: 'Zoom API credentials are not set in .env'
      };
    }

    try {
      const user = await this.request('/users/me');
      return {
        configured: true,
        connected: true,
        accountEmail: user.email,
        accountName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        accountType: user.type === 2 ? 'Licensed (Pro/Business)' : 'Basic',
        pmi: user.pmi,
        message: 'Successfully authenticated with Zoom Server-to-Server OAuth API'
      };
    } catch (err) {
      return {
        configured: true,
        connected: false,
        message: err.message || 'Failed to authenticate with Zoom'
      };
    }
  },

  async createClassroomMeeting({ gradeLevel, topic, passcode }) {
    const payload = {
      topic: topic || `Class ${gradeLevel} Official Live Classroom`,
      type: 3, // Recurring meeting with no fixed time (persistent classroom)
      password: passcode || `CLASS${gradeLevel}#`,
      agenda: `Daily persistent classroom for Grade ${gradeLevel} with Join-Before-Host (JBH) enabled.`,
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: true,
        jbh_time: 0, // Participants and teachers can join anytime before host
        waiting_room: false,
        mute_upon_entry: true,
        watermark: false,
        use_pmi: false,
        approval_type: 2, // Automatically approve
        audio: 'both',
        auto_recording: 'cloud'
      }
    };

    const created = await this.request('/users/me/meetings', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return {
      meetingId: String(created.id),
      topic: created.topic,
      joinUrl: created.join_url,
      startUrl: created.start_url,
      passcode: created.password || passcode
    };
  },

  async getMeeting(meetingId) {
    return await this.request(`/meetings/${meetingId}`);
  },

  async deleteMeeting(meetingId) {
    try {
      return await this.request(`/meetings/${meetingId}`, { method: 'DELETE' });
    } catch (err) {
      // 404 is fine if it was already deleted
      if (err.status === 404) return null;
      throw err;
    }
  },

  async getMeetingParticipants(meetingId) {
    try {
      const data = await this.request(`/report/meetings/${meetingId}/participants?page_size=300`);
      return data?.participants || [];
    } catch (err) {
      try {
        const past = await this.request(`/past_meetings/${meetingId}/participants?page_size=300`);
        return past?.participants || [];
      } catch {
        return [];
      }
    }
  },

  validateWebhookPlainToken(plainToken) {
    const secret = config.ZOOM_WEBHOOK_SECRET_TOKEN || 'fallback_secret';
    return crypto.createHmac('sha256', secret).update(plainToken).digest('hex');
  }
};
