#!/usr/bin/env node
/**
 * Phase C backfill: mövcud məlumatdan aqreqat irəliləyiş sətirlərini doldurur.
 * Miqrasiya DEYİL və boot zamanı işləmir. Əl ilə, əvvəl staging-də işlədin.
 *
 * Usage:
 *   node scripts/backfill-activity-progress.js                 # dry-run (default): heç nə yazmır, READ ONLY tranzaksiya
 *   node scripts/backfill-activity-progress.js --apply         # yazır (5 saniyə gözləyir, Ctrl+C ilə dayandırmaq olar)
 *   --only=materials,assignments,exams   yalnız seçilmiş bölmələr
 *   --batch=500                          bir səhifədə sətir sayı (50..5000)
 *   --instructor=<uuid>                  yalnız bir müəllimin məlumatı
 *
 * Nə edir (idempotent — təkrar işlətmək rəqəmləri şişirtmir):
 *  materials   material_assignments.view_count / last_viewed_at (material_view_events-dən),
 *              first/last_downloaded_at (köhnə klient yükləmə hadisələrindən; download_count toxunulmur).
 *              Yalnız yükləmə ilə «baxıb» sayılan sətirlər SAYILIR, dəyişdirilmir (D18 — qərar gözləyir).
 *  assignments student_assignments.first_submitted_at / submission_count (təhvil verilmiş, boş olanlar);
 *              assignment_status.status və yeni sahələr (yalnız status hələ NULL olan sətirlər).
 *  exams       exam_student_progress (sətri olmayan tələbə × imtahan cütləri; ON CONFLICT DO NOTHING).
 *              Vaxtı bitmiş köhnə açıq cəhdlər yekunlaşdırılmır, yalnız sayılır.
 * Rəqəmlər təxminidir: köhnə məlumatda hər baxış sessiyası ayrıca qeyd olunmayıb.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { materialKind, assignmentStudentStatus, assignmentDueEnd } = require('../src/services/engagementRules');
const { examProgressFromLegacy, parseAnswers } = require('../src/services/activityStatusRules');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECTIONS = ['materials', 'assignments', 'exams'];

function parseArgs(argv) {
  const out = { apply: false, only: new Set(SECTIONS), batch: 500, instructor: null, errors: [] };
  for (const arg of argv) {
    if (arg === '--apply') out.apply = true;
    else if (arg === '--dry-run') out.apply = false;
    else if (arg.startsWith('--only=')) {
      const picked = arg.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
      const bad = picked.filter((s) => !SECTIONS.includes(s));
      if (bad.length) out.errors.push(`Naməlum bölmə: ${bad.join(', ')}`);
      out.only = new Set(picked.filter((s) => SECTIONS.includes(s)));
    } else if (arg.startsWith('--batch=')) {
      const n = Number(arg.slice(8));
      if (!Number.isInteger(n) || n < 50 || n > 5000) out.errors.push('--batch 50..5000 olmalıdır');
      else out.batch = n;
    } else if (arg.startsWith('--instructor=')) {
      const id = arg.slice(13).trim();
      if (!UUID_RE.test(id)) out.errors.push('--instructor UUID olmalıdır');
      else out.instructor = id;
    } else {
      out.errors.push(`Naməlum arqument: ${arg}`);
    }
  }
  return out;
}

function maskedDbHost(url) {
  try {
    const u = new URL(url);
    const host = u.hostname || '?';
    const masked = host.length > 8 ? `${host.slice(0, 4)}…${host.slice(-6)}` : host;
    return `${masked}:${u.port || '5432'}/${(u.pathname || '').replace(/^\//, '') || '?'}`;
  } catch {
    return '(oxunmadı)';
  }
}

function toDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sameTime(a, b) {
  const x = toDate(a);
  const y = toDate(b);
  if (!x && !y) return true;
  if (!x || !y) return false;
  return x.getTime() === y.getTime();
}

/**
 * Bir material_assignments sətri üçün plan. ev = material_view_events aqreqatı.
 * Link materialında klient «yüklə» hadisəsi artıq «açıldı» kimi saxlanılıb, ona görə baxış = açılış.
 */
