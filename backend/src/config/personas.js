/**
 * Use-case personas (how someone uses Mentorix) vs authorization roles.
 * Keep persona checks here — do not scatter string literals across controllers.
 */

const PERSONAS = Object.freeze({
  TEACHER: 'teacher',
  EDUCATION_CENTER: 'education_center',
  STUDENT: 'student',
  PARENT: 'parent',
  HR_COMPANY: 'hr_company',
  OTHER: 'other',
});

const PERSONA_ORDER = Object.freeze([
  PERSONAS.TEACHER,
  PERSONAS.EDUCATION_CENTER,
  PERSONAS.STUDENT,
  PERSONAS.PARENT,
  PERSONAS.HR_COMPANY,
  PERSONAS.OTHER,
]);

const PERSONA_TO_AUTH_ROLE = Object.freeze({
  [PERSONAS.TEACHER]: 'instructor',
  [PERSONAS.EDUCATION_CENTER]: 'course',
  [PERSONAS.STUDENT]: 'student',
  [PERSONAS.PARENT]: 'parent',
  [PERSONAS.HR_COMPANY]: 'instructor',
  [PERSONAS.OTHER]: 'instructor',
});

const AUTH_ROLE_TO_DEFAULT_PERSONA = Object.freeze({
  instructor: PERSONAS.TEACHER,
  course: PERSONAS.EDUCATION_CENTER,
  student: PERSONAS.STUDENT,
  parent: PERSONAS.PARENT,
});

const LEGACY_ROLE_TO_PERSONA = Object.freeze({
  instructor: PERSONAS.TEACHER,
  course: PERSONAS.EDUCATION_CENTER,
  student: PERSONAS.STUDENT,
  parent: PERSONAS.PARENT,
});

const PERSONA_ID_SET = new Set(PERSONA_ORDER);

const TEACHING_FORMATS = Object.freeze(['individual', 'group', 'online', 'hybrid']);
const COUNT_BUCKETS_SMALL = Object.freeze(['1-5', '6-15', '16-40', '40+']);
const COUNT_BUCKETS_TEACHERS = Object.freeze(['1-3', '4-10', '11-30', '30+']);
const COUNT_BUCKETS_CENTER_STUDENTS = Object.freeze(['1-20', '21-80', '81-200', '200+']);
const EDUCATION_LEVELS = Object.freeze(['school', 'college', 'university', 'other']);
const CHILD_COUNTS = Object.freeze(['1', '2', '3+']);
const PARENT_FOCUS = Object.freeze(['exams', 'progress', 'both']);
const COMPANY_SIZES = Object.freeze(['1-10', '11-50', '51-200', '201-1000', '1000+']);
const HR_EXAM_PURPOSES = Object.freeze([
  'hiring',
  'candidate_assessment',
  'employee_assessment',
  'training_certification',
  'other',
]);

function isPersonaId(value) {
  return PERSONA_ID_SET.has(String(value || '').trim());
}

function authRoleForPersona(persona) {
  return PERSONA_TO_AUTH_ROLE[String(persona || '').trim()] || null;
}

function defaultPersonaForAuthRole(role) {
  const key = String(role || '').trim().toLowerCase();
  return AUTH_ROLE_TO_DEFAULT_PERSONA[key] || null;
}

function personaFromLegacyRole(role) {
  const key = String(role || '').trim().toLowerCase();
  return LEGACY_ROLE_TO_PERSONA[key] || null;
}

function cleanStr(value, max = 240) {
  return String(value || '').trim().slice(0, max);
}

function pickEnum(value, allowed) {
  const s = String(value || '').trim();
  return allowed.includes(s) ? s : '';
}

function compactObject(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v == null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    out[k] = v;
  }
  return out;
}

