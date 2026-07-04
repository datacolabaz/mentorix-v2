const db = require('../utils/db');
const { sendEmail, userEmail } = require('./emailService');
const { enqueueNotification } = require('./notificationQueueService');

async function notifyInstructorCatalogApproved({ instructorId, examId, examTitle }) {
  const title = 'Kataloq təsdiqi';
  const body = `«${examTitle}» imtahanınız təsdiqləndi və sertifikatlı imtahan kataloqunda yayımlandı.`;

  await db
    .query(
      `INSERT INTO notifications (user_id, title, body, type, is_read, meta)
       VALUES ($1, $2, $3, 'catalog_exam_approved', FALSE, $4::jsonb)`,
      [instructorId, title, body, JSON.stringify({ exam_id: examId })],
    )
    .catch((e) => console.error('catalog approve notification', e.message));

  try {
    const to = await userEmail(instructorId);
    if (!to) return;
    await enqueueNotification({
      channel: 'email',
      event_type: 'catalog_exam_approved',
      unique_key: `catalog_exam_approved_${examId}`,
      instructor_id: instructorId,
      to_addr: to,
      subject: `Mentorix — ${title}`,
      body: `${body}\n\nMentorix → İmtahanlar bölməsindən izləyə bilərsiniz.`,
      context: { exam_id: examId },
    });
  } catch (e) {
    console.error('catalog approve email', e.message);
  }
}

async function notifyInstructorCatalogRejected({ instructorId, examId, examTitle, reason }) {
  const title = 'Kataloq rəddi';
  const body =
    `«${examTitle}» imtahanınız kataloq üçün rədd edildi: ${reason}. ` +
    'Düzəliş edib yenidən «Kataloqda göstərilsin» seçimini aktivləşdirə bilərsiniz.';

  await db
    .query(
      `INSERT INTO notifications (user_id, title, body, type, is_read, meta)
       VALUES ($1, $2, $3, 'catalog_exam_rejected', FALSE, $4::jsonb)`,
      [instructorId, title, body, JSON.stringify({ exam_id: examId, reason })],
    )
    .catch((e) => console.error('catalog reject notification', e.message));

  try {
    const to = await userEmail(instructorId);
    if (!to) return;
    await enqueueNotification({
      channel: 'email',
      event_type: 'catalog_exam_rejected',
      unique_key: `catalog_exam_rejected_${examId}_${Date.now()}`,
      instructor_id: instructorId,
      to_addr: to,
      subject: `Mentorix — ${title}`,
      body: `${body}\n\nMentorix → İmtahanı redaktə edib yenidən göndərin.`,
      context: { exam_id: examId, reason },
    });
  } catch (e) {
    console.error('catalog reject email', e.message);
  }
}

module.exports = { notifyInstructorCatalogApproved, notifyInstructorCatalogRejected };
