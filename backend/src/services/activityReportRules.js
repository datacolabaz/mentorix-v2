/**
 * Aktivlik hesabatı qaydaları (DB-dən asılı deyil): filtrlər, səhifələmə, xatırlatma kimə gedir, mesaj mətni.
 * Kart rəqəmləri (summarize*) və hesabat sətirləri eyni tələbə sətirlərindən hesablanır;
 * CARD_FILTER_PARITY hansı kart rəqəminin hansı filtrin sətir sayına bərabər olduğunu göstərir (test bunu yoxlayır).
 */

const { MATERIAL_FILTERS, ASSIGNMENT_FILTERS } = require('./engagementRules');
const { EXAM_FILTERS } = require('./activityStatusRules');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENTITY_TYPES = Object.freeze(['material', 'assignment', 'exam']);
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const MAX_QUERY_LENGTH = 100;

const REPORT_FILTERS = Object.freeze({
  material: Object.freeze({
    ...MATERIAL_FILTERS,
    in_progress: (s) => s.status === 'in_progress',
  }),
  assignment: Object.freeze({
    ...ASSIGNMENT_FILTERS,
    viewed: (s) => s.opened,
    not_viewed: (s) => !s.opened,
    started: (s) => s.started || s.submitted,
    in_progress: (s) => s.status === 'started',
  }),
  exam: Object.freeze({
    ...EXAM_FILTERS,
    submitted: (s) => s.completed,
    not_submitted: (s) => !s.completed,
  }),
});

/** Kart sahəsi → filtr (null = filtrsiz, bütün sətirlər). */
const CARD_FILTER_PARITY = Object.freeze({
  material: Object.freeze({
    assigned: null,
    viewed: 'viewed',
    not_viewed: 'not_viewed',
    completed: 'completed',
    overdue: 'overdue',
    unique_downloaders: 'downloaded',
  }),
  assignment: Object.freeze({
    assigned: null,
    opened: 'viewed',
    not_opened: 'not_opened',
    started: 'started',
    submitted: 'submitted',
    not_submitted: 'not_submitted',
    pending_review: 'waiting_grading',
    graded: 'graded',
    overdue: 'overdue',
    returned: 'returned',
    late_submitted: 'late',
  }),
  exam: Object.freeze({
    assigned: null,
    viewed: 'viewed',
    started: 'started',
    in_progress: 'in_progress',
    inactive: 'inactive',
    completed: 'completed',
    expired: 'expired',
    not_started: 'not_started',
    pending_manual_grading: 'pending_manual_grading',
  }),
});

function toDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** «YYYY-MM-DD» Bakı günü kimi oxunur (UTC+4): from — günün başlanğıcı, to — sonu. */
function parseBoundary(raw, edge) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return toDate(`${s}T${edge === 'from' ? '00:00:00.000' : '23:59:59.999'}+04:00`);
  }
  return toDate(s);
}

function positiveInt(raw, fallback, max) {
  const n = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return max ? Math.min(n, max) : n;
}

/**
 * HTTP query → təhlükəsiz hesabat sorğusu. Naməlum dəyərlər sakitcə atılır.
 * Səhifələmə yalnız ?page= verildikdə tətbiq olunur (popover bütün siyahını alır).
 */
function parseReportQuery(raw = {}, type) {
  const filters = REPORT_FILTERS[type] || {};
  const filter = raw.filter && Object.prototype.hasOwnProperty.call(filters, raw.filter) ? String(raw.filter) : null;
  const status = raw.status && /^[a-z_]{2,40}$/.test(String(raw.status)) ? String(raw.status) : null;
  const group = raw.group && UUID_RE.test(String(raw.group)) ? String(raw.group) : null;
  const q = String(raw.q ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH) || null;
  const from = parseBoundary(raw.from, 'from');
  const to = parseBoundary(raw.to, 'to');
  const paginate = raw.page != null && raw.page !== '';
  return {
    filter,
    status,
    group,
    q,
    from,
    to,
    paginate,
    page: paginate ? positiveInt(raw.page, 1) : 1,
    pageSize: paginate ? positiveInt(raw.page_size, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE) : null,
  };
}

function matchesText(student, q) {
  if (!q) return true;
  return String(student.full_name || '').toLocaleLowerCase('az').includes(q.toLocaleLowerCase('az'));
}

