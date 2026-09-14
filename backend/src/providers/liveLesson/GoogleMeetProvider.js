const crypto = require('crypto');
const { LiveLessonProvider } = require('./LiveLessonProvider');
const {
  getActiveConnection,
  getDecryptedTokens,
  persistRefreshedTokens,
  markNeedsReauth,
} = require('../../services/teacherProviderConnectionService');
const { getGoogleOAuthClient } = require('../../lib/googleMeetOAuth');

const DEFAULT_DURATION_MIN = 60;
const BAKU_TZ = 'Asia/Baku';

function toIso(date) {
  return new Date(date).toISOString();
}

function resolveWindow(scheduledAt, durationMinutes) {
  const duration = Math.min(Math.max(Number(durationMinutes) || DEFAULT_DURATION_MIN, 15), 8 * 60);
  const start = scheduledAt ? new Date(scheduledAt) : new Date();
  if (Number.isNaN(start.getTime())) {
    const err = new Error('Tarix etibarsızdır');
    err.status = 400;
    throw err;
  }
  const end = new Date(start.getTime() + duration * 60 * 1000);
  return { start, end, duration };
}

class GoogleMeetProvider extends LiveLessonProvider {
  get id() {
    return 'google_meet';
  }

  async isConnected(instructorId) {
    const row = await getActiveConnection(instructorId, this.id);
    return Boolean(row);
  }

  async #accessToken(instructorId) {
    const row = await getActiveConnection(instructorId, this.id);
    if (!row) {
      const err = new Error('Google Meet hesabı bağlı deyil');
      err.status = 409;
      err.code = 'NEEDS_CONNECTION';
      err.provider = this.id;
      throw err;
    }
    const tokens = await getDecryptedTokens(row);
    const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
    const skewMs = 60 * 1000;
    if (tokens.accessToken && expiresAt > Date.now() + skewMs) {
      return { accessToken: tokens.accessToken, connection: row };
    }
    if (!tokens.refreshToken) {
      await markNeedsReauth(row.id);
      const err = new Error('Google Meet yenidən bağlanmalıdır');
      err.status = 409;
      err.code = 'NEEDS_REAUTH';
      err.provider = this.id;
      throw err;
    }
    try {
      const client = getGoogleOAuthClient();
      client.setCredentials({ refresh_token: tokens.refreshToken });
      const refreshed = await client.refreshAccessToken();
      const creds = refreshed.credentials || {};
      const accessToken = creds.access_token;
      if (!accessToken) throw new Error('refresh failed');
      const expiry = creds.expiry_date ? new Date(creds.expiry_date) : new Date(Date.now() + 3500 * 1000);
      await persistRefreshedTokens(row.id, {
        accessToken,
        refreshToken: creds.refresh_token || tokens.refreshToken,
        tokenExpiresAt: expiry,
      });
      return { accessToken, connection: row };
    } catch (e) {
      await markNeedsReauth(row.id);
      const err = new Error('Google Meet yenidən bağlanmalıdır');
      err.status = 409;
      err.code = 'NEEDS_REAUTH';
      err.provider = this.id;
      err.cause = e;
      throw err;
    }
  }

  async createMeeting(instructorId, input = {}) {
    const { accessToken, connection } = await this.#accessToken(instructorId);
    const title = String(input.title || '').trim() || 'Mentorix canlı dərs';
    const { start, end } = resolveWindow(input.scheduledAt, input.durationMinutes);
    const attendees = Array.isArray(input.attendeeEmails)
      ? input.attendeeEmails
          .map((e) => String(e || '').trim().toLowerCase())
          .filter((e) => e && e.includes('@'))
          .slice(0, 50)
          .map((email) => ({ email }))
      : [];

    const requestId = crypto.randomUUID();
    const body = {
      summary: title.slice(0, 200),
      description: 'Mentorix canlı dərs — Google Meet',
      start: { dateTime: toIso(start), timeZone: BAKU_TZ },
      end: { dateTime: toIso(end), timeZone: BAKU_TZ },
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      ...(attendees.length ? { attendees } : {}),
    };

    const url =
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=none';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || 'Google Meet yaradıla bilmədi';
      if (res.status === 401 || res.status === 403) {
        await markNeedsReauth(connection.id);
        const err = new Error('Google Meet yenidən bağlanmalıdır');
        err.status = 409;
        err.code = 'NEEDS_REAUTH';
        err.provider = this.id;
        throw err;
      }
      const err = new Error(msg);
      err.status = res.status >= 400 && res.status < 500 ? 400 : 502;
      err.code = 'GOOGLE_MEET_CREATE_FAILED';
      throw err;
    }

    const joinUrl =
      data.hangoutLink ||
      data.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video')?.uri ||
      null;
    if (!joinUrl) {
      const err = new Error('Google Meet linki alınmadı');
      err.status = 502;
      err.code = 'GOOGLE_MEET_NO_LINK';
      throw err;
    }

    return {
      providerMeetingId: String(data.id || ''),
      joinUrl,
      startUrl: joinUrl,
      passcode: null,
      raw: {
        htmlLink: data.htmlLink || null,
        hangoutLink: data.hangoutLink || null,
        status: data.status || null,
      },
      connectionId: connection.id,
    };
  }

  async updateMeeting(instructorId, providerMeetingId, patch = {}) {
    const { accessToken } = await this.#accessToken(instructorId);
    const eventId = encodeURIComponent(String(providerMeetingId || '').trim());
    if (!eventId) {
      const err = new Error('Meeting id yoxdur');
      err.status = 400;
      throw err;
    }
    const body = {};
    if (patch.title) body.summary = String(patch.title).slice(0, 200);
    if (patch.scheduledAt || patch.durationMinutes) {
      const { start, end } = resolveWindow(patch.scheduledAt, patch.durationMinutes);
      body.start = { dateTime: toIso(start), timeZone: BAKU_TZ };
      body.end = { dateTime: toIso(end), timeZone: BAKU_TZ };
    }
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data?.error?.message || 'Google Meet yenilənmədi');
      err.status = 502;
      throw err;
    }
    return res.json();
  }

  async cancelMeeting(instructorId, providerMeetingId) {
    const { accessToken } = await this.#accessToken(instructorId);
    const eventId = encodeURIComponent(String(providerMeetingId || '').trim());
    if (!eventId) return null;
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (res.status === 404 || res.status === 410) return null;
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data?.error?.message || 'Google Meet silinmədi');
      err.status = 502;
      throw err;
    }
    return null;
  }

  async getMeeting(instructorId, providerMeetingId) {
    const { accessToken } = await this.#accessToken(instructorId);
    const eventId = encodeURIComponent(String(providerMeetingId || '').trim());
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    return res.json();
  }
}

module.exports = { GoogleMeetProvider };
