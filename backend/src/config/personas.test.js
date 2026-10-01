const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  PERSONAS,
  PERSONA_ORDER,
  isPersonaId,
  normalizePersonaId,
  publicPersona,
  publicPersonaProfile,
  authRoleForPersona,
  personaFromLegacyRole,
  sanitizePersonaProfile,
  requiredProfileComplete,
  mergePersonaProfile,
  isAdminRole,
  rowNeedsOnboarding,
} = require('./personas');

describe('personas config', () => {
  it('maps each persona to an authorization role without treating course as a persona', () => {
    assert.equal(authRoleForPersona(PERSONAS.TEACHER), 'instructor');
    assert.equal(authRoleForPersona(PERSONAS.EDUCATION_CENTER), 'course');
    assert.equal(authRoleForPersona(PERSONAS.STUDENT), 'student');
    assert.equal(authRoleForPersona(PERSONAS.PARENT), 'parent');
    assert.equal(authRoleForPersona(PERSONAS.HR_COMPANY), 'instructor');
    assert.equal(authRoleForPersona(PERSONAS.OTHER), 'instructor');
    assert.equal(authRoleForPersona(PERSONAS.PARTNER), null);
    assert.equal(isPersonaId('course'), false);
    assert.equal(isPersonaId(PERSONAS.PARTNER), true);
    assert.equal(PERSONA_ORDER.includes('course'), false);
    assert.equal(PERSONA_ORDER.includes(PERSONAS.PARTNER), true);
  });

  it('treats partner profile as complete without extra fields', () => {
    assert.equal(requiredProfileComplete(PERSONAS.PARTNER, {}), true);
    assert.deepEqual(sanitizePersonaProfile(PERSONAS.PARTNER, { note: '  hi  ', extra: 1 }), { note: 'hi' });
  });

  it('retired mentor persona is not a persona; it normalises to the trainer (teacher) persona', () => {
    assert.equal(isPersonaId('mentor'), false);
    assert.equal(PERSONA_ORDER.includes('mentor'), false);
    assert.equal(Object.values(PERSONAS).includes('mentor'), false);
    assert.equal(normalizePersonaId('mentor'), PERSONAS.TEACHER);
    assert.equal(normalizePersonaId(' Mentor '), PERSONAS.TEACHER);
    assert.equal(normalizePersonaId('student'), PERSONAS.STUDENT);
    assert.equal(normalizePersonaId('nope'), null);
    assert.equal(publicPersona('mentor'), PERSONAS.TEACHER);
    assert.equal(publicPersona(null), null);
    assert.equal(authRoleForPersona(normalizePersonaId('mentor')), 'instructor');
  });

  it('client persona_profile never carries the retired mentor slice', () => {
    const out = publicPersonaProfile({ mentor: { mentorship_focus: 'AI' }, teacher: { subject: 'Fizika' }, current: 'mentor' });
    assert.deepEqual(out, { teacher: { subject: 'Fizika' }, current: 'teacher' });
    assert.deepEqual(publicPersonaProfile('{"current":"student"}'), { current: 'student' });
    const merged = mergePersonaProfile({ mentor: { mentorship_focus: 'AI' }, current: 'mentor' }, PERSONAS.TEACHER, { subject: 'Kimya' });
    assert.deepEqual(merged, { teacher: { subject: 'Kimya' }, current: 'teacher' });
  });

  it('maps legacy signup roles to personas', () => {
    assert.equal(personaFromLegacyRole('instructor'), PERSONAS.TEACHER);
    assert.equal(personaFromLegacyRole('course'), PERSONAS.EDUCATION_CENTER);
    assert.equal(personaFromLegacyRole('student'), PERSONAS.STUDENT);
    assert.equal(personaFromLegacyRole('parent'), PERSONAS.PARENT);
  });

  it('sanitizes and validates teacher profile fields', () => {
    const clean = sanitizePersonaProfile(PERSONAS.TEACHER, {
      subject: '  Riyaziyyat  ',
      teaching_format: 'group',
      student_count: '6-15',
      extra: 'drop-me',
    });
    assert.deepEqual(clean, {
      subject: 'Riyaziyyat',
      teaching_format: 'group',
      student_count: '6-15',
    });
    assert.equal(requiredProfileComplete(PERSONAS.TEACHER, clean), true);
    assert.equal(requiredProfileComplete(PERSONAS.TEACHER, {}), true);
    assert.equal(requiredProfileComplete(PERSONAS.STUDENT, {}), true);
  });

  it('merges persona slices without deleting previous data', () => {
    const merged = mergePersonaProfile(
      { teacher: { subject: 'Fizika' }, current: 'teacher' },
      PERSONAS.HR_COMPANY,
      { company_name: 'Acme', company_size: '11-50', exam_purpose: 'hiring' },
    );
    assert.equal(merged.teacher.subject, 'Fizika');
    assert.equal(merged.hr_company.company_name, 'Acme');
    assert.equal(merged.current, PERSONAS.HR_COMPANY);
  });

  it('never sends admin through persona onboarding', () => {
    assert.equal(isAdminRole('admin'), true);
    assert.equal(isAdminRole({ role: 'ADMIN' }), true);
    assert.equal(isAdminRole({ role: 'student' }), false);
    assert.equal(
      rowNeedsOnboarding({ role: 'admin', onboarding_completed: false, role_selected: false }),
      false,
    );
  });

  it('gates onboarding from row flags without using admin', () => {
    assert.equal(rowNeedsOnboarding({ role: 'student', onboarding_completed: false }), true);
    assert.equal(rowNeedsOnboarding({ role: 'instructor', role_selected: false }), true);
    assert.equal(
      rowNeedsOnboarding({
        role: 'instructor',
        role_selected: true,
        onboarding_completed: true,
        persona: 'teacher',
      }),
      false,
    );
    // Legacy skip / placeholder role must still force purpose picker.
    assert.equal(
      rowNeedsOnboarding({
        role: 'student',
        role_selected: true,
        onboarding_completed: true,
        persona: null,
      }),
      true,
    );
    assert.equal(
      rowNeedsOnboarding({
        role: 'student',
        role_selected: true,
        onboarding_completed: true,
        persona: 'student',
      }),
      false,
    );
  });
});
