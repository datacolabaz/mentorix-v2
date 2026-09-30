const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('./notificationPolicy');

const off = (category, channel, event_type = null) => ({ category, channel, event_type, enabled: false, frequency: 'off' });

test('security category cannot be disabled: prefs are ignored, in-app + immediate email', () => {
  const d = policy.resolveDelivery({
    role: 'student',
    category: 'security',
    eventType: 'login_security_alert',
    prefs: [off('security', 'in_app'), off('security', 'email')],
    wantsEmail: true,
  });
  assert.equal(d.mandatory, true);
  assert.equal(d.inApp, true);
  assert.deepEqual(d.email, { eligible: true, frequency: 'immediate', reason: 'mandatory' });
});

test('mandatory event types outside security are also locked', () => {
  const d = policy.resolveDelivery({
    role: 'instructor',
    category: 'system',
    eventType: 'account_suspended',
    prefs: [off('system', 'in_app'), off('system', 'email')],
    wantsEmail: true,
  });
  assert.equal(d.inApp, true);
  assert.equal(d.email.eligible, true);
});

test('preferences cannot switch security off through the settings API', () => {
  const v = policy.validatePreferenceUpdate({
    role: 'instructor',
    items: [{ category: 'security', channel: 'email', frequency: 'off' }],
  });
  assert.equal(v.ok, false);
  assert.equal(v.code, 'LOCKED_CATEGORY');
  const keep = policy.validatePreferenceUpdate({
    role: 'instructor',
    items: [{ category: 'security', channel: 'email', frequency: 'immediate' }],
  });
  assert.equal(keep.ok, true);
  assert.equal(keep.rows.length, 0, 'locked rows are never stored');
});

test('spec defaults: teacher material email OFF, student material email ON', () => {
  assert.equal(policy.defaultSetting('instructor', 'material', 'email').frequency, 'off');
  assert.equal(policy.defaultSetting('instructor', 'material', 'in_app').frequency, 'immediate');
  assert.equal(policy.defaultSetting('student', 'material', 'email').frequency, 'immediate');
  for (const cat of ['assessment', 'assignment', 'grading', 'group', 'billing']) {
    assert.equal(policy.defaultSetting('instructor', cat, 'email').frequency, 'immediate', cat);
    assert.equal(policy.defaultSetting('student', cat, 'email').frequency, 'immediate', cat);
  }
});

test('category preference off → email skipped before queueing', () => {
  const d = policy.resolveDelivery({
    role: 'instructor',
    category: 'assignment',
    eventType: 'assignment_submitted',
    prefs: [off('assignment', 'email')],
    wantsEmail: true,
  });
  assert.equal(d.inApp, true);
  assert.deepEqual(d.email, { eligible: false, frequency: null, reason: 'preference_off' });
});

test('event-level override beats category override', () => {
  const d = policy.resolveDelivery({
    role: 'instructor',
    category: 'assignment',
    eventType: 'assignment_submitted',
    prefs: [
      off('assignment', 'email'),
      { category: 'assignment', channel: 'email', event_type: 'assignment_submitted', enabled: true, frequency: 'daily' },
    ],
    wantsEmail: true,
  });
  assert.deepEqual(d.email, { eligible: true, frequency: 'daily', reason: 'event' });
});

test('heartbeat/autosave/open never email, even with an explicit opt-in', () => {
  for (const ev of ['heartbeat', 'exam_autosaved', 'material_opened', 'exam_question_answered', 'page_view']) {
    const d = policy.resolveDelivery({
      role: 'instructor',
      category: 'material',
      eventType: ev,
      prefs: [{ category: 'material', channel: 'email', event_type: ev, enabled: true, frequency: 'immediate' }],
      wantsEmail: true,
    });
    assert.equal(d.email.eligible, false, ev);
    assert.equal(d.email.reason, 'never_email', ev);
  }
});

test('material views/downloads need an event-level opt-in for email', () => {
  const base = { role: 'student', category: 'material', eventType: 'material_downloaded', wantsEmail: true };
  assert.equal(policy.resolveDelivery({ ...base, prefs: [] }).email.reason, 'opt_in_required');
  const optIn = policy.resolveDelivery({
    ...base,
    prefs: [{ category: 'material', channel: 'email', event_type: 'material_downloaded', enabled: true, frequency: 'weekly' }],
  });
  assert.deepEqual(optIn.email, { eligible: true, frequency: 'weekly', reason: 'event' });
});

test('in-app channel only accepts immediate/off; email accepts digests', () => {
  assert.equal(
    policy.validatePreferenceUpdate({ role: 'student', items: [{ category: 'material', channel: 'in_app', frequency: 'daily' }] }).code,
    'INVALID_FREQUENCY',
  );
  const v = policy.validatePreferenceUpdate({
    role: 'student',
    items: [
      { category: 'material', channel: 'email', frequency: 'weekly' },
      { category: 'material', channel: 'in_app', frequency: 'off' },
    ],
  });
  assert.equal(v.ok, true);
  assert.deepEqual(v.rows, [
    { category: 'material', channel: 'email', enabled: true, frequency: 'weekly' },
    { category: 'material', channel: 'in_app', enabled: false, frequency: 'off' },
  ]);
});

test('partner category is only visible/editable for partner users', () => {
  assert.equal(policy.visibleCategories('instructor').includes('partner'), false);
  assert.equal(policy.visibleCategories('instructor', { isPartner: true }).includes('partner'), true);
  assert.equal(
    policy.validatePreferenceUpdate({ role: 'student', items: [{ category: 'partner', channel: 'email', frequency: 'off' }] }).code,
    'INVALID_CATEGORY',
  );
  assert.deepEqual(policy.visibleCategories('admin'), ['security', 'partner', 'billing', 'system']);
});

test('preference matrix marks security rows as locked', () => {
  const m = policy.buildPreferenceMatrix({ role: 'student', prefs: [off('material', 'email')] });
  const sec = m.find((r) => r.category === 'security');
  assert.equal(sec.locked, true);
  assert.equal(sec.channels.email.frequency, 'immediate');
  assert.equal(sec.channels.in_app.locked, true);
  const mat = m.find((r) => r.category === 'material');
  assert.equal(mat.channels.email.frequency, 'off');
  assert.equal(mat.channels.email.default_frequency, 'immediate');
  assert.deepEqual(mat.channels.in_app.allowed_frequencies, ['immediate', 'off']);
});

test('legacy types map to categories without a DB backfill', () => {
  assert.deepEqual(policy.classifyNotification({ type: 'join_request', priority: 'NORMAL' }), { category: 'group', priority: 'HIGH' });
  assert.equal(policy.classifyNotification({ type: 'assignment_reviewed' }).category, 'grading');
  assert.equal(policy.classifyNotification({ type: 'assignment_something_new' }).category, 'assignment');
  assert.equal(policy.classifyNotification({ type: 'billing_monthly_2d_student' }).category, 'billing');
  assert.equal(policy.classifyNotification({ type: 'whatever' }).category, 'system');
  assert.deepEqual(
    policy.classifyNotification({ type: 'join_request', category: 'group', priority: 'LOW' }),
    { category: 'group', priority: 'LOW' },
  );
});

test('legacy filter excludes exact-mapped types from prefix matches', () => {
  const f = policy.legacyTypeFilter('assignment');
  assert.ok(f.exact.includes('assignment_submitted'));
  assert.ok(!f.exact.includes('assignment_reviewed'));
  assert.deepEqual(f.prefixes, ['assignment_%']);
  assert.ok(f.allExact.includes('assignment_reviewed'));
  assert.equal(policy.legacyTypeFilter('system').includeUnmapped, true);
});
