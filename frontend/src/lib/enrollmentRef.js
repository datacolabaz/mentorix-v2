const UUID_RE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const SYNTHETIC_RE = new RegExp(`^(${UUID_RE})-pg-(${UUID_RE})$`, 'i')
const UUID_ONLY_RE = new RegExp(`^${UUID_RE}$`, 'i')

/** Participant-group list rows use `{enrollmentId}-pg-{groupId}`. */
export function parseEnrollmentRef(raw) {
  const s = String(raw || '').trim()
  if (!s) return null
  const syn = s.match(SYNTHETIC_RE)
  if (syn) {
    return {
      enrollmentId: syn[1],
      participantGroupId: syn[2],
      synthetic: true,
    }
  }
  if (UUID_ONLY_RE.test(s)) {
    return { enrollmentId: s, participantGroupId: null, synthetic: false }
  }
  return null
}

export function resolveEnrollmentId(raw) {
  return parseEnrollmentRef(raw)?.enrollmentId || String(raw || '').trim() || null
}
