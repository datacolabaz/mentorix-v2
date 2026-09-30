const {
  ACTIVITY_EVENTS,
  EXPIRY_GRACE_SECONDS,
  AUTOSAVE_LATE_TOLERANCE_SECONDS,
  nextExamStatus,
  parseAnswers,
  countAnsweredQuestions,
  examPersonalDeadline,
} = require('./activityStatusRules');
const { logActivityEvent } = require('./activityProgressService');

/**
 * İmtahan cəhdinin həyat dövrü: baxış, başlama, autosave, təqdim, vaxt bitməsi, nəticənin açılması.
 * İstifadəçi qərarı: vaxt bitəndə mövcud cavablar silinmir — avtomatik təqdim olunur və adi qaydada qiymətləndirilir;
 * cavabı olmayan cəhd «cavabsız» (exam_results.status = 'expired') qalır və orta nəticəyə düşmür.
 * Yarış təhlükəsizliyi: yekunlaşdırma sətri FOR UPDATE ilə kilidləyir və yalnız
 * `submitted_at IS NULL AND status = 'in_progress'` olduqda yazır; tələbənin eyni anda göndərdiyi təqdim də
 * eyni şərtlə yazılır, ona görə cəhd yalnız bir dəfə yekunlaşır.
 * Autosave jurnala yazılmır və heç bir bildiriş yaratmır (yalnız aqreqat sətirdə son fəaliyyət vaxtı).
 */

const MAX_AUTOSAVE_BYTES = 200 * 1024;
const SWEEP_LOOKBACK_HOURS = 48;

function httpError(status, message, code) {
  const err = new Error(message);
  err.statusCode = status;
  if (code) err.code = code;
  return err;
}

const DEFAULT_DEPS = {
  get db() {
    return require('../utils/db');
  },
  grade(questions, answers, exam) {
    const { buildAutoGradingMap, calculateScore } = require('./examService');
    const grading = buildAutoGradingMap(questions, answers);
    const score = calculateScore(questions, answers, {
      wrongPenaltyEnabled: exam?.wrong_penalty_enabled !== false,
      grading,
    });
    return { grading, score };
  },
  gradingPending(questions, answers, grading) {
    return require('./openExamGradingService').hasUnconfirmedOpenGrading(questions, answers, grading);
  },
  async resultView(exam, gradingPending, now) {
    const { resolveStudentResultView } = require('./examResultVisibility');
    const { isFeatureEnabled } = require('./featureFlagService');
    const { FEATURE_FLAGS } = require('../constants/featureFlags');
    const modesEnabled = await isFeatureEnabled(FEATURE_FLAGS.EXAM_RESULT_MODES).catch(() => true);
    return resolveStudentResultView(exam, { gradingPending, now, modesEnabled });
  },
  async isCrmStudent(instructorId, studentId) {
    if (!instructorId) return false;
    return require('./crmStudentService').isCrmStudentForInstructor(instructorId, studentId);
  },
  /** Avtomatik təqdimdən sonra (tələbə ekranda deyil): AI yoxlama növbəsi + iştirakçı qrupu. Sertifikat/valideyn bildirişi yox. */
  afterAutoSubmit({ examResultId, examId, studentId, needsAi }) {
    setImmediate(async () => {
      try {
        if (needsAi) await require('./openExamGradingService').enqueueOpenGradingJob(examResultId);
      } catch (e) {
        console.error('[exam-expiry] enqueueOpenGradingJob', e.message);
      }
      try {
        await require('../utils/db').transaction(async (client) => {
          const { addStudentToExamParticipantGroup } = require('./participantGroupService');
          await addStudentToExamParticipantGroup(client, examId, studentId);
        });
      } catch (e) {
        console.error('[exam-expiry] addStudentToExamParticipantGroup', e.message);
      }
    });
  },
  needsAiGrading(questions, answers, grading) {
    return require('./openExamGradingService').hasOpenQuestionsNeedingAi(questions, answers, grading);
  },
  get hooks() {
    return require('./activityNotificationHooks');
  },
};

