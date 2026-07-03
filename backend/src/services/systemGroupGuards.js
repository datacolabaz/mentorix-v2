/**
 * Sistem iştirakçı qrupları: analitika bütövlüyü və ödəniş/bildiriş istisnaları.
 * Paket limiti (Variant A): instructor_students üzrə sayılır — ayrıca burada deyil.
 */

const SYSTEM_GROUP_IMMUTABLE_MSG =
  'Sistem iştirakçı qrupu dəyişdirilə bilməz — imtahan/tapşırıq analitikası avtomatik idarə olunur.';

const SYSTEM_SUBJECT_IMMUTABLE_MSG =
  'Sistem iştirakçı sahəsi dəyişdirilə bilməz.';

/** SQL: yalnız real tədris qrupları (sistem iştirakçı qrupları istisna) */
const SQL_WHERE_TEACHING_GROUP_ONLY = `COALESCE(ig.is_system, FALSE) = FALSE`;

/** SQL: CRM ödəniş/bildirişlərə aid OLMAYAN enrollment-lar */
const SQL_EXCLUDE_SYSTEM_GROUP_ENROLLMENTS = `
  AND COALESCE(e.enrollment_source, 'manual') IN ('group', 'manual')
  AND NOT EXISTS (
    SELECT 1 FROM instructor_groups ig
    WHERE ig.id = e.group_id AND COALESCE(ig.is_system, FALSE) = TRUE
  )`;

async function fetchGroupGuard(client, groupId, instructorId) {
  const dbConn = client?.query ? client : require('../utils/db');
  const { rows } = await dbConn.query(
    `SELECT id, name, is_system, system_kind, instructor_id
     FROM instructor_groups
     WHERE id = $1::uuid AND instructor_id = $2::uuid
     LIMIT 1`,
    [groupId, instructorId],
  );
  return rows[0] || null;
}

async function fetchSubjectGuard(client, subjectId, instructorId) {
  const dbConn = client?.query ? client : require('../utils/db');
  const { rows } = await dbConn.query(
    `SELECT id, name, COALESCE(is_system, FALSE) AS is_system
     FROM instructor_subjects
     WHERE id = $1::uuid AND instructor_id = $2::uuid
     LIMIT 1`,
    [subjectId, instructorId],
  );
  return rows[0] || null;
}

function assertNotSystemGroup(group, action = 'modify') {
  if (!group?.is_system) return;
  const err = new Error(SYSTEM_GROUP_IMMUTABLE_MSG);
  err.statusCode = 400;
  err.code = 'SYSTEM_GROUP_IMMUTABLE';
  err.action = action;
  throw err;
}

function assertNotSystemSubject(subject, action = 'modify') {
  if (!subject?.is_system) return;
  const err = new Error(SYSTEM_SUBJECT_IMMUTABLE_MSG);
  err.statusCode = 400;
  err.code = 'SYSTEM_SUBJECT_IMMUTABLE';
  err.action = action;
  throw err;
}

async function assertGroupMutable(groupId, instructorId, action = 'modify', client = null) {
  const g = await fetchGroupGuard(client, groupId, instructorId);
  if (!g) {
    const err = new Error('Qrup tapılmadı');
    err.statusCode = 404;
    throw err;
  }
  assertNotSystemGroup(g, action);
  return g;
}

async function assertSubjectMutable(subjectId, instructorId, action = 'modify', client = null) {
  const s = await fetchSubjectGuard(client, subjectId, instructorId);
  if (!s) {
    const err = new Error('Sahə tapılmadı');
    err.statusCode = 404;
    throw err;
  }
  assertNotSystemSubject(s, action);
  return s;
}

function isReservedSystemSubjectName(name) {
  const n = String(name || '').trim();
  return n === '[System] Participants' || n === 'Link iştirakçıları' || /^\[System\]/i.test(n);
}

async function enrollmentHasSystemGroup(enrollmentId, client = null) {
  const dbConn = client?.query ? client : require('../utils/db');
  const { rows } = await dbConn.query(
    `SELECT COALESCE(ig.is_system, FALSE) AS is_system,
            COALESCE(LOWER(TRIM(e.enrollment_source)), 'manual') AS enrollment_source
     FROM enrollments e
     LEFT JOIN instructor_groups ig ON ig.id = e.group_id
     WHERE e.id = $1::uuid
     LIMIT 1`,
    [enrollmentId],
  );
  const r = rows[0];
  if (!r) return false;
  if (r.is_system) return true;
  const src = String(r.enrollment_source || '').toLowerCase();
  return src === 'exam' || src === 'task';
}

function enrollmentRowEligibleForBilling(row) {
  if (!row) return false;
  if (row.is_system_group === true || row.group_is_system === true) return false;
  const src = String(row.enrollment_source || 'manual').trim().toLowerCase();
  if (src === 'exam' || src === 'task') return false;
  return true;
}

module.exports = {
  SYSTEM_GROUP_IMMUTABLE_MSG,
  SYSTEM_SUBJECT_IMMUTABLE_MSG,
  SQL_EXCLUDE_SYSTEM_GROUP_ENROLLMENTS,
  SQL_WHERE_TEACHING_GROUP_ONLY,
  fetchGroupGuard,
  fetchSubjectGuard,
  assertNotSystemGroup,
  assertNotSystemSubject,
  assertGroupMutable,
  assertSubjectMutable,
  isReservedSystemSubjectName,
  enrollmentHasSystemGroup,
  enrollmentRowEligibleForBilling,
};
