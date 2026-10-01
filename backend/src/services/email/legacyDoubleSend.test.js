const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

/** Body of `async function <name>(` up to the next top-level function. */
function functionBody(source, name) {
  const start = source.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, `${name} not found`);
  const rest = source.slice(start + 1);
  const next = rest.search(/\n(?:async )?function |\nmodule\.exports/);
  return next >= 0 ? rest.slice(0, next) : rest;
}

const DIRECT_EMAIL = /sendEmail\s*\(|sendMail\s*\(|sendTemplatedEmail\s*\(|enqueueNotification\s*\(|userEmail\s*\(|channel:\s*'email'/;

const MIGRATED = [
  ['services/joinInvitationService.js', 'notifyInstructorJoinRequest'],
  ['services/examAccessRequestService.js', 'notifyInstructorExamAccessRequest'],
  ['services/taskAccessRequestService.js', 'notifyInstructorTaskAccessRequest'],
  ['jobs/openGradingInstructorNotifications.js', 'runOpenGradingInstructorNotifications'],
];

for (const [file, fn] of MIGRATED) {
  test(`${fn}: in-app via notificationService only, no second (legacy) email`, () => {
    const body = functionBody(read(file), fn);
    assert.match(body, /createNotification(Safe)?\s*\(/, 'uses the Phase A service');
    assert.doesNotMatch(body, DIRECT_EMAIL, 'email comes only from the notification outbox');
  });
}

test('migrated files no longer import the legacy email sender', () => {
  for (const [file] of MIGRATED) {
    assert.doesNotMatch(read(file), /require\(['"][./]+(services\/)?emailService['"]\)/, file);
  }
});

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.js$/.test(entry.name) && !/\.test\.js$/.test(entry.name)) out.push(p);
  }
  return out;
}

test('only the shared transport talks to Resend / SMTP', () => {
  const offenders = walk(SRC)
    .filter((p) => !p.includes(`${path.sep}services${path.sep}email${path.sep}`))
    .filter((p) => /new Resend\(|require\(['"]resend['"]\)|nodemailer\.createTransport|require\(['"]nodemailer['"]\)/.test(fs.readFileSync(p, 'utf8')))
    .map((p) => path.relative(SRC, p));
  assert.deepEqual(offenders, []);
});
