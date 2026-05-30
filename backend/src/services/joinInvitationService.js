const db = require('../utils/db');
const {
  applyGroupScheduleToEnrollment,
  getGroupLessonSchedule,
} = require('./studentEnrollmentsService');
const {
  canonicalStudentPhone,
  upsertStudentContactPhone,
} = require('../utils/studentPhone');
const { bakuTodayYmd } = require('../controllers/monthlyAttendanceController');

function getFrontendBaseUrl() {
  const raw =
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://mentorix.io';
  return String(raw).trim().replace(/\/+$/, '');
}

function buildInvitationLink(code) {
  const c = normalizeInvitationCode(code);
  if (!c) return null;
  return `${getFrontendBaseUrl()}/join/${encodeURIComponent(c)}`;
}

function normalizeInvitationCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function syncInvitationFieldsForGroup(groupId, joinCode) {
  const code = normalizeInvitationCode(joinCode);
  const link = buildInvitationLink(code);
  return db.query(
    `UPDATE instructor_groups
     SET invitation_code = $2,
         invitation_link = $3
     WHERE id = $1`,
    [groupId, code || null, link],
  );
}

async function findGroupByInvitationCode(code) {
  const c = normalizeInvitationCode(code);
  if (!c) return null;
  const { rows } = await db.query(
    `SELECT ig.id AS group_id,
            ig.instructor_id,
            ig.subject_id,
            ig.name AS group_name,
            ig.join_code,
            ig.invitation_code,
            ig.invitation_link,
            ig.join_code_expires_at,
            COALESCE(NULLIF(TRIM(ist.name), ''), 'Sahəsiz') AS subject_name,
            iu.full_name AS instructor_name
     FROM instructor_groups ig
     LEFT JOIN instructor_subjects ist ON ist.id = ig.subject_id
     LEFT JOIN users iu ON iu.id = ig.instructor_id
     WHERE UPPER(TRIM(COALESCE(ig.invitation_code, ig.join_code))) = $1
     LIMIT 1`,
    [c],
  );
  return rows[0] || null;
}

async function getPublicJoinInfo(code) {
  const g = await findGroupByInvitationCode(code);
  if (!g) {
    const err = new Error('Dəvət kodu tapılmadı');
    err.statusCode = 404;
    err.code = 'INVALID_CODE';
    throw err;
  }
  if (g.join_code_expires_at && new Date(g.join_code_expires_at).getTime() < Date.now()) {
    const err = new Error('Dəvət kodunun müddəti bitib');
    err.statusCode = 410;
    err.code = 'EXPIRED_CODE';
    throw err;
  }
  const inviteCode = g.invitation_code || g.join_code;
  const invitation_link = g.invitation_link || buildInvitationLink(inviteCode);
  return {
    group_id: g.group_id,
    group_name: g.group_name,
    subject_name: g.subject_name,
    instructor_name: g.instructor_name,
    invitation_code: inviteCode,
    invitation_link,
  };
}

async function notifyInstructorJoinRequest(instructorId, studentName, groupName) {
  const title = 'Yeni qoşulma sorğusu';
  const body = `${studentName} «${groupName}» qrupunuza qoşulmaq istəyir. Təsdiqləyin.`;
  await db
    .query(
      `INSERT INTO notifications (user_id, title, body, type, is_read)
       VALUES ($1, $2, $3, 'join_request', FALSE)`,
      [instructorId, title, body],
    )
    .catch(() => {});
}

