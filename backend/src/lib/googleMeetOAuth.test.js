const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  createPkcePair,
  frontendConnectRedirect,
  GOOGLE_MEET_SCOPES,
  parseGrantedScopes,
  hasCalendarEventsScope,
  isInsufficientCalendarScopeError,
  CALENDAR_EVENTS_SCOPE,
} = require('./googleMeetOAuth');

describe('googleMeetOAuth helpers', () => {
  it('creates PKCE verifier/challenge pair', () => {
    const a = createPkcePair();
    const b = createPkcePair();
    assert.ok(a.verifier.length >= 32);
    assert.ok(a.challenge.length >= 32);
    assert.notEqual(a.verifier, a.challenge);
    assert.notEqual(a.verifier, b.verifier);
  });

  it('includes calendar.events scope', () => {
    assert.ok(GOOGLE_MEET_SCOPES.some((s) => s.includes('calendar.events')));
  });

  it('parses space-delimited granted scopes', () => {
    assert.deepEqual(parseGrantedScopes('openid email profile'), [
      'openid',
      'email',
      'profile',
    ]);
    assert.equal(hasCalendarEventsScope('openid email profile'), false);
    assert.equal(
      hasCalendarEventsScope(`openid email ${CALENDAR_EVENTS_SCOPE}`),
      true,
    );
  });

  it('detects insufficient calendar scope API errors', () => {
    assert.equal(
      isInsufficientCalendarScopeError(403, {
        error: {
          message: 'Request had insufficient authentication scopes.',
          status: 'PERMISSION_DENIED',
          details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }],
        },
      }),
      true,
    );
    assert.equal(
      isInsufficientCalendarScopeError(403, {
        error: { message: 'Forbidden', status: 'PERMISSION_DENIED' },
      }),
      false,
    );
    assert.equal(isInsufficientCalendarScopeError(500, {}), false);
  });

  it('builds frontend redirect with success flag', () => {
    const prev = process.env.FRONTEND_BASE_URL;
    process.env.FRONTEND_BASE_URL = 'https://app.example';
    const url = frontendConnectRedirect({ success: true, returnPath: '/instructor/live/history' });
    assert.equal(url, 'https://app.example/instructor/live/history?meet_connected=1');
    if (prev === undefined) delete process.env.FRONTEND_BASE_URL;
    else process.env.FRONTEND_BASE_URL = prev;
  });

  it('rejects open redirect via returnPath (only path allowed)', () => {
    const prev = process.env.FRONTEND_BASE_URL;
    process.env.FRONTEND_BASE_URL = 'https://app.example';
    const url = frontendConnectRedirect({
      success: true,
      returnPath: 'https://evil.example/phish',
    });
    assert.match(url, /^https:\/\/app\.example\/instructor\/live\/history/);
    if (prev === undefined) delete process.env.FRONTEND_BASE_URL;
    else process.env.FRONTEND_BASE_URL = prev;
  });
});
