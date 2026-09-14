/**
 * One Mentorix user identity → multiple memberships (user_roles).
 * Persona / partner purpose must never create a second users row.
 *
 * Signup/Google create store placeholder users.role='student' before any purpose
 * is chosen — that must NOT become a real student membership.
 */

function rolesToGrantAfterPersonaChange({ previousRole, authRole, personaId, previousPersona }) {
  const granted = new Set();
  const prev = String(previousRole || '').trim().toLowerCase();
  const next = String(authRole || '').trim().toLowerCase();
  const persona = String(personaId || '').trim();
  const priorPersona = String(previousPersona || '').trim();
  const hadPriorPurpose = Boolean(priorPersona);

  if (next && next !== 'admin') {
    // Partner-only signup keeps placeholder auth role in users.role but must not
    // grant student membership until the user explicitly picks İştirakçı.
    if (!(persona === 'partner' && next === 'student' && !hadPriorPurpose)) {
      granted.add(next);
    }
  }

  // Student → Teacher: keep Student membership only if they were a real participant.
  if (prev === 'student' && next === 'instructor' && priorPersona === 'student') {
    granted.add('student');
  }

  // Partner purpose must not wipe prior *chosen* auth membership.
  if (persona === 'partner') {
    if (hadPriorPurpose && prev && prev !== 'admin') granted.add(prev);
  }

  // Retain previous non-admin auth role when switching personas (real purpose only).
  if (hadPriorPurpose && prev && prev !== 'admin' && prev !== next) {
    granted.add(prev);
  }

  return [...granted];
}

module.exports = { rolesToGrantAfterPersonaChange };