function inRange(iso, from, to) {
  if (!from && !to) return true;
  const d = toDate(iso);
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

/**
 * Filtr + səhifələmə. total = filtrdən sonrakı sətir sayı (kartdakı uyğun rəqəmə bərabər).
 * @returns {{ rows: object[], total: number, page: number, page_size: number|null, total_pages: number }}
 */
function applyReportQuery(students, query, type) {
  const list = Array.isArray(students) ? students : [];
  const q = query || {};
  const fn = q.filter ? REPORT_FILTERS[type]?.[q.filter] : null;
  const filtered = list.filter(
    (s) =>
      (!fn || fn(s)) &&
      (!q.status || s.status === q.status || s.progress_status === q.status) &&
      (!q.group || (s.groups || []).some((g) => String(g.id) === q.group)) &&
      matchesText(s, q.q) &&
      inRange(s.last_activity_at, q.from, q.to),
  );
  const total = filtered.length;
  if (!q.paginate) return { rows: filtered, total, page: 1, page_size: null, total_pages: 1 };
  const totalPages = Math.max(1, Math.ceil(total / q.pageSize));
  const page = Math.min(q.page, totalPages);
  const start = (page - 1) * q.pageSize;
  return { rows: filtered.slice(start, start + q.pageSize), total, page, page_size: q.pageSize, total_pages: totalPages };
}

function earliestIso(values) {
  const ds = values.map(toDate).filter(Boolean);
  if (!ds.length) return null;
  return new Date(Math.min(...ds.map((d) => d.getTime()))).toISOString();
}

/**
 * Hesabat sətrinə ilk aktivlik, hadisə sayı və qrupları əlavə edir.
 * logStats: student_activity_log aqreqatı (bu obyekt üzrə); jurnaldan əvvəlki köhnə məlumat üçün
 * irəliləyiş sətrindəki ilk vaxt saxlanılır (first_activity_at).
 * Son aktivlik dəyişdirilmir: kartdakı «Son aktivlik» ilə eyni mənbədən (irəliləyiş cədvəli) qalır.
 */
function enrichReportRow(row, { logStats = null, groups = [] } = {}) {
  return {
    ...row,
    first_activity_at: earliestIso([row.first_activity_at, logStats?.first_activity_at]),
    activity_count: Number(logStats?.activity_count) || 0,
    groups,
  };
}

/* ------------------------------------------------------------------ */
/* Reminders                                                           */
/* ------------------------------------------------------------------ */

/** Kimə xatırlatma getməlidir: material — baxmayanlar; tapşırıq — təqdim etməyənlər; imtahan — başlamayanlar. */
function reminderEligibleFor(entityType, s) {
  if (entityType === 'material') return !s.viewed;
  if (entityType === 'assignment') return !s.submitted;
  if (entityType === 'exam') return !s.started && !s.expired && !s.completed;
  return false;
}

/** Eyni tələbəyə eyni material/tapşırıq üçün bu müddətdə ikinci xatırlatma getmir (əl ilə və avtomatik). */
const REMINDER_COOLDOWN_HOURS = 6;

const REMINDER_NOTIFICATION_TYPES = Object.freeze({
  material: 'material_reminder',
  assignment: 'assignment_reminder',
  exam: 'exam_reminder',
});

const REMINDER_LOCALES = Object.freeze(['az', 'en', 'ru']);

const REMINDER_COPY = Object.freeze({
  az: Object.freeze({
    title: 'Xatırlatma',
    material: (t) => `Müəlliminiz «${t}» materialına baxmağınızı xatırladır.`,
    assignment: (t) => `Müəlliminiz «${t}» tapşırığını təqdim etməyinizi xatırladır.`,
    exam: (t) => `Müəlliminiz «${t}» imtahanına başlamağınızı xatırladır.`,
  }),
  en: Object.freeze({
    title: 'Reminder',
    material: (t) => `Your teacher is reminding you to view the material “${t}”.`,
    assignment: (t) => `Your teacher is reminding you to submit the assignment “${t}”.`,
    exam: (t) => `Your teacher is reminding you to start the exam “${t}”.`,
  }),
  ru: Object.freeze({
    title: 'Напоминание',
    material: (t) => `Преподаватель напоминает вам просмотреть материал «${t}».`,
    assignment: (t) => `Преподаватель напоминает вам сдать задание «${t}».`,
    exam: (t) => `Преподаватель напоминает вам начать экзамен «${t}».`,
  }),
});

function normalizeLocale(raw) {
  const l = String(raw || '').toLowerCase().split(/[-_]/)[0];
  return REMINDER_LOCALES.includes(l) ? l : 'az';
}

/** Tələbəyə gedən mətn: yalnız obyektin adı, heç bir bal / cavab / başqa tələbə məlumatı yox. */
function reminderMessage(entityType, title, locale) {
  const copy = REMINDER_COPY[normalizeLocale(locale)];
  const safeTitle = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  return { locale: normalizeLocale(locale), title: copy.title, body: copy[entityType](safeTitle) };
}

function reminderMeta(entityType, entityId) {
  if (entityType === 'material') return { material_id: entityId, href: '/student/materials' };
  if (entityType === 'exam') return { exam_id: entityId, href: '/student/exams' };
  return { assignment_id: entityId };
}

/**
 * Göndərmədən əvvəlki plan: kimlər alacaq, kimlər son N saatda artıq alıb, kimlər uyğun deyil.
 * @param {{ entityType, candidates, recentSentAt: Map<string, string|Date>, cooldownHours, now, closed }} input
 */
function planReminderRecipients({ entityType, candidates, recentSentAt = new Map(), cooldownHours, now = new Date(), closed = false }) {
  const recipients = [];
  const recentlyReminded = [];
  const notEligible = [];
  for (const s of candidates || []) {
    const base = { student_id: s.student_id, full_name: s.full_name, status: s.status };
    if (closed || !reminderEligibleFor(entityType, s)) {
      notEligible.push(base);
      continue;
    }
    const last = recentSentAt.get(String(s.student_id));
    if (last) {
      const lastDate = toDate(last);
      recentlyReminded.push({
        ...base,
        last_sent_at: lastDate ? lastDate.toISOString() : null,
        next_allowed_at: lastDate ? new Date(lastDate.getTime() + cooldownHours * 3600000).toISOString() : null,
      });
      continue;
    }
    recipients.push(base);
  }
  return { recipients, recently_reminded: recentlyReminded, not_eligible: notEligible, checked_at: now.toISOString() };
}

/** Müəllim üçün önizləmə: hər dil üçün bir mesaj və neçə tələbəyə gedəcəyi. */
function previewMessages(entityType, title, recipients, localeById) {
  const counts = new Map();
  for (const r of recipients) {
    const l = normalizeLocale(localeById.get(String(r.student_id)));
    counts.set(l, (counts.get(l) || 0) + 1);
  }
  if (!counts.size) counts.set('az', 0);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || REMINDER_LOCALES.indexOf(a[0]) - REMINDER_LOCALES.indexOf(b[0]))
    .map(([locale, count]) => ({ ...reminderMessage(entityType, title, locale), count }));
}

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

