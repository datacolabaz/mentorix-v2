const express = require('express');
const multer = require('multer');
const R = require('../services/questionBankRules');
const { createQuestionBankService } = require('../services/questionBankService');
const { createBankExamAttemptService } = require('../services/bankExamAttemptService');
const auth = require('../middleware/auth');
const entitlements = require('../middleware/entitlements');
const { requireInstructorPhoneVerification } = require('../middleware/requireInstructorPhoneVerification');

function createQuestionBankRouter(overrides = {}) {
  const router = express.Router();
  const bank = overrides.bank || createQuestionBankService();
  const attempts = overrides.attempts || createBankExamAttemptService({ bank });
  const authenticate = overrides.authenticate || auth.authenticate;
  const active = overrides.active || entitlements.enforceActiveSubscription;
  const examLimit = overrides.examLimit || entitlements.enforceExamsLimit;
  const phone = overrides.phone || requireInstructorPhoneVerification({ trigger: 'exam' });
  const teacher = auth.authorize('instructor', 'admin');
  const student = auth.authorize('student');
  const anyone = auth.authorize('student', 'instructor', 'admin');
  router.use(authenticate, (_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });
  function error(res, e) {
    const pg = {
      '23503': [409, 'QB_RELATION_CONFLICT', 'Əlaqə istifadə olunur və ya seçilən əlaqə düzgün deyil'],
      '23505': [409, 'QB_CONFLICT', 'Məlumat artıq mövcuddur'],
      '23514': [400, 'QB_CONSTRAINT', 'Məlumatın quruluşu düzgün deyil'],
      '22P02': [400, 'QB_INVALID_INPUT', 'Məlumatın formatı düzgün deyil'],
    }[e.code];
    const status = pg?.[0] || e.statusCode || e.status || 500;
    if (status >= 500) console.error('[question-bank] request failed', e.code || 'INTERNAL_ERROR');
    return res.status(status).json({
      success: false,
      code: pg?.[1] || (status < 500 ? e.code || 'QB_INVALID_INPUT' : 'QB_INTERNAL_ERROR'),
      message: pg?.[2] || (status < 500 ? e.message : 'Əməliyyat tamamlanmadı'),
    });
  }
  const run = (fn, key = null, status = 200) => async (req, res) => {
    try {
      const result = await fn(req);
      res.status(status).json({ success: true, ...(key ? { [key]: result } : result || {}) });
    } catch (e) { error(res, e); }
  };
  const binary = fn => async (req, res) => {
    try {
      const f = await fn(req);
      res.set('Content-Type', f.content_type || 'application/pdf');
      res.set('Content-Security-Policy', "sandbox; default-src 'none'");
      res.set('Content-Disposition', f.buffer ? 'inline; filename="source.pdf"' :
        `attachment; filename="${f.file_name}"`);
      res.send(f.buffer || f.data);
    } catch (e) { error(res, e); }
  };
  router.get('/meta', anyone, run(() => ({
    question_types: R.TYPES, schema_version: 1, max_file_bytes: R.MAX_FILE_BYTES, max_question_count: 500,
  })));
  router.get('/student/exams', student, run(req => attempts.studentExams(req.user.id, req.query), 'exams'));
  router.post('/exams/:id/start', student, run(req => attempts.start(req.user.id, req.params.id)));
  router.get('/attempts/:id', student, run(req => attempts.getAttempt(req.user, req.params.id)));
  router.patch('/attempts/:id/answers', student, run(req => attempts.save(req.user, req.params.id, req.body.answers)));
  router.post('/attempts/:id/submit', student, run(req => attempts.submit(req.user, req.params.id, req.body)));
  router.get('/attempts/:id/result', student, run(req => attempts.review(req.user, req.params.id)));
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: R.MAX_FILE_BYTES, files: 1, fields: 0 } }).single('file');
  router.post('/attempts/:id/answers/:questionId/file', student, (req, res, next) => {
    upload(req, res, e => {
      if (e) return error(res, { statusCode: e.code === 'LIMIT_FILE_SIZE' ? 413 : 400, code: 'QB_UPLOAD_INVALID', message: 'Fayl qəbul edilmədi (maksimum 25 MiB)' });
      next();
    });
  }, run(req => attempts.upload(req.user, req.params.id, req.params.questionId, req.file), 'file', 201));
  router.get('/files/:id', anyone, binary(req => attempts.download(req.user, req.params.id)));
  router.delete('/files/:id', student, run(req => attempts.deleteFile(req.user, req.params.id)));

  router.get('/subjects', teacher, run(req => bank.subjects(req.user.id), 'subjects'));
  router.post('/subjects', teacher, active, run(req => bank.createSubject(req.user.id, req.body), 'subject', 201));
  router.get('/topics', teacher, run(req => bank.topics(req.user.id, req.query), 'topics'));
  router.post('/topics', teacher, active, run(req => bank.saveTopic(req.user.id, req.body), 'topic', 201));
  router.put('/topics/:id', teacher, active, run(req => bank.saveTopic(req.user.id, req.body, req.params.id), 'topic'));
  router.delete('/topics/:id', teacher, active, run(req => bank.deleteTopic(req.user.id, req.params.id)));
  // Upload once with existing POST /api/materials (private, no group/share); then register.
  router.get('/sources', teacher, run(req => bank.sources(req.user.id, req.query), 'sources'));
  router.post('/sources', teacher, active, run(req => bank.registerSource(req.user.id, req.body), 'source', 201));
  router.get('/sources/:id/file', teacher, binary(req => bank.sourceFile(req.user.id, req.params.id)));
  router.get('/questions', teacher, run(req => bank.questions(req.user.id, req.query)));
  router.get('/questions/:id', teacher, run(req => bank.getQuestion(req.user.id, req.params.id), 'question'));
  router.post('/questions', teacher, active, run(req => bank.saveQuestion(req.user.id, req.body), 'question', 201));
  router.put('/questions/:id', teacher, active, run(req => bank.saveQuestion(req.user.id, req.body, req.params.id), 'question'));
  router.delete('/questions/:id', teacher, active, run(req => bank.archiveQuestion(req.user.id, req.params.id)));
  router.get('/banks', teacher, run(req => bank.banks(req.user.id, req.query), 'banks'));
  router.post('/banks', teacher, active, run(req => bank.saveBank(req.user.id, req.body), 'bank', 201));
  router.put('/banks/:id', teacher, active, run(req => bank.saveBank(req.user.id, req.body, req.params.id), 'bank'));
  router.delete('/banks/:id', teacher, active, run(req => bank.deleteBank(req.user.id, req.params.id)));
  router.post('/banks/:id/items', teacher, active, run(req => bank.bankItems(req.user.id, req.params.id, req.body)));
  router.delete('/banks/:id/items', teacher, active, run(req => bank.bankItems(req.user.id, req.params.id, req.body, true)));
  router.get('/exams', teacher, run(req => bank.exams(req.user.id, req.query), 'exams'));
  router.post('/exams', teacher, phone, active, examLimit, run(req => bank.createExam(req.user.id, req.body), 'exam', 201));
  router.get('/exams/:id', teacher, run(req => bank.examDetail(req.user.id, req.params.id), 'exam'));
  router.patch('/exams/:id', teacher, active, run(req => bank.patchExam(req.user.id, req.params.id, req.body), 'exam'));
  router.delete('/exams/:id', teacher, active, run(req => bank.archiveExam(req.user.id, req.params.id)));
  router.get('/exams/:id/results', teacher, run(req => attempts.results(req.user.id, req.params.id, req.query), 'results'));
  router.get('/exams/:id/attempts/:attemptId', teacher,
    run(req => attempts.review(req.user, req.params.attemptId, req.params.id)));
  router.patch('/exams/:id/attempts/:attemptId/answers/:questionId', teacher, active,
    run(req => attempts.manualGrade(req.user.id, req.params.id, req.params.attemptId, req.params.questionId, req.body)));
  router.get('/analytics', teacher, run(req => bank.analytics(req.user.id, req.query), 'analytics'));
  return router;
}
module.exports = createQuestionBankRouter();
module.exports.createQuestionBankRouter = createQuestionBankRouter;