async function createJoinRequest({
  studentId,
  code,
  first_name,
  last_name,
  phone_number,
  parent_name,
  parent_phone,
}) {
  const g = await findGroupByInvitationCode(code);
  if (!g) {
    const err = new Error('Dəvət kodu tapılmadı');
    err.statusCode = 404;
    err.code = 'INVALID_CODE';
    throw err;
  }
  if (g.join_code_expires_at && new Date(g.join_code_expires_at).getTime() < Date.now()) {
    const err = new Error('Dəvət kodunun müddəti bitib');
    err.statusCode = 410;
    err.code = 'EXPIRED_CODE';
    throw err;
  }

  const firstName = String(first_name || '').trim();
  const lastName = String(last_name || '').trim();
  if (!firstName || !lastName) {
    const err = new Error('Ad və soyad tələb olunur');
    err.statusCode = 400;
    throw err;
  }

  const phoneCanon = canonicalStudentPhone(phone_number);
  if (!phoneCanon) {
    const err = new Error('Telefon nömrəsi tələb olunur (+994 XX XXX XX XX)');
    err.statusCode = 400;
    throw err;
  }

  const fullName = `${firstName} ${lastName}`.trim();

  const { rows: existing } = await db.query(
    `SELECT e.id, e.status, sjr.id AS request_id, sjr.status AS request_status
     FROM enrollments e
     LEFT JOIN student_join_requests sjr ON sjr.enrollment_id = e.id
     WHERE e.student_id = $1
       AND e.group_id = $2
       AND (e.deleted_at IS NULL)
       AND COALESCE(LOWER(TRIM(e.status)), '') NOT IN ('rejected', 'left', 'archived')`,
    [studentId, g.group_id],
  );
  const prev = existing[0];
  if (prev) {
    const st = String(prev.status || '').toLowerCase();
    const reqSt = String(prev.request_status || '').toUpperCase();
    if (st === 'active' || (st === 'pending_setup' && reqSt === 'APPROVED')) {
      const err = new Error('Bu qrupa artıq qoşulmusunuz');
      err.statusCode = 409;
      err.code = 'ALREADY_JOINED';
      throw err;
    }
    if (st === 'pending_approval' && reqSt === 'PENDING') {
      const err = new Error('Sorğunuz artıq göndərilib — müəllimin təsdiqini gözləyin');
      err.statusCode = 409;
      err.code = 'ALREADY_PENDING';
      throw err;
    }
  }

  const parentName = parent_name != null ? String(parent_name).trim() : '';
  const parentPhone = parent_phone != null ? String(parent_phone).trim() : '';

  const result = await db.transaction(async (client) => {
    await client.query(`UPDATE users SET full_name = $1 WHERE id = $2`, [fullName, studentId]);
    await upsertStudentContactPhone(client, studentId, phoneCanon);

    const pr = await client.query(
      `UPDATE student_profiles SET
         parent_name = COALESCE(NULLIF($1, ''), parent_name),
         parent_phone = COALESCE(NULLIF($2, ''), parent_phone),
         phone_number = COALESCE($3, phone_number)
       WHERE user_id = $4`,
      [parentName, parentPhone, phoneCanon, studentId],
    );
    if (pr.rowCount === 0) {
      await client.query(
        `INSERT INTO student_profiles (user_id, parent_name, parent_phone, phone_number)
         VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), $4)`,
        [studentId, parentName, parentPhone, phoneCanon],
      );
    }

    const { rows: enr } = await client.query(
      `INSERT INTO enrollments (instructor_id, student_id, status, enrolled_at, subject_id, group_id)
       VALUES ($1, $2, 'pending_approval', NOW(), $3, $4)
       RETURNING id`,
      [g.instructor_id, studentId, g.subject_id || null, g.group_id],
    );
    const enrollmentId = enr[0].id;

    await applyGroupScheduleToEnrollment(enrollmentId, g.group_id).catch(() => {});

    const { rows: reqRows } = await client.query(
      `INSERT INTO student_join_requests (
         enrollment_id, instructor_id, group_id, student_id, status,
         first_name, last_name, phone_number, parent_name, parent_phone
       ) VALUES ($1, $2, $3, $4, 'PENDING', $5, $6, $7, $8, $9)
       RETURNING id, status, created_at`,
      [
        enrollmentId,
        g.instructor_id,
        g.group_id,
        studentId,
        firstName,
        lastName,
        phoneCanon,
        parentName || null,
        parentPhone || null,
      ],
    );

    return {
      enrollment_id: enrollmentId,
      request_id: reqRows[0].id,
      group: {
        id: g.group_id,
        name: g.group_name,
        subject: g.subject_name,
      },
    };
  });

  await notifyInstructorJoinRequest(g.instructor_id, fullName, g.group_name);

  return {
    ...result,
    message: 'Sorğunuz göndərildi. Müəllim təsdiqlədikdən sonra qrupa əlavə olunacaqsınız.',
    code: 'PENDING_APPROVAL',
  };
}

