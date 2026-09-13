/**
 * One Mentorix user identity → multiple memberships (user_roles).
 * Persona / partner purpose must never create a second users row.
 */

function rolesToGrantAfterPersonaChange({ previousRole, authRole, personaId }) {
  const granted = new Set();
  const prev = String(previousRole || '').trim().toLowerCase();
  const next = String(authRole || '').trim().toLowerCase();
  const persona = String(personaId || '').trim();

  if (next && next !== 'admin') granted.add(next);

  // Student → Teacher: keep Student membership.
  if (prev === 'student' && next === 'instructor') {
    granted.add('student');
  }

  // Partner purpose must not wipe prior auth membership.
  if (persona === 'partner') {
    if (prev && prev !== 'admin') granted.add(prev);
    else granted.add('student');
  }

  // Retain previous non-admin auth role when switching personas.
  if (prev && prev !== 'admin' && prev !== next) {
    granted.add(prev);
  }

  return [...granted];
}

module.exports = { rolesToGrantAfterPersonaChange };