function planMaterialProgress(row) {
  const kind = materialKind(row.file_type, row.file_url);
  const viewed = Boolean(row.first_viewed_at || row.completed_at);
  const eventViews = kind === 'link' ? Number(row.opens) || 0 : Number(row.views) || 0;
  const viewCount = Math.max(Number(row.view_count) || 0, eventViews, viewed ? 1 : 0);
  const lastViewCandidate = kind === 'link' ? row.last_open_at : row.last_view_at;
  const lastViewedAt = row.last_viewed_at || lastViewCandidate || (viewed ? row.first_viewed_at || row.completed_at : null);
  const hadDownloads = (Number(row.download_count) || 0) > 0;
  const firstDownloadedAt = row.first_downloaded_at || (hadDownloads ? row.first_download_at || null : null);
  const lastDownloadedAt = row.last_downloaded_at || (hadDownloads ? row.last_download_at || null : null);
  const viewedOnlyViaDownload =
    kind !== 'link' && viewed && eventViews === 0 && (Number(row.downloads) || 0) > 0 && !row.video_events;
  const values = {
    view_count: viewCount,
    last_viewed_at: toDate(lastViewedAt),
    first_downloaded_at: toDate(firstDownloadedAt),
    last_downloaded_at: toDate(lastDownloadedAt),
  };
  const changed =
    values.view_count !== (Number(row.view_count) || 0) ||
    !sameTime(values.last_viewed_at, row.last_viewed_at) ||
    !sameTime(values.first_downloaded_at, row.first_downloaded_at) ||
    !sameTime(values.last_downloaded_at, row.last_downloaded_at);
  return { changed, values, viewedOnlyViaDownload };
}

/** assignment_status sətri üçün dəyərlər (canlı sinxronla eyni qayda: assignmentStudentStatus). */
function planAssignmentProgress(row, now = new Date()) {
  const st = { first_opened_at: row.st_first_opened_at, started_at: row.st_started_at, last_activity_at: row.st_last_activity_at };
  const state = assignmentStudentStatus(row, st, { dueDate: row.due_date, now });
  const dueEnd = assignmentDueEnd(row.due_date);
  return {
    status: state.progress_status,
    first_opened_at: toDate(row.st_first_opened_at) || toDate(row.seen_at),
    last_activity_at: toDate(state.last_activity_at),
    submitted_at: toDate(row.submitted_at),
    graded_at: state.graded ? toDate(row.reviewed_at) : null,
    returned_at: toDate(row.returned_at),
    submission_count: Math.max(Number(row.submission_count) || 0, state.submitted ? 1 : 0),
    is_late: state.is_late,
    overdue_at: (state.overdue || state.is_late) && dueEnd ? dueEnd : null,
  };
}

/** exam_student_progress sətri (examProgressFromLegacy + nəticənin açılma qərarı). */
function planExamProgress({ row, exam, questions, now = new Date(), modesEnabled = true, deps = {} }) {
  const gradingPendingFn =
    deps.gradingPending || require('../src/services/openExamGradingService').hasUnconfirmedOpenGrading;
  const resolveView = deps.resolveView || require('../src/services/examResultVisibility').resolveStudentResultView;
  const result = row.result_id
    ? {
        id: row.result_id,
        status: row.result_status,
        started_at: row.result_started_at,
        submitted_at: row.result_submitted_at,
        answers: row.answers,
      }
    : null;
  let gradingPending = false;
  let released = false;
  let releaseAt = null;
  if (result?.submitted_at) {
    const grading = typeof row.grading === 'string' ? JSON.parse(row.grading || '{}') : row.grading || {};
    gradingPending = Boolean(gradingPendingFn(questions || [], parseAnswers(row.answers) || {}, grading));
    const view = resolveView(exam, { gradingPending, now, modesEnabled });
    released = view?.released === true && !gradingPending;
    if (String(exam?.result_visibility_mode || '') === 'after_exam_window') {
      releaseAt = toDate(exam.results_release_at || exam.available_until);
    }
  }
  return examProgressFromLegacy({
    result,
    attemptCount: Number(row.attempt_count) || 0,
    totalQuestions: questions ? questions.length : null,
    gradingPending,
    released,
    releaseAt,
    durationMinutes: Number(exam?.duration_minutes) || 0,
  });
}

