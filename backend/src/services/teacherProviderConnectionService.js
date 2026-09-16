const crypto = require('crypto');
const db = require('../utils/db');
const { encrypt, decrypt } = require('../lib/tokenCrypto');
const {
  createPkcePair,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
  revokeGoogleToken,
  GOOGLE_MEET_SCOPES,
  parseGrantedScopes,
  hasCalendarEventsScope,
  assertGoogleMeetOAuthConfigured,
} = require('../lib/googleMeetOAuth');
const {
  createPkcePair: createZoomPkcePair,
  buildAuthorizeUrl: buildZoomAuthorizeUrl,
  exchangeCodeForTokens: exchangeZoomCodeForTokens,
  refreshAccessToken: refreshZoomAccessToken,
  fetchZoomUserInfo,
  revokeZoomToken,
  ZOOM_SCOPES,
  assertZoomOAuthConfigured,
} = require('../lib/zoomOAuth');

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const ALLOWED_PROVIDERS = new Set(['google_meet', 'zoom', 'teams']);

function publicConnection(row) {
  if (!row) return null;
  return {
    provider: row.provider,
    status: row.status,
    account_email: row.account_email || null,
    provider_account_id: row.provider_account_id || null,
    connected: row.status === 'active',
    needs_reauth: row.status === 'needs_reauth',
    token_expires_at: row.token_expires_at || null,
    updated_at: row.updated_at || null,
  };
}

/**
 * A refresh token must never be carried from one Google account to another.
 * Google can omit a refresh token on a repeat consent flow, so only retain an
 * existing one when the identity returned by the new OAuth exchange matches.
 */
function sameGoogleAccount(existing, { providerAccountId, accountEmail }) {
  if (!existing) return false;
  const oldId = String(existing.provider_account_id || '').trim();
  const newId = String(providerAccountId || '').trim();
  if (oldId && newId) return oldId === newId;

  const oldEmail = String(existing.account_email || '').trim().toLowerCase();
  const newEmail = String(accountEmail || '').trim().toLowerCase();
  return Boolean(oldEmail && newEmail && oldEmail === newEmail);
}

async function listConnections(instructorId) {
  const { rows } = await db.query(
    `SELECT provider, status, account_email, provider_account_id, token_expires_at, updated_at
     FROM teacher_provider_connections
     WHERE instructor_id = $1::uuid
       AND status <> 'revoked'`,
    [instructorId],
  );
  const byProvider = Object.fromEntries(rows.map((r) => [r.provider, publicConnection(r)]));
  return {
    google_meet: byProvider.google_meet || { provider: 'google_meet', connected: false, status: null },
    zoom: byProvider.zoom || { provider: 'zoom', connected: false, status: null },
    teams: byProvider.teams || { provider: 'teams', connected: false, status: null, comingSoon: true },
  };
}

async function getActiveConnection(instructorId, provider) {
  const { rows } = await db.query(
    `SELECT * FROM teacher_provider_connections
     WHERE instructor_id = $1::uuid AND provider = $2 AND status = 'active'
     LIMIT 1`,
    [instructorId, provider],
  );
  return rows[0] || null;
}

async function getConnectionRow(instructorId, provider) {
  const { rows } = await db.query(
    `SELECT * FROM teacher_provider_connections
     WHERE instructor_id = $1::uuid AND provider = $2
     LIMIT 1`,
    [instructorId, provider],
  );
  return rows[0] || null;
}

async function getDecryptedTokens(row) {
  return {
    accessToken: decrypt(row.access_token_enc),
    refreshToken: row.refresh_token_enc ? decrypt(row.refresh_token_enc) : null,
  };
}

