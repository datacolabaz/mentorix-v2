/**
 * Fəaliyyət hadisələri və status keçidləri üçün tək qayda mənbəyi (DB-dən asılı deyil).
 * Yazan tərəf (activityProgressService, assessmentAttemptService) keçidləri buradan alır;
 * oxuyan tərəf (kartlar, hesabat, backfill) eyni funksiyalarla sayır ki, rəqəmlər üst-üstə düşsün.
 * Spesifikasiyadakı UPPER_SNAKE adlar DB-də lower_snake saxlanılır (212-dən qalan ad sistemi).
 */

const ACTIVITY_EVENTS = Object.freeze({
  ASSESSMENT_VIEWED: 'exam_viewed',
  ASSESSMENT_STARTED: 'exam_started',
  ASSESSMENT_AUTOSAVED: 'exam_autosaved',
  ASSESSMENT_SUBMITTED: 'exam_submitted',
  ASSESSMENT_EXPIRED: 'exam_expired',
  RESULT_RELEASED: 'exam_result_released',
  ASSESSMENT_ATTEMPT_VOIDED: 'exam_attempt_voided',
  ASSIGNMENT_VIEWED: 'assignment_opened',
  ASSIGNMENT_STARTED: 'assignment_started',
  ASSIGNMENT_SUBMITTED: 'assignment_submitted',
  ASSIGNMENT_LATE_SUBMITTED: 'assignment_late_submitted',
  ASSIGNMENT_GRADED: 'assignment_graded',
  ASSIGNMENT_RETURNED_FOR_REVISION: 'assignment_returned',
  MATERIAL_OPENED: 'material_opened',
  MATERIAL_VIEWED: 'material_viewed',
  MATERIAL_DOWNLOADED: 'material_file_downloaded',
  VIDEO_STARTED: 'video_started',
  VIDEO_PROGRESS: 'video_progressed',
  VIDEO_COMPLETED: 'video_completed',
  FILE_UPLOADED: 'file_uploaded',
  FILE_DOWNLOADED: 'file_downloaded',
  REMINDER_SENT: 'reminder_sent',
});

/** student_activity_log.event_type CHECK-i ilə eyni siyahı (217). Köhnə növlər oxunmaq üçün qalır. */
const STORED_EVENT_TYPES = Object.freeze([
  'material_assigned', 'material_opened', 'material_viewed', 'material_downloaded', 'material_file_downloaded',
  'video_started', 'video_progressed', 'video_completed',
  'file_uploaded', 'file_downloaded',
  'assignment_opened', 'assignment_started', 'assignment_submitted', 'assignment_late_submitted',
  'assignment_graded', 'assignment_returned',
  'exam_viewed', 'exam_started', 'exam_autosaved', 'exam_submitted', 'exam_expired',
  'exam_result_released', 'exam_attempt_voided',
  'reminder_sent',
]);

/* ------------------------------------------------------------------ */
/* Assignment                                                          */
/* ------------------------------------------------------------------ */

const ASSIGNMENT_PROGRESS_STATUSES = Object.freeze([
  'not_opened', 'viewed', 'in_progress', 'submitted', 'late_submitted', 'graded', 'returned_for_revision', 'overdue',
]);

const ASSIGNMENT_SUBMITTABLE_FROM = new Set(['not_opened', 'viewed', 'in_progress', 'returned_for_revision', 'overdue']);
const ASSIGNMENT_RETURNABLE_FROM = new Set(['submitted', 'late_submitted', 'graded']);

/**
 * Saxlanan tapşırıq irəliləyişinin növbəti vəziyyəti.
 * PENDING_REVIEW saxlanılmır: submitted | late_submitted = yoxlama gözləyir.
 * OVERDUE vaxta bağlıdır və oxuyanda hesablanır; burada yalnız gecikmiş təslim rədd ediləndə yazılır.
 * @returns {{ status: string, changed: boolean, valid: boolean }}
 */
