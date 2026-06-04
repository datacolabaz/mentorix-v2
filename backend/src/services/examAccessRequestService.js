const db = require('../utils/db');
const { sendEmail, userEmail } = require('./emailService');
const {
  canonicalStudentPhone,
  STUDENT_CONTACT_PHONE_SQL,
} = require('../utils/studentPhone');

const normHex = (id) =>
  id == null ? '' : String(id).trim().toLowerCase().replace(/-/g, '');

async function insertUserNotification(userId, title, body, type, meta = {}) {
  await db
    .query(
      `INSERT INTO notifications (user_id, title, body, type, is_read, meta)
       VALUES ($1, $2, $3, $4, FALSE, $5::jsonb)`,
      [userId, title, body, type, JSON.stringify(meta)],
    )
    .catch((e) => console.error('insertUserNotification', type, e.message));
}

/** Təsdiqdən sonra müəllimin tələbə siyahısında görünsün */
async function ensureInstructorStudentEnrollment(client, instructorId, studentId) {
  const ni = normHex(instructorId);
  const { rows: existing } = await client.query(
    `SELECT id, status FROM enrollments
     WHERE student_id = $1::uuid
       AND (deleted_at IS NULL)
       AND REPLACE(LOWER(TRIM(instructor_id::text)), '-', '') = $2
       AND COALESCE(LOWER(TRIM(status)), '') NOT IN ('rejected', 'left', 'archived')
     LIMIT 1`,
    [studentId, ni],
  );
  if (existing[0]?.id) return existing[0].id;

  const { rows: ins } = await client.query(
    `INSERT INTO enrollments (instructor_id, student_id, status, enrolled_at)
     VALUES ($1::uuid, $2::uuid, 'pending_setup', NOW())
     RETURNING id`,
    [instructorId, studentId],
  );
  return ins[0]?.id || null;
}

async function notifyInstructorExamAccessRequest(instructorId, studentName, examTitle, examId) {
  const title = 'İmtahana giriş sorğusu';
  const body = `${studentName} «${examTitle}» imtahanına qoşulmaq istəyir. Təsdiqləyin.`;
  await db
    .query(
      `INSERT INTO notifications (user_id, title, body, type, is_read, meta)
       VALUES ($1, $2, $3, 'exam_access_request', FALSE, $4::jsonb)`,
      [
        instructorId,
        title,
        body,
        JSON.stringify({ exam_id: examId, kind: 'exam_access_request' }),
      ],
    )
    .catch((e) => console.error('notifyInstructorExamAccessRequest', e.message));

  try {
    const to = await userEmail(instructorId);
    if (to) {
      await sendEmail({
        to,
        subject: `Mentorix — ${title}`,
        text: `${body}\n\nMentorix → Sorğular və ya İmtahanlar bölməsindən təsdiqləyin.`,
      });
    }
  } catch (e) {
    console.error('exam access request email', e.message);
  }
}

async function getExamForStudentRequest(examId) {
  const { rows } = await db.query(
    `SELECT e.id, e.title, e.instructor_id, u.full_name AS instructor_name,
            COALESCE(e.is_deleted, FALSE) AS is_deleted
     FROM exams e
     JOIN users u ON u.id = e.instructor_id
     WHERE e.id = $1::uuid
     LIMIT 1`,
    [examId],
  );
  return rows[0] || null;
}

