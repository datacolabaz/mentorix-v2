/** Mentorix use-case personas — not authorization roles. */

export const PERSONAS = Object.freeze({
  TEACHER: 'teacher',
  EDUCATION_CENTER: 'education_center',
  STUDENT: 'student',
  PARENT: 'parent',
  HR_COMPANY: 'hr_company',
  PARTNER: 'partner',
  OTHER: 'other',
})

export const PERSONA_ORDER = Object.freeze([
  PERSONAS.TEACHER,
  PERSONAS.EDUCATION_CENTER,
  PERSONAS.STUDENT,
  PERSONAS.PARENT,
  PERSONAS.HR_COMPANY,
  PERSONAS.PARTNER,
  PERSONAS.OTHER,
])

/** Maps a use-case persona to the existing authorization role.
 * Partner is referral-only: no dedicated auth role (see applyPersonaSelection). */
export const PERSONA_TO_AUTH_ROLE = Object.freeze({
  [PERSONAS.TEACHER]: 'instructor',
  [PERSONAS.EDUCATION_CENTER]: 'course',
  [PERSONAS.STUDENT]: 'student',
  [PERSONAS.PARENT]: 'parent',
  [PERSONAS.HR_COMPANY]: 'instructor',
  [PERSONAS.PARTNER]: null,
  [PERSONAS.OTHER]: 'instructor',
})

export const AUTH_ROLE_TO_DEFAULT_PERSONA = Object.freeze({
  instructor: PERSONAS.TEACHER,
  course: PERSONAS.EDUCATION_CENTER,
  student: PERSONAS.STUDENT,
  parent: PERSONAS.PARENT,
})

export const PERSONA_ID_SET = new Set(PERSONA_ORDER)

export function isPersonaId(value) {
  return PERSONA_ID_SET.has(String(value || '').trim())
}

/** Retired persona ids that may still arrive from an older API; see backend/src/config/personas.js. */
export const LEGACY_PERSONA_ALIASES = Object.freeze({
  mentor: PERSONAS.TEACHER,
})

export function normalizePersonaId(value) {
  const key = String(value || '').trim()
  if (!key) return null
  if (PERSONA_ID_SET.has(key)) return key
  return LEGACY_PERSONA_ALIASES[key.toLowerCase()] || null
}

export function authRoleForPersona(persona) {
  return PERSONA_TO_AUTH_ROLE[String(persona || '').trim()] || null
}

export function defaultPersonaForAuthRole(role) {
  return AUTH_ROLE_TO_DEFAULT_PERSONA[String(role || '').trim().toLowerCase()] || null
}

export const ONBOARDING_PATH = '/onboarding'
export const DEFAULT_APP_PATH = '/app'
