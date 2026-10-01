/**
 * Bildirişdən açılan linkin həlli + server tərəfində icazənin YENİDƏN yoxlanması.
 * Bildiriş özü heç bir icazə vermir: hədəf obyektə hazırkı istifadəçinin indi çıxışı
 * yoxdursa `href: null, status: 'forbidden'` qaytarılır (məs. qrupdan çıxarılıb).
 * Hədəf səhifələr öz API icazə yoxlamalarını ayrıca edir.
 */
const db = require('../utils/db');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROLE_PATH_PREFIX = Object.freeze({
  admin: '/admin',
  instructor: '/instructor',
  student: '/student',
  parent: '/parent',
  course: '/org',
});

function parseMeta(meta) {
  if (!meta) return {};
  if (typeof meta === 'object') return meta;
  try {
    return JSON.parse(meta);
  } catch {
    return {};
  }
}

function uuidOrNull(v) {
  const s = String(v || '').trim();
  return UUID_RE.test(s) ? s : null;
}

/** Bildiriş sətrindən hədəf obyekt (yeni sütunlar → köhnə meta/type). */
function targetFor(notification) {
  const type = String(notification?.type || '').toLowerCase();
  const meta = parseMeta(notification?.meta);
  const entityType = String(notification?.related_entity_type || '').toLowerCase();
  const entityId = uuidOrNull(notification?.related_entity_id);
  if (entityType && entityId) return { kind: entityType, id: entityId };

  if (type === 'join_request') return { kind: 'join_requests' };
  if (type === 'exam_access_request' || type === 'task_access_request') return { kind: 'join_requests' };
  if (type === 'partner_payout_paid' || type.startsWith('partner_')) return { kind: 'partner' };
  if (type.startsWith('billing_') || type === 'payment' || type === 'payment_confirmed' || type === 'student_limit_block') {
    return { kind: 'billing' };
  }
  if (type.startsWith('storage_limit_')) return { kind: 'storage' };
  if (type === 'weekly_teacher_digest') return { kind: 'digest' };
  if (uuidOrNull(meta.assignment_id)) return { kind: 'assignment', id: uuidOrNull(meta.assignment_id) };
  if (uuidOrNull(meta.material_id)) return { kind: 'material', id: uuidOrNull(meta.material_id) };
  if (uuidOrNull(meta.exam_id)) return { kind: 'exam', id: uuidOrNull(meta.exam_id) };
  if (type.startsWith('assignment_')) return { kind: 'assignment_list' };
  if (typeof meta.href === 'string' && meta.href) return { kind: 'href', href: meta.href };
  return null;
}

