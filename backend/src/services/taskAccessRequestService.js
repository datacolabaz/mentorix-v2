const db = require('../utils/db');
const { sendEmail, userEmail } = require('./emailService');
const { canonicalStudentPhone } = require('../utils/studentPhone');
const { assertStudentProfileComplete } = require('../controllers/studentProfileController');
const { ensureLightInstructorEnrollment } = require('./lightEnrollmentService');
const { notifyStudentsOfNewAssignment } = require('./assignmentHomeworkService');

const normHex = (id) => (id == null ? '' : String(id).trim().toLowerCase().replace(/-/g, ''));

async function getTaskForStudentRequest(taskId) {
  const { rows } = await db.query(
    `SELECT a.id, a.title, a.instructor_id, u.full_name AS instructor_name
     FROM assignments a
     JOIN users u ON u.id = a.instructor_id
     WHERE a.id = $1::uuid
     LIMIT 1`,
    [taskId],
  );
  return rows[0] || null;
}

async function getStudentTaskAccessStatus(studentId, taskId) {
  const task = await getTaskForStudentRequest(taskId);
  if (!task) {
    const err = new Error('Tapşırıq tapılmadı');
    err.statusCode = 404;
    throw err;
  }
  const sidHex = normHex(studentId);
  const { rows: assigned } = await db.query(
    `SELECT 1 FROM student_assignments sa
     WHERE sa.assignment_id = $1::uuid
       AND REPLACE(LOWER(TRIM(sa.student_id::text)), '-', '') = $2
     LIMIT 1`,
    [taskId, sidHex],
  );
  const { rows: pending } = await db.query(
    `SELECT id, status, created_at FROM task_access_requests
     WHERE assignment_id = $1::uuid AND student_id = $2::uuid
       AND UPPER(TRIM(status)) = 'PENDING'
     LIMIT 1`,
    [taskId, studentId],
  );
  const { rows: rejected } = await db.query(
    `SELECT id, created_at FROM task_access_requests
     WHERE assignment_id = $1::uuid AND student_id = $2::uuid
       AND UPPER(TRIM(status)) = 'REJECTED'
     ORDER BY created_at DESC
     LIMIT 1`,
    [taskId, studentId],
  );
  return {
    task: {
      id: task.id,
      title: task.title,
      instructor_name: task.instructor_name,
    },
    assigned: Boolean(assigned[0]),
    pending_request: pending[0] || null,
    rejected_request: rejected[0] || null,
  };
}

async function notifyInstructorTaskAccessRequest(instructorId, studentName, taskTitle, taskId) {
  const title = 'Tapşırıq giriş sorğusu';
  const body = `${studentName} «${taskTitle}» tapşırığına qoşulmaq istəyir. Təsdiqləyin.`;
  await db
    .query(
      `INSERT INTO notifications (user_id, title, body, type, is_read, meta)
       VALUES ($1, $2, $3, 'task_access_request', FALSE, $4::jsonb)`,
      [instructorId, title, body, JSON.stringify({ assignment_id: taskId, kind: 'task_access_request' })],
    )
    .catch((e) => console.error('notifyInstructorTaskAccessRequest', e.message));
  try {
    const to = await userEmail(instructorId);
    if (to) {
      await sendEmail({
        to,
        subject: `Mentorix — ${title}`,
        text: `${body}\n\nMentorix → Sorğular bölməsindən təsdiqləyin.`,
      });
    }
  } catch (e) {
    console.error('task access request email', e.message);
  }
}