/* ------------------------------------------------------------------ */

async function backfillMaterials(client, opts, report) {
  const r = { scanned: 0, to_update: 0, updated: 0, viewed_only_via_download: 0 };
  let lastM = '00000000-0000-0000-0000-000000000000';
  let lastS = '00000000-0000-0000-0000-000000000000';
  for (;;) {
    const { rows } = await client.query(
      `SELECT ma.material_id, ma.student_id, ma.view_count, ma.first_viewed_at, ma.last_viewed_at, ma.completed_at,
              ma.download_count, ma.first_downloaded_at, ma.last_downloaded_at,
              cm.file_type, cm.file_url,
              ev.views, ev.opens, ev.video_events, ev.last_view_at, ev.last_open_at,
              ev.downloads, ev.first_download_at, ev.last_download_at
       FROM material_assignments ma
       JOIN course_materials cm ON cm.id = ma.material_id
       LEFT JOIN LATERAL (
         SELECT COUNT(*) FILTER (WHERE e.event_type IN ('material_viewed', 'video_started'))::int AS views,
                COUNT(*) FILTER (WHERE e.event_type = 'material_opened')::int AS opens,
                COUNT(*) FILTER (WHERE e.event_type LIKE 'video_%')::int AS video_events,
                MAX(e.created_at) FILTER (WHERE e.event_type IN ('material_viewed', 'video_started')) AS last_view_at,
                MAX(e.created_at) FILTER (WHERE e.event_type = 'material_opened') AS last_open_at,
                COUNT(*) FILTER (WHERE e.event_type = 'material_downloaded')::int AS downloads,
                MIN(e.created_at) FILTER (WHERE e.event_type = 'material_downloaded') AS first_download_at,
                MAX(e.created_at) FILTER (WHERE e.event_type = 'material_downloaded') AS last_download_at
         FROM material_view_events e
         WHERE e.material_id = ma.material_id AND e.student_id = ma.student_id
       ) ev ON TRUE
       WHERE ($1::uuid IS NULL OR cm.instructor_id = $1)
         AND (ma.material_id, ma.student_id) > ($2::uuid, $3::uuid)
       ORDER BY ma.material_id, ma.student_id
       LIMIT $4`,
      [opts.instructor, lastM, lastS, opts.batch],
    );
    if (!rows.length) break;
    lastM = rows[rows.length - 1].material_id;
    lastS = rows[rows.length - 1].student_id;
    r.scanned += rows.length;
    const changes = [];
    for (const row of rows) {
      const plan = planMaterialProgress(row);
      if (plan.viewedOnlyViaDownload) r.viewed_only_via_download += 1;
      if (plan.changed) changes.push({ row, v: plan.values });
    }
    r.to_update += changes.length;
    if (opts.apply && changes.length) {
      const res = await client.query(
        `UPDATE material_assignments ma SET
           view_count = GREATEST(ma.view_count, v.view_count),
           last_viewed_at = COALESCE(ma.last_viewed_at, v.last_viewed_at),
           first_downloaded_at = COALESCE(ma.first_downloaded_at, v.first_downloaded_at),
           last_downloaded_at = COALESCE(ma.last_downloaded_at, v.last_downloaded_at),
           updated_at = NOW()
         FROM unnest($1::uuid[], $2::uuid[], $3::int[], $4::timestamptz[], $5::timestamptz[], $6::timestamptz[])
           AS v(material_id, student_id, view_count, last_viewed_at, first_downloaded_at, last_downloaded_at)
         WHERE ma.material_id = v.material_id AND ma.student_id = v.student_id`,
        [
          changes.map((c) => c.row.material_id),
          changes.map((c) => c.row.student_id),
          changes.map((c) => c.v.view_count),
          changes.map((c) => c.v.last_viewed_at),
          changes.map((c) => c.v.first_downloaded_at),
          changes.map((c) => c.v.last_downloaded_at),
        ],
      );
      r.updated += res.rowCount;
    }
  }
  report.materials = r;
}

