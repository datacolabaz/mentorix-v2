/**
 * Live lessons held on the teacher's own Google Meet / Zoom / other HTTPS link.
 * Mentorix stores the schedule and the link, shows the link only to the lesson's teacher, its assigned
 * students and admins, sends email/in-app notices, and records manual attendance. It does not host video.
 *
 * Storage: live_rooms (extended in migration 226) so legacy room codes and /live/:roomCode URLs keep working.
 * Times are instants (timestamptz); dates/times entered in the form are Asia/Baku (UTC+4, no DST).
 */
const crypto = require('crypto');
const db = require('../utils/db');
const { validateMeetingUrl, validateResourceUrl, maskUrlsInText, normalizePlatform } = require('../lib/meetingUrl');
const { formatDateTime } = require('../utils/formatDateTime');

const BAKU_OFFSET_MS = 4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_OFFSETS = Object.freeze([15, 30, 60, 1440]);
const DEFAULT_REMINDER = 60;
const RECURRENCE_TYPES = Object.freeze(['none', 'weekly', 'weekdays', 'custom']);
const MAX_OCCURRENCES = 52;
const MAX_SERIES_DAYS = 183;
const DEFAULT_COUNT = Object.freeze({ weekly: 8, weekdays: 20, custom: 8 });
const MAX_MATERIALS = 10;
const ATTENDANCE_STATUSES = Object.freeze(['attended', 'absent', 'late', 'excused']);
const LEGACY_PROVIDER = 'mentorix_live';
const ACTIVE_ENROLLMENT_SQL = `e.deleted_at IS NULL
  AND COALESCE(LOWER(TRIM(e.status)), 'active') IN ('active', 'pending_setup', 'pending_approval')`;

const PLATFORM_NAMES = Object.freeze({ google_meet: 'Google Meet', zoom: 'Zoom', teams: 'Microsoft Teams' });

class LessonError extends Error {
  constructor(message, status = 400, code = 'VALIDATION', fields = null) {
    super(message);
    this.status = status;
    this.code = code;
    if (fields) this.fields = fields;
  }
}

/* ------------------------------------------------------------------ pure helpers */

function platformName(provider, joinUrl) {
  if (PLATFORM_NAMES[provider]) return PLATFORM_NAMES[provider];
  try {
    return new URL(String(joinUrl || '')).hostname.replace(/^www\./, '') || 'Video platforma';
  } catch {
    return 'Video platforma';
  }
}

function bakuDayNumber(ms) {
  return Math.floor((ms + BAKU_OFFSET_MS) / DAY_MS);
}

/** ISO weekday 1 (Mon) … 7 (Sun) in Baku time. */
function bakuIsoWeekday(ms) {
  const d = new Date(ms + BAKU_OFFSET_MS).getUTCDay();
  return d === 0 ? 7 : d;
}