async function getStudentAccessStatus(studentId, examId) {
  const exam = await getExamForStudentRequest(examId);
  if (!exam || exam.is_deleted) {
    const err = new Error('İmtahan tapılmadı');
    err.statusCode = 404;
    throw err;
  }
  const sidHex = normHex(studentId);
  const { rows: assigned } = await db.query(
    `SELECT 1 FROM exam_assignments ea
     WHERE ea.exam_id = $1::uuid
       AND REPLACE(LOWER(TRIM(ea.student_id::text)), '-', '') = $2
     LIMIT 1`,
    [examId, sidHex],
  );
  const { rows: pending } = await db.query(
    `SELECT id, status, created_at FROM exam_access_requests
     WHERE exam_id = $1::uuid AND student_id = $2::uuid
       AND UPPER(TRIM(status)) = 'PENDING'
     LIMIT 1`,
    [examId, studentId],
  );
  const { rows: rejected } = await db.query(
    `SELECT id, created_at FROM exam_access_requests
     WHERE exam_id = $1::uuid AND student_id = $2::uuid
       AND UPPER(TRIM(status)) = 'REJECTED'
     ORDER BY created_at DESC
     LIMIT 1`,
    [examId, studentId],
  );
  return {
    exam: {
      id: exam.id,
      title: exam.title,
      instructor_name: exam.instructor_name,
    },
    assigned: Boolean(assigned[0]),
    pending_request: pending[0] || null,
    rejected_request: rejected[0] || null,
  };
}

const { assertStudentProfileComplete } = require('../controllers/studentProfileController');

async function createExamAccessRequest(studentId, examId) {
  const exam = await getExamForStudentRequest(examId);
  if (!exam || exam.is_deleted) {
    const err = new Error('İmtahan tapılmadı');
    err.statusCode = 404;
    throw err;
  }

  try {
    await assertStudentProfileComplete(studentId);
  } catch (e) {
    if (e.code === 'STUDENT_PROFILE_INCOMPLETE') {
      e.code = 'PROFILE_INCOMPLETE';
      e.message =
        'Əvvəlcə ad, soyad və mobil telefonu doldurun — sonra müraciət müəllimə göndəriləcək.';
    }
    throw e;
  }

  const status = await getStudentAccessStatus(studentId, examId);
  if (status.assigned) {
    const err = new Error('Bu imtahan artıq sizə təyin edilib');
    err.statusCode = 409;
    err.code = 'ALREADY_ASSIGNED';
    throw err;
  }
  if (status.pending_request) {
    const err = new Error('Sorğunuz artıq göndərilib — müəllimin təsdiqini gözləyin');
    err.statusCode = 409;
    err.code = 'ALREADY_PENDING';
    throw err;
  }

  const { rows: urows } = await db.query(
    `SELECT full_name, email FROM users WHERE id = $1::uuid LIMIT 1`,
    [studentId],
  );
  const u = urows[0] || {};
  const studentName = String(u.full_name || u.email || 'Tələbə').trim();

  const {
    ensureInstructorCanAddStudent,
    trackInstructorStudentLink,
    STUDENT_LIMIT_MESSAGE,
  } = require('./instructorStudentService');
  await ensureInstructorCanAddStudent(exam.instructor_id, studentId, {
    studentMessage: STUDENT_LIMIT_MESSAGE,
  });

  const { rows } = await db.query(
    `INSERT INTO exam_access_requests (
       exam_id, student_id, instructor_id, status, student_email, student_name
     ) VALUES ($1, $2, $3, 'PENDING', $4, $5)
     RETURNING id, status, created_at`,
    [examId, studentId, exam.instructor_id, u.email || null, studentName],
  );

  await trackInstructorStudentLink(exam.instructor_id, studentId, { skipLimitCheck: true });

  await notifyInstructorExamAccessRequest(
    exam.instructor_id,
    studentName,
    exam.title,
    exam.id,
  );

  return {
    request_id: rows[0].id,
    message: 'Sorğunuz müəllimə göndərildi. Təsdiqlədikdən sonra imtahana daxil ola bilərsiniz.',
    code: 'PENDING_APPROVAL',
  };
}

/** İmtahan linki ilə gələn tələbə üçün avtomatik sorğu (təkrar yoxlanılır) */
async function ensureExamAccessRequestFromLink(studentId, examId) {
  const status = await getStudentAccessStatus(studentId, examId);
  if (status.assigned) {
    return { already_assigned: true, ...status };
  }
  if (status.pending_request) {
    return { already_pending: true, request_id: status.pending_request.id, ...status };
  }
  if (status.rejected_request) {
    const created = await createExamAccessRequest(studentId, examId);
    return { created: true, re_requested: true, ...created, exam: status.exam };
  }
  const created = await createExamAccessRequest(studentId, examId);
  return { created: true, ...created, exam: status.exam };
}

