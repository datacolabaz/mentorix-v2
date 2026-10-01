/**
 * Dashboard xülasələri üçün qaydalar (DB-dən asılı deyil): kim nə görür, pəncərələr, keçidlər, aqreqat formatı.
 * - Admin: yalnız aqreqat saylar (tələbə adı/ID yoxdur). Tələbə səviyyəsində baxış yalnız səbəb + audit axını ilə
 *   (/admin/instructors/:id/activity) mümkündür, bu endpoint onu açmır.
 * - Müəllim: yalnız öz provider workspace-i (instructor_id = özü); ?instructor_id= kimi parametrlər nəzərə alınmır.
 * - Tələbə: yalnız özü (student_id = özü).
 * - Valideyn, org (course), partnyor və rolsuz istifadəçi: heç nə (403). Partnyor ayrıca users.role deyil, onun
 *   əsas rolu hansıdırsa yalnız o rolun öz xülasəsini alır; partnyor kimi tələbə məlumatı almır.
 */

const NEW_ITEM_DAYS = 14;
const UPCOMING_DEADLINE_DAYS = 7;
const RECENT_RESULT_DAYS = 14;
const FEEDBACK_DAYS = 14;
const JOIN_RESOLVED_DAYS = 14;
const RECENT_ACTIVITY_HOURS = 24;
/** Son 24 saatda jurnaldan ən çox bu qədər sətir oxunur (indeks aralığı; böyük müəllimdə də sabit iş). */
const RECENT_ACTIVITY_SCAN_CAP = 5000;
const RECENT_ACTIVITY_LATEST = 5;
const FAILED_DELIVERY_WINDOWS_HOURS = Object.freeze({ day: 24, week: 24 * 7 });
const AUTH_FAILURE_HOURS = 24;
const JOB_FAILURE_DAYS = 7;

/**
 * Müəllimə gələn «tələbə təqdim etdi» bildirişləri (köhnə birbaşa insert-lər və notificationService):
 * assignment_submitted, assignment_late_submitted, exam_submitted, exam_auto_submitted ...
 */
const SUBMISSION_NOTIFICATION_TYPE_RE = '^(assignment|exam)_([a-z]+_)*submitted$';

/** Təhlükəsizlik bildirişləri: category = 'security' və ya köhnə sətirlərdə bu tiplər. */
const SECURITY_NOTIFICATION_TYPES = Object.freeze([
  'security_alert',
  'login_security_alert',
  'google_account_changed',
  'account_suspended',
]);

const AUTH_FAILURE_EVENTS = Object.freeze(['login_failed', 'legacy_login_blocked']);

/** Son aktivlik qrupları (student_activity_log.event_type → kart sətri). reminder_sent müəllimin öz hərəkətidir. */
const ACTIVITY_BUCKETS = Object.freeze({
  submissions: ['assignment_submitted', 'assignment_late_submitted'],
  exams_completed: ['exam_submitted'],
  exams_started: ['exam_started'],
  material_views: ['material_viewed', 'video_started', 'video_completed'],
  downloads: ['material_file_downloaded'],
  expired: ['exam_expired'],
});
const ACTIVITY_EVENT_TYPES = Object.freeze([...new Set(Object.values(ACTIVITY_BUCKETS).flat())]);

/**
 * Bu xülasədə OLMAYAN admin bəndləri və səbəbi (spec: «yoxdursa göstərmə, sənədləşdir»).
 * UI bunları göstərmir; API istehlakçısı nəyin niyə olmadığını görür.
 */
const ADMIN_OMITTED = Object.freeze([
  Object.freeze({ key: 'privacy_requests', reason: 'no_data_source' }),
  Object.freeze({ key: 'cross_workspace_attempts', reason: 'not_logged' }),
]);

function deny(status, code, message) {
  return { ok: false, status, code, message };
}

/**
 * @param {{ id?: string, role?: string|null }} user
 * @returns {{ ok: true, kind: 'admin'|'teacher'|'student', userId: string } | { ok: false, status: number, code: string, message: string }}
 */
function resolveDashboardScope(user) {
  if (!user?.id) return deny(401, 'AUTH_REQUIRED', 'Giriş tələb olunur');
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin') return { ok: true, kind: 'admin', userId: String(user.id) };
  if (role === 'instructor') return { ok: true, kind: 'teacher', userId: String(user.id) };
  if (role === 'student') return { ok: true, kind: 'student', userId: String(user.id) };
  return deny(403, 'DASHBOARD_ROLE_UNSUPPORTED', 'Bu rol üçün xülasə yoxdur');
}

