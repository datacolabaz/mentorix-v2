const db = require('../utils/db');
const { sign } = require('../utils/jwt');
const {
  canonicalStudentPhone,
  normalizePhoneDigits,
  upsertStudentContactPhone,
} = require('../utils/studentPhone');
const { grantUserRole } = require('./userRolesService');
const { ensureLightInstructorEnrollment } = require('./lightEnrollmentService');
const {
  getExamForStudentRequest,
  getStudentAccessStatus,
} = require('./examAccessRequestService');
const {
  getTaskForStudentRequest,
  getStudentTaskAccessStatus,
} = require('./taskAccessRequestService');

async function findStudentIdByContactPhone(dbConn, phoneCanon) {
  const digits = normalizePhoneDigits(phoneCanon);
  if (!digits) return null;
  const { rows } = await dbConn.query(
    `SELECT u.id, u.role
     FROM users u
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     WHERE COALESCE(u.is_active, TRUE) = TRUE
       AND (
         regexp_replace(COALESCE(u.phone::text, ''), '[^0-9]', '', 'g') = $1
         OR regexp_replace(COALESCE(sp.phone_number::text, ''), '[^0-9]', '', 'g') = $1
       )
     LIMIT 1`,
    [digits],
  );
  return rows[0] || null;
}

async function findOrCreateGuestStudent({ first_name, last_name, phone }, client = null) {
  const q = client ? client.query.bind(client) : db.query.bind(db);
  const phoneCanon = canonicalStudentPhone(phone);
  if (!phoneCanon) {
    const err = new Error('Telefon nömrəsi düzgün deyil (+994 XX XXX XX XX)');
    err.statusCode = 400;
    throw err;
  }
  const firstName = String(first_name || '').trim();
  const lastName = String(last_name || '').trim();
  if (!firstName || !lastName) {
    const err = new Error('Ad və soyad tələb olunur');
    err.statusCode = 400;
    throw err;
  }
  const fullName = `${firstName} ${lastName}`.trim();

  const existing = await findStudentIdByContactPhone(client || db, phoneCanon);
  if (existing?.id) {
    if (String(existing.role || '').toLowerCase() !== 'student') {
      const err = new Error(
        'Bu telefon nömrəsi artıq başqa hesaba bağlıdır. Başqa nömrə istifadə edin və ya mövcud hesabla daxil olun.',
      );
      err.statusCode = 409;
      err.code = 'PHONE_NOT_STUDENT';
      throw err;
    }
    await q(`UPDATE users SET full_name = $1 WHERE id = $2::uuid`, [fullName, existing.id]);
    await upsertStudentContactPhone(client || db, existing.id, phoneCanon, { full_name: fullName });
    return existing.id;
  }

  const { rows: ins } = await q(
    `INSERT INTO users (full_name, phone, role, is_verified, account_status, is_active)
     VALUES ($1, $2, 'student', TRUE, 'active', TRUE)
     RETURNING id`,
    [fullName, phoneCanon],
  );
  const studentId = ins[0]?.id;
  if (!studentId) {
    const err = new Error('Tələbə profili yaradılmadı');
    err.statusCode = 500;
    throw err;
  }
  await grantUserRole(studentId, 'student', client);
  const { rows: spRows } = await q(`SELECT id FROM student_profiles WHERE user_id = $1::uuid LIMIT 1`, [
    studentId,
  ]);
  if (spRows[0]?.id) {
    await q(`UPDATE student_profiles SET phone_number = $2 WHERE user_id = $1::uuid`, [
      studentId,
      phoneCanon,
    ]);
  } else {
    await q(`INSERT INTO student_profiles (user_id, phone_number) VALUES ($1::uuid, $2)`, [
      studentId,
      phoneCanon,
    ]);
  }
  return studentId;
}

async function loadStudentSessionUser(studentId) {
  const { rows } = await db.query(
    `SELECT id, full_name, email, phone, role, is_verified
     FROM users WHERE id = $1::uuid AND COALESCE(is_active, TRUE) = TRUE LIMIT 1`,
    [studentId],
  );
  const u = rows[0];
  if (!u || String(u.role || '').toLowerCase() !== 'student') {
    const err = new Error('Tələbə hesabı tapılmadı');
    err.statusCode = 404;
    throw err;
  }
  return {
    ...u,
    needs_phone_verification: false,
  };
}

