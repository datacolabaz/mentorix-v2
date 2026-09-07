const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  PERSONAS,
  PERSONA_ORDER,
  isPersonaId,
  authRoleForPersona,
  personaFromLegacyRole,
  sanitizePersonaProfile,
  requiredProfileComplete,
  mergePersonaProfile,
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
    assert.equal(isPersonaId('course'), false);
    assert.equal(PERSONA_ORDER.includes('course'), false);
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
    assert.equal(requiredProfileComplete(PERSONAS.TEACHER, { subject: 'X' }), false);
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

  it('gates onboarding from row flags without using admin', () => {
    assert.equal(rowNeedsOnboarding({ role: 'admin', onboarding_completed: false }), false);
    assert.equal(rowNeedsOnboarding({ role: 'student', onboarding_completed: false }), true);
    assert.equal(rowNeedsOnboarding({ role: 'instructor', role_selected: false }), true);
    assert.equal(
      rowNeedsOnboarding({ role: 'instructor', role_selected: true, onboarding_completed: true }),
      false,
    );
  });
});