/** 'YYYY-MM-DD' + 'HH:MM' (Baku) → Date | null */
function bakuLocalToDate(ymd, hm) {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
  const tm = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hm || '').trim());
  if (!dm || !tm) return null;
  const d = new Date(`${dm[1]}-${dm[2]}-${dm[3]}T${tm[1]}:${tm[2]}:00+04:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseInstant(raw) {
  if (raw == null || raw === '') return null;
  const d = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** End of a Baku calendar day ('YYYY-MM-DD') as epoch ms. */
function bakuEndOfDayMs(ymd) {
  const d = bakuLocalToDate(ymd, '23:59');
  return d ? d.getTime() + 59 * 1000 : null;
}

/**
 * Normalises the recurrence rule. Occurrence starts are produced by buildOccurrences.
 * @returns {{ type, count?, until?, days?, interval_weeks? }}
 */
function normalizeRecurrence(raw) {
  const r = raw && typeof raw === 'object' ? raw : { type: raw || 'none' };
  const type = String(r.type || 'none').trim().toLowerCase();
  if (!RECURRENCE_TYPES.includes(type)) throw new LessonError('Təkrarlanma növü düzgün deyil.', 400, 'RECURRENCE', ['recurrence']);
  if (type === 'none') return { type };
  const out = { type };
  if (r.until) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.until))) {
      throw new LessonError('Təkrarlanmanın bitmə tarixi düzgün deyil.', 400, 'RECURRENCE', ['recurrence']);
    }
    out.until = String(r.until);
  }
  if (r.count != null && r.count !== '') {
    const c = Number(r.count);
    if (!Number.isInteger(c) || c < 2 || c > MAX_OCCURRENCES) {
      throw new LessonError(`Dərs sayı 2 ilə ${MAX_OCCURRENCES} arasında olmalıdır.`, 400, 'RECURRENCE', ['recurrence']);
    }
    out.count = c;
  }
  if (!out.until && !out.count) out.count = DEFAULT_COUNT[type];
  if (type === 'custom') {
    const days = [...new Set((Array.isArray(r.days) ? r.days : []).map(Number))].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
    if (!days.length) throw new LessonError('Xüsusi qayda üçün ən azı bir həftə günü seçin.', 400, 'RECURRENCE', ['recurrence']);
    out.days = days.sort((a, b) => a - b);
    const iv = r.interval_weeks == null || r.interval_weeks === '' ? 1 : Number(r.interval_weeks);
    if (!Number.isInteger(iv) || iv < 1 || iv > 4) {
      throw new LessonError('Həftə intervalı 1 ilə 4 arasında olmalıdır.', 400, 'RECURRENCE', ['recurrence']);
    }
    out.interval_weeks = iv;
  }
  return out;
}

/**
 * Occurrence start instants (epoch ms). The first lesson is always the given start; later ones keep the
 * same Baku wall-clock time (no DST in Baku, so adding whole days is exact).
 */
function buildOccurrences(startMs, rule) {
  if (!rule || rule.type === 'none') return [startMs];
  const limitCount = Math.min(rule.count || MAX_OCCURRENCES, MAX_OCCURRENCES);
  const untilMs = rule.until ? bakuEndOfDayMs(rule.until) : null;
  const hardEnd = startMs + MAX_SERIES_DAYS * DAY_MS;
  const endMs = Math.min(untilMs ?? hardEnd, hardEnd);
  const out = [];
  if (rule.type === 'weekly') {
    for (let t = startMs; t <= endMs && out.length < limitCount; t += 7 * DAY_MS) out.push(t);
    return out;
  }
  const days = rule.type === 'weekdays' ? [1, 2, 3, 4, 5] : rule.days;
  const interval = rule.type === 'custom' ? rule.interval_weeks || 1 : 1;
  const startDay = bakuDayNumber(startMs);
  const startMonday = startDay - (bakuIsoWeekday(startMs) - 1);
  out.push(startMs);
  for (let t = startMs + DAY_MS; t <= endMs && out.length < limitCount; t += DAY_MS) {
    const weekIdx = Math.floor((bakuDayNumber(t) - startMonday) / 7);
    if (weekIdx % interval !== 0) continue;
    if (days.includes(bakuIsoWeekday(t))) out.push(t);
  }
  return out;
}

function cleanText(v, max) {
  const s = String(v ?? '').replace(/\u0000/g, '').trim();
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * Validates the create/update form. Pure (no DB): ownership of group/student/material is checked later.
 * @param {object} body
 * @param {{ now?: number, partial?: boolean, current?: object }} [opts]
 * @returns {object} normalised values (only keys present when partial)
 */
function validateLessonInput(body = {}, { now = Date.now(), partial = false, current = null, linkFromProvider = false } = {}) {
  const errors = {};
  const out = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

  if (!partial || has('title')) {
    const title = cleanText(body.title, 255);
    if (!title) errors.title = 'Dərsin adını yazın.';
    else out.title = title;
  }
  if (!partial || has('description')) {
    const description = cleanText(body.description, 5000);
    out.description = description || null;
  }

  if (!partial || has('group_id') || has('student_id')) {
    const groupId = body.group_id ? String(body.group_id).trim() : null;
    const studentId = body.student_id ? String(body.student_id).trim() : null;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (groupId && studentId) errors.target = 'Ya qrup, ya da fərdi tələbə seçin (ikisi birlikdə yox).';
    else if (!groupId && !studentId) errors.target = 'Qrup və ya fərdi tələbə seçin.';
    else if ((groupId && !uuid.test(groupId)) || (studentId && !uuid.test(studentId))) errors.target = 'Seçim düzgün deyil.';
    else {
      out.group_id = groupId;
      out.student_id = studentId;
    }
  }

  const timeKeys = ['starts_at', 'date', 'start_time', 'ends_at', 'end_time', 'duration_minutes'];
  if (!partial || timeKeys.some(has)) {
    let start = parseInstant(body.starts_at);
    if (!start && (body.date || body.start_time)) start = bakuLocalToDate(body.date, body.start_time);
    if (!start && partial && current?.scheduled_at) start = parseInstant(current.scheduled_at);
    if (!start) errors.starts_at = 'Tarix və başlama saatını düzgün daxil edin.';

    let end = parseInstant(body.ends_at);
    if (!end && body.end_time && start) {
      const ymd = body.date || new Date(start.getTime() + BAKU_OFFSET_MS).toISOString().slice(0, 10);
      end = bakuLocalToDate(ymd, body.end_time);
    }
    let duration = body.duration_minutes != null && body.duration_minutes !== '' ? Number(body.duration_minutes) : null;
    if (start && end) duration = Math.round((end.getTime() - start.getTime()) / 60000);
    if (start && duration == null && partial && current?.duration_minutes) duration = Number(current.duration_minutes);
    if (start && !errors.starts_at) {
      if (duration == null || !Number.isFinite(duration)) errors.ends_at = 'Bitmə saatını və ya müddəti daxil edin.';
      else if (duration <= 0) errors.ends_at = 'Bitmə saatı başlama saatından sonra olmalıdır.';
      else if (duration < 5 || duration > 600) errors.ends_at = 'Dərsin müddəti 5 dəqiqə ilə 10 saat arasında olmalıdır.';
      else if (start.getTime() < now - 10 * 60 * 1000) errors.starts_at = 'Keçmiş vaxta dərs planlamaq olmaz.';
      else {
        out.scheduled_at = start;
        out.duration_minutes = Math.round(duration);
        out.ends_at = new Date(start.getTime() + out.duration_minutes * 60000);
      }
    }
  }

  if (linkFromProvider) {
    const platform = normalizePlatform(body.platform);
    if (platform !== 'google_meet' && platform !== 'zoom') errors.meeting_url = 'Bağlı hesabla link yalnız Google Meet və ya Zoom üçün yaradılır.';
    else {
      out.provider = platform;
      out.join_url = null;
    }
  } else if (!partial || has('platform') || has('meeting_url')) {
    const platform = normalizePlatform(body.platform ?? current?.provider);
    const v = validateMeetingUrl(body.meeting_url ?? (partial ? current?.join_url : ''), platform || body.platform);
    if (!v.ok) errors.meeting_url = v.error;
    else {
      out.provider = v.platform;
      out.join_url = v.url;
    }
  }

  if (!partial || has('reminder_offset_minutes')) {
    const raw = body.reminder_offset_minutes;
    const r = raw == null || raw === '' ? DEFAULT_REMINDER : Number(raw);
    if (!REMINDER_OFFSETS.includes(r)) errors.reminder_offset_minutes = 'Xatırlatma vaxtını seçin (15 dəq, 30 dəq, 1 saat və ya 1 gün əvvəl).';
    else out.reminder_offset_minutes = r;
  }
  if (!partial || has('notify_email')) {
    out.notify_email = body.notify_email === undefined ? true : body.notify_email === true || body.notify_email === 'true';
  }

  if (!partial || has('materials')) {
    const list = Array.isArray(body.materials) ? body.materials : [];
    if (list.length > MAX_MATERIALS) errors.materials = `Ən çoxu ${MAX_MATERIALS} material əlavə etmək olar.`;
    else {
      const mats = [];
      for (const m of list) {
        if (m && m.material_id) {
          mats.push({ type: 'material', id: String(m.material_id).trim() });
          continue;
        }
        const v = validateResourceUrl(m?.url);
        if (!v.ok) {
          errors.materials = `Material linki: ${v.error}`;
          break;
        }
        mats.push({ type: 'link', title: cleanText(m.title, 200) || v.url, url: v.url });
      }
      if (!errors.materials) out.materials = mats;
    }
  }

  if (!partial && has('recurrence')) {
    try {
      out.recurrence = normalizeRecurrence(body.recurrence);
    } catch (e) {
      errors.recurrence = e.message;
    }
  } else if (!partial) {
    out.recurrence = { type: 'none' };
  }

  const keys = Object.keys(errors);
  if (keys.length) {
    throw new LessonError(errors[keys[0]], 400, 'VALIDATION', keys).withDetails(errors);
  }
  return out;
}

LessonError.prototype.withDetails = function withDetails(details) {
  this.details = details;
  return this;
};

function lessonEndMs(row) {
  const end = parseInstant(row.ends_at);
  if (end) return end.getTime();
  const start = parseInstant(row.scheduled_at || row.started_at);
  if (!start) return null;
  return start.getTime() + (Number(row.duration_minutes) || 60) * 60000;
}

/** 'cancelled' | 'legacy' | 'ended' | 'live' | 'upcoming' (computed, never stored). */
function lessonDisplayState(row, now = Date.now()) {
  if (row.status === 'cancelled' || row.cancelled_at) return 'cancelled';
  if ((row.provider || LEGACY_PROVIDER) === LEGACY_PROVIDER) return 'legacy';
  if (row.status === 'ended' && row.ended_at) return 'ended';
  const start = parseInstant(row.scheduled_at || row.started_at);
  const end = lessonEndMs(row);
  if (end != null && now > end) return 'ended';
  if (start && now >= start.getTime() - 10 * 60000) return 'live';
  return 'upcoming';
}

/**
 * API shape. The meeting link (and the teacher-only start link) is included only when the caller passed
 * canSeeLink — computed from the server-side access check, never from the client.
 */
function mapLesson(row, { canSeeLink = false, isOwner = false, attendance = null, now = Date.now() } = {}) {
  const state = lessonDisplayState(row, now);
  const showLink = canSeeLink && state !== 'cancelled' && state !== 'legacy';
  const materials = Array.isArray(row.materials) ? row.materials : [];
  return {
    id: row.id,
    room_code: row.room_code,
    title: row.title,
    description: row.description || null,
    platform: row.provider || LEGACY_PROVIDER,
    platform_name: state === 'legacy' ? 'Mentorix Live' : platformName(row.provider, row.join_url),
    starts_at: row.scheduled_at || row.started_at || null,
    ends_at: row.ends_at || (lessonEndMs(row) ? new Date(lessonEndMs(row)).toISOString() : null),
    duration_minutes: row.duration_minutes || null,
    group_id: row.group_id || null,
    group_name: row.group_name || null,
    student_id: row.student_id || null,
    student_name: row.student_name || null,
    instructor_id: row.instructor_id,
    instructor_name: row.instructor_name || null,
    reminder_offset_minutes: row.reminder_offset_minutes ?? null,
    notify_email: row.notify_email !== false,
    recurrence: row.recurrence_rule || { type: 'none' },
    series_id: row.series_id || null,
    materials: materials.map((m) => (m.type === 'link' ? { type: 'link', title: m.title, url: m.url } : { type: 'material', id: m.id, title: m.title || null })),
    state,
    cancelled_at: row.cancelled_at || null,
    cancel_reason: row.cancel_reason || null,
    is_owner: Boolean(isOwner),
    link_source: row.link_source || null,
    can_join: showLink && state !== 'ended',
    join_url: showLink ? row.join_url || null : null,
    ...(isOwner && showLink && row.start_url && row.start_url !== row.join_url ? { start_url: row.start_url } : {}),
    ...(attendance ? { my_attendance: attendance } : {}),
  };
}

function icsEscape(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function icsDate(ms) {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function foldIcsLine(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts = [];
  let cur = '';
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch, 'utf8') > (parts.length ? 74 : 75)) {
      parts.push(cur);
      cur = ch;
    } else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts.join('\r\n ');
}

/** RFC 5545 single-event calendar file. Caller must already have checked access (link included). */
function buildIcs(row, { appUrl = '', now = Date.now() } = {}) {
  const start = parseInstant(row.scheduled_at || row.started_at);
  if (!start) return null;
  const end = lessonEndMs(row) || start.getTime() + 60 * 60000;
  const lessonPage = appUrl ? `${appUrl.replace(/\/$/, '')}/live/${row.room_code}` : '';
  const desc = [row.description || '', row.join_url ? `Qoşulma linki: ${row.join_url}` : '', lessonPage ? `Mentorix: ${lessonPage}` : '']
    .filter(Boolean)
    .join('\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mentorix//Live lessons//AZ',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${row.id}@mentorix`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(start.getTime())}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(row.title || 'Canlı dərs')}`,
    desc ? `DESCRIPTION:${icsEscape(desc)}` : null,
    row.join_url ? `LOCATION:${icsEscape(row.join_url)}` : null,
    row.join_url ? `URL:${row.join_url}` : null,
    `STATUS:${row.status === 'cancelled' || row.cancelled_at ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

/* ------------------------------------------------------------------ access */

/**
 * Student visibility predicate ($1 = student id, alias lr). Single source for list + detail:
 * individual lesson → that student; group lesson → current group members; legacy room without
 * group/student → any current student of the teacher (pre-existing rule). Enrollment must be current.
 */
const STUDENT_CAN_VIEW_SQL = `EXISTS (
  SELECT 1 FROM enrollments e
  WHERE e.student_id = $1 AND e.instructor_id = lr.instructor_id AND ${ACTIVE_ENROLLMENT_SQL}
    AND (
      (lr.student_id IS NOT NULL AND lr.student_id = $1)
      OR (lr.student_id IS NULL AND lr.group_id IS NOT NULL AND e.group_id = lr.group_id)
      OR (lr.student_id IS NULL AND lr.group_id IS NULL)
    )
)`;

function isOwner(user, room) {
  return Boolean(user && room && user.role === 'instructor' && String(room.instructor_id) === String(user.id));
}

/** Can this user open the lesson page (and therefore see its link)? Parents and guests: no. */
async function canViewLesson(user, room, { client = db } = {}) {
  if (!user || !room) return false;
  if (user.role === 'admin') return true;
  if (isOwner(user, room)) return true;
  if (user.role !== 'student') return false;
  const { rows } = await client.query(`SELECT 1 FROM live_rooms lr WHERE lr.id = $2 AND ${STUDENT_CAN_VIEW_SQL} LIMIT 1`, [user.id, room.id]);
  return Boolean(rows[0]);
}

/** Students who should receive notices for the lesson. */
async function rosterStudentIds(room, { client = db } = {}) {
  if (room.student_id) {
    const { rows } = await client.query(
      `SELECT DISTINCT e.student_id FROM enrollments e
       WHERE e.student_id = $1 AND e.instructor_id = $2 AND ${ACTIVE_ENROLLMENT_SQL}`,
      [room.student_id, room.instructor_id],
    );
    return rows.map((r) => r.student_id);
  }
  if (!room.group_id) return [];
  const { rows } = await client.query(
    `SELECT DISTINCT e.student_id FROM enrollments e
     WHERE e.instructor_id = $1 AND e.group_id = $2 AND ${ACTIVE_ENROLLMENT_SQL}`,
    [room.instructor_id, room.group_id],
  );
  return rows.map((r) => r.student_id).filter(Boolean);
}

const LESSON_SELECT = `SELECT lr.*, ig.name AS group_name, u.full_name AS instructor_name, su.full_name AS student_name
  FROM live_rooms lr
  JOIN users u ON u.id = lr.instructor_id
  LEFT JOIN instructor_groups ig ON ig.id = lr.group_id
  LEFT JOIN users su ON su.id = lr.student_id`;

async function loadLessonRow({ id = null, roomCode = null }, { client = db } = {}) {
  if (id) {
    if (!/^[0-9a-f-]{36}$/i.test(String(id))) return null;
    const { rows } = await client.query(`${LESSON_SELECT} WHERE lr.id = $1 LIMIT 1`, [id]);
    return rows[0] || null;
  }
  const code = String(roomCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,12}$/.test(code)) return null;
  const { rows } = await client.query(`${LESSON_SELECT} WHERE UPPER(lr.room_code) = $1 LIMIT 1`, [code]);
  return rows[0] || null;
}