function nextAssignmentStatus(current, event, { late = false } = {}) {
  const cur = ASSIGNMENT_PROGRESS_STATUSES.includes(current) ? current : 'not_opened';
  const to = (status) => ({ status, changed: status !== cur, valid: true });
  switch (event) {
    case 'opened':
      return to(cur === 'not_opened' ? 'viewed' : cur);
    case 'started':
      return to(cur === 'not_opened' || cur === 'viewed' ? 'in_progress' : cur);
    case 'submitted':
      if (!ASSIGNMENT_SUBMITTABLE_FROM.has(cur)) return to(cur);
      return to(late ? 'late_submitted' : 'submitted');
    case 'graded':
      if (cur === 'returned_for_revision') return { status: cur, changed: false, valid: false };
      return to('graded');
    case 'returned':
      if (!ASSIGNMENT_RETURNABLE_FROM.has(cur)) return { status: cur, changed: false, valid: false };
      return to('returned_for_revision');
    case 'late_rejected':
      return to('overdue');
    default:
      return { status: cur, changed: false, valid: false };
  }
}

/** student_assignments.status (köhnə dəyərlər) → saxlanan irəliləyiş statusu. */
function assignmentProgressFromLegacy(sa, st = null) {
  const s = String(sa?.status || '').toLowerCase();
  if (s === 'returned') return 'returned_for_revision';
  if (s === 'reviewed') return 'graded';
  if (s === 'late_rejected') return 'overdue';
  if (sa?.submitted_at) return s === 'late' ? 'late_submitted' : 'submitted';
  if (st?.started_at) return 'in_progress';
  if (st?.first_opened_at || sa?.seen_at) return 'viewed';
  return 'not_opened';
}

/* ------------------------------------------------------------------ */
/* Assessment (exam)                                                   */
/* ------------------------------------------------------------------ */

const EXAM_PROGRESS_STATUSES = Object.freeze([
  'not_started', 'viewed', 'in_progress', 'completed',
  'expired_auto_submitted', 'expired_no_answers', 'pending_manual_grading', 'result_released',
]);

/**
 * Şəxsi vaxt bitəndən sonra müştərinin avtomatik təqdiminin serverə çatması üçün pəncərə.
 * Bu pəncərədə gələn cavablar qəbul olunur; sonra yalnız serverdə saxlanmış (autosave) cavablar yekunlaşır.
 */
const EXPIRY_GRACE_SECONDS = 60;
/** Müştəri taymeri serverdən bir az tez bitə bilər (saat fərqi). */
const AUTO_SUBMIT_EARLY_TOLERANCE_SECONDS = 10;
/** Autosave şəxsi son andan sonra yalnız şəbəkə gecikməsi qədər qəbul olunur. */
const AUTOSAVE_LATE_TOLERANCE_SECONDS = 10;
/** Bu müddətdə heç bir fəaliyyət olmayan açıq cəhd «Fəaliyyətsizdir» sayılır (D10: 10 dəqiqə, təsdiqlənib). */
const EXAM_INACTIVE_AFTER_MINUTES = 10;

const OPEN_EXAM_STATES = new Set(['not_started', 'viewed', 'in_progress']);

/**
 * Saxlanan imtahan irəliləyişinin növbəti vəziyyəti (yalnız irəli gedir, təkrar hadisə heç nəyi pozmur).
 * Prioritet: result_released > pending_manual_grading > expired_* / completed > in_progress > viewed.
 * Vaxtı bitib avtomatik təqdim edilmiş cəhd sonra «nəticə açıqlanıb» ola bilər — expired_at bunu saxlayır.
 */
function nextExamStatus(current, event, { gradingPending = false, released = false, autoSubmitted = false } = {}) {
  const cur = EXAM_PROGRESS_STATUSES.includes(current) ? current : 'not_started';
  switch (event) {
    case 'viewed':
      return cur === 'not_started' ? 'viewed' : cur;
    case 'started':
      return cur === 'not_started' || cur === 'viewed' ? 'in_progress' : cur;
    case 'submitted':
    case 'auto_submitted':
      if (!OPEN_EXAM_STATES.has(cur)) return cur;
      if (gradingPending) return 'pending_manual_grading';
      if (released) return 'result_released';
      return event === 'auto_submitted' ? 'expired_auto_submitted' : 'completed';
    case 'expired_no_answers':
      return OPEN_EXAM_STATES.has(cur) ? 'expired_no_answers' : cur;
    case 'grading_confirmed':
      if (cur !== 'pending_manual_grading') return cur;
      if (released) return 'result_released';
      return autoSubmitted ? 'expired_auto_submitted' : 'completed';
    case 'result_released':
      return cur === 'completed' || cur === 'expired_auto_submitted' ? 'result_released' : cur;
    case 'voided':
      return cur === 'expired_no_answers' ? 'not_started' : cur;
    default:
      return cur;
  }
}