function toInt(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function toIso(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function hoursAgo(now, hours) {
  return new Date(now.getTime() - hours * 3600000);
}

function daysAgo(now, days) {
  return hoursAgo(now, days * 24);
}

function daysAhead(now, days) {
  return new Date(now.getTime() + days * 24 * 3600000);
}

/** Saxlanan bənd: sorğu alınmasa (cədvəl yoxdur və s.) bütün dashboard yıxılmır, yalnız bu bənd «əlçatmaz» olur. */
function item(key, value, extra = {}) {
  if (value == null) return { key, available: false, count: 0, ...extra };
  return { key, available: true, count: toInt(value), ...extra };
}

function severity(count, level) {
  return count > 0 ? level : 'ok';
}

/**
 * Admin bəndləri. raw: sorğu nəticələri (hər biri null ola bilər = əlçatmaz).
 * Heç bir bənd tələbə/istifadəçi səviyyəsində sahə daşımır: yalnız say, ən köhnə tarix və keçid.
 */
function buildAdminSummary(raw = {}, { now = new Date() } = {}) {
  const security = raw.security || null;
  const partners = raw.partners || null;
  const deliveries = raw.deliveries || null;
  const jobs = raw.jobs || null;
  const commissions = raw.commissions || null;

  const securityUnread = security ? toInt(security.unread_notifications) : null;
  const authFailures = security ? toInt(security.auth_failures) : null;
  const items = [
    item('security_events', securityUnread, {
      href: '/notifications?category=security',
      severity: severity(securityUnread || 0, 'critical'),
      detail: { auth_failures_24h: authFailures, auth_failures_href: '/admin/operations#security' },
    }),
    item('partner_applications', partners ? partners.pending : null, {
      href: '/admin/partners?status=pending',
      severity: severity(toInt(partners?.pending), 'warning'),
      detail: { oldest_at: toIso(partners?.oldest_at) },
    }),
    item('failed_email_deliveries', deliveries ? deliveries.last_24h : null, {
      href: '/admin/operations#email',
      severity: severity(toInt(deliveries?.last_24h), 'critical'),
      detail: { last_7d: deliveries ? toInt(deliveries.last_7d) : null },
    }),
    item('failed_background_jobs', jobs ? jobs.open_grading_failed : null, {
      href: '/admin/operations#jobs',
      severity: severity(toInt(jobs?.open_grading_failed), 'warning'),
      detail: { window_days: JOB_FAILURE_DAYS, sources: ['exam_open_grading_queue'] },
    }),
    item(
      'commission_actions',
      commissions ? toInt(commissions.pending_payouts) + toInt(commissions.pending_commissions) : null,
      {
        href: toInt(commissions?.pending_payouts) || !toInt(commissions?.pending_commissions)
          ? '/admin/partners?tab=payouts'
          : '/admin/partners?tab=commissions',
        severity: severity(toInt(commissions?.pending_payouts) + toInt(commissions?.pending_commissions), 'warning'),
        detail: {
          pending_payouts: commissions ? toInt(commissions.pending_payouts) : null,
          pending_payout_cents: commissions ? toInt(commissions.pending_payout_cents) : null,
          pending_commissions: commissions ? toInt(commissions.pending_commissions) : null,
        },
      },
    ),
  ];
  return {
    role: 'admin',
    generated_at: now.toISOString(),
    items,
    attention_total: items.reduce((s, i) => s + (i.available ? i.count : 0), 0),
    omitted: ADMIN_OMITTED,
  };
}

/** Son aktivlik: jurnal sayları qruplara yığılır; ən son hadisələrdən yalnız ad, obyekt adı və vaxt. */
function summarizeRecentActivity(countRows = [], latestRows = [], { capped = false } = {}) {
  const counts = Object.fromEntries(Object.keys(ACTIVITY_BUCKETS).map((k) => [k, 0]));
  let total = 0;
  for (const r of countRows) {
    const n = toInt(r.n);
    const bucket = Object.keys(ACTIVITY_BUCKETS).find((k) => ACTIVITY_BUCKETS[k].includes(r.event_type));
    if (!bucket) continue;
    counts[bucket] += n;
    total += n;
  }
  return {
    window_hours: RECENT_ACTIVITY_HOURS,
    total,
    capped: Boolean(capped),
    counts,
    latest: latestRows.slice(0, RECENT_ACTIVITY_LATEST).map((r) => ({
      event_type: r.event_type,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      entity_title: r.entity_title || null,
      student_name: r.student_name || null,
      at: toIso(r.created_at),
    })),
  };
}

/**
 * Müəllim xülasəsi. materials/assignments/exams = Phase D kartlarının cəmi (eyni roster + eyni status qaydaları);
 * parity testi bunu kartların özü ilə müqayisə edir.
 */
function buildTeacherSummary(raw = {}, { now = new Date() } = {}) {
  const m = raw.materials || null;
  const a = raw.assignments || null;
  const e = raw.exams || null;
  const waitingAssignments = a ? toInt(a.waiting_grading) : null;
  const pendingExams = e ? toInt(e.pending_manual_grading) : null;
  const pendingGrading = a && e ? waitingAssignments + pendingExams : a ? waitingAssignments : e ? pendingExams : null;

  const items = [
    item('unread_submissions', raw.unreadSubmissions, {
      href: '/notifications?unread=1',
      tone: 'blue',
    }),
    item('pending_grading', pendingGrading, {
      href: toInt(waitingAssignments) || !toInt(pendingExams)
        ? '/instructor/engagement?tab=assignments'
        : '/instructor/engagement?tab=exams',
      tone: 'yellow',
      detail: { assignments: waitingAssignments, exams: pendingExams },
    }),
    item('overdue_assignments', a ? a.overdue : null, {
      href: '/instructor/engagement?tab=assignments',
      tone: 'red',
      detail: { assignments: a ? toInt(a.overdue_assignments) : null },
    }),
    item('assessment_expiry', e ? toInt(e.auto_submitted) + toInt(e.expired_no_answers) : null, {
      href: '/instructor/engagement?tab=exams',
      tone: 'yellow',
      detail: {
        auto_submitted: e ? toInt(e.auto_submitted) : null,
        expired_no_answers: e ? toInt(e.expired_no_answers) : null,
      },
    }),
    item('unviewed_materials', m ? m.not_viewed : null, {
      href: '/instructor/engagement?tab=materials',
      tone: 'gray',
      detail: {
        materials: m ? toInt(m.materials_with_unviewed) : null,
        overdue: m ? toInt(m.overdue) : null,
      },
    }),
    item('join_requests', raw.joinRequests, {
      href: '/instructor/join-requests',
      tone: 'blue',
    }),
  ];
  return {
    role: 'teacher',
    generated_at: now.toISOString(),
    items,
    recent_activity: raw.activity || null,
  };
}

/** Tələbə xülasəsi: yalnız öz məlumatı. Keçidlər tələbənin öz səhifələrinədir. */
function buildStudentSummary(raw = {}, { now = new Date() } = {}) {
  const ex = raw.exams || null;
  const asg = raw.assignments || null;
  const results = raw.results || null;
  const join = raw.join || null;
  const nextDeadline = [ex?.next_deadline, asg?.next_deadline].map(toIso).filter(Boolean).sort()[0] || null;
  const upcoming = ex || asg ? toInt(ex?.upcoming) + toInt(asg?.upcoming) : null;

  const items = [
    item('new_assessments', ex ? ex.new_count : null, { href: '/student/exams', tone: 'blue' }),
    item('new_assignments', asg ? asg.new_count : null, { href: '/student/assignments', tone: 'blue' }),
    item('new_materials', raw.materials ? raw.materials.new_count : null, { href: '/student/materials', tone: 'blue' }),
    item('upcoming_deadlines', upcoming, {
      href: toInt(asg?.upcoming) || !toInt(ex?.upcoming) ? '/student/assignments' : '/student/exams',
      tone: 'yellow',
      detail: {
        next_at: nextDeadline,
        assignments: asg ? toInt(asg.upcoming) : null,
        assessments: ex ? toInt(ex.upcoming) : null,
        window_days: UPCOMING_DEADLINE_DAYS,
      },
    }),
    item('released_results', results ? results.released : null, {
      href: '/student/exams',
      tone: 'green',
      detail: { latest_at: toIso(results?.latest_at), window_days: RECENT_RESULT_DAYS },
    }),
    item('teacher_feedback', asg ? toInt(asg.feedback_recent) + toInt(asg.returned) : null, {
      href: '/student/assignments',
      tone: 'green',
      detail: {
        graded: asg ? toInt(asg.feedback_recent) : null,
        returned: asg ? toInt(asg.returned) : null,
        window_days: FEEDBACK_DAYS,
      },
    }),
  ];

  const joinRows = Array.isArray(join) ? join : null;
  return {
    role: 'student',
    generated_at: now.toISOString(),
    items,
    group_join: joinRows
      ? {
          pending: joinRows.filter((r) => r.status === 'pending').length,
          approved_recent: joinRows.filter((r) => r.status === 'approved').length,
          rejected_recent: joinRows.filter((r) => r.status === 'rejected').length,
          requests: joinRows.slice(0, 5).map((r) => ({
            status: r.status,
            group_name: r.group_name || null,
            at: toIso(r.at),
          })),
          href: '/student/groups',
        }
      : null,
  };
}

function rowOrNull(res) {
  return res && res.rows && res.rows[0] ? res.rows[0] : null;
}

module.exports = {
  NEW_ITEM_DAYS,
  UPCOMING_DEADLINE_DAYS,
  RECENT_RESULT_DAYS,
  FEEDBACK_DAYS,
  JOIN_RESOLVED_DAYS,
  RECENT_ACTIVITY_HOURS,
  RECENT_ACTIVITY_SCAN_CAP,
  RECENT_ACTIVITY_LATEST,
  FAILED_DELIVERY_WINDOWS_HOURS,
  AUTH_FAILURE_HOURS,
  JOB_FAILURE_DAYS,
  SUBMISSION_NOTIFICATION_TYPE_RE,
  SECURITY_NOTIFICATION_TYPES,
  AUTH_FAILURE_EVENTS,
  ACTIVITY_BUCKETS,
  ACTIVITY_EVENT_TYPES,
  ADMIN_OMITTED,
  resolveDashboardScope,
  buildAdminSummary,
  buildTeacherSummary,
  buildStudentSummary,
  summarizeRecentActivity,
  hoursAgo,
  daysAgo,
  daysAhead,
  rowOrNull,
};