async function backfillAssignments(client, opts, report) {
  const r = { submissions_to_fix: 0, submissions_fixed: 0, progress_scanned: 0, progress_to_write: 0, progress_written: 0, by_status: {} };
  const { rows: cnt } = await client.query(
    `SELECT COUNT(*)::int AS n FROM student_assignments sa JOIN assignments a ON a.id = sa.assignment_id
     WHERE sa.submitted_at IS NOT NULL AND (sa.first_submitted_at IS NULL OR sa.submission_count = 0)
       AND ($1::uuid IS NULL OR a.instructor_id = $1)`,
    [opts.instructor],
  );
  r.submissions_to_fix = cnt[0].n;
  if (opts.apply) {
    for (;;) {
      const res = await client.query(
        `UPDATE student_assignments sa SET
           first_submitted_at = COALESCE(sa.first_submitted_at, sa.submitted_at),
           submission_count = GREATEST(sa.submission_count, 1)
         WHERE sa.id IN (
           SELECT x.id FROM student_assignments x JOIN assignments a ON a.id = x.assignment_id
           WHERE x.submitted_at IS NOT NULL AND (x.first_submitted_at IS NULL OR x.submission_count = 0)
             AND ($1::uuid IS NULL OR a.instructor_id = $1)
           LIMIT $2
         )`,
        [opts.instructor, opts.batch],
      );
      r.submissions_fixed += res.rowCount;
      if (res.rowCount === 0) break;
    }
  }

  const now = new Date();
  let lastA = '00000000-0000-0000-0000-000000000000';
  let lastS = '00000000-0000-0000-0000-000000000000';
  for (;;) {
    const { rows } = await client.query(
      `SELECT sa.assignment_id, sa.student_id, sa.status, sa.submitted_at, sa.first_submitted_at, sa.reviewed_at,
              sa.returned_at, sa.submission_count, sa.seen_at, sa.score, a.due_date,
              st.first_opened_at AS st_first_opened_at, st.started_at AS st_started_at,
              st.last_activity_at AS st_last_activity_at
       FROM student_assignments sa
       JOIN assignments a ON a.id = sa.assignment_id
       LEFT JOIN assignment_status st ON st.assignment_id = sa.assignment_id AND st.student_id = sa.student_id
       WHERE st.status IS NULL
         AND ($1::uuid IS NULL OR a.instructor_id = $1)
         AND (sa.assignment_id, sa.student_id) > ($2::uuid, $3::uuid)
       ORDER BY sa.assignment_id, sa.student_id
       LIMIT $4`,
      [opts.instructor, lastA, lastS, opts.batch],
    );
    if (!rows.length) break;
    lastA = rows[rows.length - 1].assignment_id;
    lastS = rows[rows.length - 1].student_id;
    r.progress_scanned += rows.length;
    const plans = rows.map((row) => ({ row, p: planAssignmentProgress(row, now) }));
    for (const { p } of plans) r.by_status[p.status] = (r.by_status[p.status] || 0) + 1;
    r.progress_to_write += plans.length;
    if (opts.apply) {
      const res = await client.query(
        `INSERT INTO assignment_status AS s (
           assignment_id, student_id, status, first_opened_at, last_activity_at, submitted_at, graded_at,
           returned_at, submission_count, is_late, overdue_at, created_at, updated_at
         )
         SELECT v.assignment_id, v.student_id, v.status, v.first_opened_at, v.last_activity_at, v.submitted_at,
                v.graded_at, v.returned_at, v.submission_count, v.is_late, v.overdue_at, NOW(), NOW()
         FROM unnest($1::uuid[], $2::uuid[], $3::text[], $4::timestamptz[], $5::timestamptz[], $6::timestamptz[],
                     $7::timestamptz[], $8::timestamptz[], $9::int[], $10::bool[], $11::timestamptz[])
           AS v(assignment_id, student_id, status, first_opened_at, last_activity_at, submitted_at, graded_at,
                returned_at, submission_count, is_late, overdue_at)
         ON CONFLICT (assignment_id, student_id) DO UPDATE SET
           status = EXCLUDED.status,
           first_opened_at = COALESCE(s.first_opened_at, EXCLUDED.first_opened_at),
           last_activity_at = COALESCE(s.last_activity_at, EXCLUDED.last_activity_at),
           submitted_at = EXCLUDED.submitted_at,
           graded_at = EXCLUDED.graded_at,
           returned_at = EXCLUDED.returned_at,
           submission_count = GREATEST(s.submission_count, EXCLUDED.submission_count),
           is_late = EXCLUDED.is_late,
           overdue_at = COALESCE(s.overdue_at, EXCLUDED.overdue_at),
           updated_at = NOW()
         WHERE s.status IS NULL`,
        [
          plans.map((x) => x.row.assignment_id),
          plans.map((x) => x.row.student_id),
          plans.map((x) => x.p.status),
          plans.map((x) => x.p.first_opened_at),
          plans.map((x) => x.p.last_activity_at),
          plans.map((x) => x.p.submitted_at),
          plans.map((x) => x.p.graded_at),
          plans.map((x) => x.p.returned_at),
          plans.map((x) => x.p.submission_count),
          plans.map((x) => x.p.is_late),
          plans.map((x) => x.p.overdue_at),
        ],
      );
      r.progress_written += res.rowCount;
    }
  }
  report.assignments = r;
}