function isNonEmptyAnswer(v) {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'boolean') return true;
  if (Array.isArray(v)) return v.some(isNonEmptyAnswer);
  if (typeof v === 'object') return Object.values(v).some(isNonEmptyAnswer);
  return false;
}

function parseAnswers(answers) {
  if (answers == null) return null;
  if (typeof answers === 'string') {
    try {
      return JSON.parse(answers);
    } catch {
      return null;
    }
  }
  return typeof answers === 'object' ? answers : null;
}

function countAnsweredQuestions(answers) {
  const a = parseAnswers(answers);
  if (!a) return 0;
  const values = Array.isArray(a) ? a : Object.values(a);
  return values.filter(isNonEmptyAnswer).length;
}

function hasAnyAnswer(answers) {
  return countAnsweredQuestions(answers) > 0;
}

function toDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Şəxsi son an = başlama + müddət. Müddət yoxdursa son an da yoxdur. */
function examPersonalDeadline(startedAt, durationMinutes, { minimumMinutes = 0 } = {}) {
  const dur = Math.max(Number(durationMinutes) || 0, minimumMinutes);
  const s = toDate(startedAt);
  if (!s || dur <= 0) return null;
  return new Date(s.getTime() + dur * 60000);
}

/**
 * Təqdim sorğusu gələndə nə etməli.
 * manual — adi təqdim; auto_expired — vaxt bitdiyi üçün avtomatik təqdim; too_late — cavab qəbul edilmir,
 * yalnız serverdə saxlanmış cavablar yekunlaşdırılır (bitmiş vaxtdan sonra işləməyə davam etmək olmasın).
 */
function classifySubmission({ deadline, now = new Date(), clientAutoSubmit = false, graceSeconds = EXPIRY_GRACE_SECONDS }) {
  const d = toDate(deadline);
  if (!d) return { accept: true, kind: 'manual' };
  const diffMs = now.getTime() - d.getTime();
  if (diffMs <= 0) {
    const nearEnd = -diffMs <= AUTO_SUBMIT_EARLY_TOLERANCE_SECONDS * 1000;
    return { accept: true, kind: clientAutoSubmit && nearEnd ? 'auto_expired' : 'manual' };
  }
  if (diffMs <= graceSeconds * 1000) return { accept: true, kind: clientAutoSubmit ? 'auto_expired' : 'manual' };
  return { accept: false, kind: 'too_late' };
}

/** Vaxtı bitmiş cəhdin nəticəsi: cavab varsa avtomatik təqdim, yoxdursa «cavabsız». */
function expiredAttemptOutcome(answers) {
  return hasAnyAnswer(answers) ? 'expired_auto_submitted' : 'expired_no_answers';
}

function latestOf(...values) {
  const ds = values.map(toDate).filter(Boolean);
  if (!ds.length) return null;
  return new Date(Math.max(...ds.map((d) => d.getTime())));
}

/**
 * Bir tələbənin imtahan vəziyyəti (kart və hesabat eyni funksiyadan).
 * row: exam_student_progress sahələri + son (ləğv edilməmiş) exam_results cəhdi (result_*).
 * Progress sətri hələ yoxdursa (backfill-dən əvvəl) exam_results-dan ehtiyat hesablanır.
 */