async function myAttendance(roomId, studentId) {
  const { rows } = await db.query(`SELECT status, note, marked_at FROM live_lesson_attendance WHERE room_id = $1 AND student_id = $2`, [roomId, studentId]);
  return rows[0] ? { status: rows[0].status, marked_at: rows[0].marked_at } : null;
}

/** Lesson page data. 404 for unknown rooms *and* for rooms the user cannot see (no existence leak). */
async function getLessonForUser(user, { id, roomCode }) {
  const row = await loadLessonRow({ id, roomCode });
  if (!row) throw new LessonError('Canlı dərs tapılmadı.', 404, 'NOT_FOUND');
  const allowed = await canViewLesson(user, row);
  if (!allowed) throw new LessonError('Canlı dərs tapılmadı və ya bu dərsə giriş icazəniz yoxdur.', 404, 'NOT_FOUND');
  const attendance = user.role === 'student' ? await myAttendance(row.id, user.id) : null;
  return mapLesson(row, { canSeeLink: true, isOwner: isOwner(user, row), attendance });
}

async function listLessonsForUser(user, { scope = 'upcoming', limit = 100 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const timeExpr = `COALESCE(lr.ends_at, COALESCE(lr.scheduled_at, lr.started_at, lr.created_at) + make_interval(mins => COALESCE(lr.duration_minutes, 60)))`;
  const scopeSql =
    scope === 'past' ? `AND ${timeExpr} < NOW()` : scope === 'all' ? '' : `AND ${timeExpr} >= NOW()`;
  const order = scope === 'past' ? 'DESC' : 'ASC';
  let rows;
  if (user.role === 'instructor') {
    ({ rows } = await db.query(
      `${LESSON_SELECT} WHERE lr.instructor_id = $1 ${scopeSql}
       ORDER BY COALESCE(lr.scheduled_at, lr.started_at, lr.created_at) ${order} LIMIT $2`,
      [user.id, cap],
    ));
  } else if (user.role === 'student') {
    ({ rows } = await db.query(
      `${LESSON_SELECT} WHERE lr.provider <> '${LEGACY_PROVIDER}' AND ${STUDENT_CAN_VIEW_SQL} ${scopeSql}
       ORDER BY COALESCE(lr.scheduled_at, lr.started_at, lr.created_at) ${order} LIMIT $2`,
      [user.id, cap],
    ));
  } else {
    return [];
  }
  return rows.map((r) => mapLesson(r, { canSeeLink: true, isOwner: isOwner(user, r) }));
}

/* ------------------------------------------------------------------ ownership checks */

async function assertTargetOwned(instructorId, { group_id: groupId, student_id: studentId }, client = db) {
  if (groupId) {
    const { rows } = await client.query(`SELECT id, name FROM instructor_groups WHERE id = $1 AND instructor_id = $2 LIMIT 1`, [groupId, instructorId]);
    if (!rows[0]) throw new LessonError('Qrup tapılmadı.', 404, 'GROUP_NOT_FOUND', ['target']);
    return;
  }
  const { rows } = await client.query(
    `SELECT 1 FROM enrollments e WHERE e.student_id = $1 AND e.instructor_id = $2 AND ${ACTIVE_ENROLLMENT_SQL} LIMIT 1`,
    [studentId, instructorId],
  );
  if (!rows[0]) throw new LessonError('Bu tələbə sizin tələbələriniz arasında deyil.', 404, 'STUDENT_NOT_FOUND', ['target']);
}

async function resolveMaterials(instructorId, materials, client = db) {
  const ids = materials.filter((m) => m.type === 'material').map((m) => m.id);
  if (!ids.length) return materials;
  const { rows } = await client.query(
    `SELECT id, title FROM course_materials WHERE id = ANY($1::uuid[]) AND instructor_id = $2`,
    [ids, instructorId],
  ).catch(() => ({ rows: [] }));
  const byId = new Map(rows.map((r) => [String(r.id), r.title]));
  return materials.map((m) => {
    if (m.type !== 'material') return m;
    if (!byId.has(String(m.id))) throw new LessonError('Material tapılmadı.', 404, 'MATERIAL_NOT_FOUND', ['materials']);
    return { type: 'material', id: m.id, title: byId.get(String(m.id)) };
  });
}

async function uniqueRoomCode(client) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 8; attempt += 1) {
    let code = 'MX-';
    for (let i = 0; i < 6; i += 1) code += chars[crypto.randomInt(0, chars.length)];
    // eslint-disable-next-line no-await-in-loop
    const { rows } = await client.query(`SELECT 1 FROM live_rooms WHERE room_code = $1 LIMIT 1`, [code]);
    if (!rows[0]) return code;
  }
  throw new LessonError('Dərs kodu yaradılmadı, yenidən cəhd edin.', 500, 'ROOM_CODE');
}

