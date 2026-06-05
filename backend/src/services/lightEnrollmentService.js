const db = require('../utils/db');

const normHex = (id) => (id == null ? '' : String(id).trim().toLowerCase().replace(/-/g, ''));

const LIGHT_SOURCES = new Set(['exam', 'task']);

function isLightEnrollmentSource(source) {
  return LIGHT_SOURCES.has(String(source || '').trim().toLowerCase());
}

/** İmtahan/tapşırıq: paket/cədvəl olmadan aktiv enrollment */
async function activateLightEnrollment(client, enrollmentId) {
  if (!enrollmentId) return null;
  const { rows } = await client.query(
    `UPDATE enrollments
     SET status = 'active',
         configured_at = COALESCE(configured_at, NOW()),
         notifications_enabled = FALSE
     WHERE id = $1::uuid
       AND COALESCE(LOWER(TRIM(enrollment_source)), '') IN ('exam', 'task')
     RETURNING id, status`,
    [enrollmentId],
  );
  return rows[0] || null;
}

/**
 * İmtahan/tapşırıq linki ilə gələn tələbə — yüngül enrollment (ödəniş bildirişi yox).
 * Mövcud qrup enrollment varsa, onu saxlayır (CRM + ödəniş qaydaları qüvvədə qalır).
 */
async function ensureLightInstructorEnrollment(client, instructorId, studentId, accessSource, opts = {}) {
  const activate = opts.activate === true;
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
  if (existing[0]?.id) {
    const ex = existing[0];
    const exSource = String(ex.enrollment_source || 'manual').trim().toLowerCase();
    if (!ex.group_id && !LIGHT_SOURCES.has(exSource)) {
      await client.query(
        `UPDATE enrollments SET enrollment_source = $2 WHERE id = $1::uuid`,
        [ex.id, source],
      );
    }
    if (activate) await activateLightEnrollment(client, ex.id);
    return ex.id;
  }

  const { rows: ins } = await client.query(
    `INSERT INTO enrollments (
       instructor_id, student_id, status, enrolled_at, enrollment_source, notifications_enabled
     ) VALUES ($1::uuid, $2::uuid, 'pending_setup', NOW(), $3, FALSE)
     RETURNING id`,
    [instructorId, studentId, source],
  );
  if (activate && ins[0]?.id) await activateLightEnrollment(client, ins[0].id);
  return ins[0]?.id || null;
}

function enrollmentEligibleForPaymentReminders(enrollmentSource) {
  const s = String(enrollmentSource || 'manual').trim().toLowerCase();
  return s === 'group' || s === 'manual';
}

module.exports = {
  ensureLightInstructorEnrollment,
  activateLightEnrollment,
  isLightEnrollmentSource,
  enrollmentEligibleForPaymentReminders,
  LIGHT_SOURCES,
};
