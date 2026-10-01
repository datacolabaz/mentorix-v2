const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const express = require('express');

/**
 * API role/persona values never include the retired `mentor` role. Trainers are `instructor`
 * (label Təlimçi); old mentor rows and old clients are mapped, never echoed back.
 */

const SRC = path.join(__dirname, '..');
const MENTOR_RE = /(?<![a-z])mentor(?!ix)/i;

test('personas and their auth roles are only Təlimçi/Tələbə/Valideyn/Təşkilat roles', () => {
  const { PERSONA_ORDER, PERSONAS, PERSONA_TO_AUTH_ROLE, authRoleForPersona } = require('../config/personas');
  const allowedAuthRoles = new Set(['instructor', 'student', 'parent', 'course', null]);
  assert.equal(PERSONA_ORDER.includes('mentor'), false);
  assert.equal(Object.values(PERSONAS).includes('mentor'), false);
  assert.equal(Object.keys(PERSONA_TO_AUTH_ROLE).includes('mentor'), false);
  for (const persona of PERSONA_ORDER) {
    assert.ok(allowedAuthRoles.has(authRoleForPersona(persona)), persona);
  }
});

test('user payloads normalise a stored mentor persona to the trainer persona', () => {
  const { attachPersonaFields } = require('./personaOnboardingService');
  const out = attachPersonaFields(
    { id: 'u1', role: 'instructor', full_name: 'Test' },
    {
      persona: 'mentor',
      persona_profile: { mentor: { mentorship_focus: 'career' }, teacher: { subject: 'Fizika' }, current: 'mentor' },
      onboarding_completed: true,
    },
  );
  assert.equal(out.persona, 'teacher');
  assert.equal(out.role, 'instructor');
  assert.deepEqual(out.persona_profile, { teacher: { subject: 'Fizika' }, current: 'teacher' });
  assert.doesNotMatch(JSON.stringify(out), MENTOR_RE);

  const { publicPersona } = require('../config/personas');
  for (const v of ['mentor', 'Mentor', ' MENTOR ']) assert.equal(publicPersona(v), 'teacher', v);
});

test('the DB role CHECK constraints never allowed mentor and no migration adds it', () => {
  const dir = path.join(SRC, 'models', 'migrations');
  const offenders = [];
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.sql'))) {
    const sql = fs.readFileSync(path.join(dir, name), 'utf8');
    for (const m of sql.matchAll(/\brole\b[^;]{0,40}\bIN\s*\(([^)]*)\)/gi)) {
      if (MENTOR_RE.test(m[1])) offenders.push(`${name}: ${m[0]}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('no route authorises a mentor role', () => {
  const dir = path.join(SRC, 'routes');
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    const code = fs.readFileSync(path.join(dir, name), 'utf8');
    for (const m of code.matchAll(/authorize\(([^)]*)\)/g)) {
      assert.doesNotMatch(m[1], MENTOR_RE, `${name}: ${m[0]}`);
    }
  }
});

test('university program rows reach clients as contributor/instructor, never mentor', () => {
  const { toClientProgramRow } = require('./universityProgramContributionService');
  const row = toClientProgramRow({
    id: 1,
    mentor_display_name: 'Aysel M.',
    source_type: 'mentor',
    portal_source: 'mentor',
    ai_raw_json: { mentor_notes: 'IELTS 7', other: 1 },
  });
  assert.equal(row.contributor_display_name, 'Aysel M.');
  assert.equal(row.source_type, 'instructor');
  assert.equal(row.portal_source, 'instructor');
  assert.deepEqual(row.ai_raw_json, { other: 1, contributor_notes: 'IELTS 7' });
  assert.doesNotMatch(JSON.stringify(row), MENTOR_RE);
});

async function withServer(fn) {
  const app = express();
  app.use(express.json());
  app.use('/api/assistant', require('../routes/assistant'));
  app.use('/api/mentor', require('../routes/legacyMentor'));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('legacy /api/mentor/* answers 410 except the assistant aliases', async () => {
  await withServer(async (base) => {
    for (const [method, url] of [
      ['GET', '/api/mentor/goals'],
      ['GET', '/api/mentor/workspace/summary'],
      ['POST', '/api/mentor/sessions/1/ai-summary'],
      ['GET', '/api/mentor/'],
    ]) {
      // eslint-disable-next-line no-await-in-loop
      const r = await fetch(`${base}${url}`, { method });
      assert.equal(r.status, 410, `${method} ${url}`);
      // eslint-disable-next-line no-await-in-loop
      const body = await r.json();
      assert.equal(body.code, 'FEATURE_RETIRED');
      assert.doesNotMatch(body.message, MENTOR_RE);
    }
    for (const url of ['/api/mentor/onboarding', '/api/assistant/onboarding']) {
      // eslint-disable-next-line no-await-in-loop
      const r = await fetch(`${base}${url}`);
      assert.equal(r.status, 401, `${url} is served by the assistant router (auth required)`);
    }
  });
});
