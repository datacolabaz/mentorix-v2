const { randomUUID } = require('node:crypto');
const { PDFDocument } = require('pdf-lib');
const R = require('./questionBankRules');
const { RESULT_VISIBILITY_MODES, showResultsForMode } = require('./examResultVisibility');
const { slugifyExamTitle } = require('../lib/examSlug');

const QUESTION_SELECT = `SELECT q.*,
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', o.id, 'option_text', o.option_text, 'is_correct', o.is_correct,
    'order_num', o.order_num, 'metadata', o.metadata) ORDER BY o.order_num)
    FROM question_options o WHERE o.question_id = q.id), '[]'::jsonb) AS options
  FROM bank_questions q`;
const EXAM_SELECT = `SELECT e.*, s.subject_id, s.exam_type, s.shuffle_questions, s.shuffle_options, s.display_mode
  FROM exams e JOIN exam_bank_settings s ON s.exam_id = e.id`;
const LEGACY_TYPE = {
  single_choice: 'closed', multiple_choice: 'multiple', true_false: 'closed',
  short_answer: 'open', numeric: 'open', matching: 'matching', ordering: 'sequence',
  open_answer: 'open', file_upload: 'open',
};

async function pdfPages(buffer) {
  R.check(Buffer.isBuffer(buffer) && buffer.length > 0 && buffer.length <= R.MAX_FILE_BYTES &&
    buffer.subarray(0, 5).toString() === '%PDF-', 'PDF content');
  try {
    const pdf = await PDFDocument.load(buffer, { throwOnInvalidObject: true, updateMetadata: false });
    const count = pdf.getPageCount();
    R.check(count > 0 && count <= 10000 && !pdf.isEncrypted, 'PDF pages/encryption');
    return count;
  } catch (e) {
    if (e.statusCode) throw e;
    R.fail(400, 'QB_INVALID_PDF', 'PDF oxunmadı və ya şifrəlidir');
  }
}
function createQuestionBankService(overrides = {}) {
  const db = overrides.db || require('../utils/db');
  const readMaterial = overrides.readMaterial || require('./courseMaterialStorage').readCourseMaterialBuffer;

  async function owned(client, table, owner, entityId, ownerColumn = 'created_by', lock = '') {
    const { rows } = await client.query(
      `SELECT * FROM ${table} WHERE id = $1 AND ${ownerColumn} = $2 ${lock}`, [R.id(entityId), owner],
    );
    if (!rows[0]) R.fail(404, 'QB_NOT_FOUND', 'Tapılmadı');
    return rows[0];
  }
  async function subjects(owner) {
    const { rows } = await db.query(
      `SELECT id, name FROM instructor_subjects WHERE instructor_id = $1 AND COALESCE(is_system, FALSE) = FALSE ORDER BY name, id`, [owner],
    );
    return rows;
  }
  async function createSubject(owner, input) {
    const { rows } = await db.query(
      'INSERT INTO instructor_subjects (instructor_id, name) VALUES ($1,$2) RETURNING id, name',
      [owner, R.text(input.name, 'name')],
    );
    return rows[0];
  }
  async function topics(owner, query = {}) {
    const params = [owner];
    let where = '';
    if (query.subject_id) { params.push(R.id(query.subject_id)); where = 'AND subject_id = $2'; }
    const { rows } = await db.query(
      `SELECT id, subject_id, parent_topic_id, name FROM question_bank_topics
       WHERE created_by = $1 ${where} ORDER BY name, id`, params,
    );
    return rows;
  }
  async function saveTopic(owner, input, topicId = null) {
    const subjectId = R.id(input.subject_id, 'subject_id');
    const parentId = R.optionalId(input.parent_topic_id, 'parent_topic_id');
    const name = R.text(input.name, 'name');
    return db.transaction(async c => {
      await owned(c, 'instructor_subjects', owner, subjectId, 'instructor_id');
      if (parentId) {
        const parent = await owned(c, 'question_bank_topics', owner, parentId);
        R.check(parent.subject_id === subjectId, 'parent subject');
      }
      if (topicId) {
        await owned(c, 'question_bank_topics', owner, topicId, 'created_by', 'FOR UPDATE');
        const { rows } = await c.query(
          `UPDATE question_bank_topics SET subject_id=$3, parent_topic_id=$4, name=$5 WHERE id=$1 AND created_by=$2 RETURNING *`,
          [R.id(topicId), owner, subjectId, parentId, name],
        );
        return rows[0];
      }
      const { rows } = await c.query(
        `INSERT INTO question_bank_topics (created_by, subject_id, parent_topic_id, name)
         VALUES ($1,$2,$3,$4) RETURNING *`, [owner, subjectId, parentId, name],
      );
      return rows[0];
    });
  }
  async function deleteTopic(owner, topicId) {
    const { rows } = await db.query(
      'DELETE FROM question_bank_topics WHERE id=$1 AND created_by=$2 RETURNING id', [R.id(topicId), owner],
    );
    if (!rows.length) R.fail(404, 'QB_NOT_FOUND');
  }
  async function sourceFile(client, owner, sourceId) {
    const { rows } = await client.query(
      `SELECT s.*, m.storage_filename, m.file_url, COALESCE(m.original_filename,m.title) AS file_name
       FROM source_pdfs s JOIN course_materials m ON m.id=s.material_id AND m.instructor_id=s.uploaded_by
       WHERE s.id=$1 AND s.uploaded_by=$2`, [R.id(sourceId), owner],
    );
    if (!rows[0]) R.fail(404, 'QB_NOT_FOUND');
    const file = await readMaterial(rows[0].storage_filename);
    if (!file?.buffer) R.fail(404, 'QB_SOURCE_FILE_MISSING');
    return { ...rows[0], buffer: file.buffer, page_count: await pdfPages(file.buffer) };
  }
  async function registerSource(owner, input) {
    return db.transaction(async c => {
      const subjectId = R.id(input.subject_id);
      await owned(c, 'instructor_subjects', owner, subjectId, 'instructor_id');
      const m = await owned(c, 'course_materials', owner, input.material_id, 'instructor_id', 'FOR SHARE');
      R.check(m.file_type === 'application/pdf' && (!m.subject_id || m.subject_id === subjectId), 'owned PDF subject');
      const file = await readMaterial(m.storage_filename);
      if (!file?.buffer) R.fail(404, 'QB_SOURCE_FILE_MISSING');
      const pageCount = await pdfPages(file.buffer);
      const { rows } = await c.query(
        `INSERT INTO source_pdfs (material_id, uploaded_by, subject_id) VALUES ($1,$2,$3)
         ON CONFLICT (material_id) DO UPDATE SET material_id=EXCLUDED.material_id
         WHERE source_pdfs.uploaded_by=EXCLUDED.uploaded_by AND source_pdfs.subject_id=EXCLUDED.subject_id
         RETURNING *`, [m.id, owner, subjectId],
      );
      if (!rows[0]) R.fail(409, 'QB_SOURCE_ALREADY_REGISTERED');
      return {
        ...rows[0], page_count: pageCount, file_name: m.original_filename || m.title,
        file_url: `/api/question-bank/sources/${rows[0].id}/file`,
      };
    });
  }
  async function sources(owner, query = {}) {
    const p = R.page(query);
    const { rows } = await db.query(
      `SELECT s.id, s.material_id, s.subject_id, s.created_at, m.file_url,
        COALESCE(m.original_filename,m.title) AS file_name
       FROM source_pdfs s JOIN course_materials m ON m.id=s.material_id
       WHERE s.uploaded_by=$1 AND ($2::uuid IS NULL OR s.subject_id=$2)
       ORDER BY s.created_at DESC, s.id LIMIT $3 OFFSET $4`,
      [owner, R.optionalId(query.subject_id), p.limit, p.offset],
    );
    return rows.map(s => ({ ...s, file_url: `/api/question-bank/sources/${s.id}/file` }));
  }
  function filters(owner, query = {}) {
    R.check(!query.teacher_id || R.id(query.teacher_id) === owner, 'teacher_id scope');
    const params = [owner];
    const clauses = ['q.created_by=$1'];
    const add = (sql, value) => { params.push(value); clauses.push(sql.replaceAll('?', `$${params.length}`)); };
    if (query.subject_id) add('q.subject_id=?', R.id(query.subject_id));
    if (query.topic_id) {
      const topicId = R.id(query.topic_id);
      R.check(query.include_descendants == null || ['true', 'false', true, false].includes(query.include_descendants), 'include_descendants');
      if (query.include_descendants === false || query.include_descendants === 'false') add('q.topic_id=?', topicId);
      else add(`q.topic_id IN (WITH RECURSIVE tree AS (
        SELECT id FROM question_bank_topics WHERE id=? AND created_by=$1
        UNION SELECT t.id FROM question_bank_topics t JOIN tree ON t.parent_topic_id=tree.id WHERE t.created_by=$1
      ) SELECT id FROM tree)`, topicId);
    }
    if (query.question_type) add('q.question_type=?', R.enumValue(query.question_type, R.TYPES, 'question_type'));
    if (query.difficulty) add('q.difficulty=?', R.enumValue(query.difficulty, ['easy', 'medium', 'hard'], 'difficulty'));
    if (query.status) add('q.status=?', R.enumValue(query.status, ['draft', 'published', 'archived'], 'status'));
    else clauses.push("q.status<>'archived'");
    if (query.bank_id) add('EXISTS (SELECT 1 FROM question_bank_items i WHERE i.question_id=q.id AND i.bank_id=?)', R.id(query.bank_id));
    if (query.q) add('q.question_text ILIKE ?', `%${R.text(query.q, 'q', 200)}%`);
    return { params, where: clauses.join(' AND ') };
  }
  async function questions(owner, query = {}) {
    const { params, where } = filters(owner, query);
    const { limit, offset } = R.page(query);
    const [{ rows: count }, { rows: items }] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS total FROM bank_questions q WHERE ${where}`, params),
      db.query(`${QUESTION_SELECT} WHERE ${where} ORDER BY q.created_at DESC, q.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]),
    ]);
    return { items, total: count[0].total, limit, offset };
  }
  async function getQuestion(owner, questionId, client = db, lock = '') {
    const { rows } = await client.query(
      `${QUESTION_SELECT} WHERE q.id=$1 AND q.created_by=$2 ${lock}`, [R.id(questionId), owner],
    );
    if (!rows[0]) R.fail(404, 'QB_NOT_FOUND');
    return rows[0];
  }
  async function questionRelations(c, owner, q) {
    await owned(c, 'instructor_subjects', owner, q.subject_id, 'instructor_id');
    if (q.topic_id) {
      const t = await owned(c, 'question_bank_topics', owner, q.topic_id);
      R.check(t.subject_id === q.subject_id, 'topic subject');
    }
    if (q.source_pdf_id) {
      const s = await sourceFile(c, owner, q.source_pdf_id);
      R.check(s.subject_id === q.subject_id && (!q.source_page || q.source_page <= s.page_count), 'source subject/page');
    }
  }
  async function saveQuestion(owner, input, questionId = null) {
    const q = R.normalizeQuestion(input);
    return db.transaction(async c => {
      await questionRelations(c, owner, q);
      const fields = ['subject_id', 'topic_id', 'source_pdf_id', 'source_page', 'question_text', 'question_type',
        'difficulty', 'points', 'explanation', 'status', 'answer_key'];
      const values = fields.map(k => k === 'answer_key' ? JSON.stringify(q[k]) : q[k]);
      let saved;
      if (questionId) {
        await getQuestion(owner, questionId, c, 'FOR UPDATE OF q');
        const { rows } = await c.query(
          `UPDATE bank_questions SET ${fields.map((f, i) => `${f}=$${i + 3}`).join(',')}
           WHERE id=$1 AND created_by=$2 RETURNING *`, [R.id(questionId), owner, ...values],
        );
        [saved] = rows;
        await c.query('DELETE FROM question_options WHERE question_id=$1', [saved.id]);
      } else {
        const { rows } = await c.query(
          `INSERT INTO bank_questions (created_by,${fields.join(',')})
           VALUES ($1,${fields.map((_, i) => `$${i + 2}`).join(',')}) RETURNING *`, [owner, ...values],
        );
        [saved] = rows;
      }
      for (const o of q.options) await c.query(
        `INSERT INTO question_options (id,question_id,option_text,is_correct,order_num,metadata)
         VALUES ($1,$2,$3,$4,$5,$6)`, [o.id, saved.id, o.option_text, o.is_correct, o.order_num, o.metadata],
      );
      return { ...saved, options: q.options };
    });
  }
  async function archiveQuestion(owner, questionId) {
    const { rows } = await db.query(
      `UPDATE bank_questions SET status='archived' WHERE id=$1 AND created_by=$2 RETURNING id`, [R.id(questionId), owner],
    );
    if (!rows.length) R.fail(404, 'QB_NOT_FOUND');
  }
  async function banks(owner, query = {}) {
    const { limit, offset } = R.page(query);
    const { rows } = await db.query(
      `SELECT b.*, (SELECT COUNT(*)::int FROM question_bank_items i WHERE i.bank_id=b.id) AS question_count
       FROM question_banks b WHERE created_by=$1 ORDER BY name, id LIMIT $2 OFFSET $3`, [owner, limit, offset],
    );
    return rows;
  }
  async function saveBank(owner, input, bankId = null) {
    const name = R.text(input.name, 'name');
    const description = input.description == null ? null : R.text(input.description, 'description', 4000, true);
    R.check(input.saved_filters == null || R.object(input.saved_filters), 'saved_filters');
    const savedFilters = Object.fromEntries(Object.entries(input.saved_filters || {}).filter(([k]) =>
      ['subject_id', 'topic_id', 'question_type', 'difficulty', 'status', 'q', 'include_descendants'].includes(k)));
    filters(owner, savedFilters);
    const { rows } = bankId
      ? await db.query(`UPDATE question_banks SET name=$3,description=$4,saved_filters=$5
          WHERE id=$1 AND created_by=$2 RETURNING *`, [R.id(bankId), owner, name, description, savedFilters])
      : await db.query(`INSERT INTO question_banks (created_by,name,description,saved_filters)
          VALUES ($1,$2,$3,$4) RETURNING *`, [owner, name, description, savedFilters]);
    if (!rows[0]) R.fail(404, 'QB_NOT_FOUND');
    return rows[0];
  }
  async function bankItems(owner, bankId, input, remove = false) {
    const questionIds = R.ids(input.question_ids, 'question_ids');
    return db.transaction(async c => {
      await owned(c, 'question_banks', owner, bankId, 'created_by', 'FOR UPDATE');
      for (const qid of questionIds) {
        await getQuestion(owner, qid, c, 'FOR SHARE OF q');
        if (remove) await c.query('DELETE FROM question_bank_items WHERE bank_id=$1 AND question_id=$2', [bankId, qid]);
        else await c.query(
          `INSERT INTO question_bank_items (bank_id,question_id,created_by) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [bankId, qid, owner],
        );
      }
    });
  }
  async function deleteBank(owner, bankId) {
    const { rows } = await db.query('DELETE FROM question_banks WHERE id=$1 AND created_by=$2 RETURNING id', [R.id(bankId), owner]);
    if (!rows.length) R.fail(404, 'QB_NOT_FOUND');
  }
  async function ownedExam(c, owner, examId, lock = '') {
    const { rows } = await c.query(
      `${EXAM_SELECT} WHERE e.id=$1 AND e.instructor_id=$2 AND COALESCE(e.is_deleted,FALSE)=FALSE ${lock}`,
      [R.id(examId), owner],
    );
    if (!rows[0]) R.fail(404, 'QB_NOT_FOUND');
    return rows[0];
  }
  function examInput(input) {
    const from = R.date(input.available_from, 'available_from');
    const until = R.date(input.available_until, 'available_until');
    const duration = Number(input.duration_minutes);
    R.check(Date.parse(until) > Date.parse(from), 'exam window');
    R.check(['number', 'string'].includes(typeof input.duration_minutes) && /^\d+$/.test(String(input.duration_minutes)), 'duration_minutes');
    R.check(Number.isInteger(duration) && duration >= 1 && duration <= 1440, 'duration_minutes');
    return {
      title: R.text(input.title, 'title', 255), subject_id: R.id(input.subject_id),
      available_from: from, available_until: until, duration_minutes: duration,
      allow_finish_after_until: input.allow_finish_after_until == null ? true : R.bool(input.allow_finish_after_until, 'allow_finish_after_until'),
      result_visibility_mode: R.enumValue(input.result_visibility_mode || 'after_manual_grading', RESULT_VISIBILITY_MODES, 'result_visibility_mode'),
      results_release_at: input.results_release_at == null ? null : R.date(input.results_release_at, 'results_release_at'),
      shuffle_questions: input.shuffle_questions == null ? false : R.bool(input.shuffle_questions, 'shuffle_questions'),
      shuffle_options: input.shuffle_options == null ? false : R.bool(input.shuffle_options, 'shuffle_options'),
      display_mode: R.enumValue(input.display_mode || 'all', ['all', 'step'], 'display_mode'),
      exam_type: R.text(input.exam_type || 'exam', 'exam_type', 50),
      status: R.enumValue(input.status || 'draft', ['draft', 'scheduled'], 'status'),
    };
  }
  async function snapshots(c, owner, exam, input) {
    const questionIds = R.ids(input.question_ids, 'question_ids');
    R.check(questionIds.length > 0, 'question_ids');
    const overridesMap = input.points_overrides || {};
    R.check(R.object(overridesMap) && Object.keys(overridesMap).every(x => questionIds.includes(R.id(x))), 'points_overrides');
    const copies = [];
    for (const qid of questionIds) {
      const bank = await getQuestion(owner, qid, c, 'FOR SHARE OF q');
      R.check(bank.status === 'published' && bank.subject_id === exam.subject_id, 'published question subject');
      const normalized = R.normalizeQuestion(bank);
      const points = R.cents(overridesMap[qid] ?? normalized.points) / 100;
      copies.push({ ...normalized, points, bank_question_id: qid });
    }
    R.check(copies.reduce((s, q) => s + R.cents(q.points), 0) <= 9999999999, 'total_points');
    await c.query('DELETE FROM exam_questions WHERE exam_id=$1', [exam.id]);
    for (const [i, q] of copies.entries()) {
      const questionId = randomUUID();
      await c.query(
        `INSERT INTO exam_questions (id,exam_id,question_text,question_type,options,correct_answer,points,order_num,negative_marking)
         VALUES ($1,$2,$3,$4,$5,NULL,$6,$7,0)`,
        [questionId, exam.id, q.question_text, LEGACY_TYPE[q.question_type], JSON.stringify(R.publicQuestion(q).options), q.points, i + 1],
      );
      await c.query(
        `INSERT INTO exam_bank_questions
          (exam_question_id,exam_id,created_by,bank_question_id,question_type,subject_id,topic_id,points,snapshot)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [questionId, exam.id, owner, q.bank_question_id, q.question_type, q.subject_id, q.topic_id, q.points, JSON.stringify(q)],
      );
    }
  }
  async function assign(c, owner, examId, input) {
    const direct = R.ids(input.student_ids || [], 'student_ids', 2000);
    const groups = R.ids(input.group_ids || [], 'group_ids', 100);
    if (groups.length) {
      const { rows } = await c.query(
        `SELECT id FROM instructor_groups WHERE id=ANY($1::uuid[]) AND instructor_id=$2`, [groups, owner],
      );
      R.check(rows.length === groups.length, 'owned groups');
    }
    const { rows: members } = groups.length ? await c.query(
      'SELECT DISTINCT student_id FROM instructor_group_members WHERE group_id=ANY($1::uuid[])', [groups],
    ) : { rows: [] };
    const all = [...new Set([...direct, ...members.map(m => m.student_id)])];
    R.check(all.length <= 2000, 'student count');
    if (all.length) {
      const { rows } = await c.query(
        `SELECT DISTINCT en.student_id FROM enrollments en JOIN users u ON u.id=en.student_id
         WHERE en.instructor_id=$1 AND en.status='active' AND en.deleted_at IS NULL AND en.student_id=ANY($2::uuid[])
           AND u.role='student' AND COALESCE(u.is_active,TRUE)=TRUE AND u.deleted_at IS NULL`, [owner, all],
      );
      R.check(rows.length === all.length, 'active owned students');
    }
    await c.query('DELETE FROM exam_assignments WHERE exam_id=$1', [examId]);
    for (const sid of all) await c.query(
      'INSERT INTO exam_assignments (exam_id,student_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [examId, sid],
    );
  }
  async function createExam(owner, input) {
    R.jsonLimit(input);
    const config = examInput(input);
    return db.transaction(async c => {
      const subject = await owned(c, 'instructor_subjects', owner, config.subject_id, 'instructor_id');
      const examId = randomUUID();
      const { rows } = await c.query(
        `INSERT INTO exams (id,instructor_id,title,subject,start_time,available_from,available_until,duration_minutes,
          allow_finish_after_until,status,result_visibility_mode,results_release_at,show_results,wrong_penalty_enabled,slug)
         VALUES ($1,$2,$3,$4,($5::timestamptz AT TIME ZONE 'UTC'),$5::timestamptz,$6,$7,$8,$9,$10,$11,$12,FALSE,$13) RETURNING *`,
        [examId, owner, config.title, subject.name, config.available_from, config.available_until, config.duration_minutes,
          config.allow_finish_after_until, config.status, config.result_visibility_mode, config.results_release_at,
          showResultsForMode(config.result_visibility_mode), `${slugifyExamTitle(config.title)}-${examId}`],
      );
      await c.query(
        `INSERT INTO exam_bank_settings (exam_id,created_by,subject_id,exam_type,shuffle_questions,shuffle_options,display_mode)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [examId, owner, config.subject_id, config.exam_type, config.shuffle_questions, config.shuffle_options, config.display_mode],
      );
      const exam = { ...rows[0], ...config, id: examId };
      await snapshots(c, owner, exam, input);
      await assign(c, owner, examId, input);
      return examDetail(owner, examId, c);
    });
  }
  async function examDetail(owner, examId, client = db) {
    const exam = await ownedExam(client, owner, examId);
    const { rows: questions } = await client.query(
      `SELECT b.exam_question_id AS id, b.bank_question_id,b.points,b.snapshot,q.order_num
       FROM exam_bank_questions b JOIN exam_questions q ON q.id=b.exam_question_id WHERE b.exam_id=$1 ORDER BY q.order_num`, [examId],
    );
    const { rows: assignments } = await client.query('SELECT student_id FROM exam_assignments WHERE exam_id=$1', [examId]);
    return {
      ...exam, question_bank_enabled: true, questions,
      question_count: questions.length, total_points: questions.reduce((s, q) => s + R.cents(q.points), 0) / 100,
      student_ids: assignments.map(x => x.student_id),
    };
  }
  async function patchExam(owner, examId, input) {
    R.check(R.object(input), 'exam'); R.jsonLimit(input);
    return db.transaction(async c => {
      const old = await ownedExam(c, owner, examId, 'FOR UPDATE OF e');
      const editable = new Set(['title', 'result_visibility_mode', 'results_release_at']);
      const structural = Object.keys(input).some(k => !editable.has(k));
      if (structural) {
        const { rows } = await c.query('SELECT 1 FROM exam_results WHERE exam_id=$1 LIMIT 1', [examId]);
        if (rows.length) R.fail(409, 'QB_EXAM_FROZEN', 'Başlanmış imtahanın quruluşu dəyişdirilə bilməz');
      }
      const config = examInput({ ...old, ...input,
        available_from: input.available_from === undefined ? new Date(old.available_from).toISOString() : input.available_from,
        available_until: input.available_until === undefined ? new Date(old.available_until).toISOString() : input.available_until,
        results_release_at: input.results_release_at === null ? null : input.results_release_at ||
          (old.results_release_at ? new Date(old.results_release_at).toISOString() : null),
      });
      R.check(config.subject_id === old.subject_id, 'immutable exam subject');
      await c.query(
        `UPDATE exams SET title=$2,start_time=($3::timestamptz AT TIME ZONE 'UTC'),available_from=$3::timestamptz,available_until=$4,duration_minutes=$5,
          allow_finish_after_until=$6,status=$7,result_visibility_mode=$8,results_release_at=$9,show_results=$10 WHERE id=$1`,
        [examId, config.title, config.available_from, config.available_until, config.duration_minutes,
          config.allow_finish_after_until, config.status, config.result_visibility_mode, config.results_release_at,
          showResultsForMode(config.result_visibility_mode)],
      );
      await c.query(
        `UPDATE exam_bank_settings SET exam_type=$2,shuffle_questions=$3,shuffle_options=$4,display_mode=$5 WHERE exam_id=$1`,
        [examId, config.exam_type, config.shuffle_questions, config.shuffle_options, config.display_mode],
      );
      if (input.question_ids) await snapshots(c, owner, { ...old, ...config }, input);
      else R.check(input.points_overrides == null, 'points_overrides requires question_ids');
      if (input.student_ids != null || input.group_ids != null) await assign(c, owner, examId, input);
      return examDetail(owner, examId, c);
    });
  }
  async function exams(owner, query = {}) {
    const { limit, offset } = R.page(query);
    const { rows } = await db.query(
      `${EXAM_SELECT} WHERE e.instructor_id=$1 AND COALESCE(e.is_deleted,FALSE)=FALSE
       ORDER BY e.created_at DESC,e.id LIMIT $2 OFFSET $3`, [owner, limit, offset],
    );
    return rows.map(e => ({ ...e, question_bank_enabled: true }));
  }
  async function archiveExam(owner, examId) {
    return db.transaction(async c => {
      await ownedExam(c, owner, examId, 'FOR UPDATE OF e');
      await c.query('UPDATE exams SET is_deleted=TRUE WHERE id=$1', [examId]);
    });
  }
  async function analytics(owner, query = {}) {
    const examId = R.optionalId(query.exam_id);
    if (examId) await ownedExam(db, owner, examId);
    const { rows } = await db.query(
      `WITH latest AS (
         SELECT DISTINCT ON (er.exam_id,er.student_id) er.id,er.exam_id
         FROM exam_results er JOIN exams e ON e.id=er.exam_id JOIN exam_bank_settings s ON s.exam_id=e.id
         WHERE e.instructor_id=$1 AND COALESCE(e.is_deleted,FALSE)=FALSE AND er.submitted_at IS NOT NULL
           AND er.status<>'voided' AND ($2::uuid IS NULL OR e.id=$2)
         ORDER BY er.exam_id,er.student_id,er.started_at DESC,er.id
       )
       SELECT q.topic_id,t.name AS topic_name,q.question_type,
         COUNT(*)::int AS answer_count,
         COUNT(*) FILTER (WHERE a.status='pending_review')::int AS pending_count,
         COUNT(*) FILTER (WHERE a.status IN ('auto_graded','reviewed') AND a.awarded_points<q.points)::int AS mistake_count,
         COALESCE(SUM(a.awarded_points) FILTER (WHERE a.status IN ('auto_graded','reviewed')),0) AS awarded_points,
         COALESCE(SUM(q.points) FILTER (WHERE a.status IN ('auto_graded','reviewed')),0) AS graded_max_points
       FROM latest l JOIN exam_answers a ON a.attempt_id=l.id
       JOIN exam_bank_questions q ON q.exam_question_id=a.question_id
       LEFT JOIN question_bank_topics t ON t.id=q.topic_id
       GROUP BY q.topic_id,t.name,q.question_type ORDER BY t.name NULLS LAST,q.question_type`, [owner, examId],
    );
    return rows;
  }
  return {
    subjects, createSubject, topics, saveTopic, deleteTopic, registerSource, sources,
    sourceFile: (owner, sourceId) => sourceFile(db, owner, sourceId),
    questions, getQuestion, saveQuestion, archiveQuestion, banks, saveBank, bankItems, deleteBank,
    createExam, patchExam, exams, examDetail, archiveExam, ownedExam, analytics,
  };
}
module.exports = { createQuestionBankService, pdfPages, QUESTION_SELECT, EXAM_SELECT };