async function persistRefreshedTokens(connectionId, { accessToken, refreshToken, tokenExpiresAt }) {
  await db.query(
    `UPDATE teacher_provider_connections
     SET access_token_enc = $2,
         refresh_token_enc = COALESCE($3, refresh_token_enc),
         token_expires_at = $4,
         status = 'active',
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [
      connectionId,
      encrypt(accessToken),
      refreshToken ? encrypt(refreshToken) : null,
      tokenExpiresAt ? new Date(tokenExpiresAt).toISOString() : null,
    ],
  );
}

async function markNeedsReauth(connectionId) {
  await db.query(
    `UPDATE teacher_provider_connections
     SET status = 'needs_reauth', updated_at = NOW()
     WHERE id = $1::uuid`,
    [connectionId],
  );
}

async function startOAuth(instructorId, provider, { returnPath } = {}) {
  if (!ALLOWED_PROVIDERS.has(provider)) {
    const err = new Error('Naməlum provider');
    err.status = 400;
    throw err;
  }
  if (provider === 'teams') {
    const err = new Error('Bu platforma hələ aktiv deyil');
    err.status = 501;
    err.code = 'PROVIDER_NOT_IMPLEMENTED';
    throw err;
  }

  const state = crypto.randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);

  await db.query(
    `INSERT INTO oauth_pending_states (state, instructor_id, provider, code_verifier, return_path, expires_at)
     VALUES ($1, $2::uuid, $3, $4, $5, $6)`,
    [state, instructorId, provider, '', returnPath || null, expiresAt.toISOString()],
  );

  // cleanup old states opportunistically
  await db.query(`DELETE FROM oauth_pending_states WHERE expires_at < NOW()`).catch(() => {});

  if (provider === 'google_meet') {
    assertGoogleMeetOAuthConfigured();
    const { verifier, challenge } = createPkcePair();
    await db.query(
      `UPDATE oauth_pending_states SET code_verifier = $2 WHERE state = $1`,
      [state, verifier],
    );
    const redirectUrl = buildAuthorizeUrl({ state, codeChallenge: challenge });
    return { redirectUrl, state };
  }

  if (provider === 'zoom') {
    assertZoomOAuthConfigured();
    const { verifier, challenge } = createZoomPkcePair();
    await db.query(
      `UPDATE oauth_pending_states SET code_verifier = $2 WHERE state = $1`,
      [state, verifier],
    );
    const redirectUrl = buildZoomAuthorizeUrl({ state, codeChallenge: challenge });
    return { redirectUrl, state };
  }

  const err = new Error('Bu platforma hələ aktiv deyil');
  err.status = 501;
  err.code = 'PROVIDER_NOT_IMPLEMENTED';
  throw err;
}

async function consumeOAuthState(state) {
  const token = String(state || '').trim();
  if (!token) return null;
  const { rows } = await db.query(
    `DELETE FROM oauth_pending_states
     WHERE state = $1 AND expires_at > NOW()
     RETURNING *`,
    [token],
  );
  return rows[0] || null;
}

async function completeGoogleMeetOAuth({ code, state }) {
  const pending = await consumeOAuthState(state);
  if (!pending || pending.provider !== 'google_meet') {
    const err = new Error('OAuth state etibarsızdır və ya vaxtı bitib');
    err.status = 400;
    err.code = 'INVALID_OAUTH_STATE';
    throw err;
  }

  const tokens = await exchangeCodeForTokens(code, pending.code_verifier);
  const accessToken = tokens.access_token;
  if (!accessToken) {
    const err = new Error('Google token alınmadı');
    err.status = 502;
    throw err;
  }

  const grantedScopes = parseGrantedScopes(tokens.scope);
  // When Google returns an explicit scope list without Calendar, reject.
  // Empty scope field is treated as unknown (legacy clients) — allow and store requested scopes.
  if (grantedScopes.length > 0 && !hasCalendarEventsScope(grantedScopes)) {
    await revokeGoogleToken(accessToken);
    if (tokens.refresh_token) await revokeGoogleToken(tokens.refresh_token);
    const err = new Error(
      'Google Calendar icazəsi verilmədi. Razılıq ekranında təqvimi (calendar) işarələyin.',
    );
    err.status = 400;
    err.code = 'GOOGLE_CALENDAR_SCOPE_MISSING';
    throw err;
  }

  const profile = await fetchGoogleUserInfo(accessToken);
  const accountEmail = profile?.email || null;
  const providerAccountId = profile?.id || accountEmail || null;
  const expiry = tokens.expiry_date
    ? new Date(tokens.expiry_date)
    : new Date(Date.now() + 3500 * 1000);

  const accessEnc = encrypt(accessToken);
  const refreshEnc = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;

  // If Google did not return a new refresh token, keep the previous one only
  // when this is still the same Google account. Keeping it after an account
  // switch would later create Meets on the old account once the access token
  // expired.
  const existing = await getConnectionRow(pending.instructor_id, 'google_meet');
  const keepRefresh =
    refreshEnc ||
    (sameGoogleAccount(existing, { providerAccountId, accountEmail })
      ? existing?.refresh_token_enc
      : null);
  if (!keepRefresh) {
    const err = new Error(
      'Seçilən Google hesabı üçün refresh token alınmadı — Google hesab seçimini təsdiqləyib yenidən qoşulun',
    );
    err.status = 502;
    err.code = 'GOOGLE_REFRESH_MISSING';
    throw err;
  }

  const scopesToStore = grantedScopes.length ? grantedScopes : GOOGLE_MEET_SCOPES;

  const { rows } = await db.query(
    `INSERT INTO teacher_provider_connections (
       instructor_id, provider, provider_account_id, account_email,
       access_token_enc, refresh_token_enc, token_expires_at, scopes, status, meta
     ) VALUES (
       $1::uuid, 'google_meet', $2, $3, $4, $5, $6, $7::jsonb, 'active', '{}'::jsonb
     )
     ON CONFLICT (instructor_id, provider) DO UPDATE SET
       provider_account_id = EXCLUDED.provider_account_id,
       account_email = EXCLUDED.account_email,
       access_token_enc = EXCLUDED.access_token_enc,
       refresh_token_enc = COALESCE(EXCLUDED.refresh_token_enc, teacher_provider_connections.refresh_token_enc),
       token_expires_at = EXCLUDED.token_expires_at,
       scopes = EXCLUDED.scopes,
       status = 'active',
       updated_at = NOW()
     RETURNING provider, status, account_email, provider_account_id, token_expires_at, updated_at`,
    [
      pending.instructor_id,
      providerAccountId,
      accountEmail,
      accessEnc,
      keepRefresh,
      expiry.toISOString(),
      JSON.stringify(scopesToStore),
    ],
  );

  return {
    connection: publicConnection(rows[0]),
    returnPath: pending.return_path,
    instructorId: pending.instructor_id,
  };
}

/**
 * A refresh token must never be carried from one Zoom account to another.
 * Zoom typically returns a refresh token on every authorization-code exchange,
 * but keeping a previous one for the same account is safe and robust.
 */
function sameZoomAccount(existing, { providerAccountId, accountEmail }) {
  if (!existing) return false;
  const oldId = String(existing.provider_account_id || '').trim();
  const newId = String(providerAccountId || '').trim();
  if (oldId && newId) return oldId === newId;

  const oldEmail = String(existing.account_email || '').trim().toLowerCase();
  const newEmail = String(accountEmail || '').trim().toLowerCase();
  return Boolean(oldEmail && newEmail && oldEmail === newEmail);
}

async function completeZoomOAuth({ code, state }) {
  const pending = await consumeOAuthState(state);
  if (!pending || pending.provider !== 'zoom') {
    const err = new Error('OAuth state etibarsızdır və ya vaxtı bitib');
    err.status = 400;
    err.code = 'INVALID_OAUTH_STATE';
    throw err;
  }

  const tokens = await exchangeZoomCodeForTokens(code, pending.code_verifier);
  const accessToken = tokens.access_token;
  if (!accessToken) {
    const err = new Error('Zoom token alınmadı');
    err.status = 502;
    throw err;
  }

  const profile = await fetchZoomUserInfo(accessToken);
  const accountEmail = profile?.email || null;
  const providerAccountId = profile?.id || accountEmail || null;

  const expiresIn = Number(tokens.expires_in || 3600);
  const expiry = new Date(Date.now() + expiresIn * 1000 - 60000);

  const accessEnc = encrypt(accessToken);
  const refreshEnc = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;

  const existing = await getConnectionRow(pending.instructor_id, 'zoom');
  const keepRefresh =
    refreshEnc ||
    (sameZoomAccount(existing, { providerAccountId, accountEmail })
      ? existing?.refresh_token_enc
      : null);
  if (!keepRefresh) {
    const err = new Error(
      'Seçilən Zoom hesabı üçün refresh token alınmadı — Zoom hesab seçimini təsdiqləyib yenidən qoşulun',
    );
    err.status = 502;
    err.code = 'ZOOM_REFRESH_MISSING';
    throw err;
  }

  const scopesToStore = tokens.scope ? tokens.scope.split(/\s+/) : ZOOM_SCOPES;

  const { rows } = await db.query(
    `INSERT INTO teacher_provider_connections (
       instructor_id, provider, provider_account_id, account_email,
       access_token_enc, refresh_token_enc, token_expires_at, scopes, status, meta
     ) VALUES (
       $1::uuid, 'zoom', $2, $3, $4, $5, $6, $7::jsonb, 'active', '{}'::jsonb
     )
     ON CONFLICT (instructor_id, provider) DO UPDATE SET
       provider_account_id = EXCLUDED.provider_account_id,
       account_email = EXCLUDED.account_email,
       access_token_enc = EXCLUDED.access_token_enc,
       refresh_token_enc = COALESCE(EXCLUDED.refresh_token_enc, teacher_provider_connections.refresh_token_enc),
       token_expires_at = EXCLUDED.token_expires_at,
       scopes = EXCLUDED.scopes,
       status = 'active',
       updated_at = NOW()
     RETURNING provider, status, account_email, provider_account_id, token_expires_at, updated_at`,
    [
      pending.instructor_id,
      providerAccountId,
      accountEmail,
      accessEnc,
      keepRefresh,
      expiry.toISOString(),
      JSON.stringify(scopesToStore),
    ],
  );

  return {
    connection: publicConnection(rows[0]),
    returnPath: pending.return_path,
    instructorId: pending.instructor_id,
  };
}

async function disconnectProvider(instructorId, provider) {
  if (!ALLOWED_PROVIDERS.has(provider)) {
    const err = new Error('Naməlum provider');
    err.status = 400;
    throw err;
  }
  const row = await getConnectionRow(instructorId, provider);
  if (!row) {
    return { disconnected: true };
  }

  if (provider === 'google_meet') {
    try {
      const tokens = await getDecryptedTokens(row);
      await revokeGoogleToken(tokens.accessToken);
      if (tokens.refreshToken) await revokeGoogleToken(tokens.refreshToken);
    } catch {
      // soft-fail
    }
  }

  if (provider === 'zoom') {
    try {
      const tokens = await getDecryptedTokens(row);
      await revokeZoomToken(tokens.accessToken);
      if (tokens.refreshToken) await revokeZoomToken(tokens.refreshToken);
    } catch {
      // soft-fail
    }
  }

  await db.query(
    `DELETE FROM teacher_provider_connections
     WHERE instructor_id = $1::uuid AND provider = $2`,
    [instructorId, provider],
  );
  return { disconnected: true };
}

module.exports = {
  listConnections,
  getActiveConnection,
  getConnectionRow,
  getDecryptedTokens,
  persistRefreshedTokens,
  markNeedsReauth,
  startOAuth,
  completeGoogleMeetOAuth,
  completeZoomOAuth,
  disconnectProvider,
  publicConnection,
  sameGoogleAccount,
  sameZoomAccount,
  ALLOWED_PROVIDERS,
};
