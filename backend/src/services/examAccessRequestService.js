const db = require('../utils/db');
const { sendEmail, userEmail } = require('./emailService');

const normHex = (id) =>
  id == null ? '' : String(id).trim().toLowerCase().replace(/-/g, '');

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
  return {
    exam: {
      id: exam.id,
      title: exam.title,
      instructor_name: exam.instructor_name,
    },
    assigned: Boolean(assigned[0]),
    pending_request: pending[0] || null,
  };
}

async function createExamAccessRequest(studentId, examId) {
  const exam = await getExamForStudentRequest(examId);
  if (!exam || exam.is_deleted) {
    const err = new Error('İmtahan tapılmadı');
    err.statusCode = 404;
    throw err;
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

  const { rows } = await db.query(
    `INSERT INTO exam_access_requests (
       exam_id, student_id, instructor_id, status, student_email, student_name
     ) VALUES ($1, $2, $3, 'PENDING', $4, $5)
     RETURNING id, status, created_at`,
    [examId, studentId, exam.instructor_id, u.email || null, studentName],
  );

  await notifyInstructorExamAccessRequest(
    exam.instructor_id,
    studentName,
    exam.title,
    exam.id,
  );

  return {
    request_id: rows[0].id,
    message: 'Sorğunuz göndərildi. Müəllim təsdiqlədikdən sonra imtahana daxil ola bilərsiniz.',
    code: 'PENDING_APPROVAL',
  };
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
  return rows.map((r) => ({
    request_id: r.request_id,
    kind: 'exam_access',
    status: r.status,
    created_at: r.created_at,
    exam_id: r.exam_id,
    exam_title: r.exam_title,
    student_name: r.student_full_name || r.student_name,
    student_email: r.student_account_email || r.student_email,
    phone: r.phone_number || r.user_phone,
  }));
}

async function countPendingExamAccessRequests(instructorId) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n
     FROM exam_access_requests ear
     JOIN exams e ON e.id = ear.exam_id AND COALESCE(e.is_deleted, FALSE) = FALSE
     WHERE ear.instructor_id = $1::uuid
       AND UPPER(TRIM(ear.status)) = 'PENDING'`,
    [instructorId],
  );
  return Number(rows[0]?.n ?? 0) || 0;
}

async function approveExamAccessRequest(requestId, instructorId) {
  const { rows } = await db.query(
    `SELECT ear.*, e.title AS exam_title
     FROM exam_access_requests ear
     JOIN exams e ON e.id = ear.exam_id
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

  await db.transaction(async (client) => {
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

  const { sendExamPlacedNotifications } = require('./examService');
  sendExamPlacedNotifications(req.exam_id, { studentIds: [req.student_id] }).catch((e) =>
    console.error('sendExamPlacedNotifications(access)', e.message),
  );

  return {
    exam_id: req.exam_id,
    student_id: req.student_id,
    message: `«${req.exam_title || 'İmtahan'}» üçün tələbə təyin edildi.`,
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
  await db.query(
    `UPDATE exam_access_requests
     SET status = 'REJECTED', resolved_at = NOW(), resolved_by = $2::uuid
     WHERE id = $1::uuid`,
    [requestId, instructorId],
  );
  return { message: 'Sorğu rədd edildi' };
}

module.exports = {
  getStudentAccessStatus,
  createExamAccessRequest,
  listPendingExamAccessRequests,
  countPendingExamAccessRequests,
  approveExamAccessRequest,
  rejectExamAccessRequest,
};
