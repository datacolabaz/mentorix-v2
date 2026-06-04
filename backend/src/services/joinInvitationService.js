const db = require('../utils/db');
const { applyGroupScheduleToEnrollment } = require('./studentEnrollmentsService');
const {
  getGroupInviteDefaults,
  assertGroupDefaultsReady,
} = require('./groupInviteDefaults');
const { buildPackagePreview } = require('../utils/groupPaymentTerms');
const { activateEnrollmentFromGroupDefaults } = require('./enrollmentActivationService');
const {
  canonicalStudentPhone,
  upsertStudentContactPhone,
} = require('../utils/studentPhone');

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
  const defaults = await getGroupInviteDefaults(g.group_id);
  const package_offer = buildPackagePreview(defaults);
  const { rows: referralRows } = await db.query(
    `SELECT id, name, icon FROM referral_sources ORDER BY name ASC`,
  );
  return {
    group_id: g.group_id,
    group_name: g.group_name,
    subject_name: g.subject_name,
    instructor_name: g.instructor_name,
    invitation_code: inviteCode,
    invitation_link,
    package_offer,
    invite_ready: Boolean(package_offer),
    referral_sources: referralRows || [],
  };
}

async function notifyInstructorJoinRequest(instructorId, studentName, groupName) {
  const { sendEmail, userEmail } = require('./emailService');
  const title = 'Yeni qoşulma sorğusu';
  const body = `${studentName} «${groupName}» qrupunuza qoşulmaq istəyir. Təsdiqləyin.`;
  await db
    .query(
      `INSERT INTO notifications (user_id, title, body, type, is_read)
       VALUES ($1, $2, $3, 'join_request', FALSE)`,
      [instructorId, title, body],
    )
    .catch((e) => console.error('notifyInstructorJoinRequest', e.message));
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
    console.error('join request email', e.message);
  }
}

