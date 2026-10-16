const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const express = require('express');
const { PDFDocument } = require('pdf-lib');
const R = require('./questionBankRules');
const { sampleQuestion } = require('./questionBankTestFixtures');
const { createQuestionBankService } = require('./questionBankService');
const { createBankExamAttemptService } = require('./bankExamAttemptService');
const { createQuestionBankRouter } = require('../routes/questionBank');

const URL_VALUE = process.env.TEST_DATABASE_URL;
const T1 = '10000000-0000-4000-8000-000000000001';
const T2 = '10000000-0000-4000-8000-000000000002';
const S1 = '10000000-0000-4000-8000-000000000003';
const S2 = '10000000-0000-4000-8000-000000000004';
const SUBJECT = '20000000-0000-4000-8000-000000000001';
const OTHER_SUBJECT = '20000000-0000-4000-8000-000000000002';
const MATERIAL = '30000000-0000-4000-8000-000000000001';
const GROUP = randomUUID();
const OTHER_GROUP = randomUUID();
const models = path.join(__dirname, '../models');
const sql = file => fs.readFileSync(path.join(models, file), 'utf8');

test('question bank HTTP + real PostgreSQL contracts (isolated local schema only)', { skip: !URL_VALUE && 'TEST_DATABASE_URL not set' }, async t => {
  const url = new URL(URL_VALUE);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Refusing a non-local database');
  const schema = `qb_api_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: URL_VALUE, ssl: false });
  let pool;
  let server;
  const globalDb = require('../utils/db');
  const originalQuery = globalDb.query;
  const originalTransaction = globalDb.transaction;
  const auth = require('../middleware/auth');
  const originalAuthenticate = auth.authenticate;
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    globalDb.query = originalQuery;
    globalDb.transaction = originalTransaction;
    auth.authenticate = originalAuthenticate;
    if (pool) await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  });
  await admin.query(`CREATE SCHEMA ${schema}`);
  pool = new Pool({ connectionString: URL_VALUE, options: `-c search_path=${schema},pg_catalog`, ssl: false, max: 10 });
  const db = {
    query: (...args) => pool.query(...args),
    transaction: async fn => {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        const out = await fn(c);
        await c.query('COMMIT');
        return out;
      } catch (e) { await c.query('ROLLBACK'); throw e; }
      finally { c.release(); }
    },
  };
  await db.transaction(async c => {
    await c.query(sql('questionBankSchema.fixture.sql'));
    await c.query(`
      ALTER TABLE users ADD full_name TEXT DEFAULT 'Fixture user', ADD is_active BOOLEAN DEFAULT TRUE, ADD deleted_at TIMESTAMPTZ;
      ALTER TABLE instructor_subjects ADD is_system BOOLEAN DEFAULT FALSE;
      ALTER TABLE course_materials ADD storage_filename TEXT, ADD title TEXT DEFAULT 'PDF', ADD file_size BIGINT DEFAULT 100,
        ADD subject_id UUID, ADD created_at TIMESTAMPTZ DEFAULT NOW();
      UPDATE course_materials SET storage_filename=id::text||'.pdf';
      ALTER TABLE exams ADD subject TEXT, ADD start_time TIMESTAMP, ADD available_from TIMESTAMPTZ,
        ADD available_until TIMESTAMPTZ, ADD duration_minutes INTEGER, ADD allow_finish_after_until BOOLEAN DEFAULT TRUE,
        ADD status TEXT DEFAULT 'draft', ADD show_results BOOLEAN DEFAULT TRUE, ADD result_visibility_mode TEXT,
        ADD results_release_at TIMESTAMPTZ, ADD wrong_penalty_enabled BOOLEAN DEFAULT FALSE,
        ADD slug TEXT UNIQUE, ADD is_deleted BOOLEAN DEFAULT FALSE, ADD created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE exam_questions ADD order_num INTEGER, ADD negative_marking NUMERIC DEFAULT 0;
      ALTER TABLE exam_results ADD started_at TIMESTAMP, ADD submitted_at TIMESTAMP, ADD grading JSONB,
        ADD duration_seconds INTEGER, ADD is_crm_student BOOLEAN;
      CREATE TABLE enrollments (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), instructor_id UUID, student_id UUID, status TEXT,
        group_id UUID, deleted_at TIMESTAMPTZ);
      CREATE TABLE instructor_groups (id UUID PRIMARY KEY, instructor_id UUID, subject_id UUID, name TEXT DEFAULT 'Group', is_system BOOLEAN DEFAULT FALSE);
      CREATE TABLE student_profiles (user_id UUID, grade TEXT);
      CREATE TABLE platform_feature_flags (key TEXT, enabled BOOLEAN);
      INSERT INTO platform_feature_flags VALUES ('feature.exam_result_modes.enabled',FALSE);
      CREATE TABLE instructor_group_members (group_id UUID, student_id UUID);
      CREATE TABLE exam_assignments (exam_id UUID REFERENCES exams(id), student_id UUID REFERENCES users(id),
        late_access_until TIMESTAMPTZ, UNIQUE(exam_id,student_id));
      CREATE TABLE course_material_blobs (filename TEXT PRIMARY KEY, content_type TEXT, byte_size INTEGER, data BYTEA);
      CREATE TABLE presentations (instructor_id UUID, file_size BIGINT);
      CREATE TABLE student_activity_log (
        id BIGSERIAL PRIMARY KEY, student_id UUID, instructor_id UUID, entity_type TEXT, entity_id UUID,
        event_type TEXT, metadata JSONB, created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await c.query(sql('migrations/178_exam_open_ai_grading.sql'));
    await c.query(sql('migrations/217_student_activity_log_extend.sql'));
    await c.query(sql('migrations/220_exam_student_progress.sql'));
    await c.query(sql('migrations/236_question_bank_foundation.sql'));
    await c.query(`INSERT INTO enrollments(instructor_id,student_id,status) VALUES ($1,$2,'active'),($1,$3,'active')`, [T1, S1, S2]);
    await c.query('INSERT INTO instructor_groups(id,instructor_id,subject_id) VALUES ($1,$2,$3),($4,$5,$6)', [GROUP, T1, SUBJECT, OTHER_GROUP, T2, OTHER_SUBJECT]);
    await c.query('UPDATE enrollments SET group_id=$1 WHERE student_id=$2', [GROUP, S1]);
    await c.query('INSERT INTO instructor_group_members VALUES ($1,$2)', [GROUP, S1]);
  });
  const doc = await PDFDocument.create(); doc.addPage();
  const pdf = Buffer.from(await doc.save());
  await db.query('INSERT INTO course_material_blobs VALUES ($1,$2,$3,$4)', [`${MATERIAL}.pdf`, 'application/pdf', pdf.length, pdf]);
  let clock = new Date();
  let quotaCap = 10 * 1024 * 1024;
  const notices = [];
  const bank = createQuestionBankService({
    db,
    readMaterial: async filename => {
      const { rows } = await db.query('SELECT data FROM course_material_blobs WHERE filename=$1', [filename]);
      return rows[0] ? { buffer: rows[0].data } : null;
    },
  });
  const attempts = createBankExamAttemptService({
    db, bank, now: () => new Date(clock),
    notify: (event, payload) => notices.push({ event, payload }),
    quota: async (owner, c) => {
      const { rows } = await c.query(
        `SELECT COALESCE(SUM(f.byte_size),0) AS bytes,COUNT(*)::int AS n FROM exam_answer_files f
         JOIN exam_results r ON r.id=f.attempt_id JOIN exams e ON e.id=r.exam_id WHERE e.instructor_id=$1`, [owner],
      );
      return { limits: { storage_bytes: quotaCap, max_files: 20 }, usage: { used_bytes: rows[0].bytes, file_count: rows[0].n } };
    },
  });
  // Production authentication/subscription middleware is unchanged. HTTP tests inject
  // fixture identities and entitlement gates only; all SQL, transactions and role gates are real.
  const authenticate = async (req, res, next) => {
    const { rows } = await db.query('SELECT id,role FROM users WHERE id::text=$1', [req.headers['x-test-user'] || '']);
    if (!rows[0]) return res.status(401).json({ success: false });
    req.user = rows[0]; next();
  };
  globalDb.query = db.query; globalDb.transaction = db.transaction;
  auth.authenticate = authenticate;
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/question-bank', createQuestionBankRouter({
    bank, attempts, authenticate, active: (_req, _res, next) => next(),
    phone: (_req, _res, next) => next(), examLimit: (_req, _res, next) => next(),
  }));
  app.use('/api/exams', require('../routes/exams'));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/question-bank`;
  async function request(user, method, endpoint, body, expected = 200, legacy = false) {
    const response = await fetch((legacy ? base.replace('/question-bank', '/exams') : base) + endpoint, {
      method, headers: { ...(user ? { 'x-test-user': user } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body == null ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    assert.equal(response.status, expected, `${method} ${endpoint}: ${JSON.stringify(data)}`);
    return data;
  }
  async function upload(user, attemptId, questionId, value = 'My file answer', mime = 'text/plain', expected = 201) {
    const form = new FormData();
    form.append('file', new Blob([value], { type: mime }), 'work.txt');
    const response = await fetch(`${base}/attempts/${attemptId}/answers/${questionId}/file`, {
      method: 'POST', headers: { 'x-test-user': user }, body: form,
    });
    const out = await response.json();
    assert.equal(response.status, expected, JSON.stringify(out));
    return out.file;
  }
  const definitions = new Map();
  let topic, child, source, collection, exam, run, file;
  const config = (questionIds, extra = {}) => ({
    title: 'Fixture bank exam', subject_id: SUBJECT, question_ids: questionIds,
    available_from: new Date(clock.getTime() - 3600000).toISOString(),
    available_until: new Date(clock.getTime() + 3600000).toISOString(),
    duration_minutes: 60, student_ids: [S1], status: 'scheduled',
    shuffle_questions: true, shuffle_options: true, display_mode: 'step', ...extra,
  });

  await t.test('authentication, role boundaries, sources, topic hierarchy and cycle rejection', async () => {
    await request(null, 'GET', '/subjects', null, 401);
    await request(S1, 'GET', '/questions', null, 403);
    topic = (await request(T1, 'POST', '/topics', { name: 'Parent', subject_id: SUBJECT }, 201)).topic;
    child = (await request(T1, 'POST', '/topics', { name: 'Child', subject_id: SUBJECT, parent_topic_id: topic.id }, 201)).topic;
    await request(T1, 'PUT', `/topics/${topic.id}`, { name: 'Parent', subject_id: SUBJECT, parent_topic_id: child.id }, 400);
    await request(T2, 'PUT', `/topics/${child.id}`, { name: 'Other', subject_id: OTHER_SUBJECT }, 404);
    source = (await request(T1, 'POST', '/sources', { material_id: MATERIAL, subject_id: SUBJECT }, 201)).source;
    assert.equal(source.page_count, 1);
    await request(T2, 'POST', '/sources', { material_id: MATERIAL, subject_id: OTHER_SUBJECT }, 404);
    await request(S1, 'GET', `/sources/${source.id}/file`, null, 403);
    const f = await fetch(`${base}/sources/${source.id}/file`, { headers: { 'x-test-user': T1 } });
    assert.equal(f.status, 200); assert.equal(Buffer.from(await f.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
  });
  await t.test('nine published types, PDF page bounds, pagination, recursive filters and collection ownership', async () => {
    for (const type of R.TYPES) {
      const fixture = sampleQuestion(type, SUBJECT);
      fixture.q.topic_id = child.id;
      if (type === 'single_choice') Object.assign(fixture.q, { source_pdf_id: source.id, source_page: 1 });
      const saved = await request(T1, 'POST', '/questions', fixture.q, 201);
      definitions.set(type, { ...fixture, saved: saved.question });
    }
    const invalidPage = { ...definitions.get('single_choice').q, source_page: 2 };
    await request(T1, 'POST', '/questions', invalidPage, 400);
    const id = definitions.get('single_choice').saved.id;
    await request(T2, 'GET', `/questions/${id}`, null, 404);
    await request(T2, 'PUT', `/questions/${id}`, { ...definitions.get('single_choice').q, subject_id: OTHER_SUBJECT, source_pdf_id: null, source_page: null, topic_id: null }, 404);
    const filtered = await request(T1, 'GET', `/questions?topic_id=${topic.id}&limit=2`);
    assert.equal(filtered.total, 9); assert.equal(filtered.items.length, 2);
    const none = await request(T1, 'GET', `/questions?offset=100`);
    assert.equal(none.total, 9); assert.equal(none.items.length, 0);
    assert.equal((await request(T1, 'GET', `/questions?topic_id=${topic.id}&include_descendants=false`)).total, 0);
    await request(T1, 'GET', `/questions?teacher_id=${T2}`, null, 400);
    collection = (await request(T1, 'POST', '/banks', { name: 'Collection', saved_filters: { topic_id: topic.id } }, 201)).bank;
    await request(T1, 'POST', `/banks/${collection.id}/items`, { question_ids: [id] });
    await request(T2, 'POST', `/banks/${collection.id}/items`, { question_ids: [id] }, 404);
    assert.equal((await request(T1, 'GET', `/questions?bank_id=${collection.id}`)).total, 1);
  });
  await t.test('builder validates group/student scope and stores only public legacy placeholders', async () => {
    const ids = [...definitions.values()].map(d => d.saved.id);
    await request(T1, 'POST', '/exams', config(ids, { group_ids: [OTHER_GROUP] }), 400);
    exam = (await request(T1, 'POST', '/exams', config(ids, { group_ids: [GROUP], student_ids: [] }), 201)).exam;
    assert.equal(exam.total_points, 18); assert.equal(exam.question_count, 9);
    assert.deepEqual(exam.student_ids, [S1]);
    const legacy = (await db.query('SELECT correct_answer,options,model_answer FROM exam_questions WHERE exam_id=$1', [exam.id])).rows;
    for (const q of legacy) {
      assert.equal(q.correct_answer, null); assert.equal(q.model_answer, null);
      assert.doesNotMatch(JSON.stringify(q.options), /is_correct|PRIVATE_|answer_key/);
    }
    await request(T2, 'GET', `/exams/${exam.id}`, null, 404);
    await request(S2, 'POST', `/exams/${exam.id}/start`, {}, 403);
  });
  await t.test('concurrent starts are idempotent, option order is stable and student payloads contain no key/source/explanation', async () => {
    const [a, b] = await Promise.all([request(S1, 'POST', `/exams/${exam.id}/start`, {}), request(S1, 'POST', `/exams/${exam.id}/start`, {})]);
    run = a;
    assert.equal(a.attempt.id, b.attempt.id);
    assert.deepEqual(a.questions, b.questions);
    const reload = await request(S1, 'GET', `/attempts/${a.attempt.id}`);
    assert.deepEqual(reload.questions, a.questions);
    for (const key of ['answer_key', 'is_correct', 'explanation', 'source_pdf_id', 'source_page', 'bank_question_id', 'PRIVATE_']) {
      assert.equal(JSON.stringify(a).includes(key), false, key);
    }
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM exam_results WHERE exam_id=$1', [exam.id])).rows[0].n, 1);
    await request(S2, 'GET', `/attempts/${a.attempt.id}`, null, 404);
  });
  await t.test('started exam freezes structure; editing the bank does not change its private exam copy', async () => {
    await request(T1, 'PATCH', `/exams/${exam.id}`, { duration_minutes: 1 }, 409);
    await request(T1, 'PATCH', `/exams/${exam.id}`, { question_ids: [definitions.get('single_choice').saved.id] }, 409);
    await request(T1, 'PATCH', `/exams/${exam.id}`, { title: 'Renamed exam' });
    const d = definitions.get('single_choice');
    const updated = { ...d.q, question_text: 'Changed after the exam started', answer_key: { option_id: d.q.options[0].id } };
    await request(T1, 'PUT', `/questions/${d.saved.id}`, updated);
    const snapshot = (await request(T1, 'GET', `/exams/${exam.id}`)).exam.questions.find(q => q.bank_question_id === d.saved.id).snapshot;
    assert.equal(snapshot.question_text, d.q.question_text);
    assert.deepEqual(snapshot.answer_key, d.q.answer_key);
  });
  await t.test('autosave rejects foreign/invalid answers atomically and preserves false/zero', async () => {
    const single = run.questions.find(q => q.question_type === 'single_choice');
    const tf = run.questions.find(q => q.question_type === 'true_false');
    await request(S1, 'PATCH', `/attempts/${run.attempt.id}/answers`, { answers: {
      [single.id]: definitions.get('single_choice').answer, [tf.id]: 'false',
    } }, 400);
    assert.deepEqual((await db.query('SELECT answers FROM exam_results WHERE id=$1', [run.attempt.id])).rows[0].answers, {});
    await request(S1, 'PATCH', `/attempts/${run.attempt.id}/answers`, { answers: { [randomUUID()]: false } }, 400);
    await request(S2, 'PATCH', `/attempts/${run.attempt.id}/answers`, { answers: {} }, 404);
    const answers = Object.fromEntries(run.questions.filter(q => q.question_type !== 'file_upload')
      .map(q => [q.id, definitions.get(q.question_type).answer]));
    const saved = await request(S1, 'PATCH', `/attempts/${run.attempt.id}/answers`, { answers });
    assert.equal(saved.answered_count, 8);
    const resumed = await request(S1, 'GET', `/attempts/${run.attempt.id}`);
    assert.equal(resumed.answers[tf.id], false);
    assert.equal(resumed.answers[run.questions.find(q => q.question_type === 'numeric').id], 0);
  });
  await t.test('private file uploads verify bytes/type, quota, ownership and failed replacement rollback', async () => {
    const q = run.questions.find(q => q.question_type === 'file_upload');
    await upload(S1, run.attempt.id, q.id, 'not a PDF', 'application/pdf', 400);
    file = await upload(S1, run.attempt.id, q.id);
    const mine = await fetch(`${base}/files/${file.id}`, { headers: { 'x-test-user': S1 } });
    assert.equal(mine.status, 200); assert.equal(await mine.text(), 'My file answer');
    assert.match(mine.headers.get('content-disposition'), /^attachment/);
    assert.equal(mine.headers.get('x-content-type-options'), 'nosniff');
    await request(S2, 'GET', `/files/${file.id}`, null, 404);
    await request(T1, 'GET', `/files/${file.id}`, null, 409);
    await request(S1, 'PATCH', `/attempts/${run.attempt.id}/answers`, { answers: { [q.id]: { file_ids: [randomUUID()] } } }, 400);
    quotaCap = 0;
    await upload(S1, run.attempt.id, q.id, 'replacement', 'text/plain', 429);
    quotaCap = 10 * 1024 * 1024;
    assert.equal((await db.query('SELECT id FROM exam_answer_files WHERE attempt_id=$1', [run.attempt.id])).rows[0].id, file.id);
  });
  await t.test('legacy routes refuse the bank engine; legacy expiry and AI workers cannot grade it', async () => {
    for (const [method, endpoint, body] of [
      ['GET', `/${exam.id}/questions`], ['GET', `/${exam.id}/review`],
      ['POST', '/submit', { exam_id: exam.id }], ['POST', `/${exam.id}/autosave`, { answers: {} }],
    ]) assert.equal((await request(S1, method, endpoint, body, 409, true)).code, 'QUESTION_BANK_API_REQUIRED');
    await request(T1, 'PATCH', `/${exam.id}`, { title: 'bypass' }, 409, true);
    await request(T1, 'POST', `/${exam.id}/regrade`, {}, 409, true);
    await request(T1, 'POST', '/bulk-delete', { exam_ids: [exam.id] }, 409, true);
    await request(T1, 'POST', '/bulk-delete', {
      exam_id: '40000000-0000-4000-8000-000000000001', exam_ids: [` ${exam.id} `],
    }, 409, true);
    await request(S1, 'GET', `/${exam.id.replaceAll('-', '')}/questions`, null, 409, true);
    await request(S1, 'POST', '/submit', { exam_id: `{${exam.id}}` }, 409, true);
    const legacy = await require('./assessmentAttemptService').finalizeExpiredAttempt(run.attempt.id);
    assert.equal(legacy.reason, 'question_bank_api_required');
    await require('./openExamGradingService').enqueueOpenGradingJob(run.attempt.id);
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM exam_open_grading_queue')).rows[0].n, 0);
  });
  await t.test('submit/retry, automatic score, pending manual review and hidden results are atomic', async () => {
    const replies = await Promise.all([
      request(S1, 'POST', `/attempts/${run.attempt.id}/submit`, {}),
      request(S1, 'POST', `/attempts/${run.attempt.id}/submit`, {}),
    ]);
    assert.equal(replies[0].attempt_id, replies[1].attempt_id);
    assert.equal(replies[0].score, undefined);
    const student = await request(S1, 'GET', `/attempts/${run.attempt.id}/result`);
    assert.equal(student.score, null); assert.equal(student.raw_score, null);
    assert.equal(student.grading_pending, true); assert.deepEqual(student.breakdown, []);
    const legacyList = await request(S1, 'GET', '/my', null, 200, true);
    const bankRow = legacyList.exams.find(e => e.id === exam.id);
    assert.equal(bankRow.question_bank_enabled, true); assert.equal(bankRow.score, null);
    const teacher = await request(T1, 'GET', `/exams/${exam.id}/attempts/${run.attempt.id}`);
    assert.equal(teacher.raw_score, 14); assert.equal(teacher.breakdown.filter(q => q.status === 'pending_review').length, 2);
    const status = (await db.query('SELECT * FROM exam_student_progress WHERE exam_id=$1', [exam.id])).rows[0];
    assert.equal(status.status, 'pending_manual_grading'); assert.equal(status.attempt_count, 1);
    assert.equal((await db.query(`SELECT COUNT(*)::int AS n FROM student_activity_log WHERE entity_id=$1 AND event_type='exam_submitted'`, [exam.id])).rows[0].n, 1);
    await request(S1, 'PATCH', `/attempts/${run.attempt.id}/answers`, { answers: {} }, 409);
    await upload(S1, run.attempt.id, run.questions.find(q => q.question_type === 'file_upload').id, 'late', 'text/plain', 409);
    const ai = await require('./openExamGradingService').processOpenGradingForResult(run.attempt.id);
    assert.deepEqual(ai, { processed: 0, errors: 0 });
  });
  await t.test('teacher-only bounded manual grades recompute both score stores and progress in one transaction', async () => {
    const open = run.questions.find(q => q.question_type === 'open_answer');
    const fileQ = run.questions.find(q => q.question_type === 'file_upload');
    const endpoint = qid => `/exams/${exam.id}/attempts/${run.attempt.id}/answers/${qid}`;
    await request(S1, 'PATCH', endpoint(open.id), { awarded_points: 2 }, 403);
    await request(T2, 'PATCH', endpoint(open.id), { awarded_points: 2 }, 404);
    await request(T1, 'PATCH', endpoint(open.id), { awarded_points: 3 }, 400);
    await request(T1, 'PATCH', endpoint(run.questions.find(q => q.question_type === 'numeric').id), { awarded_points: 0 }, 400);
    await request(T1, 'PATCH', endpoint(open.id), { awarded_points: 1, teacher_feedback: 'Partial credit' });
    const teacher = await request(T1, 'PATCH', endpoint(fileQ.id), { awarded_points: 2, teacher_feedback: 'Accepted' });
    assert.equal(teacher.raw_score, 17); assert.equal(teacher.score, 94.44); assert.equal(teacher.grading_pending, false);
    const student = await request(S1, 'GET', `/attempts/${run.attempt.id}/result`);
    assert.equal(student.score, 94.44);
    assert.equal(student.breakdown.find(q => q.id === open.id).teacher_feedback, 'Partial credit');
    assert.equal((await db.query('SELECT status FROM exam_student_progress WHERE exam_id=$1', [exam.id])).rows[0].status, 'result_released');
    await request(S1, 'POST', `/attempts/${run.attempt.id}/submit`, { answers: {} });
    assert.equal((await request(S1, 'GET', `/attempts/${run.attempt.id}/result`)).score, 94.44);
    const binary = await fetch(`${base}/files/${file.id}`, { headers: { 'x-test-user': T1 } });
    assert.equal(binary.status, 200);
  });
  await t.test('score-only, wrong-only and scheduled release redact keys/feedback and list scores server-side', async () => {
    await request(T1, 'PATCH', `/exams/${exam.id}`, { result_visibility_mode: 'score_only' });
    let result = await request(S1, 'GET', `/attempts/${run.attempt.id}/result`);
    assert.equal(result.score, 94.44); assert.deepEqual(result.breakdown, []);
    await request(T1, 'PATCH', `/exams/${exam.id}`, { result_visibility_mode: 'wrong_answers_only' });
    result = await request(S1, 'GET', `/attempts/${run.attempt.id}/result`);
    assert.equal(result.breakdown.length, 1); assert.equal(result.breakdown[0].question_type, 'open_answer');
    await request(T1, 'PATCH', `/exams/${exam.id}`, {
      result_visibility_mode: 'after_exam_window', results_release_at: new Date(clock.getTime() + 86400000).toISOString(),
    });
    result = await request(S1, 'GET', `/attempts/${run.attempt.id}/result`);
    assert.equal(result.score, null); assert.deepEqual(result.breakdown, []);
    const list = await request(S1, 'GET', '/student/exams');
    assert.equal(list.exams.find(e => e.id === exam.id).score, null);
    const analytics = (await request(T1, 'GET', `/analytics?exam_id=${exam.id}`)).analytics;
    assert.equal(analytics.reduce((sum, r) => sum + r.mistake_count, 0), 1);
    await request(T2, 'GET', `/analytics?exam_id=${exam.id}`, null, 404);
  });
  await t.test('late submit ignores forged late payload, grading only already-saved answers', async () => {
    clock = new Date();
    const id = definitions.get('true_false').saved.id;
    const e = (await request(T1, 'POST', '/exams', config([id], { duration_minutes: 1, result_visibility_mode: 'immediate_full_review' }), 201)).exam;
    const a = await request(S1, 'POST', `/exams/${e.id}/start`, {});
    const q = a.questions[0];
    await request(S1, 'PATCH', `/attempts/${a.attempt.id}/answers`, { answers: { [q.id]: false } });
    clock = new Date(clock.getTime() + 5 * 60000);
    await request(S1, 'PATCH', `/attempts/${a.attempt.id}/answers`, { answers: { [q.id]: true } }, 409);
    const final = await request(S1, 'POST', `/attempts/${a.attempt.id}/submit`, { answers: { [q.id]: true } });
    assert.equal(final.late_payload_ignored, true);
    const result = await request(S1, 'GET', `/attempts/${a.attempt.id}/result`);
    assert.equal(result.score, 100); assert.equal(result.breakdown[0].student_answer, false);
    clock = new Date();
  });
  await t.test('expiry sweep auto-submits saved false, marks blank attempts expired and never queues AI', async () => {
    const e = (await request(T1, 'POST', '/exams', config([definitions.get('true_false').saved.id], {
      duration_minutes: 1, student_ids: [S1, S2], result_visibility_mode: 'immediate_full_review',
    }), 201)).exam;
    const a = await request(S1, 'POST', `/exams/${e.id}/start`, {});
    const b = await request(S2, 'POST', `/exams/${e.id}/start`, {});
    await request(S1, 'PATCH', `/attempts/${a.attempt.id}/answers`, { answers: { [a.questions[0].id]: false } });
    await db.query(`UPDATE exam_results SET started_at=NOW()-interval '3 minutes' WHERE exam_id=$1`, [e.id]);
    const swept = await attempts.sweep();
    assert.equal(swept.finalized, 2);
    assert.equal((await request(S1, 'GET', `/attempts/${a.attempt.id}/result`)).score, 100);
    assert.equal((await request(S2, 'GET', `/attempts/${b.attempt.id}/result`)).status, 'expired');
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM exam_open_grading_queue')).rows[0].n, 0);
  });
  await t.test('a failure after grading rolls back answers, raw score, legacy score, submission and progress', async () => {
    const e = (await request(T1, 'POST', '/exams', config([definitions.get('true_false').saved.id]), 201)).exam;
    const a = await request(S1, 'POST', `/exams/${e.id}/start`, {});
    await request(S1, 'PATCH', `/attempts/${a.attempt.id}/answers`, { answers: { [a.questions[0].id]: false } });
    await db.query(`CREATE FUNCTION qb_test_fail_submit() RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN IF NEW.submitted_at IS NOT NULL AND OLD.submitted_at IS NULL THEN RAISE EXCEPTION 'fixture failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER qb_test_fail_submit BEFORE UPDATE ON exam_results FOR EACH ROW EXECUTE FUNCTION qb_test_fail_submit()`);
    await request(S1, 'POST', `/attempts/${a.attempt.id}/submit`, {}, 500);
    await db.query('DROP TRIGGER qb_test_fail_submit ON exam_results; DROP FUNCTION qb_test_fail_submit()');
    const r = (await db.query(
      `SELECT er.status,er.score,er.submitted_at,d.raw_score,a.status AS answer_status,p.status AS progress_status
       FROM exam_results er JOIN exam_attempt_details d ON d.attempt_id=er.id JOIN exam_answers a ON a.attempt_id=er.id
       JOIN exam_student_progress p ON p.exam_id=er.exam_id AND p.student_id=er.student_id WHERE er.id=$1`, [a.attempt.id],
    )).rows[0];
    assert.equal(r.status, 'in_progress'); assert.equal(r.answer_status, 'answered'); assert.equal(r.progress_status, 'in_progress');
    assert.equal(r.score, null); assert.equal(r.raw_score, null); assert.equal(r.submitted_at, null);
    await request(S1, 'POST', `/attempts/${a.attempt.id}/submit`, {});
  });
  await t.test('concurrent save/submit/retries finalize once, keeping companion and legacy scores consistent', async () => {
    const e = (await request(T1, 'POST', '/exams', config([definitions.get('true_false').saved.id], { result_visibility_mode: 'immediate_full_review' }), 201)).exam;
    const a = await request(S1, 'POST', `/exams/${e.id}/start`, {});
    const send = (method, endpoint, body) => fetch(`${base}/attempts/${a.attempt.id}/${endpoint}`, {
      method, headers: { 'x-test-user': S1, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const responses = await Promise.all([
      send('PATCH', 'answers', { answers: { [a.questions[0].id]: false } }),
      send('POST', 'submit', { answers: { [a.questions[0].id]: false } }),
      send('POST', 'submit', { answers: { [a.questions[0].id]: true } }),
    ]);
    assert.ok([200, 409].includes(responses[0].status));
    assert.equal(responses[1].status, 200); assert.equal(responses[2].status, 200);
    const result = await request(S1, 'GET', `/attempts/${a.attempt.id}/result`);
    const correct = result.breakdown[0].student_answer === false;
    assert.equal(result.score, correct ? 100 : 0); assert.equal(result.raw_score, correct ? 2 : 0);
    assert.equal((await db.query(`SELECT COUNT(*)::int AS n FROM student_activity_log WHERE entity_id=$1 AND event_type='exam_submitted'`, [e.id])).rows[0].n, 1);
  });
  await t.test('usage includes durable answer blobs and notifications run only after successful finalization', async () => {
    const usage = await require('./courseMaterialsService').getInstructorMaterialsUsage(T1);
    assert.ok(usage.used_bytes >= Buffer.byteLength('My file answer'));
    assert.ok(notices.some(n => n.event === 'onAssessmentSubmitted' && n.payload.gradingPending));
    assert.ok(notices.some(n => n.event === 'onResultReleased'));
    const results = await request(T1, 'GET', `/exams/${exam.id}/results?pending_only=true`);
    assert.equal(results.results.length, 0);
    await request(T1, 'DELETE', `/questions/${definitions.get('open_answer').saved.id}`);
    assert.equal((await request(T1, 'GET', '/questions?status=archived')).total, 1);
  });
});