/* ------------------------------------------------------------------ notifications */

async function instructorName(instructorId) {
  const { rows } = await db.query(`SELECT full_name FROM users WHERE id = $1 LIMIT 1`, [instructorId]);
  return String(rows[0]?.full_name || 'Müəllim').trim();
}

/**
 * In-app notice always; email only when the lesson's "e-poçt bildirişi" toggle is on (then the user's
 * live_lesson email preference still applies). Params never include the meeting link.
 */
async function notifyRoster(eventType, room, { recipients = null, extra = {}, dedupeSuffix = '', priority } = {}) {
  const { createNotificationSafe } = require('./notificationService');
  const ids = recipients || (await rosterStudentIds(room));
  if (!ids.length) return { notified: 0 };
  const params = {
    lessonTitle: String(room.title || 'Canlı dərs').trim(),
    instructorName: await instructorName(room.instructor_id),
    startsAt: formatDateTime(room.scheduled_at, 'az'),
    platformName: platformName(room.provider, room.join_url),
    ...extra,
  };
  let notified = 0;
  for (const studentId of ids) {
    // eslint-disable-next-line no-await-in-loop
    const out = await createNotificationSafe({
      recipientId: studentId,
      category: 'live_lesson',
      eventType,
      priority,
      params,
      meta: { live_room_id: room.id, room_code: room.room_code, href: `/live/${room.room_code}` },
      relatedEntityType: 'live_lesson',
      relatedEntityId: room.id,
      providerWorkspaceId: room.instructor_id,
      actorUserId: eventType === 'live_lesson_reminder' ? null : room.instructor_id,
      dedupeKey: `${eventType}:${room.series_id && eventType === 'live_lesson_created' ? `series:${room.series_id}` : room.id}${dedupeSuffix}`,
      email: room.notify_email !== false,
    });
    if (out?.created) notified += 1;
  }
  return { notified };
}

