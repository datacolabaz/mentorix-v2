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

async function findStudentIdByGoogleSub(dbConn, googleSub) {
  const sub = String(googleSub || '').trim();
  if (!sub) return null;
  const { rows } = await dbConn.query(
    `SELECT id, role FROM users
     WHERE COALESCE(is_active, TRUE) = TRUE AND google_sub = $1 LIMIT 1`,
    [sub],
  );
  return rows[0] || null;
}

async function findStudentIdByEmail(dbConn, emailRaw) {
  const email = String(emailRaw || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return null;
  const { rows } = await dbConn.query(
    `SELECT id, role FROM users
     WHERE COALESCE(is_active, TRUE) = TRUE AND LOWER(TRIM(email)) = $1 LIMIT 1`,
    [email],
  );
  return rows[0] || null;
}

async function assertStudentRole(row, conflictMessage) {
  if (!row?.id) return null;
  if (String(row.role || '').toLowerCase() !== 'student') {
    const err = new Error(conflictMessage);
    err.statusCode = 409;
    err.code = 'NOT_STUDENT';
    throw err;
  }
  return row.id;
}

/** google_sub (stable auth id) > email > optional phone (legacy). Phone never required. */
async function findOrCreateGuestStudent(profile, client = null) {
  const q = client ? client.query.bind(client) : db.query.bind(db);
  const conn = client || db;
  const firstName = String(profile?.first_name || '').trim();
  const lastName = String(profile?.last_name || '').trim();
  if (!firstName || !lastName) {
    const err = new Error('Ad və soyad tələb olunur');
    err.statusCode = 400;
    throw err;
  }
  const fullName = `${firstName} ${lastName}`.trim();
  const email = String(profile?.email || '').trim();
  const googleSub = String(profile?.google_sub || '').trim();
  const studentIdHint = profile?.student_id || profile?.user_id || null;
  const phoneCanon = profile?.phone ? canonicalStudentPhone(profile.phone) : null;

  if (studentIdHint) {
    const { rows } = await q(
      `SELECT id, role FROM users WHERE id = $1::uuid AND COALESCE(is_active, TRUE) = TRUE LIMIT 1`,
      [studentIdHint],
    );
    const id = await assertStudentRole(rows[0], 'Bu hesab tələbə deyil');
    await q(`UPDATE users SET full_name = $1 WHERE id = $2::uuid`, [fullName, id]);
    if (email) {
      await q(`UPDATE users SET email = COALESCE(NULLIF(TRIM(email), ''), $1) WHERE id = $2::uuid`, [email, id]);
    }
    if (phoneCanon) await upsertStudentContactPhone(conn, id, phoneCanon, { full_name: fullName });
    return id;
  }

  let existing = googleSub ? await findStudentIdByGoogleSub(conn, googleSub) : null;
  if (!existing?.id && email) existing = await findStudentIdByEmail(conn, email);
  if (!existing?.id && phoneCanon) existing = await findStudentIdByContactPhone(conn, phoneCanon);

  if (existing?.id) {
    const id = await assertStudentRole(existing, 'Bu hesab tələbə deyil — müəllim panelinə daxil olun.');
    await q(`UPDATE users SET full_name = $1 WHERE id = $2::uuid`, [fullName, id]);
    if (email) {
      await q(`UPDATE users SET email = COALESCE(NULLIF(TRIM(email), ''), $1) WHERE id = $2::uuid`, [email, id]);
    }
    if (googleSub) {
      await q(
        `UPDATE users SET google_sub = $1, auth_provider = COALESCE(auth_provider, 'google')
         WHERE id = $2::uuid AND (google_sub IS NULL OR TRIM(google_sub) = '')`,
        [googleSub, id],
      );
    }
    if (phoneCanon) await upsertStudentContactPhone(conn, id, phoneCanon, { full_name: fullName });
    return id;
  }

  if (!email && !googleSub) {
    const err = new Error('Google ilə daxil olun');
    err.statusCode = 401;
    err.code = 'AUTH_REQUIRED';
    throw err;
  }

  const { rows: ins } = await q(
    `INSERT INTO users (full_name, phone, email, google_sub, auth_provider, role, is_verified, account_status, is_active)
     VALUES ($1, $2, $3, NULLIF($4, ''), CASE WHEN NULLIF($4, '') IS NOT NULL THEN 'google' ELSE NULL END,
             'student', TRUE, 'active', TRUE)
     RETURNING id`,
    [fullName, phoneCanon, email || null, googleSub],
  );
  const studentId = ins[0]?.id;
  if (!studentId) throw Object.assign(new Error('Tələbə profili yaradılmadı'), { statusCode: 500 });
  await grantUserRole(studentId, 'student', client);
  const { rows: spRows } = await q(`SELECT id FROM student_profiles WHERE user_id = $1::uuid LIMIT 1`, [studentId]);
  if (phoneCanon) {
    if (spRows[0]?.id) await q(`UPDATE student_profiles SET phone_number = $2 WHERE user_id = $1::uuid`, [studentId, phoneCanon]);
    else await q(`INSERT INTO student_profiles (user_id, phone_number) VALUES ($1::uuid, $2)`, [studentId, phoneCanon]);
  } else if (!spRows[0]?.id) {
    await q(`INSERT INTO student_profiles (user_id) VALUES ($1::uuid)`, [studentId]);
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

async function getGroupForMaterialsInvite(groupId) {
  const { rows } = await db.query(
    `SELECT ig.id, ig.name, ig.subject_id, ig.instructor_id,
            u.full_name AS instructor_name,
            isub.name AS subject_name
     FROM instructor_groups ig
     JOIN users u ON u.id = ig.instructor_id
     JOIN instructor_subjects isub ON isub.id = ig.subject_id
     WHERE ig.id = $1::uuid
     LIMIT 1`,
    [groupId],
  );
  return rows[0] || null;
}

async function joinGroupMaterialsAsGuest(groupId, profile) {
  const group = await getGroupForMaterialsInvite(groupId);
  if (!group) {
    const err = new Error('Qrup tapılmadı');
    err.statusCode = 404;
    throw err;
  }

  const studentId = await findOrCreateGuestStudent(profile);
  const { trackInstructorStudentLink } = require('./instructorStudentService');
  const { ensureStudentInParticipantGroup } = require('./participantGroupService');

  await db.transaction(async (client) => {
    await ensureLightInstructorEnrollment(client, group.instructor_id, studentId, 'group', {
      activate: true,
    });
    await trackInstructorStudentLink(group.instructor_id, studentId, { skipLimitCheck: true }, client);
    await ensureStudentInParticipantGroup(client, {
      instructorId: group.instructor_id,
      studentId,
      groupId: group.id,
      subjectId: group.subject_id,
      enrollmentSource: 'group',
    });
  });

  const session = await buildGuestSessionPayload(studentId);
  return {
    ...session,
    guest: true,
    group: {
      id: group.id,
      name: group.name,
      subject_name: group.subject_name,
      instructor_name: group.instructor_name,
    },
    message: 'Kitabxanaya daxil ola bilərsiniz.',
  };
}

async function getMaterialForInvite(materialId) {
  const { rows } = await db.query(
    `SELECT cm.id, cm.title, cm.group_id, cm.instructor_id,
            u.full_name AS instructor_name,
            isub.name AS subject_name,
            ig.name AS group_name
     FROM course_materials cm
     JOIN users u ON u.id = cm.instructor_id
     LEFT JOIN instructor_subjects isub ON isub.id = cm.subject_id
     LEFT JOIN instructor_groups ig ON ig.id = cm.group_id
     WHERE cm.id = $1::uuid
     LIMIT 1`,
    [materialId],
  );
  return rows[0] || null;
}

async function grantMaterialAccessForStudent(studentId, materialId, client = null) {
  const material = await getMaterialForInvite(materialId);
  if (!material) {
    const err = new Error('Material tapılmadı');
    err.statusCode = 404;
    throw err;
  }
  const { trackInstructorStudentLink } = require('./instructorStudentService');
  const { ensureStudentInParticipantGroup } = require('./participantGroupService');
  const work = async (trx) => {
    await ensureLightInstructorEnrollment(trx, material.instructor_id, studentId, 'material', { activate: true });
    await trackInstructorStudentLink(material.instructor_id, studentId, { skipLimitCheck: true }, trx);
    await trx.query(
      `INSERT INTO course_material_guest_students (material_id, student_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING`,
      [materialId, studentId],
    );
    if (material.group_id) {
      const { rows: grows } = await trx.query(`SELECT subject_id FROM instructor_groups WHERE id = $1::uuid`, [material.group_id]);
      await ensureStudentInParticipantGroup(trx, {
        instructorId: material.instructor_id,
        studentId,
        groupId: material.group_id,
        subjectId: grows[0]?.subject_id,
        enrollmentSource: 'group',
      });
    }
  };
  if (client) await work(client);
  else await db.transaction(work);
  return {
    material: { id: material.id, title: material.title, instructor_name: material.instructor_name },
    message: 'Materiala daxil ola bilərsiniz.',
  };
}

async function joinMaterialAsAuthenticatedStudent(materialId, studentId) {
  const grant = await grantMaterialAccessForStudent(studentId, materialId);
  return { ...grant, guest: false };
}

async function joinMaterialAsGuest(materialId, profile) {
  const studentId = await findOrCreateGuestStudent(profile);
  const grant = await grantMaterialAccessForStudent(studentId, materialId);
  const session = await buildGuestSessionPayload(studentId);
  return { ...session, ...grant, guest: true };
}

module.exports = {
  findOrCreateGuestStudent,
  autoGrantExamAccessForStudent,
  autoGrantTaskAccessForStudent,
  joinExamAsGuest,
  joinTaskAsGuest,
  getGroupForMaterialsInvite,
  joinGroupMaterialsAsGuest,
  getMaterialForInvite,
  grantMaterialAccessForStudent,
  joinMaterialAsAuthenticatedStudent,
  joinMaterialAsGuest,
  buildGuestSessionPayload,
};
