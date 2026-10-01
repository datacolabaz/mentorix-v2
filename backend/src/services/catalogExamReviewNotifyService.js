const { createNotificationSafe } = require('./notificationService');

async function notifyInstructorCatalogApproved({ instructorId, examId, examTitle }) {
  return createNotificationSafe({
    recipientId: instructorId,
    category: 'assessment',
    eventType: 'catalog_exam_approved',
    params: { examTitle: String(examTitle || '').trim() },
    meta: { exam_id: examId },
    relatedEntityType: 'exam',
    relatedEntityId: examId,
    dedupeKey: `catalog_exam_approved:${examId}`,
    email: true,
  });
}

/** Hər rədd ayrıca hadisədir (yenidən göndərilib yenə rədd edilə bilər); dəqiqə dəqiqliyi təkrar kliki birləşdirir. */
async function notifyInstructorCatalogRejected({ instructorId, examId, examTitle, reason }) {
  const minute = new Date().toISOString().slice(0, 16);
  return createNotificationSafe({
    recipientId: instructorId,
    category: 'assessment',
    eventType: 'catalog_exam_rejected',
    priority: 'HIGH',
    params: { examTitle: String(examTitle || '').trim(), reason: String(reason || '').trim() },
    meta: { exam_id: examId, reason },
    relatedEntityType: 'exam',
    relatedEntityId: examId,
    dedupeKey: `catalog_exam_rejected:${examId}:${minute}`,
    email: true,
  });
}

module.exports = { notifyInstructorCatalogApproved, notifyInstructorCatalogRejected };