function logLessonError(where, err) {
  console.error(`[live-lessons] ${where}`, maskUrlsInText(err?.message || err));
}

/* ------------------------------------------------------------------ create / update / cancel */

/**
 * @param {string} instructorId
 * @param {object} body  form body (see validateLessonInput)
 * @param {object} [opts]
 * @param {Function} [opts.createMeeting]  optional: async ({ title, scheduledAt, durationMinutes, provider }) →
 *   { joinUrl, startUrl, passcode, providerMeetingId, raw, connectionId } from a connected Meet/Zoom account.
 *   Called only after validation and ownership checks; single lessons only. The returned link is validated
 *   exactly like a pasted one.
 */
async function createLessons(instructorId, body, { now = Date.now(), createMeeting = null } = {}) {
  const v = validateLessonInput(body, { now, linkFromProvider: Boolean(createMeeting) });
  await assertTargetOwned(instructorId, v);
  v.materials = await resolveMaterials(instructorId, v.materials || []);
  const starts = buildOccurrences(v.scheduled_at.getTime(), v.recurrence);
  if (createMeeting && starts.length > 1) {
    throw new LessonError('Təkrarlanan dərslər üçün görüş linkini əl ilə daxil edin.', 400, 'VALIDATION', ['recurrence']);
  }
  let providerFields = null;
  if (createMeeting) {
    const meeting = await createMeeting({
      title: v.title,
      scheduledAt: v.scheduled_at.toISOString(),
      durationMinutes: v.duration_minutes,
      provider: v.provider,
    });
    const checked = validateMeetingUrl(meeting?.joinUrl, v.provider);
    if (!checked.ok) throw new LessonError('Bağlı hesabdan etibarlı görüş linki alınmadı. Linki əl ilə daxil edin.', 502, 'PROVIDER_LINK');
    v.join_url = checked.url;
    providerFields = {
      start_url: meeting.startUrl || null,
      passcode: meeting.passcode || null,
      provider_meeting_id: meeting.providerMeetingId || null,
      provider_payload: meeting.raw || {},
      connection_id: meeting.connectionId || null,
    };
  }
  const seriesId = starts.length > 1 ? crypto.randomUUID() : null;
  const rule = v.recurrence.type === 'none' ? null : { ...v.recurrence, occurrences: starts.length };

  const rows = await db.transaction(async (client) => {
    const inserted = [];
    for (const startMs of starts) {
      // eslint-disable-next-line no-await-in-loop
      const code = await uniqueRoomCode(client);
      // eslint-disable-next-line no-await-in-loop
      const { rows: r } = await client.query(
        `INSERT INTO live_rooms (
           room_code, instructor_id, group_id, student_id, title, description, status, scheduled_at, ends_at,
           duration_minutes, provider, join_url, link_source, reminder_offset_minutes, notify_email,
           recurrence_rule, series_id, materials, reminder_sent_at,
           start_url, passcode, provider_meeting_id, provider_payload, connection_id, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, 'waiting', $7, $8, $9, $10, $11, $17, $12, $13, $14::jsonb, $15, $16::jsonb, $18,
                   $19, $20, $21, $22::jsonb, $23::uuid, NOW())
         RETURNING *`,
        [
          code,
          instructorId,
          v.group_id,
          v.student_id,
          v.title,
          v.description,
          new Date(startMs),
          new Date(startMs + v.duration_minutes * 60000),
          v.duration_minutes,
          v.provider,
          v.join_url,
          v.reminder_offset_minutes,
          v.notify_email,
          rule ? JSON.stringify(rule) : null,
          seriesId,
          JSON.stringify(v.materials),
          providerFields ? 'oauth' : 'manual',
          // Created inside its own reminder window: the "new lesson" notice already covers it.
          startMs - v.reminder_offset_minutes * 60000 <= now ? new Date(now) : null,
          providerFields?.start_url ?? null,
          providerFields?.passcode ?? null,
          providerFields?.provider_meeting_id ?? null,
          JSON.stringify(providerFields?.provider_payload || {}),
          providerFields?.connection_id ?? null,
        ],
      );
      inserted.push(r[0]);
    }
    return inserted;
  });

  const first = rows[0];
  try {
    await notifyRoster('live_lesson_created', first, {
      extra: rows.length > 1 ? { recurrenceCount: String(rows.length) } : {},
    });
  } catch (e) {
    logLessonError('notify created', e);
  }
  const full = await loadLessonRow({ id: first.id });
  return { lesson: mapLesson(full, { canSeeLink: true, isOwner: true }), occurrences: rows.length, series_id: seriesId };
}