const TIMELINE_METADATA_KEYS = Object.freeze([
  'outcome', 'kind', 'delivery', 'channel', 'progress_pct', 'active_seconds', 'late', 'submission_count',
  'answered_count', 'previous_status',
]);

/** Zaman xətti üçün yalnız təhlükəsiz sahələr (cavablar, bal, token heç vaxt qaytarılmır). */
function sanitizeTimelineEvent(row) {
  const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const safe = {};
  for (const k of TIMELINE_METADATA_KEYS) {
    const v = meta[k];
    if (v == null) continue;
    if (typeof v === 'number' || typeof v === 'boolean') safe[k] = v;
    else if (typeof v === 'string') safe[k] = v.slice(0, 60);
  }
  const at = toDate(row?.created_at);
  return { event_type: row?.event_type, at: at ? at.toISOString() : null, source: row?.source || null, details: safe };
}

module.exports = {
  ENTITY_TYPES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  REPORT_FILTERS,
  CARD_FILTER_PARITY,
  parseReportQuery,
  applyReportQuery,
  enrichReportRow,
  earliestIso,
  reminderEligibleFor,
  REMINDER_COOLDOWN_HOURS,
  REMINDER_NOTIFICATION_TYPES,
  normalizeLocale,
  reminderMessage,
  reminderMeta,
  planReminderRecipients,
  previewMessages,
  sanitizeTimelineEvent,
};