async function listPendingExamAccessRequests(instructorId) {
  const { rows } = await db.query(
    `SELECT ear.id AS request_id,
            ear.status,
            ear.created_at,
            ear.student_email,
            ear.student_name,
            ear.exam_id,
            e.title AS exam_title,
            u.full_name AS student_full_name,
            u.email AS student_account_email,
            sp.phone_number,
            u.phone AS user_phone
     FROM exam_access_requests ear
     JOIN exams e ON e.id = ear.exam_id AND COALESCE(e.is_deleted, FALSE) = FALSE
     JOIN users u ON u.id = ear.student_id
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     WHERE ear.instructor_id = $1::uuid
       AND UPPER(TRIM(ear.status)) = 'PENDING'
     ORDER BY ear.created_at DESC`,
    [instructorId],
  );
  return rows
    .map((r) => {
      const phoneCanon = canonicalStudentPhone(r.phone_number || r.user_phone);
      return {
        request_id: r.request_id,
        kind: 'exam_access',
        status: r.status,
        created_at: r.created_at,
        exam_id: r.exam_id,
        exam_title: r.exam_title,
        student_name: r.student_full_name || r.student_name,
        student_email: r.student_account_email || r.student_email,
        phone: phoneCanon || r.phone_number || r.user_phone,
        profile_complete: Boolean(phoneCanon),
      };
    })
    .filter((r) => r.profile_complete);
}

async function countPendingExamAccessRequests(instructorId) {
  const pending = await listPendingExamAccessRequests(instructorId);
  return pending.length;
}

