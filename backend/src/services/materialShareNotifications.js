/**
 * «Yeni material» bildirişi — yalnız müəllim materialı açıq şəkildə hədəflədikdə (qrup, tapşırıq, tələbə).
 * Qrupsuz (bütün tələbələrə görünən) yükləmə və material açılışı/baxışı bildiriş yaratmır.
 * Tələbə başına bir material üçün bir bildiriş (dedupe `material_shared:{materialId}`): eyni material
 * yenidən başqa qrupa bağlansa, artıq xəbərdar olan tələbəyə təkrar getmir.
 */
const db = require('../utils/db');

const MAX_RECIPIENTS = 500;

async function resolveRecipients(instructorId, { groupIds = [], assignmentId = null, studentIds = [] }) {
  const ids = new Set((studentIds || []).filter(Boolean).map(String));
  if (groupIds.length) {
    const { rows } = await db.query(
      `/* material_share_groups */
       SELECT igm.student_id FROM instructor_group_members igm
       JOIN instructor_groups ig ON ig.id = igm.group_id AND ig.instructor_id = $1
       WHERE igm.group_id = ANY($2::uuid[])
       UNION
       SELECT e.student_id FROM enrollments e
       WHERE e.instructor_id = $1 AND e.group_id = ANY($2::uuid[])
         AND e.status IN ('active', 'pending_setup') AND e.deleted_at IS NULL`,
      [instructorId, groupIds],
    );
    for (const r of rows) if (r.student_id) ids.add(String(r.student_id));
  }
  if (assignmentId) {
    const { rows } = await db.query(
      `/* material_share_assignment */
       SELECT sa.student_id FROM student_assignments sa
       JOIN assignments a ON a.id = sa.assignment_id AND a.instructor_id = $1
       WHERE sa.assignment_id = $2`,
      [instructorId, assignmentId],
    );
    for (const r of rows) if (r.student_id) ids.add(String(r.student_id));
  }
  return [...ids].slice(0, MAX_RECIPIENTS);
}

async function notifyMaterialSharedNow(instructorId, material, targets) {
  if (!material?.id || !instructorId) return { recipients: 0, created: 0 };
  const recipients = await resolveRecipients(instructorId, targets);
  if (!recipients.length) return { recipients: 0, created: 0 };
  const { rows } = await db.query(`SELECT full_name FROM users WHERE id = $1 LIMIT 1`, [instructorId]);
  const instructorName = String(rows[0]?.full_name || '').trim() || 'Müəllim';
  const { createNotificationSafe } = require('./notificationService');
  let created = 0;
  for (const studentId of recipients) {
    const out = await createNotificationSafe({
      recipientId: studentId,
      category: 'material',
      eventType: 'material_shared',
      params: { instructorName, materialTitle: String(material.title || '').trim() },
      meta: { material_id: material.id, href: '/student/materials' },
      relatedEntityType: 'material',
      relatedEntityId: material.id,
      actorUserId: instructorId,
      providerWorkspaceId: instructorId,
      groupId: targets.groupIds?.length === 1 ? targets.groupIds[0] : null,
      dedupeKey: `material_shared:${material.id}`,
      email: true,
    });
    if (out.created) created += 1;
  }
  return { recipients: recipients.length, created };
}

/** Upload/bağlama cavabını gözlətmir. */
function notifyMaterialShared(instructorId, material, targets = {}) {
  const { deferNotification } = require('./notificationService');
  return deferNotification('material_shared', () => notifyMaterialSharedNow(instructorId, material, targets));
}

module.exports = { notifyMaterialShared, notifyMaterialSharedNow, resolveRecipients };
