const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateMeetingUrl,
  validateResourceUrl,
  maskMeetingUrl,
  maskUrlsInText,
  normalizePlatform,
} = require('./meetingUrl');

test('Google Meet link passes validation and is normalised', () => {
  const v = validateMeetingUrl('https://meet.google.com/abc-defg-hij', 'google_meet');
  assert.deepEqual(v, { ok: true, platform: 'google_meet', url: 'https://meet.google.com/abc-defg-hij' });
  const withAuth = validateMeetingUrl('https://meet.google.com/ABC-DEFG-HIJ/?authuser=1&hs=122', 'google_meet');
  assert.equal(withAuth.ok, true);
  assert.equal(withAuth.url, 'https://meet.google.com/abc-defg-hij?authuser=1');
});

test('Zoom link passes validation (j/<id>, vanity my/<name>, pwd kept, other params dropped)', () => {
  const a = validateMeetingUrl('https://us02web.zoom.us/j/81234567890?pwd=AbC.123&utm=x', 'zoom');
  assert.equal(a.ok, true);
  assert.equal(a.url, 'https://us02web.zoom.us/j/81234567890?pwd=AbC.123');
  assert.equal(validateMeetingUrl('https://zoom.us/j/123456789', 'zoom').ok, true);
  assert.equal(validateMeetingUrl('https://school.zoom.us/my/riyaziyyat', 'zoom').ok, true);
});

test('wrong Meet / Zoom formats get a clear Azerbaijani error', () => {
  const bad = [
    ['https://meet.google.com/lookup/abc', 'google_meet', 'MEET_FORMAT'],
    ['https://meet.google.com/abcdefghij', 'google_meet', 'MEET_FORMAT'],
    ['https://meet.google.com.evil.com/abc-defg-hij', 'google_meet', 'MEET_FORMAT'],
    ['https://zoom.us/meeting/123', 'zoom', 'ZOOM_FORMAT'],
    ['https://zoom.us.evil.com/j/123456789', 'zoom', 'ZOOM_FORMAT'],
    ['https://notzoom.us/j/123456789', 'zoom', 'ZOOM_FORMAT'],
  ];
  for (const [url, platform, code] of bad) {
    const v = validateMeetingUrl(url, platform);
    assert.equal(v.ok, false, url);
    assert.equal(v.code, code, url);
    assert.match(v.error, /formatda|linki/);
  }
});

test('platform mismatch is explained', () => {
  assert.match(validateMeetingUrl('https://meet.google.com/abc-defg-hij', 'zoom').error, /Google Meet/);
  assert.match(validateMeetingUrl('https://zoom.us/j/123456789', 'google_meet').error, /Zoom/);
  assert.equal(validateMeetingUrl('https://zoom.us/j/123456789', 'other').code, 'PLATFORM_MISMATCH');
});

test('"other" platform: safe HTTPS only', () => {
  assert.equal(validateMeetingUrl('https://teams.microsoft.com/l/meetup-join/abc', 'other').ok, true);
  assert.equal(validateMeetingUrl('https://whereby.com/mentorix-room', 'other').ok, true);
  const cases = [
    ['http://example.com/room', 'HTTPS_ONLY'],
    ['javascript:alert(1)', 'HTTPS_ONLY'],
    ['data:text/html,<script>alert(1)</script>', 'INVALID'],
    ['https://user:pass@example.com/room', 'CREDENTIALS'],
    ['https://127.0.0.1/room', 'PRIVATE_HOST'],
    ['https://localhost/room', 'PRIVATE_HOST'],
    ['https://[::1]/room', 'PRIVATE_HOST'],
    ['https://intranet/room', 'PRIVATE_HOST'],
    ['https://example.com:8443/room', 'INVALID'],
    ['https://example.com/go?next=https://evil.com', 'REDIRECT'],
    ['https://example.com/go?redirect_uri=//evil.com', 'REDIRECT'],
    ['https://example.com/"><script>alert(1)</script>', 'INVALID'],
    ['https://exa\u200bmple.com/room', 'INVALID'],
    ['example.com/room', 'INVALID'],
    ['', 'REQUIRED'],
    [`https://example.com/${'a'.repeat(600)}`, 'TOO_LONG'],
  ];
  for (const [url, code] of cases) {
    const v = validateMeetingUrl(url, 'other');
    assert.equal(v.ok, false, url);
    assert.equal(v.code, code, url);
  }
});

test('platform is required and normalised', () => {
  assert.equal(validateMeetingUrl('https://meet.google.com/abc-defg-hij', '').code, 'PLATFORM');
  assert.equal(normalizePlatform('Google-Meet'), 'google_meet');
  assert.equal(normalizePlatform('meet'), 'google_meet');
  assert.equal(normalizePlatform('mentorix_live'), null);
});

test('material links: HTTPS, no credentials / private hosts / redirects', () => {
  assert.equal(validateResourceUrl('https://docs.google.com/document/d/abc/edit').ok, true);
  assert.equal(validateResourceUrl('http://docs.google.com/x').code, 'HTTPS_ONLY');
  assert.equal(validateResourceUrl('https://10.0.0.5/file.pdf').code, 'PRIVATE_HOST');
  assert.equal(validateResourceUrl('https://example.com/?url=https://evil.com').code, 'REDIRECT');
});

test('meeting URLs are masked for logs', () => {
  assert.equal(maskMeetingUrl('https://meet.google.com/abc-defg-hij'), 'https://meet.google.com/***');
  assert.equal(maskMeetingUrl('not a url'), '***');
  const text = maskUrlsInText('failed for https://us02web.zoom.us/j/81234567890?pwd=secret and http://x.y/z');
  assert.doesNotMatch(text, /81234567890|secret/);
  assert.match(text, /us02web\.zoom\.us\/\*\*\*/);
});
