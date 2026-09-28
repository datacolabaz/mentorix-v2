'use strict';

const db = require('../utils/db');
const { findGroupByInvitationCode } = require('./joinInvitationService');
const { getGroupForMaterialsInvite } = require('./guestAccessService');
const { matchSharePath, buildSharePreview, isUuid } = require('./sharePreviewRules');

function shareSiteOrigin() {
  return String(
    process.env.PUBLIC_SITE_ORIGIN || process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || 'https://mentorix.io',
  ).replace(/\/+$/, '');
}

async function one(sql, params) {
  const { rows } = await db.query(sql, params);
  return rows[0] || null;
}

async function loadExam({ examId }) {
  if (!isUuid(examId)) return null;
  const row = await one(
    `SELECT e.title, e.subject, e.duration_minutes, e.available_from,
            (SELECT COUNT(*) FROM exam_questions q WHERE q.exam_id = e.id)::int AS question_count
     FROM exams e
     WHERE e.id = $1::uuid AND COALESCE(e.is_deleted, FALSE) = FALSE
     LIMIT 1`,
    [examId],
  );
  if (!row) return null;
  return {
    title: row.title,
    subject: row.subject,
    questionCount: row.question_count,
    durationMinutes: row.duration_minutes,
    startsAt: row.available_from,
  };
}

async function loadTask({ taskId }) {
  if (!isUuid(taskId)) return null;
  const row = await one(
    `SELECT a.title, to_char(a.due_date, 'YYYY-MM-DD') AS due_day
     FROM assignments a
     WHERE a.id = $1::uuid
     LIMIT 1`,
    [taskId],
  );
  return row ? { title: row.title, dueDay: row.due_day } : null;
}

async function loadMaterial({ materialId, shareToken }) {
  let row = null;
  if (materialId) {
    if (!isUuid(materialId)) return null;
    row = await one(
      `SELECT cm.title, cm.file_type, cm.original_filename, isub.name AS subject_name
       FROM course_materials cm
       LEFT JOIN instructor_subjects isub ON isub.id = cm.subject_id
       WHERE cm.id = $1::uuid
       LIMIT 1`,
      [materialId],
    );
  } else if (shareToken) {
    row = await one(
      `SELECT cm.title, cm.file_type, cm.original_filename, isub.name AS subject_name
       FROM course_materials cm
       LEFT JOIN instructor_subjects isub ON isub.id = cm.subject_id
       WHERE cm.share_token = $1 AND cm.is_shared = TRUE
       LIMIT 1`,
      [shareToken],
    );
  }
  if (!row) return null;
  return {
    title: row.title,
    fileType: row.file_type,
    fileName: row.original_filename,
    subject: row.subject_name,
  };
}

async function loadLive({ guestToken, recordingToken }) {
  if (guestToken) {
    const row = await one(
      `SELECT r.title, r.started_at, r.created_at
       FROM live_guest_invites i
       JOIN live_rooms r ON r.id = i.room_id
       WHERE i.token = $1
         AND i.revoked_at IS NULL
         AND i.expires_at > NOW()
         AND r.status <> 'ended'
       LIMIT 1`,
      [guestToken],
    );
    return row ? { title: row.title, at: row.started_at || null } : { recording: false };
  }
  if (recordingToken) {
    const row = await one(
      `SELECT r.title, lr.created_at
       FROM live_recordings lr
       JOIN live_rooms r ON r.id = lr.room_id
       WHERE lr.share_token = $1
       LIMIT 1`,
      [recordingToken],
    );
    return row ? { title: row.title, at: row.created_at, recording: true } : { recording: true };
  }
  return null;
}

async function publicTeacherName(instructorId) {
  if (!instructorId) return '';
  const row = await one(
    `SELECT u.full_name
     FROM users u
     JOIN instructor_profiles ip ON ip.user_id = u.id
     WHERE u.id = $1
       AND u.role = 'instructor'
       AND COALESCE(u.is_active, TRUE) = TRUE
       AND u.deleted_at IS NULL
       AND COALESCE(ip.map_visible, TRUE) = TRUE
     LIMIT 1`,
    [instructorId],
  );
  return row?.full_name || '';
}

