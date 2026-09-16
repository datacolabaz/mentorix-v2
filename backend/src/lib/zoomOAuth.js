/**
 * Zoom OAuth for meeting creation on behalf of the authenticated teacher.
 *
 * Env (Railway):
 * - ZOOM_CLIENT_ID
 * - ZOOM_CLIENT_SECRET
 * - ZOOM_REDIRECT_URI — must match Zoom App Marketplace authorized redirect URI
 *   e.g. https://api.example.com/api/teacher-connections/zoom/callback
 *
 * Required Zoom OAuth scopes (user-level):
 * - user:read:user
 * - meeting:write:meeting
 * - meeting:read:meeting
 */

const crypto = require('crypto');

const ZOOM_OAUTH_BASE = 'https://zoom.us/oauth';
const ZOOM_API_BASE = 'https://api.zoom.us/v2';

const ZOOM_SCOPES = [
  'user:read:user',
  'meeting:write:meeting',
  'meeting:read:meeting',
];

function zoomClientId() {
  return String(process.env.ZOOM_CLIENT_ID || '').trim();
}

function zoomClientSecret() {
  return String(process.env.ZOOM_CLIENT_SECRET || '').trim();
}

function zoomRedirectUri() {
  const explicit = String(process.env.ZOOM_REDIRECT_URI || '').trim();
  if (explicit) return explicit;
  const apiBase = String(process.env.API_PUBLIC_URL || process.env.BACKEND_URL || '').replace(/\/$/, '');
  if (apiBase) return `${apiBase}/api/teacher-connections/zoom/callback`;
  return '';
}

function assertZoomOAuthConfigured() {
  if (!zoomClientId() || !zoomClientSecret() || !zoomRedirectUri()) {
    const err = new Error('Zoom OAuth konfiqurasiya olunmayıb (ZOOM_CLIENT_ID/SECRET + ZOOM_REDIRECT_URI)');
    err.status = 503;
    err.code = 'ZOOM_OAUTH_NOT_CONFIGURED';
    throw err;
  }
}

function basicAuthHeader() {
  const credentials = Buffer.from(`${zoomClientId()}:${zoomClientSecret()}`).toString('base64');
  return `Basic ${credentials}`;
}

function createPkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function buildAuthorizeUrl({ state, codeChallenge }) {
  assertZoomOAuthConfigured();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: zoomClientId(),
    redirect_uri: zoomRedirectUri(),
    state,
    scope: ZOOM_SCOPES.join(' '),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${ZOOM_OAUTH_BASE}/authorize?${params.toString()}`;
}

async function postToken(params) {
  const url = new URL(`${ZOOM_OAUTH_BASE}/token`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.reason || data?.errorDescription || 'Zoom token alınmadı');
    err.status = res.status >= 400 && res.status < 500 ? 400 : 502;
    err.code = 'ZOOM_TOKEN_EXCHANGE_FAILED';
    err.zoomData = data;
    throw err;
  }
  return data;
}

async function exchangeCodeForTokens(code, codeVerifier) {
  return postToken({
    grant_type: 'authorization_code',
    code: String(code || ''),
    redirect_uri: zoomRedirectUri(),
    code_verifier: String(codeVerifier || ''),
  });
}

async function refreshAccessToken(refreshToken) {
  return postToken({
    grant_type: 'refresh_token',
    refresh_token: String(refreshToken || ''),
  });
}

async function fetchZoomUserInfo(accessToken) {
  const res = await fetch(`${ZOOM_API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

async function revokeZoomToken(token) {
  if (!token) return;
  try {
    await fetch(`${ZOOM_OAUTH_BASE}/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { Authorization: basicAuthHeader() },
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
  if (success) qs.set('zoom_connected', '1');
  if (error) qs.set('zoom_error', String(error).slice(0, 80));
  const q = qs.toString();
  return `${base || ''}${path}${q ? `?${q}` : ''}`;
}

module.exports = {
  ZOOM_SCOPES,
  zoomClientId,
  zoomClientSecret,
  zoomRedirectUri,
  assertZoomOAuthConfigured,
  createPkcePair,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  fetchZoomUserInfo,
  revokeZoomToken,
  frontendConnectRedirect,
};
