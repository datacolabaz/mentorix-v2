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

const GOOGLE_MEET_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.events',
];

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
    prompt: 'consent',
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
  GOOGLE_MEET_SCOPES,
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
