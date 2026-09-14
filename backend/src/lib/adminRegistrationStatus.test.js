const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isRegistrationIncomplete } = require('./adminRegistrationStatus');

describe('isRegistrationIncomplete', () => {
  it('complete student persona is complete', () => {
    assert.equal(
      isRegistrationIncomplete({
        onboarding_completed: true,
        role_selected: true,
        persona: 'student',
      }),
      false,
    );
  });

  it('skipped onboarding (legacy) is incomplete', () => {
    assert.equal(
      isRegistrationIncomplete({
        onboarding_completed: true,
        role_selected: true,
        persona: null,
      }),
      true,
    );
  });

  it('placeholder student before persona pick is incomplete', () => {
    assert.equal(
      isRegistrationIncomplete({
        onboarding_completed: false,
        role_selected: false,
        persona: null,
      }),
      true,
    );
  });
});