async function createJoinRequest({
  studentId,
  code,
  first_name,
  last_name,
  phone_number,
  parent_name,
  parent_phone,
  payment_terms_accepted,
  referral_source_id,
  referral_notes,
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
  const parentPhoneRaw = parent_phone != null ? String(parent_phone).trim() : '';
  const parentPhoneCanon = parentPhoneRaw ? canonicalStudentPhone(parentPhoneRaw) : null;
  if (parentPhoneRaw && !parentPhoneCanon) {
    const err = new Error('Valideyn telefonu düzgün deyil (+994 50 123 45 67)');
    err.statusCode = 400;
    throw err;
  }

  let referralSourceId = null;
  if (referral_source_id != null && String(referral_source_id).trim()) {
    const rid = String(referral_source_id).trim();
    const { rows: rs } = await db.query(`SELECT id FROM referral_sources WHERE id = $1 LIMIT 1`, [rid]);
    if (!rs[0]) {
      const err = new Error('Yönləndirmə mənbəsi seçimi düzgün deyil');
      err.statusCode = 400;
      throw err;
    }
    referralSourceId = rs[0].id;
  }
  const referralNotes = referral_notes != null ? String(referral_notes).trim().slice(0, 500) : '';

  const defaults = await getGroupInviteDefaults(g.group_id);
  const package_offer = buildPackagePreview(defaults);
  if (!package_offer) {
    const err = new Error(
      'Qrup paketi hələ tam deyil. Müəllimdən dəvət linkini yeniləməsini xahiş edin.',
    );
    err.statusCode = 400;
    err.code = 'GROUP_PACKAGE_NOT_READY';
    throw err;
  }
  if (!payment_terms_accepted) {
    const err = new Error('Ödəniş şərtləri ilə razılaşmaq üçün qutunu işarələyin');
    err.statusCode = 400;
    err.code = 'TERMS_NOT_ACCEPTED';
    throw err;
  }

  const terms_snapshot = {
    ...package_offer,
    accepted_at: new Date().toISOString(),
  };

  const result = await db.transaction(async (client) => {
    await client.query(`UPDATE users SET full_name = $1 WHERE id = $2`, [fullName, studentId]);
    await upsertStudentContactPhone(client, studentId, phoneCanon);

    const pr = await client.query(
      `UPDATE student_profiles SET
         parent_name = COALESCE(NULLIF($1, ''), parent_name),
         parent_phone = COALESCE(NULLIF($2, ''), parent_phone),
         phone_number = COALESCE($3, phone_number)
       WHERE user_id = $4`,
      [parentName, parentPhoneCanon || parentPhoneRaw || null, phoneCanon, studentId],
    );
    if (pr.rowCount === 0) {
      await client.query(
        `INSERT INTO student_profiles (user_id, parent_name, parent_phone, phone_number)
         VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), $4)`,
        [studentId, parentName, parentPhoneCanon || parentPhoneRaw || null, phoneCanon],
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
         first_name, last_name, phone_number, parent_name, parent_phone,
         payment_terms_accepted_at, terms_snapshot,
         referral_source_id, referral_notes
       ) VALUES ($1, $2, $3, $4, 'PENDING', $5, $6, $7, $8, $9, NOW(), $10::jsonb, $11, $12)
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
        parentPhoneCanon || parentPhoneRaw || null,
        JSON.stringify(terms_snapshot),
        referralSourceId,
        referralNotes || null,
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
            ist.name AS subject_name,
            ig.default_billing_type,
            ig.default_package_fee,
            ig.default_lesson_weekdays,
            ig.default_lesson_times,
            sjr.referral_source_id,
            sjr.referral_notes,
            rs.name AS referral_source_name
     FROM student_join_requests sjr
     JOIN enrollments e ON e.id = sjr.enrollment_id AND (e.deleted_at IS NULL)
     JOIN users u ON u.id = sjr.student_id
     JOIN instructor_groups ig ON ig.id = sjr.group_id
     LEFT JOIN instructor_subjects ist ON ist.id = ig.subject_id
     LEFT JOIN referral_sources rs ON rs.id = sjr.referral_source_id
     WHERE sjr.instructor_id = $1
       AND UPPER(TRIM(sjr.status)) = 'PENDING'
       AND COALESCE(LOWER(TRIM(e.status)), '') = 'pending_approval'
     ORDER BY sjr.created_at ASC`,
    [instructorId],
  );
  const { rowToDefaults } = require('./groupInviteDefaults');
  return rows.map((r) => {
    const def = rowToDefaults(r);
    const pack =
      def?.billing_type === '12_lessons' ? '12 dərs' : def?.billing_type === '8_lessons' ? '8 dərs' : null;
    const fee =
      def?.package_fee != null && Number.isFinite(def.package_fee) ? `${def.package_fee} AZN` : null;
    return {
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
      referral_source_id: r.referral_source_id,
      referral_source_name: r.referral_source_name,
      referral_notes: r.referral_notes,
      student_email: r.student_email,
      group_name: r.group_name,
      subject_name: r.subject_name,
      package_label: pack,
      package_fee: fee,
      created_at: r.created_at,
      status: r.status,
    };
  });
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

/** Təsdiq: qrupun paket/cədvəl/qiymətini tətbiq et → aktiv tələbə + 1-ci ödəniş dövrü */
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

  const defaults = await getGroupInviteDefaults(groupId);
  assertGroupDefaultsReady(defaults);

  try {
    await db.transaction(async (client) => {
      await client.query(`UPDATE users SET full_name = $1 WHERE id = $2`, [fullName, studentId]);
      if (req.phone_number) {
        await upsertStudentContactPhone(client, studentId, req.phone_number);
      }

      await activateEnrollmentFromGroupDefaults(client, {
        enrollmentId,
        studentId,
        instructorId,
        groupId: defaults.group_id,
        subjectId: defaults.subject_id,
        defaults,
        referral_source_id: req.referral_source_id,
        referral_notes: req.referral_notes,
        studentProfile: {
          parent_name: req.parent_name,
          parent_phone: req.parent_phone,
        },
      });

      await client.query(
        `UPDATE student_join_requests
         SET status = 'APPROVED', resolved_at = NOW(), resolved_by = $2
         WHERE id = $1`,
        [requestId, instructorId],
      );
    });
  } catch (err) {
    if (err.code === 'LESSON_CONFLICT') {
      err.statusCode = 409;
    }
    throw err;
  }

  const packLabel = defaults.billing_type === '12_lessons' ? '12 dərs' : '8 dərs';
  const fee =
    defaults.package_fee != null && Number.isFinite(defaults.package_fee)
      ? `${defaults.package_fee} AZN`
      : '';

  return {
    enrollment_id: enrollmentId,
    activated: true,
    message: fee
      ? `Tələbə təsdiqləndi: ${packLabel}, ${fee}, qrup cədvəli tətbiq olundu.`
      : `Tələbə təsdiqləndi: ${packLabel} paketi və qrup cədvəli tətbiq olundu.`,
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