function examStudentState(row, { now = new Date(), inactiveAfterMinutes = EXAM_INACTIVE_AFTER_MINUTES } = {}) {
  const r = row || {};
  const voided = String(r.result_status || '').toLowerCase() === 'voided';
  const resultStarted = voided ? null : r.result_started_at;
  const resultSubmitted = voided ? null : r.result_submitted_at;
  const resultExpired = !voided && String(r.result_status || '').toLowerCase() === 'expired';

  const started = Boolean(r.started_at || resultStarted);
  const completed = Boolean(r.completed_at || resultSubmitted);
  const noAnswers = !completed && (r.status === 'expired_no_answers' || resultExpired);
  const expired = Boolean(r.expired_at) || noAnswers;
  const autoSubmitted = completed && (Boolean(r.expired_at) || r.status === 'expired_auto_submitted');
  const pendingGrading = completed && r.status === 'pending_manual_grading';
  const released = completed && (Boolean(r.result_released_at) || r.status === 'result_released');
  const viewed = Boolean(r.viewed_at) || started || expired || r.status === 'viewed';
  const inProgress = started && !completed && !expired;
  const last = latestOf(r.latest_activity_at, r.completed_at, resultSubmitted, r.started_at, resultStarted, r.viewed_at);
  const inactive = inProgress && Boolean(last) && now.getTime() - last.getTime() > inactiveAfterMinutes * 60000;

  const rawScore = voided || !completed ? null : r.score;
  const score = rawScore == null || rawScore === '' ? null : Number(rawScore);
  const countsForAverage = completed && !pendingGrading && score != null && Number.isFinite(score);

  let status = 'not_started';
  if (pendingGrading) status = 'pending_manual_grading';
  else if (noAnswers) status = 'expired_no_answers';
  else if (autoSubmitted) status = 'expired_auto_submitted';
  else if (completed) status = 'completed';
  else if (inactive) status = 'inactive';
  else if (inProgress) status = 'in_progress';
  else if (viewed) status = 'viewed';

  return {
    status,
    viewed,
    started,
    in_progress: inProgress && !inactive,
    inactive,
    completed,
    auto_submitted: autoSubmitted,
    expired,
    no_answers: noAnswers,
    pending_grading: pendingGrading,
    released,
    answered_count: Number(r.answered_question_count) || 0,
    score: countsForAverage ? score : null,
    counts_for_average: countsForAverage,
    last_activity_at: last ? last.toISOString() : null,
  };
}

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** Kart xülasəsi. Orta nəticəyə yalnız yoxlanmış, cavablı cəhdlər daxildir; ləğv edilmiş və cavabsızlar yox. */
function summarizeExam(students) {
  const list = Array.isArray(students) ? students : [];
  const count = (fn) => list.filter(fn).length;
  const scored = list.filter((s) => s.counts_for_average);
  const avg = scored.length ? scored.reduce((sum, s) => sum + s.score, 0) / scored.length : null;
  const completers = list
    .filter((s) => s.completed)
    .sort((a, b) => new Date(b.last_activity_at || 0) - new Date(a.last_activity_at || 0));
  const lastActivity = list.map((s) => s.last_activity_at).filter(Boolean).sort().pop() || null;
  const completed = count((s) => s.completed);
  return {
    assigned: list.length,
    viewed: count((s) => s.viewed),
    started: count((s) => s.started),
    in_progress: count((s) => s.in_progress),
    inactive: count((s) => s.inactive),
    completed,
    auto_submitted: count((s) => s.auto_submitted),
    expired: count((s) => s.expired),
    expired_no_answers: count((s) => s.no_answers),
    not_started: count((s) => !s.started && !s.expired),
    pending_manual_grading: count((s) => s.pending_grading),
    result_released: count((s) => s.released),
    average_score: avg == null ? null : Math.round(avg * 100) / 100,
    scored_count: scored.length,
    completion_pct: pct(completed, list.length),
    recent_completers: completers.slice(0, 4).map((s) => ({ student_id: s.student_id, full_name: s.full_name })),
    more_completers: Math.max(0, completers.length - 4),
    last_activity_at: lastActivity,
  };
}

const EXAM_FILTERS = Object.freeze({
  viewed: (s) => s.viewed,
  not_viewed: (s) => !s.viewed,
  started: (s) => s.started,
  not_started: (s) => !s.started && !s.expired,
  in_progress: (s) => s.in_progress,
  inactive: (s) => s.inactive,
  completed: (s) => s.completed,
  expired: (s) => s.expired,
  pending_manual_grading: (s) => s.pending_grading,
});

/**
 * Backfill: mövcud exam_results cəhdindən progress sətri.
 * @param {{ result?: object|null, attemptCount?: number, totalQuestions?: number|null,
 *   gradingPending?: boolean, released?: boolean, releaseAt?: Date|null, durationMinutes?: number }} input
 */
