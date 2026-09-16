const { LiveLessonProvider } = require('./LiveLessonProvider');
const {
  getActiveConnection,
  getDecryptedTokens,
  persistRefreshedTokens,
  markNeedsReauth,
} = require('../../services/teacherProviderConnectionService');
const { refreshAccessToken } = require('../../lib/zoomOAuth');

const DEFAULT_DURATION_MIN = 60;
const DEFAULT_TZ = 'Asia/Baku';
const ZOOM_API_BASE = 'https://api.zoom.us/v2';

function toZoomIso(date, tz) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) {
    const err = new Error('Tarix etibarsızdır');
    err.status = 400;
    throw err;
  }
  // Zoom accepts RFC3339 with an explicit timezone offset or IANA timezone.
  return { iso: d.toISOString(), tz };
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

class ZoomProvider extends LiveLessonProvider {
  get id() {
    return 'zoom';
  }

  async isConnected(instructorId) {
    const row = await getActiveConnection(instructorId, this.id);
    return Boolean(row);
  }

  async #accessToken(instructorId) {
    const row = await getActiveConnection(instructorId, this.id);
    if (!row) {
      const err = new Error('Zoom hesabı bağlı deyil');
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
      const err = new Error('Zoom yenidən bağlanmalıdır');
      err.status = 409;
      err.code = 'NEEDS_REAUTH';
      err.provider = this.id;
      throw err;
    }
    try {
      const refreshed = await refreshAccessToken(tokens.refreshToken);
      const accessToken = refreshed.access_token;
      if (!accessToken) throw new Error('refresh failed');
      const expiresIn = Number(refreshed.expires_in || 3600);
      const expiry = new Date(Date.now() + expiresIn * 1000 - 60000);
      const newRefresh = refreshed.refresh_token || tokens.refreshToken;
      await persistRefreshedTokens(row.id, {
        accessToken,
        refreshToken: newRefresh,
        tokenExpiresAt: expiry,
      });
      return { accessToken, connection: row };
    } catch (e) {
      await markNeedsReauth(row.id);
      const err = new Error('Zoom yenidən bağlanmalıdır');
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
    const { start, duration } = resolveWindow(input.scheduledAt, input.durationMinutes);
    const { iso: startTime } = toZoomIso(start, DEFAULT_TZ);

    const body = {
      topic: title.slice(0, 200),
      type: 2,
      start_time: startTime,
      duration,
      timezone: DEFAULT_TZ,
      settings: {
        host_video: true,
        participant_video: false,
        join_before_host: false,
        waiting_room: true,
        mute_upon_entry: true,
        auto_recording: 'none',
      },
    };

    const res = await fetch(`${ZOOM_API_BASE}/users/me/meetings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const zoomMsg = data?.message || data?.reason || null;
      if (res.status === 401 || res.status === 403) {
        await markNeedsReauth(connection.id);
        const err = new Error(
          zoomMsg ? `Zoom yenidən bağlanmalıdır (${zoomMsg})` : 'Zoom yenidən bağlanmalıdır',
        );
        err.status = 409;
        err.code = 'NEEDS_REAUTH';
        err.provider = this.id;
        err.zoomMessage = zoomMsg;
        throw err;
      }
      const err = new Error(zoomMsg || 'Zoom dərsi yaradıla bilmədi');
      err.status = res.status >= 400 && res.status < 500 ? 400 : 502;
      err.code = 'ZOOM_CREATE_FAILED';
      err.zoomMessage = zoomMsg;
      throw err;
    }

    const providerMeetingId = String(data.id || '');
    const joinUrl = data.join_url || null;
    const startUrl = data.start_url || null;
    const passcode = data.password || null;

    if (!providerMeetingId || !joinUrl) {
      const err = new Error('Zoom meeting məlumatları alınmadı');
      err.status = 502;
      err.code = 'ZOOM_NO_MEETING_LINK';
      throw err;
    }

    return {
      providerMeetingId,
      joinUrl,
      startUrl,
      passcode,
      raw: data,
      connectionId: connection.id,
    };
  }

  async updateMeeting(instructorId, providerMeetingId, patch = {}) {
    const { accessToken, connection } = await this.#accessToken(instructorId);
    const meetingId = String(providerMeetingId || '').trim();
    if (!meetingId) {
      const err = new Error('Meeting id yoxdur');
      err.status = 400;
      throw err;
    }

    const body = {};
    if (patch.title) body.topic = String(patch.title).slice(0, 200);
    if (patch.scheduledAt || patch.durationMinutes) {
      const { start, duration } = resolveWindow(patch.scheduledAt, patch.durationMinutes);
      const { iso: startTime } = toZoomIso(start, DEFAULT_TZ);
      body.start_time = startTime;
      body.duration = duration;
    }

    const res = await fetch(`${ZOOM_API_BASE}/meetings/${encodeURIComponent(meetingId)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 404) {
      const err = new Error('Zoom meeting tapılmadı');
      err.status = 404;
      err.code = 'ZOOM_MEETING_NOT_FOUND';
      throw err;
    }
    if (res.status === 401 || res.status === 403) {
      await markNeedsReauth(connection.id);
      const err = new Error('Zoom yenidən bağlanmalıdır');
      err.status = 409;
      err.code = 'NEEDS_REAUTH';
      err.provider = this.id;
      throw err;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data?.message || 'Zoom dərsi yenilənmədi');
      err.status = 502;
      err.code = 'ZOOM_UPDATE_FAILED';
      throw err;
    }
    return { id: meetingId, updated: true };
  }

  async cancelMeeting(instructorId, providerMeetingId) {
    const { accessToken, connection } = await this.#accessToken(instructorId);
    const meetingId = String(providerMeetingId || '').trim();
    if (!meetingId) return null;
    const res = await fetch(`${ZOOM_API_BASE}/meetings/${encodeURIComponent(meetingId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 404 || res.status === 410) return null;
    if (res.status === 401 || res.status === 403) {
      await markNeedsReauth(connection.id);
      const err = new Error('Zoom yenidən bağlanmalıdır');
      err.status = 409;
      err.code = 'NEEDS_REAUTH';
      err.provider = this.id;
      throw err;
    }
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data?.message || 'Zoom dərsi silinmədi');
      err.status = 502;
      err.code = 'ZOOM_DELETE_FAILED';
      throw err;
    }
    return null;
  }

  async getMeeting(instructorId, providerMeetingId) {
    const { accessToken, connection } = await this.#accessToken(instructorId);
    const meetingId = String(providerMeetingId || '').trim();
    const res = await fetch(`${ZOOM_API_BASE}/meetings/${encodeURIComponent(meetingId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 401 || res.status === 403) {
      await markNeedsReauth(connection.id);
      const err = new Error('Zoom yenidən bağlanmalıdır');
      err.status = 409;
      err.code = 'NEEDS_REAUTH';
      err.provider = this.id;
      throw err;
    }
    if (!res.ok) return null;
    return res.json().catch(() => null);
  }
}

module.exports = { ZoomProvider };