async function listPendingJoinRequests(instructorId) {
  const { rows } = await db.query(
    `SELECT sjr.id AS request_id,
            sjr.status,
            sjr.first_name,
            sjr.last_name,
            sjr.phone_number,
            sjr.parent_name,
            sjr.parent_phone,
            sjr.created_at,
            sjr.enrollment_id,
            e.student_id,
            u.full_name AS student_full_name,
            u.email AS student_email,
            ig.name AS group_name,
            ist.name AS subject_name
     FROM student_join_requests sjr
     JOIN enrollments e ON e.id = sjr.enrollment_id AND (e.deleted_at IS NULL)
     JOIN users u ON u.id = sjr.student_id
     JOIN instructor_groups ig ON ig.id = sjr.group_id
     LEFT JOIN instructor_subjects ist ON ist.id = ig.subject_id
     WHERE sjr.instructor_id = $1
       AND UPPER(TRIM(sjr.status)) = 'PENDING'
       AND COALESCE(LOWER(TRIM(e.status)), '') = 'pending_approval'
     ORDER BY sjr.created_at ASC`,
    [instructorId],
  );
  return rows.map((r) => ({
    request_id: r.request_id,
    enrollment_id: r.enrollment_id,
    student_id: r.student_id,
    student_name:
      r.student_full_name ||
      `${String(r.first_name || '').trim()} ${String(r.last_name || '').trim()}`.trim(),
    first_name: r.first_name,
    last_name: r.last_name,
    phone_number: r.phone_number,
    parent_name: r.parent_name,
    parent_phone: r.parent_phone,
    student_email: r.student_email,
    group_name: r.group_name,
    subject_name: r.subject_name,
    created_at: r.created_at,
    status: r.status,
  }));
}

async function countPendingJoinRequests(instructorId) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n
     FROM student_join_requests sjr
     JOIN enrollments e ON e.id = sjr.enrollment_id AND (e.deleted_at IS NULL)
     WHERE sjr.instructor_id = $1
       AND UPPER(TRIM(sjr.status)) = 'PENDING'
       AND COALESCE(LOWER(TRIM(e.status)), '') = 'pending_approval'`,
    [instructorId],
  );
  return Number(rows[0]?.n ?? 0) || 0;
}

async function getGroupEnrollmentTemplate(groupId) {
  const { rows } = await db.query(
    `SELECT billing_type,
            monthly_fee,
            billing_timing,
            payment_plan,
            lesson_weekdays,
            lesson_times,
            notifications_enabled,
            initial_payment_status,
            enrollment_start_date
     FROM enrollments
     WHERE group_id = $1
       AND (deleted_at IS NULL)
       AND COALESCE(LOWER(TRIM(status)), 'active') = 'active'
       AND configured_at IS NOT NULL
       AND billing_type IS NOT NULL
     ORDER BY configured_at DESC NULLS LAST
     LIMIT 1`,
    [groupId],
  );
  return rows[0] || null;
}

function parseLessonWeekdaysJson(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((x) => parseInt(String(x), 10)).filter((n) => n >= 1 && n <= 7))].sort(
      (a, b) => a - b,
    );
  }
  if (typeof raw === 'string') {
    try {
      return parseLessonWeekdaysJson(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return [];
}

function parseLessonTimesJson(raw, lwd) {
  if (raw == null || !lwd.length) return {};
  let o = raw;
  if (typeof raw === 'string') {
    try {
      o = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!o || typeof o !== 'object') return {};
  const out = {};
  for (const d of lwd) {
    const v = o[String(d)] ?? o[d];
    if (v != null && String(v).trim() !== '') out[String(d)] = String(v).slice(0, 5);
  }
  return out;
}

function billingLimit(bt) {
  if (bt === '8_lessons') return 8;
  if (bt === '12_lessons') return 12;
  return null;
}

/** Təsdiq: qrup şablonu varsa aktiv et, yoxdursa pending_setup + cədvəl */
async function approveJoinRequest(requestId, instructorId) {
  const { rows } = await db.query(
    `SELECT sjr.*, e.status AS enrollment_status
     FROM student_join_requests sjr
     JOIN enrollments e ON e.id = sjr.enrollment_id AND (e.deleted_at IS NULL)
     WHERE sjr.id = $1 AND sjr.instructor_id = $2
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

  const studentId = req.student_id;
  const enrollmentId = req.enrollment_id;
  const groupId = req.group_id;
  const fullName = `${String(req.first_name || '').trim()} ${String(req.last_name || '').trim()}`.trim();

  const tpl = await getGroupEnrollmentTemplate(groupId);
  const sched = await getGroupLessonSchedule(groupId);
  let lwd = tpl ? parseLessonWeekdaysJson(tpl.lesson_weekdays) : [];
  let lt = tpl ? parseLessonTimesJson(tpl.lesson_times, lwd) : {};
  if (!lwd.length) {
    lwd = sched.lesson_weekdays;
    lt = sched.lesson_times;
  }

  const enrollmentYmd = (await bakuTodayYmd()) || new Date().toISOString().slice(0, 10);
  const bt = tpl?.billing_type || '8_lessons';
  const limit = billingLimit(bt);
  const canActivate = Boolean(tpl && lwd.length && Object.keys(lt).length && limit);

  await db.transaction(async (client) => {
    await client.query(`UPDATE users SET full_name = $1 WHERE id = $2`, [fullName, studentId]);
    if (req.phone_number) {
      await upsertStudentContactPhone(client, studentId, req.phone_number);
    }
    const pr2 = await client.query(
      `UPDATE student_profiles SET
         parent_name = COALESCE(NULLIF($1, ''), parent_name),
         parent_phone = COALESCE(NULLIF($2, ''), parent_phone),
         phone_number = COALESCE($3, phone_number)
       WHERE user_id = $4`,
      [req.parent_name, req.parent_phone, req.phone_number, studentId],
    );
    if (pr2.rowCount === 0) {
      await client.query(
        `INSERT INTO student_profiles (user_id, parent_name, parent_phone, phone_number)
         VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), $4)`,
        [studentId, req.parent_name, req.parent_phone, req.phone_number],
      );
    }

    if (canActivate) {
      const billingTiming =
        String(tpl.billing_timing || '').trim().toLowerCase() === 'prepaid' ? 'prepaid' : 'postpaid';
      const paymentPlan =
        String(tpl.payment_plan || '').trim().toLowerCase() === 'partial' ? 'partial' : 'full';
      const mf = tpl.monthly_fee != null ? Number(tpl.monthly_fee) : null;
      const notif = tpl.notifications_enabled !== false;

      await client.query(
        `UPDATE enrollments SET
           billing_type = $2,
           lesson_weekdays = $3::jsonb,
           lesson_times = $4::jsonb,
           enrollment_start_date = $5::date,
           billing_timing = $6,
           payment_plan = $7,
           notifications_enabled = $8,
           initial_payment_status = COALESCE($9, initial_payment_status),
           status = 'active',
           configured_at = COALESCE(configured_at, NOW())
         WHERE id = $1`,
        [
          enrollmentId,
          bt,
          JSON.stringify(lwd),
          JSON.stringify(lt),
          enrollmentYmd,
          billingTiming,
          paymentPlan,
          notif,
          tpl.initial_payment_status || 'unpaid',
        ],
      );

      if (mf != null && Number.isFinite(mf)) {
        await client.query(
          `UPDATE student_profiles SET monthly_fee = $1 WHERE user_id = $2`,
          [mf, studentId],
        );
      }
    } else {
      await client.query(
        `UPDATE enrollments SET
           status = 'pending_setup',
           lesson_weekdays = COALESCE($2::jsonb, lesson_weekdays),
           lesson_times = COALESCE($3::jsonb, lesson_times)
         WHERE id = $1`,
        [
          enrollmentId,
          lwd.length ? JSON.stringify(lwd) : null,
          Object.keys(lt).length ? JSON.stringify(lt) : null,
        ],
      );
    }

    await client.query(
      `UPDATE student_join_requests
       SET status = 'APPROVED', resolved_at = NOW(), resolved_by = $2
       WHERE id = $1`,
      [requestId, instructorId],
    );
  });

  return {
    enrollment_id: enrollmentId,
    activated: canActivate,
    message: canActivate
      ? 'Tələbə təsdiqləndi və qrupa aktiv əlavə olundu.'
      : 'Tələbə təsdiqləndi. Paket və ödəniş quraşdırmasını tamamlayın.',
  };
}

