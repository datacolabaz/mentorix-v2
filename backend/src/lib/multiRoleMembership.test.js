const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { rolesToGrantAfterPersonaChange } = require('./multiRoleMembership');

describe('multi-role membership after persona change', () => {
  it('keeps student when upgrading to teacher', () => {
    assert.deepEqual(
      rolesToGrantAfterPersonaChange({
        previousRole: 'student',
        authRole: 'instructor',
        personaId: 'teacher',
      }).sort(),
      ['instructor', 'student'],
    );
  });

  it('adds partner purpose without wiping prior student/teacher membership', () => {
    assert.deepEqual(
      rolesToGrantAfterPersonaChange({
        previousRole: 'student',
        authRole: 'student',
        personaId: 'partner',
      }),
      ['student'],
    );
    assert.deepEqual(
      rolesToGrantAfterPersonaChange({
        previousRole: 'instructor',
        authRole: 'instructor',
        personaId: 'partner',
      }),
      ['instructor'],
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
