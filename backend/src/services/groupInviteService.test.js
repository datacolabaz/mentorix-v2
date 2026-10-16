const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generateToken,
  normalizeToken,
  looksLikeInviteToken,
  validateInviteInput,
  effectiveStatus,
  assertUsable,
  mapInvite,
  INACTIVE_MESSAGE,
} = require('./groupInviteService');

const NOW = Date.parse('2026-10-17T10:00:00Z');
const H = 3600 * 1000;

test('tokens are prefixed, unambiguous and distinct from legacy MX- join codes', () => {
  const seen = new Set();
  for (let i = 0; i < 500; i += 1) {
    const t = generateToken();
    assert.match(t, /^INV-[A-HJ-NP-Z2-9]{12}$/);
    seen.add(t);
  }
  assert.equal(seen.size, 500);
  assert.equal(looksLikeInviteToken(' inv-abcd2345efgh '), true);
  assert.equal(looksLikeInviteToken('MX-12345'), false);
  assert.equal(normalizeToken(' inv-ab cd '), 'INV-ABCD');
});

test('duration presets: 24 hours, 7 days, 30 days', () => {
  assert.equal(validateInviteInput({ duration: '24h' }, { now: NOW }).expires_at.getTime(), NOW + 24 * H);
  assert.equal(validateInviteInput({ duration: '7d' }, { now: NOW }).expires_at.getTime(), NOW + 7 * 24 * H);
  assert.equal(validateInviteInput({ duration: '30d' }, { now: NOW }).expires_at.getTime(), NOW + 30 * 24 * H);
  // default
  assert.equal(validateInviteInput({}, { now: NOW }).expires_at.getTime(), NOW + 7 * 24 * H);
});

test('custom date must be in the future and within a year', () => {
  const ok = validateInviteInput({ duration: 'custom', expires_at: '2026-11-01T12:00:00Z' }, { now: NOW });
  assert.equal(ok.expires_at.toISOString(), '2026-11-01T12:00:00.000Z');
  assert.throws(() => validateInviteInput({ duration: 'custom', expires_at: '2026-10-01T00:00:00Z' }, { now: NOW }), /gələcəkdə/);
  assert.throws(() => validateInviteInput({ duration: 'custom' }, { now: NOW }), /Bitmə tarixini/);
  assert.throws(() => validateInviteInput({ duration: 'custom', expires_at: '2028-01-01T00:00:00Z' }, { now: NOW }), /365/);
  assert.throws(() => validateInviteInput({ duration: '3d' }, { now: NOW }), /Müddəti seçin/);
});

test('use limit: default 30, integer 1..10000', () => {
  assert.equal(validateInviteInput({}, { now: NOW }).max_uses, 30);
  assert.equal(validateInviteInput({ max_uses: '5' }, { now: NOW }).max_uses, 5);
  for (const bad of [0, -1, 1.5, 10001, 'abc']) {
    assert.throws(() => validateInviteInput({ max_uses: bad }, { now: NOW }), /limiti/, String(bad));
  }
});

test('allowed_role is student only', () => {
  assert.equal(validateInviteInput({}, { now: NOW }).allowed_role, 'student');
  assert.throws(() => validateInviteInput({ allowed_role: 'instructor' }, { now: NOW }), /yalnız tələbələr/);
});

test('effective status: revoked > expired > exhausted > active', () => {
  const base = { status: 'active', expires_at: new Date(NOW + H).toISOString(), max_uses: 2, used_count: 0 };
  assert.equal(effectiveStatus(base, NOW), 'active');
  assert.equal(effectiveStatus({ ...base, used_count: 2 }, NOW), 'exhausted');
  assert.equal(effectiveStatus({ ...base, expires_at: new Date(NOW - 1).toISOString() }, NOW), 'expired');
  assert.equal(effectiveStatus({ ...base, status: 'revoked', used_count: 2 }, NOW), 'revoked');
});

test('inactive token answers 410 "link is no longer active" (no registration, no crash)', () => {
  const expired = { status: 'active', expires_at: new Date(NOW - H).toISOString(), max_uses: 5, used_count: 0, allowed_role: 'student' };
  assert.throws(
    () => assertUsable(expired, { now: NOW }),
    (err) => err.statusCode === 410 && err.code === 'INVITE_INACTIVE' && err.message === INACTIVE_MESSAGE && err.details.reason === 'expired',
  );
  const full = { ...expired, expires_at: new Date(NOW + H).toISOString(), used_count: 5 };
  assert.throws(() => assertUsable(full, { now: NOW }), (err) => err.statusCode === 410 && err.details.reason === 'exhausted');
  const ok = { ...full, used_count: 4 };
  assert.doesNotThrow(() => assertUsable(ok, { now: NOW }));
  assert.throws(() => assertUsable(ok, { now: NOW, role: 'parent' }), (err) => err.code === 'INVITE_ROLE_MISMATCH');
});

test('mapInvite exposes link, remaining uses and computed status', () => {
  const out = mapInvite(
    { id: 'x', token: 'INV-ABCDEFGHJKLM', group_id: 'g', created_by: 'u', expires_at: new Date(NOW + H).toISOString(),
      max_uses: 30, used_count: 12, allowed_role: 'student', status: 'active', created_at: new Date(NOW).toISOString() },
    { now: NOW, appUrl: 'https://mentorix.io' },
  );
  assert.equal(out.link, 'https://mentorix.io/join/INV-ABCDEFGHJKLM');
  assert.equal(out.remaining_uses, 18);
  assert.equal(out.status, 'active');
});