async function rejectJoinRequest(requestId, instructorId, reason) {
  const { rows } = await db.query(
    `SELECT sjr.*, e.status AS enrollment_status
     FROM student_join_requests sjr
     JOIN enrollments e ON e.id = sjr.enrollment_id
     WHERE sjr.id = $1 AND sjr.instructor_id = $2
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
      `UPDATE student_join_requests
       SET status = 'REJECTED',
           resolved_at = NOW(),
           resolved_by = $2,
           rejection_reason = NULLIF($3, '')
       WHERE id = $1`,
      [requestId, instructorId, reason != null ? String(reason).trim() : ''],
    );
    await client.query(
      `UPDATE enrollments SET status = 'rejected' WHERE id = $1`,
      [req.enrollment_id],
    );
  });

  return { message: 'Sorğu rədd edildi' };
}

function decorateGroupInvitationFields(group) {
  if (!group) return group;
  const code = group.invitation_code || group.join_code;
  const invitation_link = group.invitation_link || buildInvitationLink(code);
  return {
    ...group,
    invitation_code: code || null,
    invitation_link: invitation_link || null,
  };
}

module.exports = {
  getFrontendBaseUrl,
  buildInvitationLink,
  normalizeInvitationCode,
  syncInvitationFieldsForGroup,
  findGroupByInvitationCode,
  getPublicJoinInfo,
  createJoinRequest,
  listPendingJoinRequests,
  countPendingJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  decorateGroupInvitationFields,
};
