const db = require('../utils/db');
const { inferQuestionType, orderedExamQuestions, resolveAnswerRaw, normalizeAnswerPayload, indexOfQuestionInExamOrder, calculateScore, buildAutoGradingMap } = require('./examService');
const { gradeOpenAnswerWithAi } = require('./openAiGradingService');

const GRADING_STATUSES = ['pending', 'ai_suggested', 'teacher_confirmed'];

const normStudentHex = (id) =>
  String(id || '')
    .trim()
    .replace(/-/g, '')
    .toLowerCase();

function parseGrading(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function mergeOpenGradingIntoMap(questions, answers, existingGrading) {
  const base = { ...(existingGrading || {}) };
  const fullOrder = orderedExamQuestions(questions);

  for (const q of questions || []) {
    if (!q?.id || inferQuestionType(q) !== 'open') continue;
    const id = q.id;
    const idx = indexOfQuestionInExamOrder(fullOrder, q);
    const raw = resolveAnswerRaw(answers, q, idx);
    const given = normalizeAnswerPayload(raw);
    const modelAnswer = String(q.model_answer ?? '').trim();
    const maxPts = Number(q.points || 0);
    const prev = base[id] && typeof base[id] === 'object' ? base[id] : {};

    if (prev.grading_status === 'teacher_confirmed') {
      base[id] = {
        type: 'open',
        ...prev,
        earned_points: Math.min(maxPts, Math.max(0, Number(prev.final_score) || 0)),
      };
      continue;
    }

    if (!given) {
      base[id] = {
        type: 'open',
        grading_status: 'pending',
        ai_suggested_score: null,
        ai_score_percent: null,
        ai_reasoning: null,
        final_score: null,
        earned_points: 0,
      };
      continue;
    }

    if (!modelAnswer) {
      continue;
    }

    base[id] = {
      type: 'open',
      grading_status: prev.grading_status === 'ai_suggested' ? 'ai_suggested' : 'pending',
      ai_suggested_score: prev.ai_suggested_score ?? null,
      ai_score_percent: prev.ai_score_percent ?? null,
      ai_reasoning: prev.ai_reasoning ?? null,
      final_score: null,
      earned_points: 0,
    };
  }

  return base;
}

function hasOpenQuestionsNeedingAi(questions, answers, grading) {
  const g = grading || {};
  const fullOrder = orderedExamQuestions(questions);
  for (const q of questions || []) {
    if (!q?.id || inferQuestionType(q) !== 'open') continue;
    const modelAnswer = String(q.model_answer ?? '').trim();
    if (!modelAnswer) continue;
    const idx = indexOfQuestionInExamOrder(fullOrder, q);
    const given = normalizeAnswerPayload(resolveAnswerRaw(answers, q, idx));
    if (!given) continue;
    const entry = g[q.id];
    if (!entry || entry.grading_status === 'pending') return true;
  }
  return false;
}

function hasUnconfirmedOpenGrading(questions, answers, grading) {
  const g = grading || {};
  const fullOrder = orderedExamQuestions(questions);
  for (const q of questions || []) {
    if (!q?.id || inferQuestionType(q) !== 'open') continue;
    const modelAnswer = String(q.model_answer ?? '').trim();
    if (!modelAnswer) continue;
    const idx = indexOfQuestionInExamOrder(fullOrder, q);
    const given = normalizeAnswerPayload(resolveAnswerRaw(answers, q, idx));
    if (!given) continue;
    const entry = g[q.id];
    if (!entry || entry.grading_status !== 'teacher_confirmed') return true;
  }
  return false;
}

async function enqueueOpenGradingJob(examResultId) {
  if (!examResultId) return;
  await db.query(
    `INSERT INTO exam_open_grading_queue (exam_result_id)
     SELECT $1
     WHERE NOT EXISTS (
       SELECT 1 FROM exam_open_grading_queue
       WHERE exam_result_id = $1 AND processed_at IS NULL
     )`,
    [examResultId],
  );
}

async function recalculateExamResultScore(examResultId, client = db) {
  const { rows } = await client.query(
    `SELECT er.exam_id, er.answers, er.grading, e.wrong_penalty_enabled
     FROM exam_results er
     JOIN exams e ON e.id = er.exam_id
     WHERE er.id = $1`,
    [examResultId],
  );
  const row = rows[0];
  if (!row) return null;

  let answers = row.answers;
  if (typeof answers === 'string') {
    try {
      answers = JSON.parse(answers);
    } catch {
      answers = {};
    }
  }

  const grading = parseGrading(row.grading);
  const { rows: questions } = await client.query(
    'SELECT * FROM exam_questions WHERE exam_id = $1 ORDER BY order_num',
    [row.exam_id],
  );

  const wrongPen = row.wrong_penalty_enabled !== false;
  const score = calculateScore(questions, answers, { wrongPenaltyEnabled: wrongPen, grading });
  await client.query('UPDATE exam_results SET score = $2 WHERE id = $1', [examResultId, score]);
  return score;
}

async function processOpenGradingForResult(examResultId) {
  const { rows: resultRows } = await db.query(
    `SELECT er.id, er.exam_id, er.answers, er.grading
     FROM exam_results er
     WHERE er.id = $1 AND er.submitted_at IS NOT NULL`,
    [examResultId],
  );
  const result = resultRows[0];
  if (!result) return { processed: 0, errors: 0 };

  let answers = result.answers;
  if (typeof answers === 'string') {
    try {
      answers = JSON.parse(answers);
    } catch {
      answers = {};
    }
  }

  const { rows: questions } = await db.query(
    'SELECT * FROM exam_questions WHERE exam_id = $1 ORDER BY order_num',
    [result.exam_id],
  );

  let grading = buildAutoGradingMap(questions, answers, parseGrading(result.grading));
  const fullOrder = orderedExamQuestions(questions);
  let processed = 0;
  let errors = 0;

  for (const q of questions) {
    if (!q?.id || inferQuestionType(q) !== 'open') continue;
    const modelAnswer = String(q.model_answer ?? '').trim();
    if (!modelAnswer) continue;

    const idx = indexOfQuestionInExamOrder(fullOrder, q);
    const given = normalizeAnswerPayload(resolveAnswerRaw(answers, q, idx));
    if (!given) continue;

    const entry = grading[q.id] || {};
    if (entry.grading_status === 'teacher_confirmed' || entry.grading_status === 'ai_suggested') {
      continue;
    }

    try {
      const ai = await gradeOpenAnswerWithAi({
        questionText: q.question_text,
        modelAnswer,
        studentAnswer: given,
        maxPoints: q.points,
      });
      grading[q.id] = {
        type: 'open',
        grading_status: 'ai_suggested',
        ai_suggested_score: ai.suggestedScore,
        ai_score_percent: ai.scorePercent,
        ai_reasoning: ai.reasoning,
        final_score: null,
        earned_points: 0,
      };
      processed += 1;
    } catch (e) {
      console.error('openExamGrading AI failed', examResultId, q.id, e.message);
      grading[q.id] = {
        type: 'open',
        grading_status: 'pending',
        ai_suggested_score: null,
        ai_score_percent: null,
        ai_reasoning: null,
        final_score: null,
        earned_points: 0,
        ai_error: String(e.message || 'AI xətası').slice(0, 500),
      };
      errors += 1;
    }
  }

  await db.query('UPDATE exam_results SET grading = $2 WHERE id = $1', [
    examResultId,
    JSON.stringify(grading),
  ]);

  return { processed, errors };
}

async function confirmOpenGrading({ examId, examResultId, questionId, instructorId, action, finalScore }) {
  const { rows: examRows } = await db.query(
    'SELECT id, instructor_id FROM exams WHERE id = $1 AND COALESCE(is_deleted, FALSE) = FALSE',
    [examId],
  );
  const exam = examRows[0];
  if (!exam) throw Object.assign(new Error('Tapılmadı'), { status: 404 });
  if (String(exam.instructor_id) !== String(instructorId) &&
      normStudentHex(exam.instructor_id) !== normStudentHex(instructorId)) {
    throw Object.assign(new Error('İcazə yoxdur'), { status: 403 });
  }

  const { rows: resultRows } = await db.query(
    `SELECT id, answers, grading FROM exam_results
     WHERE id = $1 AND exam_id = $2 AND submitted_at IS NOT NULL`,
    [examResultId, examId],
  );
  const result = resultRows[0];
  if (!result) throw Object.assign(new Error('Nəticə tapılmadı'), { status: 404 });

  const { rows: qRows } = await db.query(
    'SELECT * FROM exam_questions WHERE id = $1 AND exam_id = $2',
    [questionId, examId],
  );
  const question = qRows[0];
  if (!question || inferQuestionType(question) !== 'open') {
    throw Object.assign(new Error('Açıq sual tapılmadı'), { status: 400 });
  }

  const grading = parseGrading(result.grading);
  const entry = grading[questionId];
  if (!entry || entry.type !== 'open') {
    throw Object.assign(new Error('Qiymətləndirmə məlumatı yoxdur'), { status: 400 });
  }

  const maxPts = Number(question.points || 0);
  let confirmedScore = null;

  if (action === 'accept') {
    if (entry.grading_status !== 'ai_suggested') {
      throw Object.assign(new Error('Qəbul etmək üçün AI tövsiyəsi lazımdır'), { status: 400 });
    }
    confirmedScore = Number(entry.ai_suggested_score);
  } else if (action === 'set') {
    confirmedScore = Number(finalScore);
  } else {
    throw Object.assign(new Error('Yanlış əməliyyat'), { status: 400 });
  }

  if (!Number.isFinite(confirmedScore)) {
    throw Object.assign(new Error('Bal düzgün deyil'), { status: 400 });
  }
  confirmedScore = Math.min(maxPts, Math.max(0, Math.round(confirmedScore * 100) / 100));

  grading[questionId] = {
    ...entry,
    type: 'open',
    grading_status: 'teacher_confirmed',
    final_score: confirmedScore,
    earned_points: confirmedScore,
  };

  await db.query('UPDATE exam_results SET grading = $2 WHERE id = $1', [
    examResultId,
    JSON.stringify(grading),
  ]);

  const newScore = await recalculateExamResultScore(examResultId);

  let certificate = null;
  try {
    const { rows: er } = await db.query(
      'SELECT student_id FROM exam_results WHERE id = $1',
      [examResultId],
    );
    const { maybeIssueCertificateAfterExamSubmit, slimCertificateRow } = require('./certificateService');
    const cert = await maybeIssueCertificateAfterExamSubmit({
      examId,
      studentId: er[0]?.student_id,
      examResultId,
      score: newScore,
    });
    if (cert) certificate = slimCertificateRow(cert);
  } catch (e) {
    console.error('certificate after open grading confirm', e.message);
  }

  return { grading: grading[questionId], score: newScore, certificate };
}

module.exports = {
  GRADING_STATUSES,
  parseGrading,
  mergeOpenGradingIntoMap,
  hasOpenQuestionsNeedingAi,
  hasUnconfirmedOpenGrading,
  enqueueOpenGradingJob,
  recalculateExamResultScore,
  processOpenGradingForResult,
  confirmOpenGrading,
};
