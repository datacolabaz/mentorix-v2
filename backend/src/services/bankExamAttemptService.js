const { randomUUID } = require('node:crypto');
const R = require('./questionBankRules');
const { createQuestionBankService, EXAM_SELECT, pdfPages } = require('./questionBankService');
const { resolveStudentResultView, applyStudentListRowView } = require('./examResultVisibility');
const { EXPIRY_GRACE_SECONDS, AUTOSAVE_LATE_TOLERANCE_SECONDS, classifySubmission } = require('./activityStatusRules');

function createBankExamAttemptService(overrides = {}) {
  const db = overrides.db || require('../utils/db');
  const bank = overrides.bank || createQuestionBankService({ db });
  const now = overrides.now || (() => new Date());
  const progress = overrides.progress || require('./assessmentAttemptService').syncExamProgress;
  const log = overrides.log || require('./activityProgressService').logActivityEvent;
  const quota = overrides.quota || ((owner, client) => require('./courseMaterialsService').getMaterialsQuota(owner, { client }));
  const notify = overrides.notify || ((event, payload) => {
    setImmediate(() => {
      try {
        const result = require('./activityNotificationHooks')[event]?.(payload);
        Promise.resolve(result).catch(() => {});
      } catch (e) { console.error('[question-bank] notification hook failed', e.code || 'HOOK_FAILED'); }
    });
  });
  async function questions(c, examId) {
    const { rows } = await c.query(
      `SELECT b.exam_question_id,b.points,b.snapshot FROM exam_bank_questions b
       JOIN exam_questions q ON q.id=b.exam_question_id WHERE b.exam_id=$1 ORDER BY q.order_num`, [examId],
    );
    return rows.map(q => ({ ...q.snapshot, id: q.exam_question_id, points: Number(q.points) }));
  }
  async function load(c, attemptId, user = null) {
    const { rows: refs } = await c.query(
      `SELECT er.exam_id,er.student_id,e.instructor_id FROM exam_results er
       JOIN exams e ON e.id=er.exam_id JOIN exam_attempt_details d ON d.attempt_id=er.id WHERE er.id=$1`, [R.id(attemptId)],
    );
    const ref = refs[0];
    if (!ref) R.fail(404, 'QB_NOT_FOUND');
    if (user) {
      const allowed = user.role === 'student' ? ref.student_id === user.id :
        ['instructor', 'admin'].includes(user.role) && ref.instructor_id === user.id;
      if (!allowed) R.fail(404, 'QB_NOT_FOUND');
    }
    // All mutations lock in the same order: exam, then attempt, then its answers/files.
    const { rows: exams } = await c.query(
      `${EXAM_SELECT} WHERE e.id=$1 AND COALESCE(e.is_deleted,FALSE)=FALSE FOR SHARE OF e`, [ref.exam_id],
    );
    if (!exams[0]) R.fail(404, 'QB_NOT_FOUND');
    const { rows } = await c.query(
      `SELECT er.*,d.question_order,d.option_order,d.max_score,d.raw_score
       FROM exam_results er JOIN exam_attempt_details d ON d.attempt_id=er.id
       WHERE er.id=$1 FOR UPDATE OF er`, [attemptId],
    );
    const { rows: assignments } = await c.query(
      `SELECT MAX(late_access_until) AS late_access_until FROM exam_assignments WHERE exam_id=$1 AND student_id=$2`,
      [ref.exam_id, ref.student_id],
    );
    return { ...rows[0], exam: exams[0], assignment: assignments[0], questions: await questions(c, ref.exam_id) };
  }
  function assertActive(a, at, tolerance = AUTOSAVE_LATE_TOLERANCE_SECONDS) {
    if (a.submitted_at || a.status !== 'in_progress') R.fail(409, 'QB_ATTEMPT_FINAL', 'Cəhd artıq yekunlaşıb');
    if (at.getTime() > R.deadline(a.exam, a, a.assignment).getTime() + tolerance * 1000) {
      R.fail(409, 'QB_DEADLINE_PASSED', 'Cavablar qəbul edilmir: vaxt bitib');
    }
  }
  async function fileRows(c, attemptId) {
    const { rows } = await c.query(
      `SELECT id,question_id,file_name,content_type,byte_size FROM exam_answer_files
       WHERE attempt_id=$1 ORDER BY created_at,id`, [attemptId],
    );
    return rows.map(f => ({ ...f, url: `/api/question-bank/files/${f.id}` }));
  }
  async function answerRows(c, attemptId) {
    return (await c.query('SELECT * FROM exam_answers WHERE attempt_id=$1 ORDER BY question_id', [attemptId])).rows;
  }
  async function syncAnswers(c, a) {
    const rows = await answerRows(c, a.id);
    const answers = Object.fromEntries(rows.filter(r => R.hasAnswer(r.answer_data)).map(r => [r.question_id, r.answer_data]));
    await c.query('UPDATE exam_results SET answers=$2 WHERE id=$1', [a.id, JSON.stringify(answers)]);
    a.answers = answers;
    return answers;
  }
  async function saveValues(c, a, input) {
    R.check(R.object(input), 'answers'); R.jsonLimit(input);
    const files = await fileRows(c, a.id);
    for (const [questionId, value] of Object.entries(input)) {
      const q = a.questions.find(x => x.id === R.id(questionId));
      R.check(q, 'question belongs to attempt');
      const fileIds = files.filter(f => f.question_id === q.id).map(f => f.id);
      const answer = R.normalizeAnswer(q, value, fileIds);
      await c.query(
        `UPDATE exam_answers SET answer_data=$3,status=$4
         WHERE attempt_id=$1 AND question_id=$2`,
        [a.id, q.id, JSON.stringify(answer), R.hasAnswer(answer) ? 'answered' : 'unanswered'],
      );
    }
    const answers = await syncAnswers(c, a);
    await progress(c, {
      examId: a.exam_id, studentId: a.student_id, event: 'activity', at: now(),
      answeredCount: Object.keys(answers).length, totalQuestions: a.questions.length,
    });
  }
  async function audit(c, a, eventType, dedupeKey, metadata = {}) {
    return log(c, {
      studentId: a.student_id, instructorId: a.exam.instructor_id, entityType: 'exam',
      entityId: a.exam_id, eventType, dedupeKey, metadata: { result_id: a.id, ...metadata },
    });
  }
  async function recompute(c, a) {
    const rows = await answerRows(c, a.id);
    const rawCents = rows.reduce((sum, r) => sum + R.cents(r.awarded_points ?? 0, 'awarded_points', { zero: true }), 0);
    const maxCents = R.cents(a.max_score, 'max_score', { max: 99999999.99 });
    const raw = rawCents / 100;
    const score = Math.round(rawCents / maxCents * 10000) / 100;
    const gradingPending = rows.some(r => r.status === 'pending_review');
    const grading = Object.fromEntries(rows.map(r => [r.question_id, {
      type: a.questions.find(q => q.id === r.question_id).question_type,
      grading_status: r.status === 'pending_review' ? 'pending_review' : 'teacher_confirmed',
      points_awarded: r.awarded_points == null ? null : Number(r.awarded_points),
      is_correct: r.is_correct,
    }]));
    await c.query('UPDATE exam_attempt_details SET raw_score=$2 WHERE attempt_id=$1', [a.id, raw]);
    await c.query('UPDATE exam_results SET score=$2,grading=$3 WHERE id=$1', [a.id, score, JSON.stringify(grading)]);
    Object.assign(a, { raw_score: raw, score, grading });
    return gradingPending;
  }
  async function finalizedProgress(c, a, gradingPending, event, at, expired = false) {
    const view = resolveStudentResultView(a.exam, { gradingPending, now: at });
    const released = view.released && !gradingPending;
    const state = await progress(c, {
      examId: a.exam_id, studentId: a.student_id, resultId: a.id,
      event: event === 'grading_confirmed' && gradingPending ? 'activity' : event, at,
      gradingPending, released, totalQuestions: a.questions.length,
      answeredCount: Object.keys(a.answers || {}).length, deadline: R.deadline(a.exam, a, a.assignment),
    });
    if (event !== 'grading_confirmed') {
      await audit(c, a, 'exam_submitted', `submitted:${a.id}`, { kind: expired ? 'auto_expired' : 'manual', grading_pending: gradingPending });
      if (expired) await audit(c, a, 'exam_expired', `expired:${a.id}`, { outcome: 'auto_submitted' });
    }
    if (released) await audit(c, a, 'exam_result_released', `result_released:${a.id}`);
    return state;
  }
  async function finish(c, a, { at, expired = false } = {}) {
    if (a.submitted_at || a.status !== 'in_progress') return { changed: false, a };
    const rows = await answerRows(c, a.id);
    if (expired && !rows.some(r => R.hasAnswer(r.answer_data))) {
      await c.query(`UPDATE exam_results SET status='expired' WHERE id=$1`, [a.id]);
      a.status = 'expired';
      await progress(c, {
        examId: a.exam_id, studentId: a.student_id, event: 'expired_no_answers', at,
        resultId: a.id, answeredCount: 0, totalQuestions: a.questions.length,
        deadline: R.deadline(a.exam, a, a.assignment),
      });
      await audit(c, a, 'exam_expired', `expired:${a.id}`, { outcome: 'no_answers' });
      return { changed: true, a, expired: true, outcome: 'expired_no_answers' };
    }
    for (const row of rows) {
      const q = a.questions.find(x => x.id === row.question_id);
      const grade = R.gradeAnswer(q, row.answer_data);
      await c.query(
        `UPDATE exam_answers SET status=$3,awarded_points=$4,is_correct=$5 WHERE attempt_id=$1 AND question_id=$2`,
        [a.id, q.id, grade.status, grade.awarded_points, grade.is_correct],
      );
    }
    const gradingPending = await recompute(c, a);
    const seconds = Math.max(0, Math.floor((at.getTime() - new Date(a.started_at).getTime()) / 1000));
    await c.query(
      `UPDATE exam_results SET status='completed',submitted_at=$2,duration_seconds=$3 WHERE id=$1`, [a.id, at, seconds],
    );
    Object.assign(a, { status: 'completed', submitted_at: at });
    await finalizedProgress(c, a, gradingPending, expired ? 'auto_submitted' : 'submitted', at, expired);
    return { changed: true, a, gradingPending, expired, outcome: expired ? 'expired_auto_submitted' : 'submitted' };
  }
  function afterFinish(result) {
    if (!result?.changed || result.outcome === 'expired_no_answers') return;
    const { a, gradingPending } = result;
    const payload = {
      examId: a.exam_id, examResultId: a.id, studentId: a.student_id,
      instructorId: a.exam.instructor_id, gradingPending,
    };
    notify(result.expired ? 'onAssessmentAutoSubmitted' : 'onAssessmentSubmitted', payload);
    if (!gradingPending && resolveStudentResultView(a.exam, { now: now() }).released) notify('onResultReleased', payload);
  }
  async function runner(c, a) {
    const at = now();
    const active = a.status === 'in_progress' && !a.submitted_at;
    const files = active ? await fileRows(c, a.id) : [];
    const rows = active ? await answerRows(c, a.id) : [];
    const questionMap = new Map(a.questions.map(q => [q.id, q]));
    return {
      exam: {
        id: a.exam_id, title: a.exam.title, subject: a.exam.subject, duration_minutes: a.exam.duration_minutes,
        available_from: a.exam.available_from, available_until: a.exam.available_until,
        display_mode: a.exam.display_mode, exam_type: a.exam.exam_type, question_bank_enabled: true,
      },
      attempt: {
        id: a.id, status: a.status, started_at: a.started_at, submitted_at: a.submitted_at,
        deadline: R.deadline(a.exam, a, a.assignment).toISOString(),
      },
      server_time: at.toISOString(),
      questions: active ? a.question_order.map(qid => R.publicQuestion(questionMap.get(qid), a.option_order[qid])) : [],
      answers: Object.fromEntries(rows.map(r => [r.question_id, r.answer_data])),
      files,
      result_url: `/api/question-bank/attempts/${a.id}/result`,
    };
  }
  async function start(studentId, examId) {
    const result = await db.transaction(async c => {
      const { rows } = await c.query(
        `${EXAM_SELECT} WHERE e.id=$1 AND COALESCE(e.is_deleted,FALSE)=FALSE FOR UPDATE OF e`, [R.id(examId)],
      );
      const exam = rows[0];
      if (!exam) R.fail(404, 'QB_NOT_FOUND');
      const { rows: assignments } = await c.query(
        'SELECT MAX(late_access_until) AS late_access_until,COUNT(*)::int AS n FROM exam_assignments WHERE exam_id=$1 AND student_id=$2',
        [examId, studentId],
      );
      const assignment = assignments[0];
      if (!assignment.n) R.fail(403, 'QB_EXAM_FORBIDDEN', 'İmtahan sizə təyin edilməyib');
      const { rows: previous } = await c.query(
        `SELECT id FROM exam_results WHERE exam_id=$1 AND student_id=$2 AND COALESCE(status,'')<>'voided'
         ORDER BY started_at DESC NULLS LAST,id LIMIT 1`, [examId, studentId],
      );
      if (previous[0]) {
        const a = await load(c, previous[0].id, { id: studentId, role: 'student' });
        const expired = now().getTime() > R.deadline(exam, a, assignment).getTime() + EXPIRY_GRACE_SECONDS * 1000;
        const final = expired ? await finish(c, a, { at: now(), expired: true }) : null;
        return { payload: await runner(c, a), final };
      }
      const at = now();
      const inWindow = at >= new Date(exam.available_from) && at <= new Date(exam.available_until);
      const late = assignment.late_access_until && at <= new Date(assignment.late_access_until);
      if (!['scheduled', 'active'].includes(exam.status) || (!inWindow && !late)) {
        R.fail(409, 'QB_EXAM_NOT_OPEN', 'İmtahan hazırda açıq deyil');
      }
      const qs = await questions(c, examId);
      R.check(qs.length > 0, 'exam questions');
      const questionOrder = (exam.shuffle_questions ? R.shuffled(qs) : qs).map(q => q.id);
      const optionOrder = Object.fromEntries(qs.map(q => [q.id,
        (exam.shuffle_options || ['matching', 'ordering'].includes(q.question_type) ? R.shuffled(q.options) : q.options).map(o => o.id),
      ]));
      const maxScore = qs.reduce((s, q) => s + R.cents(q.points), 0) / 100;
      const isCrm = await require('./crmStudentService').isCrmStudentForInstructor(exam.instructor_id, studentId, c);
      const { rows: attempts } = await c.query(
        `INSERT INTO exam_results (exam_id,student_id,status,answers,started_at,is_crm_student)
         VALUES ($1,$2,'in_progress','{}',$3,$4) RETURNING *`, [examId, studentId, at, isCrm],
      );
      const a = { ...attempts[0], exam, assignment, questions: qs, question_order: questionOrder, option_order: optionOrder, max_score: maxScore };
      await c.query(
        `INSERT INTO exam_attempt_details (attempt_id,exam_id,student_id,max_score,question_order,option_order)
         VALUES ($1,$2,$3,$4,$5,$6)`, [a.id, examId, studentId, maxScore, questionOrder, JSON.stringify(optionOrder)],
      );
      for (const q of qs) await c.query(
        'INSERT INTO exam_answers (attempt_id,exam_id,question_id) VALUES ($1,$2,$3)', [a.id, examId, q.id],
      );
      await progress(c, {
        examId, studentId, event: 'started', at, resultId: a.id, newAttempt: true, answeredCount: 0, totalQuestions: qs.length,
      });
      await audit(c, a, 'exam_started', `started:${a.id}`);
      return { payload: await runner(c, a) };
    });
    afterFinish(result.final);
    return result.payload;
  }
  async function getAttempt(user, attemptId) {
    const result = await db.transaction(async c => {
      const a = await load(c, attemptId, user);
      const expired = now().getTime() > R.deadline(a.exam, a, a.assignment).getTime() + EXPIRY_GRACE_SECONDS * 1000;
      const final = expired ? await finish(c, a, { at: now(), expired: true }) : null;
      return { payload: await runner(c, a), final };
    });
    afterFinish(result.final);
    return result.payload;
  }
  async function save(user, attemptId, input) {
    return db.transaction(async c => {
      const a = await load(c, attemptId, user);
      assertActive(a, now());
      await saveValues(c, a, input);
      return { saved: true, answered_count: Object.keys(a.answers).length, server_time: now().toISOString() };
    });
  }
  async function submit(user, attemptId, input = {}) {
    R.check(R.object(input), 'submit');
    if (input.auto_submit != null) R.bool(input.auto_submit, 'auto_submit');
    const result = await db.transaction(async c => {
      const a = await load(c, attemptId, user);
      if (a.submitted_at || a.status !== 'in_progress') return { a, changed: false };
      const at = now();
      const classification = classifySubmission({
        deadline: R.deadline(a.exam, a, a.assignment), now: at, clientAutoSubmit: input.auto_submit === true,
      });
      if (classification.accept && input.answers != null) await saveValues(c, a, input.answers);
      const final = await finish(c, a, { at, expired: classification.kind !== 'manual' });
      return { ...final, late_payload_ignored: !classification.accept };
    });
    afterFinish(result);
    return { attempt_id: attemptId, status: result.a.status, late_payload_ignored: result.late_payload_ignored === true,
      result_url: `/api/question-bank/attempts/${attemptId}/result` };
  }
  async function review(user, attemptId, expectedExamId = null) {
    return db.transaction(async c => {
      const a = await load(c, attemptId, user);
      if (expectedExamId && a.exam_id !== R.id(expectedExamId)) R.fail(404, 'QB_NOT_FOUND');
      if (!a.submitted_at) {
        if (a.status === 'expired') return { attempt_id: a.id, status: 'expired', score: null, breakdown: [] };
        R.fail(409, 'QB_NOT_SUBMITTED');
      }
      const rows = await answerRows(c, a.id);
      const files = await fileRows(c, a.id);
      const gradingPending = rows.some(r => r.status === 'pending_review');
      const teacher = user.role !== 'student';
      const view = teacher ? { released: true, show_score: true, show_breakdown: true, show_correct_answers: true } :
        resolveStudentResultView(a.exam, { gradingPending, now: now() });
      const answers = new Map(rows.map(r => [r.question_id, r]));
      const breakdown = view.show_breakdown ? a.question_order.map(qid => {
        const q = a.questions.find(x => x.id === qid);
        const answer = answers.get(qid);
        return {
          ...R.publicQuestion(q, a.option_order[qid]),
          student_answer: answer.answer_data, status: answer.status,
          is_correct: answer.is_correct,
          awarded_points: answer.awarded_points == null ? null : Number(answer.awarded_points),
          teacher_feedback: answer.teacher_feedback,
          files: files.filter(f => f.question_id === qid),
          ...(view.show_correct_answers ? { correct_answer: q.answer_key, explanation: q.explanation } : {}),
          ...(teacher ? { source_pdf_id: q.source_pdf_id, source_page: q.source_page, bank_question_id: q.bank_question_id } : {}),
        };
      }).filter(r => !view.only_wrong || (r.awarded_points != null && r.awarded_points < r.points)) : [];
      return {
        attempt_id: a.id, exam_id: a.exam_id, student_id: a.student_id, status: a.status,
        submitted_at: a.submitted_at, grading_pending: gradingPending, provisional: gradingPending,
        score: view.show_score ? Number(a.score) : null,
        raw_score: view.show_score ? Number(a.raw_score) : null, max_score: Number(a.max_score),
        result_visibility: {
          mode: view.mode, released: view.released, reason: view.reason || null, release_at: view.release_at || null,
          show_correct_answers: view.show_correct_answers, show_breakdown: view.show_breakdown, only_wrong: view.only_wrong === true,
        },
        breakdown,
      };
    });
  }
  async function manualGrade(owner, examId, attemptId, questionId, input) {
    const points = R.cents(input.awarded_points, 'awarded_points', { zero: true }) / 100;
    const feedback = input.teacher_feedback == null ? null : R.text(input.teacher_feedback, 'teacher_feedback', 10000, true);
    const result = await db.transaction(async c => {
      const a = await load(c, attemptId, { id: owner, role: 'instructor' });
      if (a.exam_id !== R.id(examId)) R.fail(404, 'QB_NOT_FOUND');
      if (!a.submitted_at) R.fail(409, 'QB_NOT_SUBMITTED');
      const q = a.questions.find(x => x.id === R.id(questionId));
      R.check(q && R.MANUAL.has(q.question_type), 'manual question');
      R.check(points <= q.points, 'awarded_points');
      await c.query(
        `UPDATE exam_answers SET status='reviewed',awarded_points=$3,is_correct=$4,teacher_feedback=$5,reviewed_by=$6,reviewed_at=$7
         WHERE attempt_id=$1 AND question_id=$2`,
        [a.id, q.id, points, points === q.points, feedback, owner, now()],
      );
      const pending = await recompute(c, a);
      const state = await finalizedProgress(c, a, pending, 'grading_confirmed', now());
      return { a, pending, state };
    });
    if (!result.pending && result.state.status === 'result_released' && result.state.previous !== 'result_released') {
      notify('onResultReleased', { examId, examResultId: attemptId, studentId: result.a.student_id, instructorId: owner });
    }
    return review({ id: owner, role: 'instructor' }, attemptId, examId);
  }
  async function results(owner, examId, query = {}) {
    await bank.ownedExam(db, owner, examId);
    const { limit, offset } = R.page(query);
    const pendingOnly = query.pending_only === 'true';
    R.check(query.pending_only == null || ['true', 'false'].includes(query.pending_only), 'pending_only');
    const { rows } = await db.query(
      `SELECT er.id,er.student_id,u.full_name,er.status,er.score,er.started_at,er.submitted_at,
        d.raw_score,d.max_score,(SELECT COUNT(*)::int FROM exam_answers a WHERE a.attempt_id=er.id AND a.status='pending_review') AS pending_count
       FROM exam_results er JOIN exam_attempt_details d ON d.attempt_id=er.id JOIN users u ON u.id=er.student_id
       WHERE er.exam_id=$1 AND er.status<>'voided'
         AND (NOT $2 OR EXISTS(SELECT 1 FROM exam_answers a WHERE a.attempt_id=er.id AND a.status='pending_review'))
       ORDER BY er.started_at DESC,er.id LIMIT $3 OFFSET $4`, [examId, pendingOnly, limit, offset],
    );
    return rows;
  }
  async function studentExams(studentId, query = {}) {
    const { limit, offset } = R.page(query);
    const { rows } = await db.query(
      `SELECT e.id,e.title,e.subject,e.status,e.available_from,e.available_until,e.duration_minutes,
        e.result_visibility_mode,e.results_release_at,e.show_results,s.display_mode,s.exam_type,
        er.id AS attempt_id,er.started_at,er.submitted_at,er.status AS attempt_status,er.score,
        EXISTS(SELECT 1 FROM exam_answers a WHERE a.attempt_id=er.id AND a.status='pending_review') AS grading_pending
       FROM exams e JOIN exam_bank_settings s ON s.exam_id=e.id
       LEFT JOIN LATERAL (
         SELECT * FROM exam_results r WHERE r.exam_id=e.id AND r.student_id=$1 AND COALESCE(r.status,'')<>'voided'
         ORDER BY r.started_at DESC NULLS LAST,r.id LIMIT 1
       ) er ON TRUE
       WHERE COALESCE(e.is_deleted,FALSE)=FALSE AND e.status<>'draft' AND (
         er.id IS NOT NULL OR EXISTS(SELECT 1 FROM exam_assignments ea WHERE ea.exam_id=e.id AND ea.student_id=$1))
       ORDER BY e.available_from DESC,e.id LIMIT $2 OFFSET $3`, [studentId, limit, offset],
    );
    return rows.map(r => {
      const out = applyStudentListRowView(r, resolveStudentResultView(r, { gradingPending: r.grading_pending, now: now() }));
      return { ...out, question_bank_enabled: true };
    });
  }
  async function validateUpload(file) {
    R.check(file?.buffer?.length > 0 && file.buffer.length <= R.MAX_FILE_BYTES, 'file size');
    const b = file.buffer;
    const mime = file.mimetype;
    let extension;
    if (mime === 'application/pdf') { await pdfPages(b); extension = 'pdf'; }
    else if (mime === 'image/png' && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) extension = 'png';
    else if (mime === 'image/jpeg' && b.length > 4 && b[0] === 255 && b[1] === 216 && b[2] === 255) extension = 'jpg';
    else if (mime === 'text/plain' && !b.includes(0)) {
      try { new TextDecoder('utf-8', { fatal: true }).decode(b); extension = 'txt'; } catch { /* reject */ }
    }
    R.check(extension, 'file content/type (PDF, PNG, JPEG, UTF-8 TXT)');
    // Never reuse a browser-supplied filename as a header or a storage path.
    return { name: `answer-${randomUUID()}.${extension}`, mime };
  }
  async function upload(user, attemptId, questionId, file) {
    const safe = await validateUpload(file);
    return db.transaction(async c => {
      const a = await load(c, attemptId, user);
      assertActive(a, now());
      const q = a.questions.find(x => x.id === R.id(questionId));
      R.check(q?.question_type === 'file_upload', 'file_upload question');
      // Serialize uploads across this teacher's attempts. Deletion is transactional, so
      // a failed replacement restores both the previous blob and its answer.
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,237))', [a.exam.instructor_id]);
      assertActive(a, now());
      await c.query('DELETE FROM exam_answer_files WHERE attempt_id=$1 AND question_id=$2', [a.id, q.id]);
      const limits = await quota(a.exam.instructor_id, c);
      if ((limits.limits.storage_bytes != null && Number(limits.usage.used_bytes) + file.buffer.length > Number(limits.limits.storage_bytes)) ||
        (limits.limits.max_files != null && Number(limits.usage.file_count) + 1 > limits.limits.max_files)) {
        R.fail(429, 'MATERIALS_STORAGE_LIMIT', 'Müəllimin yaddaş limiti dolub');
      }
      const { rows } = await c.query(
        `INSERT INTO exam_answer_files (attempt_id,question_id,uploaded_by,file_name,content_type,byte_size,data)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [a.id, q.id, user.id, safe.name, safe.mime, file.buffer.length, file.buffer],
      );
      await saveValues(c, a, { [q.id]: { file_ids: [rows[0].id] } });
      return (await fileRows(c, a.id)).find(f => f.id === rows[0].id);
    });
  }
  async function download(user, fileId) {
    return db.transaction(async c => {
      const { rows: refs } = await c.query('SELECT attempt_id FROM exam_answer_files WHERE id=$1', [R.id(fileId)]);
      if (!refs[0]) R.fail(404, 'QB_NOT_FOUND');
      const a = await load(c, refs[0].attempt_id, user);
      if (user.role !== 'student' && !a.submitted_at) R.fail(409, 'QB_NOT_SUBMITTED');
      const { rows } = await c.query(
        'SELECT file_name,content_type,byte_size,data FROM exam_answer_files WHERE id=$1 AND attempt_id=$2', [fileId, a.id],
      );
      if (!rows[0]) R.fail(404, 'QB_NOT_FOUND');
      return rows[0];
    });
  }
  async function deleteFile(user, fileId) {
    return db.transaction(async c => {
      const { rows: refs } = await c.query('SELECT attempt_id,question_id FROM exam_answer_files WHERE id=$1', [R.id(fileId)]);
      if (!refs[0]) R.fail(404, 'QB_NOT_FOUND');
      const a = await load(c, refs[0].attempt_id, user);
      assertActive(a, now());
      await c.query('DELETE FROM exam_answer_files WHERE id=$1', [fileId]);
      await saveValues(c, a, { [refs[0].question_id]: null });
    });
  }
  async function sweep({ limit = 100 } = {}) {
    const { rows } = await db.query(
      `SELECT er.id FROM exam_results er JOIN exams e ON e.id=er.exam_id
       JOIN exam_bank_settings s ON s.exam_id=e.id
       WHERE er.status='in_progress' AND er.submitted_at IS NULL AND COALESCE(e.is_deleted,FALSE)=FALSE AND (
         er.started_at + make_interval(mins=>e.duration_minutes) + interval '60 seconds' < NOW() OR
         (e.allow_finish_after_until=FALSE AND
           GREATEST(e.available_until,COALESCE((SELECT MAX(late_access_until) FROM exam_assignments ea
             WHERE ea.exam_id=e.id AND ea.student_id=er.student_id),e.available_until)) + interval '60 seconds' < NOW()))
       ORDER BY er.started_at LIMIT $1`, [limit],
    );
    let finalized = 0;
    for (const r of rows) {
      try {
        const result = await db.transaction(async c => {
          const a = await load(c, r.id);
          const at = now();
          if (at.getTime() <= R.deadline(a.exam, a, a.assignment).getTime() + EXPIRY_GRACE_SECONDS * 1000) return null;
          return finish(c, a, { at, expired: true });
        });
        if (result?.changed) finalized += 1;
        afterFinish(result);
      } catch (e) {
        console.error('[question-bank] expiry failed', e.code || 'EXPIRE_FAILED');
      }
    }
    return { checked: rows.length, finalized };
  }
  return { start, getAttempt, save, submit, review, manualGrade, results, studentExams, upload, download, deleteFile, sweep };
}
module.exports = { createBankExamAttemptService };
