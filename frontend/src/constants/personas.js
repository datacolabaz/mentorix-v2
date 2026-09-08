import {
  PERSONAS,
  PERSONA_ORDER,
  PERSONA_TO_AUTH_ROLE,
  AUTH_ROLE_TO_DEFAULT_PERSONA,
  isPersonaId,
  authRoleForPersona,
  defaultPersonaForAuthRole,
  ONBOARDING_PATH,
  DEFAULT_APP_PATH,
} from '@shared/personas.mjs'

export {
  PERSONAS,
  PERSONA_ORDER,
  PERSONA_TO_AUTH_ROLE,
  AUTH_ROLE_TO_DEFAULT_PERSONA,
  isPersonaId,
  authRoleForPersona,
  defaultPersonaForAuthRole,
  ONBOARDING_PATH,
  DEFAULT_APP_PATH,
}

/** Public picker: teacher / trainer and participant. Other personas stay valid for existing accounts. */
export const PRIMARY_PERSONA_ORDER = Object.freeze([PERSONAS.TEACHER, PERSONAS.STUDENT])

export function pickerPersonaIds(current) {
  const ids = [...PRIMARY_PERSONA_ORDER]
  if (current && isPersonaId(current) && !ids.includes(current)) ids.push(current)
  return ids
}

export const PERSONA_UI = Object.freeze({
  [PERSONAS.TEACHER]: {
    icon: 'instructors',
    titleKey: 'onboarding.personas.teacher.title',
    descKey: 'onboarding.personas.teacher.desc',
  },
  [PERSONAS.EDUCATION_CENTER]: {
    icon: 'building',
    titleKey: 'onboarding.personas.education_center.title',
    descKey: 'onboarding.personas.education_center.desc',
  },
  [PERSONAS.STUDENT]: {
    icon: 'students',
    titleKey: 'onboarding.personas.student.title',
    descKey: 'onboarding.personas.student.desc',
  },
  [PERSONAS.PARENT]: {
    icon: 'children',
    titleKey: 'onboarding.personas.parent.title',
    descKey: 'onboarding.personas.parent.desc',
  },
  [PERSONAS.HR_COMPANY]: {
    icon: 'briefcase',
    titleKey: 'onboarding.personas.hr_company.title',
    descKey: 'onboarding.personas.hr_company.desc',
  },
  [PERSONAS.OTHER]: {
    icon: 'dots',
    titleKey: 'onboarding.personas.other.title',
    descKey: 'onboarding.personas.other.desc',
  },
})

export const PERSONA_HOME_LINKS = Object.freeze({
  [PERSONAS.TEACHER]: [
    { to: '/instructor/exams', labelKey: 'personaHome.teacher.createExam', icon: 'exams' },
    { to: '/instructor/tasks', labelKey: 'personaHome.teacher.tests', icon: 'tasks' },
    { to: '/instructor/students', labelKey: 'personaHome.teacher.students', icon: 'students' },
    { to: '/instructor/teaching-groups', labelKey: 'personaHome.teacher.groups', icon: 'groups' },
    { to: '/instructor/analytics', labelKey: 'personaHome.teacher.results', icon: 'analytics' },
  ],
  [PERSONAS.EDUCATION_CENTER]: [
    { to: '/org/trainers', labelKey: 'personaHome.education_center.teachers', icon: 'instructors' },
    { to: '/org/groups', labelKey: 'personaHome.education_center.groups', icon: 'groups' },
    { to: '/org/participants', labelKey: 'personaHome.education_center.students', icon: 'students' },
    { to: '/org/exams', labelKey: 'personaHome.education_center.exams', icon: 'exams' },
    { to: '/org/reports', labelKey: 'personaHome.education_center.reports', icon: 'analytics' },
  ],
  [PERSONAS.STUDENT]: [
    { to: '/student/exams', labelKey: 'personaHome.student.exams', icon: 'exams' },
    { to: '/student/assignments', labelKey: 'personaHome.student.tests', icon: 'tasks' },
    { to: '/student', labelKey: 'personaHome.student.results', icon: 'analytics' },
  ],
  [PERSONAS.PARENT]: [
    { to: '/parent', labelKey: 'personaHome.parent.children', icon: 'children' },
    { to: '/parent', labelKey: 'personaHome.parent.results', icon: 'analytics' },
    { to: '/parent/assignments', labelKey: 'personaHome.parent.exams', icon: 'exams' },
  ],
  [PERSONAS.HR_COMPANY]: [
    { to: '/instructor/students', labelKey: 'personaHome.hr_company.candidates', icon: 'students' },
    { to: '/instructor/exams', labelKey: 'personaHome.hr_company.exams', icon: 'exams' },
    { to: '/instructor/tasks', labelKey: 'personaHome.hr_company.tests', icon: 'tasks' },
    { to: '/instructor/analytics', labelKey: 'personaHome.hr_company.evaluations', icon: 'attendance' },
    { to: '/instructor/analytics', labelKey: 'personaHome.hr_company.results', icon: 'progress' },
    { to: '/instructor/analytics', labelKey: 'personaHome.hr_company.reports', icon: 'analytics' },
  ],
  [PERSONAS.OTHER]: [
    { to: '/instructor/exams', labelKey: 'personaHome.other.exams', icon: 'exams' },
    { to: '/instructor/tasks', labelKey: 'personaHome.other.tests', icon: 'tasks' },
    { to: '/instructor/analytics', labelKey: 'personaHome.other.results', icon: 'analytics' },
  ],
})

export function resolveUserPersona(user) {
  const direct = String(user?.persona || '').trim()
  if (isPersonaId(direct)) return direct
  if (user?.onboarding_completed && !direct) return null
  return defaultPersonaForAuthRole(user?.role) || null
}

export function userNeedsOnboarding(user) {
  if (!user) return false
  if (String(user.role || '').toLowerCase() === 'admin') return false
  if (user.onboarding_completed === true) return false
  if (user.onboarding_completed === false) return true
  if (!user.role) return true
  return false
}
