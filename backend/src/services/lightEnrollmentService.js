const db = require('../utils/db');

const normHex = (id) => (id == null ? '' : String(id).trim().toLowerCase().replace(/-/g, ''));

const LIGHT_SOURCES = new Set(['exam', 'task']);

/**
 * İmtahan/tapşırıq linki ilə gələn tələbə — yüngül enrollment (ödəniş bildirişi yox).
 * Mövcud qrup enrollment varsa, onu saxlayır (CRM + ödəniş qaydaları qüvvədə qalır).
 */
async function ensureLightInstructorEnrollment(client, instructorId, studentId, accessSource) {
  const source = LIGHT_SOURCES.has(accessSource) ? accessSource : 'exam';
  const ni = normHex(instructorId);
  const { rows: existing } = await client.query(
    `SELECT id, status, enrollment_source, group_id
     FROM enrollments
     WHERE student_id = $1::uuid
       AND (deleted_at IS NULL)
       AND REPLACE(LOWER(TRIM(instructor_id::text)), '-', '') = $2
       AND COALESCE(LOWER(TRIM(status)), '') NOT IN ('rejected', 'left', 'archived')
     ORDER BY
       CASE WHEN group_id IS NOT NULL THEN 0 ELSE 1 END,
       CASE WHEN COALESCE(enrollment_source, 'manual') = 'group' THEN 0 ELSE 1 END,
       created_at DESC NULLS LAST
     LIMIT 1`,
    [studentId, ni],
  );
  if (existing[0]?.id) return existing[0].id;

  const { rows: ins } = await client.query(
    `INSERT INTO enrollments (
       instructor_id, student_id, status, enrolled_at, enrollment_source, notifications_enabled
     ) VALUES ($1::uuid, $2::uuid, 'pending_setup', NOW(), $3, FALSE)
     RETURNING id`,
    [instructorId, studentId, source],
  );
  return ins[0]?.id || null;
}

function enrollmentEligibleForPaymentReminders(enrollmentSource) {
  const s = String(enrollmentSource || 'manual').trim().toLowerCase();
  return s === 'group' || s === 'manual';
}

module.exports = {
  ensureLightInstructorEnrollment,
  enrollmentEligibleForPaymentReminders,
  LIGHT_SOURCES,
};