async function backfillExams(client, opts, report) {
  const r = { scanned: 0, to_insert: 0, inserted: 0, by_status: {}, stale_open_attempts: 0 };
  const { rows: stale } = await client.query(
    `SELECT COUNT(*)::int AS n FROM exam_results er JOIN exams e ON e.id = er.exam_id
     WHERE er.submitted_at IS NULL AND er.status = 'in_progress' AND COALESCE(e.duration_minutes, 0) > 0
       AND er.started_at + make_interval(mins => e.duration_minutes) < NOW()
       AND ($1::uuid IS NULL OR e.instructor_id = $1)`,
    [opts.instructor],
  );
  r.stale_open_attempts = stale[0].n;

  const { rows: flag } = await client
    .query(`SELECT enabled FROM platform_feature_flags WHERE key = 'feature.exam_result_modes.enabled'`)
    .catch(() => ({ rows: [] }));
  const modesEnabled = flag.length ? flag[0].enabled === true : true;

  const examCache = new Map();
  async function examInfo(examId) {
    if (examCache.has(examId)) return examCache.get(examId);
    const { rows: ex } = await client.query(
      `SELECT id, duration_minutes, show_results, result_visibility_mode, results_release_at, available_until
       FROM exams WHERE id = $1`,
      [examId],
    );
    const { rows: questions } = await client.query('SELECT * FROM exam_questions WHERE exam_id = $1', [examId]);
    const info = { exam: ex[0] || null, questions };
    if (examCache.size > 200) examCache.clear();
    examCache.set(examId, info);
    return info;
  }

  const now = new Date();
  let lastE = '00000000-0000-0000-0000-000000000000';
  let lastS = '00000000-0000-0000-0000-000000000000';
  for (;;) {
    const { rows } = await client.query(
      `WITH ex AS (
         SELECT e.id FROM exams e
         WHERE COALESCE(e.is_deleted, FALSE) = FALSE AND ($1::uuid IS NULL OR e.instructor_id = $1)
       ),
       roster AS (
         SELECT ea.exam_id, ea.student_id FROM exam_assignments ea JOIN ex ON ex.id = ea.exam_id
         UNION
         SELECT er.exam_id, er.student_id FROM exam_results er JOIN ex ON ex.id = er.exam_id
       )
       SELECT r.exam_id, r.student_id,
              lr.id AS result_id, lr.status AS result_status, lr.started_at AS result_started_at,
              lr.submitted_at AS result_submitted_at, lr.answers, lr.grading,
              (SELECT COUNT(*)::int FROM exam_results c
                WHERE c.exam_id = r.exam_id AND c.student_id = r.student_id
                  AND COALESCE(c.status, '') <> 'voided') AS attempt_count
       FROM roster r
       LEFT JOIN exam_student_progress p ON p.exam_id = r.exam_id AND p.student_id = r.student_id
       LEFT JOIN LATERAL (
         SELECT er.id, er.status, er.started_at, er.submitted_at, er.answers, er.grading
         FROM exam_results er
         WHERE er.exam_id = r.exam_id AND er.student_id = r.student_id AND COALESCE(er.status, '') <> 'voided'
         ORDER BY (er.submitted_at IS NOT NULL) DESC, er.submitted_at DESC NULLS LAST, er.started_at DESC NULLS LAST
         LIMIT 1
       ) lr ON TRUE
       WHERE p.exam_id IS NULL
         AND (r.exam_id, r.student_id) > ($2::uuid, $3::uuid)
       ORDER BY r.exam_id, r.student_id
       LIMIT $4`,
      [opts.instructor, lastE, lastS, opts.batch],
    );
    if (!rows.length) break;
    lastE = rows[rows.length - 1].exam_id;
    lastS = rows[rows.length - 1].student_id;
    r.scanned += rows.length;
    const plans = [];
    for (const row of rows) {
      const { exam, questions } = await examInfo(row.exam_id);
      if (!exam) continue;
      const p = planExamProgress({ row, exam, questions, now, modesEnabled });
      r.by_status[p.status] = (r.by_status[p.status] || 0) + 1;
      plans.push({ row, p });
    }
    r.to_insert += plans.length;
    if (opts.apply && plans.length) {
      const res = await client.query(
        `INSERT INTO exam_student_progress (
           exam_id, student_id, status, current_result_id, started_at, completed_at, expired_at,
           result_released_at, latest_activity_at, answered_question_count, total_question_count, attempt_count
         )
         SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::text[], $4::uuid[], $5::timestamptz[], $6::timestamptz[],
                              $7::timestamptz[], $8::timestamptz[], $9::timestamptz[], $10::int[], $11::int[], $12::int[])
         ON CONFLICT (exam_id, student_id) DO NOTHING`,
        [
          plans.map((x) => x.row.exam_id),
          plans.map((x) => x.row.student_id),
          plans.map((x) => x.p.status),
          plans.map((x) => x.p.current_result_id),
          plans.map((x) => toDate(x.p.started_at)),
          plans.map((x) => toDate(x.p.completed_at)),
          plans.map((x) => toDate(x.p.expired_at)),
          plans.map((x) => toDate(x.p.result_released_at)),
          plans.map((x) => toDate(x.p.latest_activity_at)),
          plans.map((x) => x.p.answered_question_count || 0),
          plans.map((x) => (x.p.total_question_count == null ? null : x.p.total_question_count)),
          plans.map((x) => x.p.attempt_count || 0),
        ],
      );
      r.inserted += res.rowCount;
    }
  }
  report.exams = r;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.errors.length) {
    console.error(opts.errors.join('\n'));
    process.exit(2);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL təyin olunmayıb');
    process.exit(2);
  }
  console.log(`[backfill] DB: ${maskedDbHost(url)}`);
  console.log(`[backfill] Rejim: ${opts.apply ? 'APPLY (yazır)' : 'DRY-RUN (heç nə yazılmır)'}`);
  console.log(`[backfill] Bölmələr: ${[...opts.only].join(', ')}; batch=${opts.batch}; instructor=${opts.instructor || 'hamısı'}`);
  if (opts.apply) {
    console.log('[backfill] 5 saniyə sonra başlayır… (dayandırmaq üçün Ctrl+C)');
    await new Promise((r) => setTimeout(r, 5000));
  }

  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: url,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 1,
  });
  const client = await pool.connect();
  const report = {};
  try {
    const sections = [
      ['materials', backfillMaterials],
      ['assignments', backfillAssignments],
      ['exams', backfillExams],
    ];
    for (const [name, fn] of sections) {
      if (!opts.only.has(name)) continue;
      await client.query(opts.apply ? 'BEGIN' : 'BEGIN READ ONLY');
      try {
        await fn(client, opts, report);
        await client.query(opts.apply ? 'COMMIT' : 'ROLLBACK');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(`${name}: ${e.message}`);
      }
      console.log(`[backfill] ${name}:`, JSON.stringify(report[name]));
    }
    console.log('[backfill] Bitdi.', opts.apply ? '' : 'Dry-run: heç nə yazılmadı. Yazmaq üçün --apply.');
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('[backfill] XƏTA:', e.message);
    process.exit(1);
  });
}

module.exports = { parseArgs, maskedDbHost, planMaterialProgress, planAssignmentProgress, planExamProgress };