function createAssessmentAttemptService(overrides = {}) {
  const dep = (k) => (Object.prototype.hasOwnProperty.call(overrides, k) ? overrides[k] : DEFAULT_DEPS[k]);
  const db = () => dep('db');
  const hooks = () => dep('hooks');

  /** exam_student_progress sətrini hadisəyə görə yeniləyir (yalnız irəli; təkrar hadisə no-op). */
  async function syncExamProgress(
    client,
    {
      examId,
      studentId,
      event,
      at,
      resultId = null,
      gradingPending = false,
      released = false,
      answeredCount = null,
      totalQuestions = null,
      newAttempt = false,
      deadline = null,
    },
  ) {
    await client.query(
      `INSERT INTO exam_student_progress (exam_id, student_id) VALUES ($1, $2)
       ON CONFLICT (exam_id, student_id) DO NOTHING`,
      [examId, studentId],
    );
    const { rows } = await client.query(
      `SELECT status, expired_at FROM exam_student_progress
       WHERE exam_id = $1 AND student_id = $2 FOR UPDATE`,
      [examId, studentId],
    );
    const cur = rows[0] || {};
    const next = nextExamStatus(cur.status, event, {
      gradingPending,
      released,
      autoSubmitted: Boolean(cur.expired_at),
    });
    const params = [examId, studentId, next, at];
    const sets = ['status = $3', 'updated_at = NOW()', 'latest_activity_at = GREATEST(COALESCE(latest_activity_at, $4), $4)'];
    const add = (sql, value) => {
      params.push(value);
      sets.push(sql.replace('?', `$${params.length}`));
    };
    switch (event) {
      case 'viewed':
        sets.push('viewed_at = COALESCE(viewed_at, $4)');
        break;
      case 'started':
        sets.push('viewed_at = COALESCE(viewed_at, $4)');
        sets.push(newAttempt ? 'started_at = $4' : 'started_at = COALESCE(started_at, $4)');
        if (newAttempt) sets.push('attempt_count = attempt_count + 1');
        if (resultId) add('current_result_id = ?', resultId);
        break;
      case 'submitted':
      case 'auto_submitted':
        sets.push('completed_at = COALESCE(completed_at, $4)');
        if (event === 'auto_submitted') add('expired_at = COALESCE(expired_at, ?)', deadline || at);
        if (resultId) add('current_result_id = ?', resultId);
        break;
      case 'expired_no_answers':
        add('expired_at = COALESCE(expired_at, ?)', deadline || at);
        if (resultId) add('current_result_id = ?', resultId);
        break;
      case 'voided':
        sets.push(
          'current_result_id = NULL',
          'started_at = NULL',
          'completed_at = NULL',
          'expired_at = NULL',
          'result_released_at = NULL',
          'answered_question_count = 0',
        );
        break;
      default:
        break;
    }
    if (next === 'result_released') sets.push('result_released_at = COALESCE(result_released_at, $4)');
    if (answeredCount != null) add('answered_question_count = ?', answeredCount);
    if (totalQuestions != null) add('total_question_count = ?', totalQuestions);
    await client.query(
      `UPDATE exam_student_progress SET ${sets.join(', ')} WHERE exam_id = $1 AND student_id = $2`,
      params,
    );
    return { previous: cur.status || 'not_started', status: next };
  }

  async function examMeta(client, examId) {
    const { rows } = await client.query('SELECT id, instructor_id FROM exams WHERE id = $1', [examId]);
    return rows[0] || null;
  }

  function examLog(client, { exam, studentId, eventType, metadata = {}, dedupeKey = null }) {
    return logActivityEvent(client, {
      studentId,
      instructorId: exam?.instructor_id || null,
      entityType: 'exam',
      entityId: exam?.id,
      eventType,
      metadata,
      dedupeKey,
    });
  }

  /** Tələbə imtahan pəncərəsini açdı (başlamadan). Bir dəfə yazılır. */
  async function recordExamViewed({ studentId, examId, now = new Date() }) {
    const { rows } = await db().query(
      `SELECT 1 FROM exam_assignments WHERE exam_id = $1 AND student_id = $2
       UNION ALL
       SELECT 1 FROM exam_results WHERE exam_id = $1 AND student_id = $2
       LIMIT 1`,
      [examId, studentId],
    );
    if (!rows.length) throw httpError(403, 'İcazə yoxdur', 'EXAM_FORBIDDEN');
    return db().transaction(async (client) => {
      const exam = await examMeta(client, examId);
      if (!exam) throw httpError(404, 'Tapılmadı');
      const res = await syncExamProgress(client, { examId, studentId, event: 'viewed', at: now });
      await examLog(client, { exam, studentId, eventType: ACTIVITY_EVENTS.ASSESSMENT_VIEWED, dedupeKey: 'viewed' });
      return res;
    });
  }

  /** Yeni cəhd başladı (exam_results sətri yaradıldı). */
  async function recordExamStarted({ studentId, examId, resultId, startedAt = new Date(), totalQuestions = null }) {
    return db().transaction(async (client) => {
      const exam = await examMeta(client, examId);
      if (!exam) return null;
      const res = await syncExamProgress(client, {
        examId,
        studentId,
        event: 'started',
        at: startedAt,
        resultId,
        newAttempt: true,
        totalQuestions,
        answeredCount: 0,
      });
      await examLog(client, {
        exam,
        studentId,
        eventType: ACTIVITY_EVENTS.ASSESSMENT_STARTED,
        metadata: { result_id: resultId },
        dedupeKey: resultId ? `started:${resultId}` : null,
      });
      return res;
    });
  }

  /**
   * Tələbənin təqdimi uğurla yazıldıqdan sonra (submitExam). kind: manual | auto_expired.
   * released = nəticə tələbəyə indi açıqdır və yoxlama gözləmir.
   */
  async function recordExamSubmitted({
    studentId,
    examId,
    resultId,
    submittedAt = new Date(),
    kind = 'manual',
    deadline = null,
    gradingPending = false,
    released = false,
    answeredCount = 0,
    totalQuestions = null,
  }) {
    const auto = kind === 'auto_expired';
    const out = await db().transaction(async (client) => {
      const exam = await examMeta(client, examId);
      if (!exam) return null;
      const res = await syncExamProgress(client, {
        examId,
        studentId,
        event: auto ? 'auto_submitted' : 'submitted',
        at: submittedAt,
        resultId,
        gradingPending,
        released,
        answeredCount,
        totalQuestions,
        deadline,
      });
      await examLog(client, {
        exam,
        studentId,
        eventType: ACTIVITY_EVENTS.ASSESSMENT_SUBMITTED,
        metadata: { result_id: resultId, kind, answered_count: answeredCount, grading_pending: gradingPending },
        dedupeKey: `submitted:${resultId}`,
      });
      if (auto) {
        await examLog(client, {
          exam,
          studentId,
          eventType: ACTIVITY_EVENTS.ASSESSMENT_EXPIRED,
          metadata: { result_id: resultId, outcome: 'auto_submitted', via: 'client_timer', answered_count: answeredCount },
          dedupeKey: `expired:${resultId}`,
        });
      }
      if (res.status === 'result_released') {
        await examLog(client, {
          exam,
          studentId,
          eventType: ACTIVITY_EVENTS.RESULT_RELEASED,
          metadata: { result_id: resultId },
          dedupeKey: `result_released:${resultId}`,
        });
      }
      return { exam, res };
    });
    if (out) {
      const payload = { examId, examResultId: resultId, studentId, instructorId: out.exam.instructor_id };
      if (auto) hooks().onAssessmentAutoSubmitted(payload);
      else hooks().onAssessmentSubmitted(payload);
      if (out.res.status === 'result_released') hooks().onResultReleased(payload);
    }
    return out ? out.res : null;
  }

  /**
   * Vaxtı bitmiş açıq cəhdi yekunlaşdırır. Cavab varsa avtomatik təqdim + qiymətləndirmə, yoxdursa «cavabsız».
   * Idempotent: artıq yekunlaşmış cəhd üçün heç nə etmir.
   * @param {{ now?: Date, graceSeconds?: number, via?: string, minimumMinutes?: number }} opts
   */
  async function finalizeExpiredAttempt(resultId, { now = new Date(), graceSeconds = EXPIRY_GRACE_SECONDS, via = 'sweep', minimumMinutes = 0 } = {}) {
    const out = await db().transaction(async (client) => {
      const { rows } = await client.query(
        `SELECT er.id, er.exam_id, er.student_id, er.started_at, er.submitted_at, er.status, er.answers,
                e.duration_minutes, e.instructor_id, e.wrong_penalty_enabled, e.show_results,
                e.result_visibility_mode, e.results_release_at, e.available_until
         FROM exam_results er
         JOIN exams e ON e.id = er.exam_id
         WHERE er.id = $1
         FOR UPDATE OF er`,
        [resultId],
      );
      const r = rows[0];
      if (!r) return { finalized: false, reason: 'not_found' };
      const st = String(r.status || 'in_progress').toLowerCase();
      if (r.submitted_at) return { finalized: false, reason: 'already_final', outcome: 'submitted' };
      if (st === 'expired') return { finalized: false, reason: 'already_final', outcome: 'expired_no_answers' };
      if (st !== 'in_progress') return { finalized: false, reason: 'already_final', outcome: st };

      const deadline = examPersonalDeadline(r.started_at, r.duration_minutes, { minimumMinutes });
      if (!deadline) return { finalized: false, reason: 'no_deadline' };
      if (now.getTime() <= deadline.getTime() + graceSeconds * 1000) return { finalized: false, reason: 'not_expired' };

      const answers = parseAnswers(r.answers) || {};
      const answered = countAnsweredQuestions(answers);
      const { rows: questions } = await client.query(
        'SELECT * FROM exam_questions WHERE exam_id = $1 ORDER BY order_num',
        [r.exam_id],
      );
      const exam = { id: r.exam_id, instructor_id: r.instructor_id };

      if (answered === 0) {
        const upd = await client.query(
          `UPDATE exam_results SET status = 'expired'
           WHERE id = $1 AND submitted_at IS NULL AND COALESCE(status, 'in_progress') = 'in_progress'
           RETURNING id`,
          [r.id],
        );
        if (!upd.rows.length) return { finalized: false, reason: 'race' };
        await syncExamProgress(client, {
          examId: r.exam_id,
          studentId: r.student_id,
          event: 'expired_no_answers',
          at: deadline,
          resultId: r.id,
          answeredCount: 0,
          totalQuestions: questions.length,
          deadline,
        });
        await examLog(client, {
          exam,
          studentId: r.student_id,
          eventType: ACTIVITY_EVENTS.ASSESSMENT_EXPIRED,
          metadata: { result_id: r.id, outcome: 'no_answers', via },
          dedupeKey: `expired:${r.id}`,
        });
        return { finalized: true, outcome: 'expired_no_answers', row: r, deadline };
      }

      const { grading, score } = dep('grade')(questions, answers, r);
      const pending = Boolean(dep('gradingPending')(questions, answers, grading));
      const view = await dep('resultView')(r, pending, now);
      const released = view?.released === true && !pending;
      const isCrm = await Promise.resolve(dep('isCrmStudent')(r.instructor_id, r.student_id)).catch(() => false);
      const startedMs = new Date(r.started_at).getTime();
      const duration = Math.max(0, Math.floor((deadline.getTime() - startedMs) / 1000));
      const upd = await client.query(
        `UPDATE exam_results
         SET score = $2, answers = $3, grading = $4, status = 'completed',
             submitted_at = $5, duration_seconds = $6, is_crm_student = $7
         WHERE id = $1 AND submitted_at IS NULL AND COALESCE(status, 'in_progress') = 'in_progress'
         RETURNING id`,
        [r.id, score, JSON.stringify(answers), JSON.stringify(grading), deadline, duration, Boolean(isCrm)],
      );
      if (!upd.rows.length) return { finalized: false, reason: 'race' };
      const res = await syncExamProgress(client, {
        examId: r.exam_id,
        studentId: r.student_id,
        event: 'auto_submitted',
        at: deadline,
        resultId: r.id,
        gradingPending: pending,
        released,
        answeredCount: answered,
        totalQuestions: questions.length,
        deadline,
      });
      await examLog(client, {
        exam,
        studentId: r.student_id,
        eventType: ACTIVITY_EVENTS.ASSESSMENT_EXPIRED,
        metadata: { result_id: r.id, outcome: 'auto_submitted', via, answered_count: answered },
        dedupeKey: `expired:${r.id}`,
      });
      await examLog(client, {
        exam,
        studentId: r.student_id,
        eventType: ACTIVITY_EVENTS.ASSESSMENT_SUBMITTED,
        metadata: { result_id: r.id, kind: 'auto_expired', answered_count: answered, grading_pending: pending },
        dedupeKey: `submitted:${r.id}`,
      });
      if (res.status === 'result_released') {
        await examLog(client, {
          exam,
          studentId: r.student_id,
          eventType: ACTIVITY_EVENTS.RESULT_RELEASED,
          metadata: { result_id: r.id },
          dedupeKey: `result_released:${r.id}`,
        });
      }
      const needsAi = Boolean(dep('needsAiGrading')(questions, answers, grading));
      return {
        finalized: true,
        outcome: 'expired_auto_submitted',
        row: r,
        deadline,
        score,
        gradingPending: pending,
        released: res.status === 'result_released',
        needsAi,
      };
    });

    if (out.finalized) {
      const payload = {
        examId: out.row.exam_id,
        examResultId: out.row.id,
        studentId: out.row.student_id,
        instructorId: out.row.instructor_id,
      };
      if (out.outcome === 'expired_auto_submitted') {
        dep('afterAutoSubmit')({ ...payload, needsAi: out.needsAi });
        hooks().onAssessmentAutoSubmitted(payload);
        if (out.released) hooks().onResultReleased(payload);
      } else {
        hooks().onAssessmentExpiredNoAnswers(payload);
      }
    }
    const { row, ...rest } = out;
    return row ? { ...rest, exam_id: row.exam_id, student_id: row.student_id, result_id: row.id } : rest;
  }

  /** Tələbə cavablarını serverdə saxlayır ki, vaxt bitəndə və ya tab bağlananda itməsin. */
  async function autosaveAttempt({ studentId, examId, answers, now = new Date() }) {
    const parsed = parseAnswers(answers);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw httpError(400, 'Cavablar düzgün deyil', 'EXAM_AUTOSAVE_INVALID');
    }
    const json = JSON.stringify(parsed);
    if (Buffer.byteLength(json, 'utf8') > MAX_AUTOSAVE_BYTES) {
      throw httpError(413, 'Cavablar çox böyükdür', 'EXAM_AUTOSAVE_TOO_LARGE');
    }
    const { rows } = await db().query(
      `UPDATE exam_results er
       SET answers = $3::jsonb
       FROM exams e
       WHERE er.id = (
           SELECT x.id FROM exam_results x
           WHERE x.exam_id = $1 AND x.student_id = $2
             AND x.submitted_at IS NULL AND COALESCE(x.status, 'in_progress') = 'in_progress'
           ORDER BY x.started_at DESC NULLS LAST
           LIMIT 1
         )
         AND e.id = er.exam_id
         AND COALESCE(e.is_deleted, FALSE) = FALSE
         AND er.submitted_at IS NULL
         AND (
           COALESCE(e.duration_minutes, 0) <= 0
           OR er.started_at + make_interval(mins => GREATEST(e.duration_minutes, 1))
                            + make_interval(secs => $4) >= NOW()
         )
       RETURNING er.id`,
      [examId, studentId, json, AUTOSAVE_LATE_TOLERANCE_SECONDS],
    );
    if (!rows.length) {
      throw httpError(409, 'Cavablar saxlanılmadı: aktiv cəhd yoxdur və ya vaxt bitib', 'EXAM_NOT_ACTIVE');
    }
    const answeredCount = countAnsweredQuestions(parsed);
    await db().transaction((client) =>
      syncExamProgress(client, { examId, studentId, event: 'activity', at: now, answeredCount }),
    );
    return { saved: true, answered_count: answeredCount, saved_at: now.toISOString() };
  }

  /**
   * Müəllim gec giriş verəndə: cavabsız bitmiş cəhd «ləğv edilmiş» (voided) olur ki, tələbə yenidən başlaya bilsin.
   * Ləğv edilmiş cəhd heç bir sayğaca və orta nəticəyə düşmür. Cavablı (avtomatik təqdim olunmuş) cəhdlərə toxunulmur.
   */
  async function voidExpiredAttemptsForLateAccess({ examId, studentId, actorId = null, now = new Date() }) {
    return db().transaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE exam_results SET status = 'voided'
         WHERE exam_id = $1 AND student_id = $2 AND submitted_at IS NULL AND status = 'expired'
         RETURNING id`,
        [examId, studentId],
      );
      if (!rows.length) return 0;
      const exam = await examMeta(client, examId);
      await syncExamProgress(client, { examId, studentId, event: 'voided', at: now });
      for (const r of rows) {
        await examLog(client, {
          exam,
          studentId,
          eventType: ACTIVITY_EVENTS.ASSESSMENT_ATTEMPT_VOIDED,
          metadata: { result_id: r.id, reason: 'late_access_granted', ...(actorId ? { actor_id: actorId } : {}) },
          dedupeKey: `voided:${r.id}`,
        });
      }
      return rows.length;
    });
  }

  /** Müəllim açıq sualı təsdiqlədikdən sonra: yoxlama bitibsə status yenilənir, nəticə açıqdırsa RESULT_RELEASED. */
  async function refreshAfterOpenGrading(examResultId, { now = new Date() } = {}) {
    const { rows } = await db().query(
      `SELECT er.id, er.exam_id, er.student_id, er.answers, er.grading, er.submitted_at,
              e.instructor_id, e.show_results, e.result_visibility_mode, e.results_release_at, e.available_until
       FROM exam_results er JOIN exams e ON e.id = er.exam_id
       WHERE er.id = $1 AND er.submitted_at IS NOT NULL`,
      [examResultId],
    );
    const r = rows[0];
    if (!r) return null;
    const { rows: questions } = await db().query(
      'SELECT * FROM exam_questions WHERE exam_id = $1 ORDER BY order_num',
      [r.exam_id],
    );
    const grading = typeof r.grading === 'string' ? JSON.parse(r.grading || '{}') : r.grading || {};
    const pending = Boolean(dep('gradingPending')(questions, parseAnswers(r.answers) || {}, grading));
    if (pending) return { status: 'pending_manual_grading' };
    const view = await dep('resultView')(r, false, now);
    const released = view?.released === true;
    const out = await db().transaction(async (client) => {
      const res = await syncExamProgress(client, {
        examId: r.exam_id,
        studentId: r.student_id,
        event: 'grading_confirmed',
        at: now,
        released,
      });
      if (res.status === 'result_released' && res.previous !== 'result_released') {
        await examLog(client, {
          exam: { id: r.exam_id, instructor_id: r.instructor_id },
          studentId: r.student_id,
          eventType: ACTIVITY_EVENTS.RESULT_RELEASED,
          metadata: { result_id: r.id, via: 'manual_grading' },
          dedupeKey: `result_released:${r.id}`,
        });
      }
      return res;
    });
    if (out.status === 'result_released' && out.previous !== 'result_released') {
      hooks().onResultReleased({ examId: r.exam_id, examResultId: r.id, studentId: r.student_id, instructorId: r.instructor_id });
    }
    return out;
  }

  /**
   * Dəqiqəlik iş: vaxtı (üstəgəl güzəşt pəncərəsi) bitmiş açıq cəhdləri yekunlaşdırır.
   * Yalnız son SWEEP_LOOKBACK_HOURS ərzində başlanmış cəhdlər: yerləşdirmədən əvvəlki köhnə «asılı» cəhdlər
   * birdən-birə nəticəyə çevrilməsin (onlar backfill hesabatında göstərilir; tələbə açanda yekunlaşır).
   */
  async function sweepExpiredAttempts({ now = new Date(), limit = 50 } = {}) {
    const { rows } = await db().query(
      `SELECT er.id
       FROM exam_results er
       JOIN exams e ON e.id = er.exam_id
       WHERE er.submitted_at IS NULL AND er.status = 'in_progress' AND er.started_at IS NOT NULL
         AND COALESCE(e.duration_minutes, 0) > 0
         AND er.started_at + make_interval(mins => e.duration_minutes) + make_interval(secs => $1) < NOW()
         AND er.started_at > NOW() - make_interval(hours => $3)
       ORDER BY er.started_at
       LIMIT $2`,
      [EXPIRY_GRACE_SECONDS, limit, SWEEP_LOOKBACK_HOURS],
    );
    const summary = { checked: rows.length, auto_submitted: 0, no_answers: 0, skipped: 0 };
    for (const { id } of rows) {
      try {
        const res = await finalizeExpiredAttempt(id, { now, via: 'sweep' });
        if (res.outcome === 'expired_auto_submitted' && res.finalized) summary.auto_submitted += 1;
        else if (res.outcome === 'expired_no_answers' && res.finalized) summary.no_answers += 1;
        else summary.skipped += 1;
      } catch (e) {
        summary.skipped += 1;
        console.error('[exam-expiry] finalize failed', id, e.message);
      }
    }
    return summary;
  }

  /** «Pəncərədən sonra» rejimində nəticə vaxtı çatanda RESULT_RELEASED yazılır (bildiriş Phase F-də). */
  async function releaseDueResults({ now = new Date(), limit = 100 } = {}) {
    const { rows } = await db().query(
      `SELECT p.exam_id, p.student_id, p.current_result_id, e.instructor_id, e.show_results,
              e.result_visibility_mode, e.results_release_at, e.available_until
       FROM exam_student_progress p
       JOIN exams e ON e.id = p.exam_id
       WHERE p.status IN ('completed', 'expired_auto_submitted')
         AND p.result_released_at IS NULL
         AND COALESCE(e.results_release_at, e.available_until) <= NOW()
       LIMIT $1`,
      [limit],
    );
    let released = 0;
    for (const r of rows) {
      const view = await dep('resultView')(r, false, now);
      if (view?.released !== true) continue;
      const res = await db().transaction(async (client) => {
        const s = await syncExamProgress(client, { examId: r.exam_id, studentId: r.student_id, event: 'result_released', at: now });
        if (s.status === 'result_released' && s.previous !== 'result_released') {
          await examLog(client, {
            exam: { id: r.exam_id, instructor_id: r.instructor_id },
            studentId: r.student_id,
            eventType: ACTIVITY_EVENTS.RESULT_RELEASED,
            metadata: { result_id: r.current_result_id, via: 'release_time' },
            dedupeKey: `result_released:${r.current_result_id || r.exam_id}`,
          });
        }
        return s;
      });
      if (res.status === 'result_released' && res.previous !== 'result_released') {
        released += 1;
        hooks().onResultReleased({
          examId: r.exam_id,
          examResultId: r.current_result_id,
          studentId: r.student_id,
          instructorId: r.instructor_id,
        });
      }
    }
    return { checked: rows.length, released };
  }

  return {
    syncExamProgress,
    recordExamViewed,
    recordExamStarted,
    recordExamSubmitted,
    finalizeExpiredAttempt,
    autosaveAttempt,
    voidExpiredAttemptsForLateAccess,
    refreshAfterOpenGrading,
    sweepExpiredAttempts,
    releaseDueResults,
  };
}

const defaultService = createAssessmentAttemptService();

/** Controller-lərdən: cavabı gecikdirmir, xəta əsas axını pozmur. */
function track(label, fn) {
  setImmediate(() => {
    Promise.resolve()
      .then(fn)
      .catch((e) => console.error('[exam-activity]', label, e.message));
  });
}

module.exports = {
  ...defaultService,
  createAssessmentAttemptService,
  track,
  MAX_AUTOSAVE_BYTES,
  SWEEP_LOOKBACK_HOURS,
};