async function approveExamAccessRequest(requestId, instructorId, options = {}) {
  const sendSms = options.sendSms === true;
  const { rows } = await db.query(
    `SELECT ear.*, e.title AS exam_title, u.full_name AS instructor_name
     FROM exam_access_requests ear
     JOIN exams e ON e.id = ear.exam_id
     JOIN users u ON u.id = ear.instructor_id
     WHERE ear.id = $1::uuid AND ear.instructor_id = $2::uuid
     LIMIT 1`,
    [requestId, instructorId],
  );
  const req = rows[0];
  if (!req) {
    const err = new Error('Sorğu tapılmadı');
    err.statusCode = 404;
    throw err;
  }
  if (String(req.status || '').toUpperCase() !== 'PENDING') {
    const err = new Error('Bu sorğu artıq həll olunub');
    err.statusCode = 400;
    throw err;
  }

  await assertStudentProfileComplete(req.student_id);

  let enrollmentId = null;
  const { trackInstructorStudentLink } = require('./instructorStudentService');
  await db.transaction(async (client) => {
    enrollmentId = await ensureInstructorStudentEnrollment(client, instructorId, req.student_id);
    await trackInstructorStudentLink(instructorId, req.student_id, { skipLimitCheck: true }, client);
    await client.query(
      `INSERT INTO exam_assignments (exam_id, student_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.exam_id, req.student_id],
    );
    await client.query(
      `UPDATE exam_access_requests
       SET status = 'APPROVED', resolved_at = NOW(), resolved_by = $2::uuid
       WHERE id = $1::uuid`,
      [requestId, instructorId],
    );
  });

  const examTitle = req.exam_title || 'İmtahan';
  const instructorName = req.instructor_name || 'Müəlliminiz';
  await insertUserNotification(
    req.student_id,
    'İmtahana giriş təsdiqləndi',
    `«${examTitle}» üçün müəlliminiz icazə verdi. İndi imtahana başlaya bilərsiniz.`,
    'exam_access_approved',
    { exam_id: req.exam_id },
  );

  const { sendExamAccessApprovedEmail } = require('./studentNotificationEmailService');
  const emailResult = await sendExamAccessApprovedEmail({
    userId: req.student_id,
    examId: req.exam_id,
    examTitle,
    instructorName,
    emailOverride: req.student_email,
  }).catch((e) => {
    console.error('sendExamAccessApprovedEmail', e.message);
    return { ok: false, error: e.message };
  });

  const { sendExamPlacedNotifications } = require('./examService');
  sendExamPlacedNotifications(req.exam_id, {
    studentIds: [req.student_id],
    sendSms,
    skipPlacementEmail: true,
    skipPlacementInApp: true,
  }).catch((e) => console.error('sendExamPlacedNotifications(access)', e.message));

  const smsPart = sendSms
    ? ' SMS/WhatsApp göndərildi (nömrə varsa).'
    : ' SMS göndərilmədi.';
  const emailPart = emailResult?.ok
    ? ' Gmail-ə «Müraciətiniz təsdiqləndi» göndərildi.'
    : emailResult?.skipped
      ? ' Gmail yoxdur və ya email konfiqurasiya olunmayıb.'
      : ' Gmail göndərilmədi (xəta).';
  return {
    exam_id: req.exam_id,
    student_id: req.student_id,
    enrollment_id: enrollmentId,
    email_notified: Boolean(emailResult?.ok),
    sms_sent: sendSms,
    message: `Tələbə təsdiqləndi: «${examTitle}».${emailPart}${smsPart}`,
  };
}

async function rejectExamAccessRequest(requestId, instructorId) {
  const { rows } = await db.query(
    `SELECT id, status FROM exam_access_requests
     WHERE id = $1::uuid AND instructor_id = $2::uuid
     LIMIT 1`,
    [requestId, instructorId],
  );
  const req = rows[0];
  if (!req) {
    const err = new Error('Sorğu tapılmadı');
    err.statusCode = 404;
    throw err;
  }
  if (String(req.status || '').toUpperCase() !== 'PENDING') {
    const err = new Error('Bu sorğu artıq həll olunub');
    err.statusCode = 400;
    throw err;
  }
  const { rows: full } = await db.query(
    `SELECT ear.student_id, ear.exam_id, e.title AS exam_title
     FROM exam_access_requests ear
     JOIN exams e ON e.id = ear.exam_id
     WHERE ear.id = $1::uuid AND ear.instructor_id = $2::uuid`,
    [requestId, instructorId],
  );
  const row = full[0];
  if (!row) {
    const err = new Error('Sorğu tapılmadı');
    err.statusCode = 404;
    throw err;
  }
  if (String(req.status || '').toUpperCase() !== 'PENDING') {
    const err = new Error('Bu sorğu artıq həll olunub');
    err.statusCode = 400;
    throw err;
  }

  await db.query(
    `UPDATE exam_access_requests
     SET status = 'REJECTED', resolved_at = NOW(), resolved_by = $2::uuid
     WHERE id = $1::uuid`,
    [requestId, instructorId],
  );

  if (row.student_id) {
    await insertUserNotification(
      row.student_id,
      'İmtahana giriş rədd edildi',
      `«${row.exam_title || 'İmtahan'}» üçün müəllim sorğunuzu rədd etdi.`,
      'exam_access_rejected',
      { exam_id: row.exam_id },
    );
  }

  return { message: 'Sorğu rədd edildi' };
}

function isMissingExamAccessTableError(err) {
  const code = err?.code || '';
  const msg = String(err?.message || '');
  return code === '42P01' || /exam_access_requests/i.test(msg);
}

module.exports = {
  getStudentAccessStatus,
  getExamForStudentRequest,
  createExamAccessRequest,
  ensureExamAccessRequestFromLink,
  listPendingExamAccessRequests,
  countPendingExamAccessRequests,
  approveExamAccessRequest,
  rejectExamAccessRequest,
  isMissingExamAccessTableError,
};
