/**
 * Google OAuth for Calendar/Meet (separate from Sign-In ID-token flow).
 *
 * Env (Railway):
 * - GOOGLE_CLIENT_ID (reuse Sign-In client if same project allows Calendar scopes)
 * - GOOGLE_CLIENT_SECRET (required for authorization-code exchange)
 * - GOOGLE_MEET_REDIRECT_URI — must match Google Cloud Console authorized redirect URI
 *   e.g. https://api.example.com/api/teacher-connections/google_meet/callback
 */

const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');

const CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

const GOOGLE_MEET_SCOPES = [
  'openid',
  'email',
  'profile',
  CALENDAR_EVENTS_SCOPE,
];

/** @param {string|string[]|null|undefined} raw */
function parseGrantedScopes(raw) {
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s || '').trim()).filter(Boolean);
  }
  return String(raw || '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** @param {string|string[]|null|undefined} raw */
function hasCalendarEventsScope(raw) {
  const scopes = parseGrantedScopes(raw);
  return scopes.some(
    (s) =>
      s === CALENDAR_EVENTS_SCOPE ||
      s === 'https://www.googleapis.com/auth/calendar' ||
      s.endsWith('/auth/calendar.events') ||
      s.endsWith('/auth/calendar'),
  );
}

/** Detect Google Calendar API insufficient-scope / permission errors. */
function isInsufficientCalendarScopeError(status, data) {
  if (status !== 401 && status !== 403) return false;
  const reason = String(data?.error?.status || data?.error?.errors?.[0]?.reason || '').toUpperCase();
  const msg = String(data?.error?.message || '').toLowerCase();
  const details = Array.isArray(data?.error?.details) ? data.error.details : [];
  const detailReason = details
    .map((d) => String(d?.reason || '').toUpperCase())
    .join(' ');
  if (
    reason.includes('PERMISSION_DENIED') ||
    reason.includes('INSUFFICIENT') ||
    detailReason.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') ||
    detailReason.includes('INSUFFICIENT')
  ) {
    if (
      msg.includes('scope') ||
      msg.includes('permission') ||
      msg.includes('insufficient') ||
      detailReason.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')
    ) {
      return true;
    }
  }
  if (msg.includes('insufficient authentication scopes')) return true;
  if (msg.includes('request had insufficient authentication scopes')) return true;
  if (String(data?.error?.errors?.[0]?.reason || '') === 'insufficientPermissions') return true;
  return false;
}

function googleClientId() {
  return String(process.env.GOOGLE_MEET_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '').trim();
}

function googleClientSecret() {
  return String(process.env.GOOGLE_MEET_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '').trim();
}

function googleMeetRedirectUri() {
  const explicit = String(process.env.GOOGLE_MEET_REDIRECT_URI || '').trim();
  if (explicit) return explicit;
  const apiBase = String(process.env.API_PUBLIC_URL || process.env.BACKEND_URL || '').replace(/\/$/, '');
  if (apiBase) return `${apiBase}/api/teacher-connections/google_meet/callback`;
  return '';
}

function assertGoogleMeetOAuthConfigured() {
  if (!googleClientId() || !googleClientSecret() || !googleMeetRedirectUri()) {
    const err = new Error(
      'Google Meet OAuth konfiqurasiya olunmayıb (GOOGLE_CLIENT_ID/SECRET + GOOGLE_MEET_REDIRECT_URI)',
    );
    err.status = 503;
    err.code = 'GOOGLE_MEET_OAUTH_NOT_CONFIGURED';
    throw err;
  }
}

function getGoogleOAuthClient() {
  assertGoogleMeetOAuthConfigured();
  return new OAuth2Client(googleClientId(), googleClientSecret(), googleMeetRedirectUri());
}

function createPkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function buildAuthorizeUrl({ state, codeChallenge }) {
  const client = getGoogleOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    // Teachers commonly have several Google accounts open in the same browser.
    // Always show Google's account picker so a Meet connection is not silently
    // renewed against whichever account happens to be active in Chrome.
    prompt: 'select_account consent',
    scope: GOOGLE_MEET_SCOPES,
    state,
    include_granted_scopes: true,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
}

async function exchangeCodeForTokens(code, codeVerifier) {
  const client = getGoogleOAuthClient();
  const { tokens } = await client.getToken({
    code: String(code || ''),
    codeVerifier: String(codeVerifier || ''),
  });
  return tokens;
}

async function fetchGoogleUserInfo(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}

async function revokeGoogleToken(token) {
  if (!token) return;
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  } catch {
    // soft-fail revoke
  }
}

function frontendConnectRedirect({ success, error, returnPath } = {}) {
  const base = String(
    process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || process.env.APP_URL || '',
  ).replace(/\/$/, '');
  const path =
    returnPath && String(returnPath).startsWith('/')
      ? String(returnPath).split('?')[0]
      : '/instructor/live/history';
  const qs = new URLSearchParams();
  if (success) qs.set('meet_connected', '1');
  if (error) qs.set('meet_error', String(error).slice(0, 80));
  const q = qs.toString();
  return `${base || ''}${path}${q ? `?${q}` : ''}`;
}

module.exports = {
  CALENDAR_EVENTS_SCOPE,
  GOOGLE_MEET_SCOPES,
  parseGrantedScopes,
  hasCalendarEventsScope,
  isInsufficientCalendarScopeError,
  googleClientId,
  googleClientSecret,
  googleMeetRedirectUri,
  assertGoogleMeetOAuthConfigured,
  getGoogleOAuthClient,
  createPkcePair,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
  revokeGoogleToken,
  frontendConnectRedirect,
};
