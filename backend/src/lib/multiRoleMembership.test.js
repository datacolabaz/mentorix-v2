const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { rolesToGrantAfterPersonaChange } = require('./multiRoleMembership');

describe('multi-role membership after persona change', () => {
  it('keeps student when upgrading to teacher from real participant purpose', () => {
    assert.deepEqual(
      rolesToGrantAfterPersonaChange({
        previousRole: 'student',
        authRole: 'instructor',
        personaId: 'teacher',
        previousPersona: 'student',
      }).sort(),
      ['instructor', 'student'],
    );
  });

  it('does not keep placeholder student when first choosing teacher', () => {
    assert.deepEqual(
      rolesToGrantAfterPersonaChange({
        previousRole: 'student',
        authRole: 'instructor',
        personaId: 'teacher',
        previousPersona: null,
      }),
      ['instructor'],
    );
  });

  it('adds partner purpose without wiping prior student/teacher membership', () => {
    assert.deepEqual(
      rolesToGrantAfterPersonaChange({
        previousRole: 'student',
        authRole: 'student',
        personaId: 'partner',
        previousPersona: 'student',
      }),
      ['student'],
    );
    assert.deepEqual(
      rolesToGrantAfterPersonaChange({
        previousRole: 'instructor',
        authRole: 'instructor',
        personaId: 'partner',
        previousPersona: 'teacher',
      }),
      ['instructor'],
    );
  });

  it('partner-first signup does not invent student membership from placeholder role', () => {
    assert.deepEqual(
      rolesToGrantAfterPersonaChange({
        previousRole: 'student',
        authRole: 'student',
        personaId: 'partner',
        previousPersona: null,
      }),
      [],
    );
  });

  it('does not invent admin membership', () => {
    assert.deepEqual(
      rolesToGrantAfterPersonaChange({
        previousRole: 'admin',
        authRole: 'instructor',
        personaId: 'teacher',
      }),
      ['instructor'],
    );
  });
});