/** Köhnə `meta.href` yalnız daxili, rola uyğun yol olduqda qəbul edilir. */
function safeLegacyHref(href, role) {
  const h = String(href || '').trim();
  if (!h.startsWith('/') || h.startsWith('//') || h.includes('\\') || /[\r\n]/.test(h)) return null;
  const pathOnly = h.split(/[?#]/)[0];
  const rolePrefix = ROLE_PATH_PREFIX[role];
  const allPrefixes = Object.values(ROLE_PATH_PREFIX);
  const hit = allPrefixes.find((p) => pathOnly === p || pathOnly.startsWith(`${p}/`));
  if (hit) return hit === rolePrefix ? h : null;
  if (pathOnly === '/notifications' || pathOnly.startsWith('/settings/')) return h;
  return null;
}

const ok = (href) => ({ href, status: 'ok' });
const FORBIDDEN = Object.freeze({ href: null, status: 'forbidden' });
const NOT_FOUND = Object.freeze({ href: null, status: 'not_found' });
const NONE = Object.freeze({ href: null, status: 'none' });

async function exists(q, sql, params) {
  const { rows } = await q.query(sql, params);
  return Boolean(rows[0]);
}

async function resolveAssignment(q, id, user) {
  const { rows } = await q.query(`SELECT id, instructor_id FROM assignments WHERE id = $1 LIMIT 1`, [id]);
  const a = rows[0];
  if (!a) return NOT_FOUND;
  if (user.role === 'instructor') {
    return String(a.instructor_id) === String(user.id) ? ok('/instructor/tasks') : FORBIDDEN;
  }
  if (user.role === 'student') {
    const mine = await exists(
      q,
      `SELECT 1 FROM student_assignments WHERE assignment_id = $1 AND student_id = $2 LIMIT 1`,
      [id, user.id],
    );
    return mine ? ok('/student/assignments') : FORBIDDEN;
  }
  return FORBIDDEN;
}

async function resolveStudentAssignment(q, id, user) {
  const { rows } = await q.query(
    `SELECT sa.student_id, a.instructor_id
     FROM student_assignments sa
     JOIN assignments a ON a.id = sa.assignment_id
     WHERE sa.id = $1 LIMIT 1`,
    [id],
  );
  const r = rows[0];
  if (!r) return NOT_FOUND;
  if (user.role === 'instructor' && String(r.instructor_id) === String(user.id)) return ok('/instructor/tasks');
  if (user.role === 'student' && String(r.student_id) === String(user.id)) return ok('/student/assignments');
  return FORBIDDEN;
}

async function resolveExam(q, id, user) {
  const { rows } = await q.query(
    `SELECT id, instructor_id, COALESCE(is_deleted, FALSE) AS is_deleted FROM exams WHERE id = $1 LIMIT 1`,
    [id],
  );
  const e = rows[0];
  if (!e || e.is_deleted) return NOT_FOUND;
  if (user.role === 'instructor') {
    return String(e.instructor_id) === String(user.id) ? ok('/instructor/exams') : FORBIDDEN;
  }
  if (user.role === 'student') {
    const mine = await exists(
      q,
      `SELECT 1 FROM exam_assignments WHERE exam_id = $1 AND student_id = $2
       UNION ALL
       SELECT 1 FROM exam_results WHERE exam_id = $1 AND student_id = $2
       LIMIT 1`,
      [id, user.id],
    );
    return mine ? ok('/student/exams') : FORBIDDEN;
  }
  if (user.role === 'parent') {
    const child = await exists(
      q,
      `SELECT 1 FROM exam_assignments ea
       JOIN student_profiles sp ON sp.user_id = ea.student_id
       WHERE ea.exam_id = $1 AND sp.parent_id = $2
       LIMIT 1`,
      [id, user.id],
    );
    return child ? ok('/parent') : FORBIDDEN;
  }
  return FORBIDDEN;
}

async function resolveLiveLesson(q, id, user) {
  const { rows } = await q.query(`SELECT * FROM live_rooms WHERE id = $1 LIMIT 1`, [id]);
  const room = rows[0];
  if (!room) return NOT_FOUND;
  const { canViewLesson } = require('./liveLessonService');
  return (await canViewLesson(user, room, { client: q })) ? ok(`/live/${encodeURIComponent(room.room_code)}`) : FORBIDDEN;
}

async function resolveCertificate(q, id, user) {
  const { rows } = await q.query(`SELECT student_id, instructor_id FROM certificates WHERE id = $1 LIMIT 1`, [id]);
  const c = rows[0];
  if (!c) return NOT_FOUND;
  if (user.role === 'student' && String(c.student_id) === String(user.id)) return ok('/student/certificates');
  if (user.role === 'instructor' && String(c.instructor_id) === String(user.id)) return ok('/instructor/certificates');
  return FORBIDDEN;
}

async function resolveMaterial(q, id, user) {
  const { rows } = await q.query(`SELECT * FROM course_materials WHERE id = $1 LIMIT 1`, [id]);
  const m = rows[0];
  if (!m) return NOT_FOUND;
  if (user.role === 'instructor') {
    return String(m.instructor_id) === String(user.id) ? ok('/instructor/materials') : FORBIDDEN;
  }
  if (user.role === 'student') {
    const { studentCanAccessMaterial } = require('./courseMaterialsService');
    return (await studentCanAccessMaterial(user.id, m)) ? ok('/student/materials') : FORBIDDEN;
  }
  return FORBIDDEN;
}

async function resolveGroup(q, id, user) {
  const { rows } = await q.query(`SELECT id, instructor_id FROM instructor_groups WHERE id = $1 LIMIT 1`, [id]);
  const g = rows[0];
  if (!g) return NOT_FOUND;
  if (user.role === 'instructor') {
    return String(g.instructor_id) === String(user.id) ? ok('/instructor/teaching-groups') : FORBIDDEN;
  }
  if (user.role === 'student') {
    const mine = await exists(
      q,
      `SELECT 1 FROM enrollments WHERE group_id = $1 AND student_id = $2 LIMIT 1`,
      [id, user.id],
    );
    return mine ? ok('/student/groups') : FORBIDDEN;
  }
  return FORBIDDEN;
}

async function resolveOwnedRequest(q, table, id, user) {
  const { rows } = await q.query(`SELECT instructor_id FROM ${table} WHERE id = $1 LIMIT 1`, [id]);
  const r = rows[0];
  if (!r) return NOT_FOUND;
  return user.role === 'instructor' && String(r.instructor_id) === String(user.id)
    ? ok('/instructor/join-requests')
    : FORBIDDEN;
}

async function resolvePartner(q, user) {
  const partner = await exists(q, `SELECT 1 FROM partners WHERE user_id = $1 LIMIT 1`, [user.id]);
  return partner ? ok('/partner/dashboard') : FORBIDDEN;
}

function resolveBilling(user) {
  if (user.role === 'instructor') return ok('/instructor/payments');
  if (user.role === 'student') return ok('/student/payments');
  if (user.role === 'admin') return ok('/admin/billing');
  return NONE;
}

/**
 * @param {object} notification  alıcıya məxsus sətir (çağıran artıq `user_id = user.id` ilə yükləyib)
 * @param {{ id: string, role: string|null }} user
 * @returns {Promise<{ href: string|null, status: 'ok'|'forbidden'|'not_found'|'none' }>}
 */
async function resolveNotificationLink(notification, user, opts = {}) {
  const q = opts.client || db;
  if (!notification || !user?.id) return FORBIDDEN;
  if (String(notification.user_id) !== String(user.id)) return FORBIDDEN;

  const target = targetFor(notification);
  if (!target) return NONE;

  switch (target.kind) {
    case 'assignment':
      return resolveAssignment(q, target.id, user);
    case 'student_assignment':
      return resolveStudentAssignment(q, target.id, user);
    case 'exam':
      return resolveExam(q, target.id, user);
    case 'material':
      return resolveMaterial(q, target.id, user);
    case 'group':
      return resolveGroup(q, target.id, user);
    case 'join_request':
      return resolveOwnedRequest(q, 'student_join_requests', target.id, user);
    case 'exam_access_request':
      return resolveOwnedRequest(q, 'exam_access_requests', target.id, user);
    case 'task_access_request':
      return resolveOwnedRequest(q, 'task_access_requests', target.id, user);
    case 'join_requests':
      return user.role === 'instructor' ? ok('/instructor/join-requests') : FORBIDDEN;
    case 'assignment_list':
      if (user.role === 'student') return ok('/student/assignments');
      if (user.role === 'instructor') return ok('/instructor/tasks');
      return NONE;
    case 'partner':
    case 'partner_payout':
      if (user.role === 'admin') return ok('/admin/partners');
      return resolvePartner(q, user);
    case 'billing':
      return resolveBilling(user);
    case 'storage':
      return user.role === 'instructor' ? ok('/instructor/payments#storage') : NONE;
    case 'digest':
      return user.role === 'instructor' ? ok('/instructor/analytics') : NONE;
    case 'live_lesson':
      return resolveLiveLesson(q, target.id, user);
    case 'certificate':
      return resolveCertificate(q, target.id, user);
    case 'href': {
      const href = safeLegacyHref(target.href, user.role);
      return href ? ok(href) : FORBIDDEN;
    }
    default:
      return NONE;
  }
}

module.exports = { resolveNotificationLink, targetFor, safeLegacyHref };
