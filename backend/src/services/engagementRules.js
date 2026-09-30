/**
 * Engagement status qaydaları (DB-dən asılı deyil).
 * Səhifəni bir saniyəlik açmaq «baxıldı» sayılmır: sənəd/mətn üçün minimum aktiv vaxt tələb olunur.
 */

const MIN_VIEW_SECONDS = Object.freeze({
  pdf: 10,
  document: 10,
  presentation: 10,
  image: 5,
  text: 20,
  file: 10,
});
const VIDEO_COMPLETE_PCT = 80;
/** Bir hadisədə qəbul edilən maksimum aktiv vaxt (tab açıq unudulsa şişirtməsin). */
const MAX_ACTIVE_SECONDS_PER_EVENT = 30 * 60;

const MATERIAL_EVENTS = Object.freeze([
  'material_opened',
  'material_viewed',
  'material_downloaded',
  'video_started',
  'video_progressed',
  'video_completed',
]);

function materialKind(fileType, fileUrl) {
  const t = String(fileType || '').toLowerCase();
  const u = String(fileUrl || '').toLowerCase().split(/[?#]/)[0];
  const ext = u.includes('.') ? u.split('.').pop() : '';
  if (t === 'link' || t === 'text/uri-list' || (/^https?:\/\//.test(u) && !u.includes('/api/materials/file/'))) {
    return 'link';
  }
  if (t.startsWith('video/') || ['mp4', 'webm', 'mov', 'm4v'].includes(ext)) return 'video';
  if (t.includes('pdf') || ext === 'pdf') return 'pdf';
  if (t.includes('presentation') || t.includes('powerpoint') || ['ppt', 'pptx', 'key'].includes(ext)) return 'presentation';
  if (t.startsWith('text/') || ['txt', 'md', 'html'].includes(ext)) return 'text';
  if (t.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image';
  if (t.includes('word') || t.includes('msword') || t.includes('spreadsheet') || t.includes('excel') ||
      ['doc', 'docx', 'xls', 'xlsx', 'csv', 'odt', 'rtf'].includes(ext)) {
    return 'document';
  }
  return 'file';
}

function clampPct(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function clampSeconds(v) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, MAX_ACTIVE_SECONDS_PER_EVENT);
}

/**
 * Müştəridən gələn hadisəni server qaydasına görə şərh edir.
 * Yükləmə müştəridən sayılmır: fayl yükləməsini yalnız server (serveMaterialFile) qeydə alır
 * və yükləmə «baxıb/tamamlayıb» demək deyil. Köhnə müştərilərin material_downloaded hadisəsi ignored qaytarır.
 * counts_as_view — ümumi baxış sayına (view_count) +1 yazan mənalı baxış.
 * @returns {null | { event_type, opened, viewed, completed, downloaded, counts_as_view, ignored?, progress_pct, active_seconds }}
 */
function interpretMaterialEvent(kind, { event_type, active_seconds, progress_pct } = {}) {
  if (!MATERIAL_EVENTS.includes(event_type)) return null;
  const secs = clampSeconds(active_seconds);
  const pct = clampPct(progress_pct);
  const base = {
    event_type,
    opened: true,
    viewed: false,
    completed: false,
    downloaded: false,
    counts_as_view: false,
    progress_pct: pct,
    active_seconds: secs,
  };

  if (kind === 'link') {
    if (event_type.startsWith('video_')) return null;
    const isOpen = event_type === 'material_downloaded' ? 'material_opened' : event_type;
    return { ...base, event_type: isOpen, viewed: true, completed: true, counts_as_view: true };
  }

  if (event_type === 'material_downloaded') return { ...base, opened: false, ignored: true };

  if (kind === 'video') {
    if (event_type === 'material_opened' || event_type === 'material_viewed') return { ...base, event_type: 'material_opened' };
    if (event_type === 'video_started') return { ...base, viewed: true, counts_as_view: true };
    const reached = pct != null && pct >= VIDEO_COMPLETE_PCT;
    if (event_type === 'video_completed' || event_type === 'video_progressed') {
      return reached
        ? { ...base, event_type: 'video_completed', viewed: true, completed: true }
        : { ...base, event_type: 'video_progressed', viewed: true };
    }
    return null;
  }

  if (event_type.startsWith('video_')) return null;

  if (event_type === 'material_viewed') {
    const min = MIN_VIEW_SECONDS[kind] ?? MIN_VIEW_SECONDS.file;
    if (secs >= min) return { ...base, viewed: true, completed: true, counts_as_view: true };
    return { ...base, event_type: 'material_opened' };
  }
  return base;
}

function isPast(ts, now) {
  if (!ts) return false;
  const d = ts instanceof Date ? ts : new Date(ts);
  return !Number.isNaN(d.getTime()) && d < now;
}

/** assignments.due_date (DATE) Bakı vaxtı ilə günün sonuna qədər etibarlıdır (UTC+4). */
function assignmentDueEnd(dueDate) {
  if (!dueDate) return null;
  const s = dueDate instanceof Date ? dueDate.toISOString().slice(0, 10) : String(dueDate).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 19, 59, 59));
}

/**
 * Material üzrə tələbə statusu.
 * completed | in_progress (video başlanıb, bitməyib) | opened | not_opened; overdue = son tarix keçib və baxılmayıb.
 * progress_status spesifikasiya adlarıdır: completed | in_progress | viewed | downloaded | not_viewed.
 * Sənəd üçün mənalı baxış elə «tamamlayıb» sayılır (212 qaydası), ona görə viewed ayrıca yalnız hesabatda görünür.
 */
function materialStudentStatus(row, { dueAt = null, now = new Date() } = {}) {
  const completed = Boolean(row?.completed_at);
  const viewed = Boolean(row?.first_viewed_at) || completed;
  const downloadCount = Math.max(0, Number(row?.download_count) || 0);
  const downloaded = downloadCount > 0 || Boolean(row?.first_downloaded_at);
  const opened = Boolean(row?.first_opened_at) || viewed;
  const status = completed ? 'completed' : viewed ? 'in_progress' : opened ? 'opened' : 'not_opened';
  const progressStatus = completed ? 'completed' : viewed ? 'in_progress' : downloaded ? 'downloaded' : 'not_viewed';
  const viewCount = Math.max(Number(row?.view_count) || 0, viewed ? 1 : 0);
  return {
    status,
    progress_status: progressStatus,
    viewed,
    completed,
    opened,
    downloaded,
    view_count: viewCount,
    download_count: downloadCount,
    last_viewed_at: row?.last_viewed_at || (viewed ? row?.first_viewed_at || null : null),
    first_downloaded_at: row?.first_downloaded_at || null,
    last_downloaded_at: row?.last_downloaded_at || null,
    overdue: !viewed && isPast(dueAt, now),
    last_activity_at: row?.last_activity_at || null,
  };
}

/**
 * Tapşırıq üzrə tələbə statusu (student_assignments + assignment_status).
 * graded | submitted (qiymət gözləyir) | returned (yenidən işləməyə qaytarılıb) | overdue | started | opened | not_opened
 * progress_status spesifikasiya adlarıdır (activityStatusRules.ASSIGNMENT_PROGRESS_STATUSES).
 * Qaytarılmış iş son tarixdən sonra da «vaxtı keçib» sayılmır: onu müəllim özü qaytarıb.
 */
function assignmentStudentStatus(sa, st, { dueDate = null, now = new Date() } = {}) {
  const saStatus = String(sa?.status || '').toLowerCase();
  const returned = saStatus === 'returned';
  const graded = !returned && (saStatus === 'reviewed' || Boolean(sa?.reviewed_at && sa?.submitted_at));
  const submitted = !returned && !graded && Boolean(sa?.submitted_at) && saStatus !== 'late_rejected';
  const done = graded || submitted;
  const dueEnd = assignmentDueEnd(dueDate);
  const overdue = !done && !returned && isPast(dueEnd, now);
  const started = Boolean(st?.started_at);
  const opened = started || Boolean(st?.first_opened_at) || Boolean(sa?.seen_at);
  const firstSubmitted = sa?.first_submitted_at || sa?.submitted_at || null;
  const isLate =
    (done || returned) &&
    (saStatus === 'late' || Boolean(firstSubmitted && dueEnd && new Date(firstSubmitted) > dueEnd));
  let status = 'not_opened';
  if (graded) status = 'graded';
  else if (submitted) status = 'submitted';
  else if (returned) status = 'returned';
  else if (overdue) status = 'overdue';
  else if (started) status = 'started';
  else if (opened) status = 'opened';
  const progressStatus = {
    graded: 'graded',
    submitted: isLate ? 'late_submitted' : 'submitted',
    returned: 'returned_for_revision',
    overdue: 'overdue',
    started: 'in_progress',
    opened: 'viewed',
    not_opened: 'not_opened',
  }[status];
  const times = [st?.last_activity_at, sa?.reviewed_at, sa?.submitted_at, sa?.returned_at, sa?.seen_at]
    .filter(Boolean)
    .map((t) => new Date(t));
  const last = times.length ? new Date(Math.max(...times.map((d) => d.getTime()))) : null;
  return {
    status,
    progress_status: progressStatus,
    graded,
    submitted: done,
    waiting_grading: submitted,
    returned,
    is_late: isLate,
    overdue,
    opened: opened || done || returned,
    started,
    submission_count: Math.max(Number(sa?.submission_count) || 0, done ? 1 : 0),
    score: sa?.score ?? null,
    last_activity_at: last ? last.toISOString() : null,
  };
}

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function byRecent(a, b) {
  return new Date(b.last_activity_at || 0) - new Date(a.last_activity_at || 0);
}

function latestIso(values) {
  return values.filter(Boolean).map((v) => new Date(v).toISOString()).sort().pop() || null;
}

/**
 * Unikal baxan = viewed olan sətirlər (tələbə başına bir sətir, təkrar açılış artırmır).
 * Ümumi baxış = view_count cəmi. Unikal yükləyən = download_count > 0. Ümumi yükləmə = download_count cəmi.
 */
function summarizeMaterial(students) {
  const list = Array.isArray(students) ? students : [];
  const viewedList = list.filter((s) => s.viewed).sort(byRecent);
  const completed = list.filter((s) => s.completed).length;
  const lastActivity = list.map((s) => s.last_activity_at).filter(Boolean).sort().pop() || null;
  return {
    assigned: list.length,
    viewed: viewedList.length,
    not_viewed: list.length - viewedList.length,
    completed,
    opened_not_viewed: list.filter((s) => s.opened && !s.viewed).length,
    not_opened: list.filter((s) => !s.opened).length,
    overdue: list.filter((s) => s.overdue).length,
    completion_pct: pct(completed, list.length),
    total_views: list.reduce((sum, s) => sum + (Number(s.view_count) || 0), 0),
    unique_downloaders: list.filter((s) => s.downloaded).length,
    total_downloads: list.reduce((sum, s) => sum + (Number(s.download_count) || 0), 0),
    last_viewed_at: latestIso(list.map((s) => s.last_viewed_at)),
    last_downloaded_at: latestIso(list.map((s) => s.last_downloaded_at)),
    recent_viewers: viewedList.slice(0, 4).map((s) => ({ student_id: s.student_id, full_name: s.full_name })),
    more_viewers: Math.max(0, viewedList.length - 4),
    last_activity_at: lastActivity,
  };
}

function summarizeAssignment(students) {
  const list = Array.isArray(students) ? students : [];
  const count = (k) => list.filter((s) => s.status === k).length;
  const submitted = list.filter((s) => s.submitted).length;
  const lastActivity = list.map((s) => s.last_activity_at).filter(Boolean).sort().pop() || null;
  return {
    assigned: list.length,
    opened: list.filter((s) => s.opened).length,
    started: list.filter((s) => s.started || s.submitted).length,
    submitted,
    late_submitted: list.filter((s) => s.submitted && s.is_late).length,
    graded: count('graded'),
    waiting_grading: count('submitted'),
    pending_review: count('submitted'),
    returned: count('returned'),
    not_submitted: list.length - submitted,
    overdue: count('overdue'),
    not_opened: count('not_opened'),
    completion_pct: pct(submitted, list.length),
    last_activity_at: lastActivity,
  };
}

const MATERIAL_FILTERS = Object.freeze({
  viewed: (s) => s.viewed,
  not_viewed: (s) => !s.viewed,
  completed: (s) => s.completed,
  overdue: (s) => s.overdue,
  downloaded: (s) => s.downloaded,
  not_downloaded: (s) => !s.downloaded,
});
const ASSIGNMENT_FILTERS = Object.freeze({
  submitted: (s) => s.submitted,
  not_submitted: (s) => !s.submitted,
  graded: (s) => s.graded,
  waiting_grading: (s) => s.waiting_grading,
  overdue: (s) => s.overdue,
  not_opened: (s) => s.status === 'not_opened',
  returned: (s) => s.returned,
  late: (s) => s.is_late,
});

/** Xatırlatma kimə gedə bilər: material — baxmayanlar; tapşırıq — təqdim etməyənlər. */
function reminderEligible(entityType, s) {
  return entityType === 'material' ? !s.viewed : !s.submitted;
}

module.exports = {
  MIN_VIEW_SECONDS,
  VIDEO_COMPLETE_PCT,
  MATERIAL_EVENTS,
  MATERIAL_FILTERS,
  ASSIGNMENT_FILTERS,
  materialKind,
  interpretMaterialEvent,
  materialStudentStatus,
  assignmentStudentStatus,
  assignmentDueEnd,
  summarizeMaterial,
  summarizeAssignment,
  reminderEligible,
};
