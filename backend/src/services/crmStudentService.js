const db = require('../utils/db');

/** Müəllimin rəsmi (sistem olmayan) tədris qrupunda aktiv tələbə? */
async function isCrmStudentForInstructor(instructorId, studentId, client = null) {
  if (!instructorId || !studentId) return false;
  const conn = client?.query ? client : db;
  const { rows } = await conn.query(
    `SELECT 1
     FROM enrollments e
     JOIN instructor_groups ig ON ig.id = e.group_id
     WHERE e.student_id = $2::uuid
       AND e.instructor_id = $1::uuid
       AND e.deleted_at IS NULL
       AND e.group_id IS NOT NULL
       AND COALESCE(ig.is_system, FALSE) = FALSE
       AND COALESCE(LOWER(TRIM(e.status)), '') NOT IN ('rejected', 'left', 'archived', 'deleted')
     LIMIT 1`,
    [instructorId, studentId],
  );
  return Boolean(rows[0]);
}

async function batchCrmStudentIds(instructorId, studentIds, client = null) {
  const ids = [...new Set((studentIds || []).map(String).filter(Boolean))];
  if (!instructorId || !ids.length) return new Set();
  const conn = client?.query ? client : db;
  const { rows } = await conn.query(
    `SELECT DISTINCT e.student_id
     FROM enrollments e
     JOIN instructor_groups ig ON ig.id = e.group_id
     WHERE e.instructor_id = $1::uuid
       AND e.student_id = ANY($2::uuid[])
       AND e.deleted_at IS NULL
       AND e.group_id IS NOT NULL
       AND COALESCE(ig.is_system, FALSE) = FALSE
       AND COALESCE(LOWER(TRIM(e.status)), '') NOT IN ('rejected', 'left', 'archived', 'deleted')`,
    [instructorId, ids],
  );
  return new Set(rows.map((r) => String(r.student_id)));
}

function parseExamAudienceFilter(raw) {
  const v = String(raw || 'all').trim().toLowerCase();
  if (v === 'crm' || v === 'guest') return v;
  return 'all';
}

function sqlExamAudienceWhere(alias = 'er', paramIndex = 2) {
  return `(
    $${paramIndex}::text IS NULL
    OR $${paramIndex}::text = 'all'
    OR ($${paramIndex}::text = 'crm' AND COALESCE(${alias}.is_crm_student, FALSE) = TRUE)
    OR ($${paramIndex}::text = 'guest' AND COALESCE(${alias}.is_crm_student, FALSE) = FALSE)
  )`;
}

module.exports = {
  isCrmStudentForInstructor,
  batchCrmStudentIds,
  parseExamAudienceFilter,
  sqlExamAudienceWhere,
};