async function loadGroup({ groupId, code }) {
  if (code) {
    const g = await findGroupByInvitationCode(code);
    if (!g) return null;
    if (g.join_code_expires_at && new Date(g.join_code_expires_at).getTime() < Date.now()) return null;
    return {
      name: g.group_name,
      subject: g.subject_name === 'Sahəsiz' ? '' : g.subject_name,
      publicTeacherName: await publicTeacherName(g.instructor_id),
    };
  }
  if (groupId) {
    if (!isUuid(groupId)) return null;
    const g = await getGroupForMaterialsInvite(groupId);
    if (!g) return null;
    return {
      name: g.name,
      subject: g.subject_name,
      publicTeacherName: g.instructor_id ? await publicTeacherName(g.instructor_id) : '',
    };
  }
  return null;
}

async function loadTeacher({ teacherId }) {
  if (!isUuid(teacherId)) return null;
  const row = await one(
    `SELECT u.full_name,
            NULLIF(TRIM(ip.subject), '') AS subject,
            ip.experience_years,
            COALESCE(NULLIF(TRIM(ip.discover_bio), ''), NULLIF(TRIM(ip.bio), '')) AS bio
     FROM users u
     JOIN instructor_profiles ip ON ip.user_id = u.id
     WHERE u.id = $1
       AND u.role = 'instructor'
       AND COALESCE(u.is_active, TRUE) = TRUE
       AND u.deleted_at IS NULL
       AND COALESCE(ip.map_visible, TRUE) = TRUE
     LIMIT 1`,
    [teacherId],
  );
  if (!row) return null;
  const years = Number(row.experience_years);
  const bioFirstSentence = String(row.bio || '').split(/(?<=[.!?])\s/)[0];
  return {
    name: row.full_name,
    subjects: row.subject,
    headline: years > 0 ? `${years} il təcrübə` : bioFirstSentence,
  };
}

const CATALOG_EXAM_WHERE = `
  e.is_public = TRUE
  AND e.is_verified = TRUE
  AND COALESCE(e.is_deleted, FALSE) = FALSE
  AND e.certificate_enabled = TRUE
`;

async function loadCertified({ categorySlug, examSlug }) {
  if (categorySlug && examSlug) {
    const row = await one(
      `SELECT e.title, e.certificate_pass_pct
       FROM exams e
       LEFT JOIN exam_categories ec ON ec.id = e.category_id
       LEFT JOIN exam_categories parent ON parent.id = ec.parent_id
       WHERE e.slug = $1 AND ${CATALOG_EXAM_WHERE} AND (ec.slug = $2 OR parent.slug = $2)
       LIMIT 1`,
      [examSlug, categorySlug],
    );
    return row ? { title: row.title, passPct: Number(row.certificate_pass_pct) || 70 } : null;
  }
  if (categorySlug) {
    const row = await one(`SELECT name FROM exam_categories WHERE slug = $1 LIMIT 1`, [categorySlug]);
    return row ? { title: row.name } : null;
  }
  return null;
}

const LOADERS = {
  exam: loadExam,
  task: loadTask,
  material: loadMaterial,
  live: loadLive,
  group: loadGroup,
  teacher: loadTeacher,
  certified: loadCertified,
};

async function resolveSharePreview(rawPath, { now = new Date() } = {}) {
  const match = matchSharePath(rawPath);
  let data = null;
  const loader = LOADERS[match.kind];
  if (loader && !match.invalid) {
    try {
      data = await loader(match.params);
    } catch (err) {
      console.warn('[share-preview]', match.kind, err?.message);
      data = null;
    }
  }
  return buildSharePreview({ kind: match.kind, path: match.path, data, siteOrigin: shareSiteOrigin(), now });
}

module.exports = { resolveSharePreview, shareSiteOrigin };