async function loadOwnedLesson(instructorId, id) {
  const row = await loadLessonRow({ id });
  if (!row || String(row.instructor_id) !== String(instructorId)) throw new LessonError('Canlı dərs tapılmadı.', 404, 'NOT_FOUND');
  if ((row.provider || LEGACY_PROVIDER) === LEGACY_PROVIDER) {
    throw new LessonError('Köhnə daxili video dərsləri redaktə edilə bilməz.', 409, 'LEGACY_LESSON');
  }
  return row;
}

const NOTIFY_ON_CHANGE = ['scheduled_at', 'duration_minutes', 'join_url', 'provider', 'title'];

/**
 * @param {'single'|'following'} scope  following = this and later lessons of the same series
 */
async function updateLesson(instructorId, id, body, { scope = 'single', now = Date.now() } = {}) {
  const current = await loadOwnedLesson(instructorId, id);
  if (current.status === 'cancelled') throw new LessonError('Ləğv edilmiş dərsi redaktə etmək olmaz.', 409, 'CANCELLED');
  const v = validateLessonInput(body, { now, partial: true, current });
  if (v.group_id !== undefined || v.student_id !== undefined) await assertTargetOwned(instructorId, v);
  if (v.materials) v.materials = await resolveMaterials(instructorId, v.materials);

  const targets =
    scope === 'following' && current.series_id
      ? (
          await db.query(
            `SELECT * FROM live_rooms WHERE series_id = $1 AND instructor_id = $2 AND scheduled_at >= $3 AND status <> 'cancelled'
             ORDER BY scheduled_at`,
            [current.series_id, instructorId, current.scheduled_at],
          )
        ).rows
      : [current];
  const deltaMs = v.scheduled_at ? v.scheduled_at.getTime() - new Date(current.scheduled_at).getTime() : 0;
  const oldRoster = await rosterStudentIds(current);

  const updated = await db.transaction(async (client) => {
    const out = [];
    for (const t of targets) {
      const start = v.scheduled_at ? new Date(new Date(t.scheduled_at).getTime() + deltaMs) : new Date(t.scheduled_at);
      const duration = v.duration_minutes ?? t.duration_minutes ?? 60;
      const timeChanged = start.getTime() !== new Date(t.scheduled_at).getTime() || duration !== t.duration_minutes;
      // eslint-disable-next-line no-await-in-loop
      const { rows } = await client.query(
        `UPDATE live_rooms SET
           title = COALESCE($2, title),
           description = CASE WHEN $3::boolean THEN $4 ELSE description END,
           group_id = CASE WHEN $5::boolean THEN $6::uuid ELSE group_id END,
           student_id = CASE WHEN $5::boolean THEN $7::uuid ELSE student_id END,
           scheduled_at = $8,
           duration_minutes = $9,
           ends_at = $10,
           provider = COALESCE($11, provider),
           join_url = COALESCE($12, join_url),
           link_source = CASE WHEN $12::text IS NOT NULL THEN 'manual' ELSE link_source END,
           reminder_offset_minutes = COALESCE($13, reminder_offset_minutes),
           notify_email = COALESCE($14, notify_email),
           materials = COALESCE($15::jsonb, materials),
           reminder_sent_at = CASE WHEN $16::boolean OR $13::int IS NOT NULL THEN NULL ELSE reminder_sent_at END,
           updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          t.id,
          v.title ?? null,
          v.description !== undefined,
          v.description ?? null,
          v.group_id !== undefined,
          v.group_id ?? null,
          v.student_id ?? null,
          start,
          duration,
          new Date(start.getTime() + duration * 60000),
          v.provider ?? null,
          v.join_url && v.join_url !== t.join_url ? v.join_url : null,
          v.reminder_offset_minutes ?? null,
          v.notify_email ?? null,
          v.materials ? JSON.stringify(v.materials) : null,
          timeChanged,
        ],
      );
      out.push(rows[0]);
    }
    return out;
  });

  const head = updated[0];
  const meaningful = NOTIFY_ON_CHANGE.some((k) => {
    if (k === 'scheduled_at') return deltaMs !== 0;
    if (k === 'duration_minutes') return v.duration_minutes != null && v.duration_minutes !== current.duration_minutes;
    if (k === 'join_url') return v.join_url && v.join_url !== current.join_url;
    if (k === 'provider') return v.provider && v.provider !== current.provider;
    return v.title && v.title !== current.title;
  });
  try {
    const newRoster = await rosterStudentIds(head);
    const removed = oldRoster.filter((sid) => !newRoster.includes(sid));
    if (removed.length) {
      await notifyRoster('live_lesson_cancelled', current, { recipients: removed, dedupeSuffix: `:moved:${Date.now()}` });
    }
    if (meaningful) {
      await notifyRoster('live_lesson_updated', head, {
        recipients: newRoster,
        extra: deltaMs !== 0 ? { previousStartsAt: formatDateTime(current.scheduled_at, 'az') } : {},
        dedupeSuffix: `:${new Date(head.updated_at).getTime()}`,
      });
    }
  } catch (e) {
    logLessonError('notify updated', e);
  }
  const full = await loadLessonRow({ id: head.id });
  return { lesson: mapLesson(full, { canSeeLink: true, isOwner: true }), updated: updated.length, notified: meaningful };
}

async function cancelLesson(instructorId, id, { reason = '', scope = 'single' } = {}) {
  const current = await loadOwnedLesson(instructorId, id);
  if (current.status === 'cancelled') return { lesson: mapLesson(current, { canSeeLink: true, isOwner: true }), cancelled: 0 };
  const why = cleanText(reason, 500) || null;
  const { rows } = await db.query(
    scope === 'following' && current.series_id
      ? `UPDATE live_rooms SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = $3, updated_at = NOW()
         WHERE series_id = $1 AND instructor_id = $2 AND scheduled_at >= $4 AND status <> 'cancelled'
         RETURNING *`
      : `UPDATE live_rooms SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = $3, updated_at = NOW()
         WHERE id = $1 AND instructor_id = $2 AND status <> 'cancelled'
         RETURNING *`,
    scope === 'following' && current.series_id
      ? [current.series_id, instructorId, why, current.scheduled_at]
      : [current.id, instructorId, why],
  );
  try {
    const head = rows.find((r) => r.id === current.id) || rows[0];
    if (head) {
      await notifyRoster('live_lesson_cancelled', head, {
        extra: {
          ...(why ? { reason: why } : {}),
          ...(rows.length > 1 ? { startsAt: `${formatDateTime(head.scheduled_at, 'az')} (+${rows.length - 1})` } : {}),
        },
        priority: 'HIGH',
      });
    }
  } catch (e) {
    logLessonError('notify cancelled', e);
  }
  const full = await loadLessonRow({ id: current.id });
  return { lesson: mapLesson(full, { canSeeLink: true, isOwner: true }), cancelled: rows.length };
}

/* ------------------------------------------------------------------ attendance (manual only) */

async function getAttendance(instructorId, id) {
  const room = await loadOwnedLesson(instructorId, id);
  const roster = await rosterStudentIds(room);
  const { rows } = await db.query(
    `SELECT u.id AS student_id, u.full_name, a.status, a.note, a.marked_at
     FROM users u
     LEFT JOIN live_lesson_attendance a ON a.room_id = $1 AND a.student_id = u.id
     WHERE u.id = ANY($2::uuid[]) OR a.room_id = $1
     ORDER BY u.full_name NULLS LAST`,
    [room.id, roster],
  );
  return rows.map((r) => ({
    student_id: r.student_id,
    full_name: r.full_name,
    status: r.status || null,
    note: r.note || null,
    marked_at: r.marked_at || null,
    in_roster: roster.includes(r.student_id),
  }));
}

async function setAttendance(instructorId, id, records) {
  const room = await loadOwnedLesson(instructorId, id);
  if (room.status === 'cancelled') throw new LessonError('Ləğv edilmiş dərs üçün iştirak qeyd edilmir.', 409, 'CANCELLED');
  const start = parseInstant(room.scheduled_at);
  if (start && start.getTime() > Date.now() + 15 * 60000) {
    throw new LessonError('İştirak dərs başlayandan sonra qeyd edilir.', 409, 'NOT_STARTED');
  }
  if (!Array.isArray(records) || !records.length || records.length > 500) {
    throw new LessonError('İştirak siyahısı boşdur.', 400, 'VALIDATION');
  }
  const roster = new Set(await rosterStudentIds(room));
  for (const r of records) {
    if (!roster.has(String(r?.student_id))) throw new LessonError('Tələbə bu dərsə təyin olunmayıb.', 400, 'NOT_IN_ROSTER');
    if (r.status !== null && !ATTENDANCE_STATUSES.includes(r.status)) {
      throw new LessonError('İştirak statusu: İştirak edib, İştirak etməyib, Gecikib və ya Üzrlü.', 400, 'VALIDATION');
    }
  }
  await db.transaction(async (client) => {
    for (const r of records) {
      if (r.status === null) {
        // eslint-disable-next-line no-await-in-loop
        await client.query(`DELETE FROM live_lesson_attendance WHERE room_id = $1 AND student_id = $2`, [room.id, r.student_id]);
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `INSERT INTO live_lesson_attendance (room_id, student_id, status, note, marked_by, marked_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (room_id, student_id)
         DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note, marked_by = EXCLUDED.marked_by, marked_at = NOW()`,
        [room.id, r.student_id, r.status, cleanText(r.note, 500) || null, instructorId],
      );
    }
  });
  return getAttendance(instructorId, id);
}

/* ------------------------------------------------------------------ calendar + reminders */

async function getLessonIcs(user, id) {
  const row = await loadLessonRow({ id });
  if (!row || !(await canViewLesson(user, row))) throw new LessonError('Canlı dərs tapılmadı.', 404, 'NOT_FOUND');
  if ((row.provider || LEGACY_PROVIDER) === LEGACY_PROVIDER) throw new LessonError('Bu dərs üçün təqvim faylı yoxdur.', 404, 'NOT_FOUND');
  const { frontendPublicUrl } = require('./email/emailConfig');
  return { filename: `mentorix-${row.room_code}.ics`, body: buildIcs(row, { appUrl: frontendPublicUrl() }) };
}

/**
 * Claims due reminders atomically (FOR UPDATE SKIP LOCKED + reminder_sent_at), so concurrent replicas never
 * double-send; the notification dedupe key includes the start instant, so a rescheduled lesson gets a new one.
 */
async function runLiveLessonReminders({ limit = 50 } = {}) {
  const { rows } = await db.query(
    `UPDATE live_rooms lr SET reminder_sent_at = NOW()
     WHERE lr.id IN (
       SELECT id FROM live_rooms
       WHERE reminder_sent_at IS NULL AND cancelled_at IS NULL AND status = 'waiting'
         AND reminder_offset_minutes IS NOT NULL AND scheduled_at IS NOT NULL
         AND provider <> '${LEGACY_PROVIDER}'
         AND scheduled_at > NOW()
         AND scheduled_at - make_interval(mins => reminder_offset_minutes) <= NOW()
       ORDER BY scheduled_at
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING lr.*`,
    [limit],
  );
  let notified = 0;
  for (const room of rows) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const out = await notifyRoster('live_lesson_reminder', room, {
        dedupeSuffix: `:${new Date(room.scheduled_at).getTime()}`,
        priority: 'HIGH',
      });
      notified += out.notified;
    } catch (e) {
      logLessonError('reminder', e);
    }
  }
  return { claimed: rows.length, notified };
}

module.exports = {
  REMINDER_OFFSETS,
  ATTENDANCE_STATUSES,
  LessonError,
  bakuLocalToDate,
  bakuIsoWeekday,
  normalizeRecurrence,
  buildOccurrences,
  validateLessonInput,
  lessonDisplayState,
  mapLesson,
  buildIcs,
  platformName,
  STUDENT_CAN_VIEW_SQL,
  canViewLesson,
  rosterStudentIds,
  getLessonForUser,
  listLessonsForUser,
  createLessons,
  updateLesson,
  cancelLesson,
  getAttendance,
  setAttendance,
  getLessonIcs,
  runLiveLessonReminders,
  notifyRoster,
};