async function createTaskAccessRequest(studentId, taskId) {
  const task = await getTaskForStudentRequest(taskId);
  if (!task) {
    const err = new Error('Tapşırıq tapılmadı');
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

  const status = await getStudentTaskAccessStatus(studentId, taskId);
  if (status.assigned) {
    const err = new Error('Bu tapşırıq artıq sizə təyin edilib');
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
  await ensureInstructorCanAddStudent(task.instructor_id, studentId, {
    studentMessage: STUDENT_LIMIT_MESSAGE,
  });

  let requestRow = null;
  await db.transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO task_access_requests (
         assignment_id, student_id, instructor_id, status, student_email, student_name
       ) VALUES ($1, $2, $3, 'PENDING', $4, $5)
       RETURNING id, status, created_at`,
      [taskId, studentId, task.instructor_id, u.email || null, studentName],
    );
    requestRow = rows[0];
    await ensureLightInstructorEnrollment(client, task.instructor_id, studentId, 'task', {
      activate: false,
    });
    await trackInstructorStudentLink(task.instructor_id, studentId, { skipLimitCheck: true }, client);
  });
  await notifyInstructorTaskAccessRequest(task.instructor_id, studentName, task.title, task.id);

  return {
    request_id: requestRow.id,
    message: 'Sorğunuz müəllimə göndərildi. Təsdiqlədikdən sonra tapşırığa daxil ola bilərsiniz.',
    code: 'PENDING_APPROVAL',
  };
}

async function ensureTaskAccessRequestFromLink(studentId, taskId) {
  const status = await getStudentTaskAccessStatus(studentId, taskId);
  if (status.assigned) return { already_assigned: true, ...status };
  if (status.pending_request) {
    return { already_pending: true, request_id: status.pending_request.id, ...status };
  }
  if (status.rejected_request) {
    const created = await createTaskAccessRequest(studentId, taskId);
    return { created: true, re_requested: true, ...created, task: status.task };
  }
  const created = await createTaskAccessRequest(studentId, taskId);
  return { created: true, ...created, task: status.task };
}

async function listPendingTaskAccessRequests(instructorId) {
  const { rows } = await db.query(
    `SELECT tar.id AS request_id,
            tar.status,
            tar.created_at,
            tar.student_email,
            tar.student_name,
            tar.assignment_id AS task_id,
            a.title AS task_title,
            u.full_name AS student_full_name,
            u.email AS student_account_email,
            sp.phone_number,
            u.phone AS user_phone
     FROM task_access_requests tar
     JOIN assignments a ON a.id = tar.assignment_id
     JOIN users u ON u.id = tar.student_id
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     WHERE tar.instructor_id = $1::uuid
       AND UPPER(TRIM(tar.status)) = 'PENDING'
     ORDER BY tar.created_at DESC`,
    [instructorId],
  );
  return rows
    .map((r) => {
      const phoneCanon = canonicalStudentPhone(r.phone_number || r.user_phone);
      return {
        request_id: r.request_id,
        kind: 'task_access',
        status: r.status,
        created_at: r.created_at,
        task_id: r.task_id,
        task_title: r.task_title,
        student_name: r.student_full_name || r.student_name,
        student_email: r.student_account_email || r.student_email,
        phone: phoneCanon || r.phone_number || r.user_phone,
        profile_complete: Boolean(phoneCanon),
      };
    })
    .filter((r) => r.profile_complete);
}

async function countPendingTaskAccessRequests(instructorId) {
  return (await listPendingTaskAccessRequests(instructorId)).length;
}

async function approveTaskAccessRequest(requestId, instructorId) {
  const { rows } = await db.query(
    `SELECT tar.*, a.title AS task_title, u.full_name AS instructor_name
     FROM task_access_requests tar
     JOIN assignments a ON a.id = tar.assignment_id
     JOIN users u ON u.id = tar.instructor_id
     WHERE tar.id = $1::uuid AND tar.instructor_id = $2::uuid
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

  const { trackInstructorStudentLink } = require('./instructorStudentService');
  await db.transaction(async (client) => {
    await ensureLightInstructorEnrollment(client, instructorId, req.student_id, 'task', {
      activate: true,
    });
    await trackInstructorStudentLink(instructorId, req.student_id, { skipLimitCheck: true }, client);
    await client.query(
      `INSERT INTO student_assignments (assignment_id, student_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (assignment_id, student_id) DO NOTHING`,
      [req.assignment_id, req.student_id],
    );
    await client.query(
      `UPDATE task_access_requests
       SET status = 'APPROVED', resolved_at = NOW(), resolved_by = $2::uuid
       WHERE id = $1::uuid`,
      [requestId, instructorId],
    );
  });

  const { rows: taskRows } = await db.query(`SELECT * FROM assignments WHERE id = $1 LIMIT 1`, [
    req.assignment_id,
  ]);
  if (taskRows[0]) {
    await notifyStudentsOfNewAssignment(taskRows[0], [req.student_id], req.instructor_name || '');
  }

  return {
    task_id: req.assignment_id,
    student_id: req.student_id,
    message: `Tələbə təsdiqləndi: «${req.task_title || 'Tapşırıq'}».`,
  };
}

async function rejectTaskAccessRequest(requestId, instructorId) {
  const { rows } = await db.query(
    `SELECT id, status FROM task_access_requests
     WHERE id = $1::uuid AND instructor_id = $2::uuid LIMIT 1`,
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
    `UPDATE task_access_requests
     SET status = 'REJECTED', resolved_at = NOW(), resolved_by = $2::uuid
     WHERE id = $1::uuid`,
    [requestId, instructorId],
  );
  return { message: 'Sorğu rədd edildi' };
}

function isMissingTaskAccessTableError(err) {
  const code = err?.code || '';
  const msg = String(err?.message || '');
  return code === '42P01' || /task_access_requests/i.test(msg);
}

module.exports = {
  getTaskForStudentRequest,
  getStudentTaskAccessStatus,
  createTaskAccessRequest,
  ensureTaskAccessRequestFromLink,
  listPendingTaskAccessRequests,
  countPendingTaskAccessRequests,
  approveTaskAccessRequest,
  rejectTaskAccessRequest,
  isMissingTaskAccessTableError,
};