function examProgressFromLegacy({
  result = null,
  attemptCount = 0,
  totalQuestions = null,
  gradingPending = false,
  released = false,
  releaseAt = null,
  durationMinutes = 0,
} = {}) {
  const base = {
    status: 'not_started',
    current_result_id: null,
    started_at: null,
    completed_at: null,
    expired_at: null,
    result_released_at: null,
    latest_activity_at: null,
    answered_question_count: 0,
    total_question_count: totalQuestions,
    attempt_count: attemptCount,
  };
  const rStatus = String(result?.status || '').toLowerCase();
  if (!result || rStatus === 'voided') return base;
  const answered = countAnsweredQuestions(result.answers);
  const startedAt = toDate(result.started_at);
  const submittedAt = toDate(result.submitted_at);
  const common = {
    ...base,
    current_result_id: result.id || null,
    started_at: startedAt,
    answered_question_count: answered,
  };
  if (!submittedAt && rStatus === 'expired') {
    const deadline = examPersonalDeadline(startedAt, durationMinutes);
    return { ...common, status: 'expired_no_answers', expired_at: deadline, latest_activity_at: deadline || startedAt };
  }
  if (!submittedAt) return { ...common, status: 'in_progress', latest_activity_at: startedAt };
  const status = nextExamStatus('in_progress', 'submitted', { gradingPending, released });
  const releasedAt = status === 'result_released' ? latestOf(submittedAt, releaseAt) : null;
  return {
    ...common,
    status,
    completed_at: submittedAt,
    result_released_at: releasedAt,
    latest_activity_at: submittedAt,
  };
}

/* ------------------------------------------------------------------ */
/* Honest labels (spec): never «abandoned»                             */
/* ------------------------------------------------------------------ */

const PROGRESS_STATUS_LABELS = Object.freeze({
  az: Object.freeze({
    not_started: 'Başlamayıb',
    viewed: 'Baxıb, başlamayıb',
    in_progress: 'Davam edir',
    inactive: 'Fəaliyyətsizdir',
    completed: 'Tamamlayıb',
    expired_auto_submitted: 'Vaxtı bitib — avtomatik təqdim edildi',
    expired_no_answers: 'Vaxtı bitib — cavab yoxdur',
    pending_manual_grading: 'Yoxlama gözləyir',
    result_released: 'Nəticə açıqlanıb',
    not_opened: 'Açmayıb',
    submitted: 'Təhvil verib',
    late_submitted: 'Gecikmə ilə təhvil verib',
    pending_review: 'Yoxlama gözləyir',
    graded: 'Qiymətləndirilib',
    returned_for_revision: 'Yenidən işləməyə qaytarılıb',
    overdue: 'Vaxtı keçib',
    not_viewed: 'Baxmayıb',
    downloaded: 'Faylı yükləyib',
  }),
  en: Object.freeze({
    not_started: 'Not started',
    viewed: 'Viewed, not started',
    in_progress: 'In progress',
    inactive: 'Inactive',
    completed: 'Completed',
    expired_auto_submitted: 'Time ran out — auto-submitted',
    expired_no_answers: 'Time ran out — no answers',
    pending_manual_grading: 'Awaiting review',
    result_released: 'Result released',
    not_opened: 'Not opened',
    submitted: 'Submitted',
    late_submitted: 'Submitted late',
    pending_review: 'Awaiting review',
    graded: 'Graded',
    returned_for_revision: 'Returned for revision',
    overdue: 'Overdue',
    not_viewed: 'Not viewed',
    downloaded: 'Downloaded the file',
  }),
});

module.exports = {
  ACTIVITY_EVENTS,
  STORED_EVENT_TYPES,
  ASSIGNMENT_PROGRESS_STATUSES,
  nextAssignmentStatus,
  assignmentProgressFromLegacy,
  EXAM_PROGRESS_STATUSES,
  EXPIRY_GRACE_SECONDS,
  AUTO_SUBMIT_EARLY_TOLERANCE_SECONDS,
  AUTOSAVE_LATE_TOLERANCE_SECONDS,
  EXAM_INACTIVE_AFTER_MINUTES,
  nextExamStatus,
  hasAnyAnswer,
  countAnsweredQuestions,
  parseAnswers,
  examPersonalDeadline,
  classifySubmission,
  expiredAttemptOutcome,
  examStudentState,
  summarizeExam,
  EXAM_FILTERS,
  examProgressFromLegacy,
  PROGRESS_STATUS_LABELS,
};
