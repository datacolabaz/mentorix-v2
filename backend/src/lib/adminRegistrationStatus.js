const { rowNeedsOnboarding } = require('../config/personas');

/**
 * Admin list helper: incomplete registration = onboarding not finished
 * or persona never chosen (legacy skip left role=student + persona null).
 */
function isRegistrationIncomplete(row) {
  if (!row) return true;
  if (row.onboarding_completed !== true) return true;
  if (row.role_selected === false) return true;
  if (!row.persona) return true;
  return false;
}

module.exports = { isRegistrationIncomplete, rowNeedsOnboarding };
