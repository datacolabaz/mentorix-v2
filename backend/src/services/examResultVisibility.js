/**
 * İmtahan nəticəsinin tələbəyə nə vaxt və nə qədər açılacağına dair tək qərar nöqtəsi.
 * Bütün tələbə cavabları (submit, review, siyahı) bu modul vasitəsilə süzülür ki,
 * bağlı rejimdə düzgün cavab və bal serverdən heç çıxmasın.
 */

const RESULT_VISIBILITY_MODES = Object.freeze([
  'immediate_full_review',
  'after_exam_window',
  'after_manual_grading',
  'score_only',
  'wrong_answers_only',
]);

/** Migration-dan əvvəlki show_results=false davranışı (mode NULL). */
const LEGACY_ANSWERS_WITHOUT_KEY = 'legacy_answers_without_key';

function normalizeResultMode(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  return RESULT_VISIBILITY_MODES.includes(v) ? v : null;
}

function effectiveResultMode(exam, { modesEnabled = true } = {}) {
  if (modesEnabled) {
    const mode = normalizeResultMode(exam?.result_visibility_mode);
    if (mode) return mode;
  }
  return exam?.show_results === false ? LEGACY_ANSWERS_WITHOUT_KEY : 'immediate_full_review';
}

/** Köhnə show_results sütunu yeni rejimlə sinxron saxlanılır (köhnə oxucular üçün). */
function showResultsForMode(mode) {
  return mode !== 'score_only';
}

function resultsReleaseAt(exam) {
  const raw = exam?.results_release_at || exam?.available_until || null;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

const FULL = Object.freeze({
  released: true,
  reason: null,
  release_at: null,
  show_score: true,
  show_breakdown: true,
  show_type_summary: true,
  show_correct_answers: true,
  only_wrong: false,
});

const HIDDEN = Object.freeze({
  released: false,
  show_score: false,
  show_breakdown: false,
  show_type_summary: false,
  show_correct_answers: false,
  only_wrong: false,
});

/**
 * @returns {{ mode, released, reason, release_at, show_score, show_breakdown,
 *   show_type_summary, show_correct_answers, only_wrong }}
 */
function resolveStudentResultView(exam, { gradingPending = false, now = new Date(), modesEnabled = true } = {}) {
  const mode = effectiveResultMode(exam, { modesEnabled });
  switch (mode) {
    case LEGACY_ANSWERS_WITHOUT_KEY:
      return { mode, ...FULL, show_correct_answers: false };
    case 'score_only':
      return { mode, ...FULL, show_breakdown: false, show_correct_answers: false };
    case 'wrong_answers_only':
      return { mode, ...FULL, only_wrong: true };
    case 'after_exam_window': {
      const releaseAt = resultsReleaseAt(exam);
      if (releaseAt && now < releaseAt) {
        return { mode, ...HIDDEN, reason: 'exam_window', release_at: releaseAt.toISOString() };
      }
      return { mode, ...FULL };
    }
    case 'after_manual_grading':
      if (gradingPending) return { mode, ...HIDDEN, reason: 'manual_grading', release_at: null };
      return { mode, ...FULL };
    default:
      return { mode, ...FULL };
  }
}

/** Nəticə açılana qədər valideynə/tələbəyə bal bildirişi göndərilməməlidir. */
function isResultDelayed(view) {
  return view?.released === false;
}

function isMistakeRow(row) {
  if (!row) return false;
  if (row.is_correct === false) return true;
  if (row.student_answer === '—' || row.student_answer == null || row.student_answer === '') return true;
  return row.status_label === 'Qismən düzgün';
}

function publicViewMeta(view) {
  return {
    mode: view.mode,
    released: view.released,
    reason: view.reason || null,
    release_at: view.release_at || null,
    show_correct_answers: view.show_correct_answers,
    show_breakdown: view.show_breakdown,
    only_wrong: view.only_wrong,
  };
}

/**
 * Tələbəyə gedən nəticə payload-ını rejimə görə süzür.
 * `breakdown` artıq `show_correct_answers` ilə qurulmuş olmalıdır.
 */
function applyStudentResultView(payload, view) {
  const out = { ...payload, result_visibility: publicViewMeta(view) };
  if (!view.show_score) {
    out.score = null;
    out.score_display = 'hidden';
  }
  if (!view.show_type_summary) out.type_summary = null;
  if (!view.show_breakdown) {
    out.breakdown = [];
    delete out.answers;
  } else if (view.only_wrong && Array.isArray(out.breakdown)) {
    out.breakdown = out.breakdown.filter(isMistakeRow);
  }
  if (!view.released) {
    out.certificate = null;
    out.certificate_meta = null;
  }
  return out;
}

/** Tələbə imtahan siyahısı sətri üçün: açılmamış nəticənin balı və reytinqi gizlədilir. */
function applyStudentListRowView(row, view) {
  const out = { ...row, result_visibility: publicViewMeta(view) };
  if (!view.show_score) {
    out.score = null;
    out.rank_in_group = null;
  }
  return out;
}

module.exports = {
  RESULT_VISIBILITY_MODES,
  LEGACY_ANSWERS_WITHOUT_KEY,
  normalizeResultMode,
  effectiveResultMode,
  showResultsForMode,
  resultsReleaseAt,
  resolveStudentResultView,
  applyStudentResultView,
  applyStudentListRowView,
  isResultDelayed,
  isMistakeRow,
};