async function buildGuestSessionPayload(studentId) {
  const user = await loadStudentSessionUser(studentId);
  const token = sign({ id: user.id, role: user.role });
  return { token, user };
}

async function autoGrantExamAccessForStudent(studentId, examId) {
  const exam = await getExamForStudentRequest(examId);
  if (!exam || exam.is_deleted) {
    const err = new Error('İmtahan tapılmadı');
    err.statusCode = 404;
    throw err;
  }

  const status = await getStudentAccessStatus(studentId, examId);
  if (status.assigned) {
    return {
      already_assigned: true,
      assigned: true,
      exam: status.exam,
      message: 'Bu imtahan artıq sizə açıqdır.',
    };
  }

  const { trackInstructorStudentLink } = require('./instructorStudentService');
  const { addStudentToExamParticipantGroup } = require('./participantGroupService');

  await db.transaction(async (client) => {
    await ensureLightInstructorEnrollment(client, exam.instructor_id, studentId, 'exam', {
      activate: true,
    });
    await trackInstructorStudentLink(exam.instructor_id, studentId, { skipLimitCheck: true }, client);
    await client.query(
      `INSERT INTO exam_assignments (exam_id, student_id) VALUES ($1::uuid, $2::uuid)
       ON CONFLICT DO NOTHING`,
      [examId, studentId],
    );
    await addStudentToExamParticipantGroup(client, examId, studentId);
  });

  return {
    assigned: true,
    exam: {
      id: exam.id,
      title: exam.title,
      instructor_name: exam.instructor_name,
    },
    message: 'İmtahana daxil ola bilərsiniz.',
  };
}

async function autoGrantTaskAccessForStudent(studentId, taskId) {
  const task = await getTaskForStudentRequest(taskId);
  if (!task) {
    const err = new Error('Tapşırıq tapılmadı');
    err.statusCode = 404;
    throw err;
  }

  const status = await getStudentTaskAccessStatus(studentId, taskId);
  if (status.assigned) {
    return {
      already_assigned: true,
      assigned: true,
      task: status.task,
      message: 'Bu tapşırıq artıq sizə açıqdır.',
    };
  }

  const { trackInstructorStudentLink } = require('./instructorStudentService');
  const { addStudentToAssignmentParticipantGroup } = require('./participantGroupService');

  await db.transaction(async (client) => {
    await ensureLightInstructorEnrollment(client, task.instructor_id, studentId, 'task', {
      activate: true,
    });
    await trackInstructorStudentLink(task.instructor_id, studentId, { skipLimitCheck: true }, client);
    await client.query(
      `INSERT INTO student_assignments (assignment_id, student_id, status)
       VALUES ($1::uuid, $2::uuid, 'pending')
       ON CONFLICT (assignment_id, student_id) DO NOTHING`,
      [taskId, studentId],
    );
    await addStudentToAssignmentParticipantGroup(client, taskId, studentId);
  });

  return {
    assigned: true,
    task: {
      id: task.id,
      title: task.title,
      instructor_name: task.instructor_name,
    },
    message: 'Tapşırığa daxil ola bilərsiniz.',
  };
}

async function joinExamAsGuest(examId, profile) {
  const studentId = await findOrCreateGuestStudent(profile);
  const grant = await autoGrantExamAccessForStudent(studentId, examId);
  const session = await buildGuestSessionPayload(studentId);
  return { ...grant, ...session, guest: true };
}

async function joinTaskAsGuest(taskId, profile) {
  const studentId = await findOrCreateGuestStudent(profile);
  const grant = await autoGrantTaskAccessForStudent(studentId, taskId);
  const session = await buildGuestSessionPayload(studentId);
  return { ...grant, ...session, guest: true };
}

module.exports = {
  findOrCreateGuestStudent,
  autoGrantExamAccessForStudent,
  autoGrantTaskAccessForStudent,
  joinExamAsGuest,
  joinTaskAsGuest,
  buildGuestSessionPayload,
};