function sanitizePersonaProfile(persona, raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  switch (String(persona || '').trim()) {
    case PERSONAS.TEACHER:
      return compactObject({
        subject: cleanStr(src.subject, 120),
        teaching_format: pickEnum(src.teaching_format, TEACHING_FORMATS),
        student_count: pickEnum(src.student_count, COUNT_BUCKETS_SMALL),
      });
    case PERSONAS.EDUCATION_CENTER:
      return compactObject({
        center_name: cleanStr(src.center_name, 160),
        teacher_count: pickEnum(src.teacher_count, COUNT_BUCKETS_TEACHERS),
        student_count: pickEnum(src.student_count, COUNT_BUCKETS_CENTER_STUDENTS),
        exam_purpose: cleanStr(src.exam_purpose, 240),
      });
    case PERSONAS.STUDENT:
      return compactObject({
        education_level: pickEnum(src.education_level, EDUCATION_LEVELS),
        subject_interest: cleanStr(src.subject_interest, 120),
      });
    case PERSONAS.PARENT:
      return compactObject({
        child_count: pickEnum(src.child_count, CHILD_COUNTS),
        follow_focus: pickEnum(src.follow_focus, PARENT_FOCUS),
      });
    case PERSONAS.HR_COMPANY:
      return compactObject({
        company_name: cleanStr(src.company_name, 160),
        company_size: pickEnum(src.company_size, COMPANY_SIZES),
        exam_purpose: pickEnum(src.exam_purpose, HR_EXAM_PURPOSES),
      });
    case PERSONAS.OTHER:
      return compactObject({
        purpose_text: cleanStr(src.purpose_text, 400),
      });
    default:
      return {};
  }
}

function requiredProfileComplete(persona, profile) {
  const p = profile && typeof profile === 'object' ? profile : {};
  switch (String(persona || '').trim()) {
    case PERSONAS.TEACHER:
      return Boolean(p.subject && p.teaching_format && p.student_count);
    case PERSONAS.EDUCATION_CENTER:
      return Boolean(p.center_name && p.teacher_count && p.student_count && p.exam_purpose);
    case PERSONAS.STUDENT:
      return Boolean(p.education_level && p.subject_interest);
    case PERSONAS.PARENT:
      return Boolean(p.child_count);
    case PERSONAS.HR_COMPANY:
      return Boolean(p.company_name && p.company_size && p.exam_purpose);
    case PERSONAS.OTHER:
      return Boolean(p.purpose_text);
    default:
      return false;
  }
}

function parseStoredProfile(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

function mergePersonaProfile(existing, persona, nextSlice) {
  const base = parseStoredProfile(existing);
  const prevSlice =
    base[persona] && typeof base[persona] === 'object' && !Array.isArray(base[persona])
      ? base[persona]
      : {};
  return {
    ...base,
    [persona]: { ...prevSlice, ...compactObject(nextSlice) },
    current: persona,
  };
}

function isAdminRole(roleOrUser) {
  const role =
    roleOrUser && typeof roleOrUser === 'object' ? roleOrUser.role : roleOrUser;
  return String(role || '').toLowerCase() === 'admin';
}

function rowNeedsOnboarding(row) {
  if (!row) return true;
  if (isAdminRole(row)) return false;
  if (row.onboarding_completed === false) return true;
  if (row.role_selected === false) return true;
  return false;
}

module.exports = {
  PERSONAS,
  PERSONA_ORDER,
  PERSONA_TO_AUTH_ROLE,
  AUTH_ROLE_TO_DEFAULT_PERSONA,
  LEGACY_ROLE_TO_PERSONA,
  PERSONA_ID_SET,
  TEACHING_FORMATS,
  COUNT_BUCKETS_SMALL,
  COUNT_BUCKETS_TEACHERS,
  COUNT_BUCKETS_CENTER_STUDENTS,
  EDUCATION_LEVELS,
  CHILD_COUNTS,
  PARENT_FOCUS,
  COMPANY_SIZES,
  HR_EXAM_PURPOSES,
  isPersonaId,
  authRoleForPersona,
  defaultPersonaForAuthRole,
  personaFromLegacyRole,
  sanitizePersonaProfile,
  requiredProfileComplete,
  parseStoredProfile,
  mergePersonaProfile,
  isAdminRole,
  rowNeedsOnboarding,
};
