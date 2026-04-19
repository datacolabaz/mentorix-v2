const fs = require('fs');
const path = require('path');
const db = require('../utils/db');
const { normalizeExamStartTime } = require('../utils/examTime');

/** JWT / DB UUID format fərqi olanda exam_assignments uyğunlaşması */
const normStudentHex = (id) =>
  id == null ? '' : String(id).trim().toLowerCase().replace(/-/g, '');

function uploadsExamAbsPathFromPublicUrl(url) {
  const rel = String(url || '');
  const m = rel.match(/\/api\/uploads\/exams\/([^/?#]+)$/);
  if (!m) return null;
  return path.join(__dirname, '../../uploads/exams', m[1]);
}

function safeUnlinkUpload(url) {
  const abs = uploadsExamAbsPathFromPublicUrl(url);
  if (!abs) return;
  try {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    // ignore
  }
}

function parseJsonMaybe(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/** patchExam COALESCE: boş sətir / səhv tip PG int–varchar xətası verməsin */
function patchCoalesceStr(v, maxLen) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, maxLen);
}

function patchCoalesceInt(v) {
  if (v == null || v === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function patchCoalesceBool(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === '1' || v === 'true' || v === 'TRUE') return true;
  if (v === 0 || v === '0' || v === 'false' || v === 'FALSE') return false;
  return null;
}

/** Uyğunluq: explicit `correct_answer` və ya sol/sağ cütlərdən açar; `template_hint` heç vaxt düzgün cavab sayılmır */
function buildMatchingCorrectFromPayload(q) {
  const explicit = String(q.correct_answer ?? '').trim();
  if (explicit) return explicit;
  const opts = q.options;
  if (!Array.isArray(opts)) return null;
  let key = '';
  for (let i = 0; i < opts.length; i++) {
    const row = opts[i];
    if (!row || typeof row !== 'object') continue;
    const L = String(row.left ?? '').trim();
    const R = String(row.right ?? '').trim();
    const num = (L.match(/\d+/) || [])[0] || String(i + 1);
    const letters = R.replace(/[^a-z]/gi, '').toLowerCase();
    for (const ch of letters) {
      if (/[a-z]/.test(ch)) key += num + ch;
    }
  }
  return key || null;
}
const {
  calculateScore,
  buildExamResultBreakdown,
  buildAutoGradingMap,
  rankResults,
  syncExamReminderJob,
  notifyParentExamResultAfterSubmit,
} = require('../services/examService');

function parseDateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function examWindowOrLegacy(exam) {
  const from = parseDateOrNull(exam.available_from) || parseDateOrNull(exam.start_time);
  const until =
    parseDateOrNull(exam.available_until) ||
    (from ? new Date(from.getTime() + (Number(exam.duration_minutes) || 0) * 60000) : null);
  const allowFinish = exam.allow_finish_after_until !== false;
  return { from, until, allowFinish };
}

// Imtahan yarat
const createExam = async (req, res) => {
  try {
    const {
      title,
      subject,
      topic,
      pdf_url,
      exam_files,
      duration_minutes,
      start_time,
      available_from,
      available_until,
      allow_finish_after_until,
      notify_enabled,
      notify_before_hours,
      notify_students,
      show_results,
      questions,
      student_ids,
    } = req.body;

    const startNorm = normalizeExamStartTime(start_time);
    const fromNorm = normalizeExamStartTime(available_from || start_time);
    const untilNorm = normalizeExamStartTime(available_until);
    const notifyOn = notify_students === true || notify_students === 'true' || notify_enabled === true;
    const notifyHours =
      notify_before_hours != null && notify_before_hours !== ''
        ? Number(notify_before_hours)
        : 1;

    const result = await db.transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO exams (instructor_id, title, subject, topic, pdf_url, exam_files, duration_minutes, start_time,
          available_from, available_until, allow_finish_after_until,
          notify_enabled, notify_students, notify_before_hours, show_results, status)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,'scheduled') RETURNING *`,
        [
          req.user.id,
          title,
          subject || null,
          topic || null,
          pdf_url || null,
          JSON.stringify(Array.isArray(exam_files) ? exam_files : []),
          duration_minutes,
          startNorm,
          fromNorm,
          untilNorm,
          allow_finish_after_until !== false,
          notifyOn,
          notifyOn,
          notifyHours,
          show_results !== false,
        ]
      );

      const exam = rows[0];

      if (questions?.length) {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const neg =
            q.negative_marking != null && q.negative_marking !== ''
              ? Number(q.negative_marking)
              : q.question_type === 'closed'
                ? -0.25
                : 0;
          const qText = (q.question_text && String(q.question_text).trim()) || `Sual ${i + 1}`;
          const correctAns =
            q.question_type === 'matching'
              ? buildMatchingCorrectFromPayload(q)
              : q.correct_answer != null && q.correct_answer !== ''
                ? q.correct_answer
                : null;
          const templateHint =
            q.template_hint != null && String(q.template_hint).trim() !== ''
              ? String(q.template_hint).trim()
              : null;
          const safeTemplateHint =
            q.question_type === 'matching'
              ? '1a2b3c'
              : q.question_type === 'multiple'
                ? '13'
                : templateHint;
          await client.query(
            `INSERT INTO exam_questions (exam_id, question_text, question_type, options, correct_answer, points, order_num, negative_marking, template_hint)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              exam.id,
              qText,
              q.question_type,
              JSON.stringify(q.options || null),
              correctAns,
              q.points,
              i + 1,
              neg,
              safeTemplateHint,
            ]
          );
        }
      }

      let assignIds = Array.isArray(student_ids)
        ? [...new Set(student_ids.filter((x) => x != null && String(x).trim() !== ''))]
        : [];
      /** Addım 3 atlananda boş array gəlirdi — heç bir təyinat olmur, İmtahanlarım boş qalırdı */
      if (assignIds.length === 0 && req.user.role === 'instructor') {
        const instHex = normStudentHex(req.user.id);
        if (instHex) {
          const { rows: enrolled } = await client.query(
            `SELECT DISTINCT e.student_id AS id FROM enrollments e
             WHERE e.status = 'active'
               AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1`,
            [instHex]
          );
          assignIds = enrolled.map((r) => r.id).filter(Boolean);
        }
      }
      for (const sid of assignIds) {
        await client.query(
          `INSERT INTO exam_assignments (exam_id, student_id) VALUES ($1,$2)
           ON CONFLICT DO NOTHING`,
          [exam.id, sid]
        );
      }

      return exam;
    });

    res.status(201).json({ success: true, exam: result });
    setImmediate(() => {
      syncExamReminderJob(result.id).catch((e) => console.error('syncExamReminderJob', e.message));
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Imtahanları listele
const listExams = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const { rows } = await db.query(
      `SELECT e.*, u.full_name AS instructor_name,
        COUNT(ea.id) AS student_count
       FROM exams e
       JOIN users u ON u.id = e.instructor_id
       LEFT JOIN exam_assignments ea ON ea.exam_id = e.id
       WHERE ($1 OR e.instructor_id = $2)
       GROUP BY e.id, u.full_name
       ORDER BY COALESCE(e.available_from, e.start_time) DESC NULLS LAST`,
      [isAdmin, req.user.id]
    );
    res.json({ success: true, exams: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Soft delete exam (flag only)
const softDeleteExam = async (req, res) => {
  try {
    const examId = req.params.id;
    const isAdmin = req.user.role === 'admin';

    const { rows: [exam] } = await db.query('SELECT id, instructor_id, is_deleted FROM exams WHERE id = $1', [examId]);
    if (!exam) return res.status(404).json({ success: false, message: 'Tapılmadı' });

    if (!isAdmin && req.user.role === 'instructor') {
      if (normStudentHex(exam.instructor_id) !== normStudentHex(req.user.id)) {
        return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
      }
    } else if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    if (exam.is_deleted === true) {
      return res.json({ success: true, exam_id: examId, is_deleted: true });
    }

    const { rows: [updated] } = await db.query(
      `UPDATE exams
       SET is_deleted = TRUE,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, is_deleted`,
      [examId]
    );
    res.json({ success: true, exam: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Hard delete exam + dependent rows (results + questions + assignments)
const hardDeleteExam = async (req, res) => {
  try {
    const examId = req.params.id;
    const isAdmin = req.user.role === 'admin';

    const { rows: [exam] } = await db.query('SELECT id, instructor_id FROM exams WHERE id = $1', [examId]);
    if (!exam) return res.status(404).json({ success: false, message: 'Tapılmadı' });

    if (!isAdmin && req.user.role === 'instructor') {
      if (normStudentHex(exam.instructor_id) !== normStudentHex(req.user.id)) {
        return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
      }
    } else if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    await db.transaction(async (client) => {
      // FK-lar ON DELETE CASCADE olanda bu 3 sətir redundantdır, amma köhnə DB-lərdə təhlükəsizdir
      await client.query('DELETE FROM exam_results WHERE exam_id = $1', [examId]);
      await client.query('DELETE FROM exam_questions WHERE exam_id = $1', [examId]);
      await client.query('DELETE FROM exam_assignments WHERE exam_id = $1', [examId]);
      await client.query('DELETE FROM exams WHERE id = $1', [examId]);
    });

    res.json({ success: true, exam_id: examId, deleted: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Bulk hard delete exams by IDs (results + questions + assignments + exams)
const bulkHardDeleteExams = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && req.user.role !== 'instructor') {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const idsRaw = req.body?.exam_ids;
    const examIds = Array.isArray(idsRaw)
      ? [...new Set(idsRaw.map((x) => String(x || '').trim()).filter(Boolean))]
      : [];
    if (examIds.length === 0) {
      return res.status(400).json({ success: false, message: 'exam_ids tələb olunur' });
    }

    const { rows: exams } = await db.query(
      `SELECT id, instructor_id FROM exams WHERE id = ANY($1::uuid[])`,
      [examIds]
    );
    if (exams.length !== examIds.length) {
      return res.status(404).json({ success: false, message: 'Bəzi imtahanlar tapılmadı' });
    }
    if (!isAdmin) {
      const myHex = normStudentHex(req.user.id);
      const forbidden = exams.some((e) => normStudentHex(e.instructor_id) !== myHex);
      if (forbidden) return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    await db.transaction(async (client) => {
      await client.query('DELETE FROM exam_results WHERE exam_id = ANY($1::uuid[])', [examIds]);
      await client.query('DELETE FROM exam_questions WHERE exam_id = ANY($1::uuid[])', [examIds]);
      await client.query('DELETE FROM exam_assignments WHERE exam_id = ANY($1::uuid[])', [examIds]);
      await client.query('DELETE FROM exams WHERE id = ANY($1::uuid[])', [examIds]);
    });

    res.json({ success: true, deleted: examIds.length, exam_ids: examIds });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Müəllim paneli: hər tələbə üçün bu müəllimin imtahanlarında orta bal (təqdim olunmuş nəticələr) */
const instructorStudentExamProgress = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const { rows } = await db.query(
      `SELECT er.student_id,
              u.full_name,
              ROUND(AVG(er.score), 2) AS exam_avg_score,
              COUNT(er.id)::int AS exams_taken
       FROM exam_results er
       JOIN exams e ON e.id = er.exam_id
       JOIN users u ON u.id = er.student_id
       WHERE er.submitted_at IS NOT NULL
         AND COALESCE(e.is_deleted, FALSE) = FALSE
         AND ($1::boolean OR e.instructor_id = $2::uuid)
       GROUP BY er.student_id, u.full_name
       ORDER BY u.full_name`,
      [isAdmin, req.user.id]
    );
    res.json({ success: true, stats: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Telebe ucun imtahanlar
const studentExams = async (req, res) => {
  try {
    const sidHex = normStudentHex(req.user.id);
    if (!sidHex) {
      return res.status(400).json({ success: false, message: 'İstifadəçi identifikatoru yoxdur' });
    }
    /** Təyinat + nəticə: yalnız exam_assignments istifadə etsək, nəticəsi olan amma təyinatı
     *  silinmiş/köhnə DB-də olmayan tələbələr üçün siyahı boş qalır; müəllim statistikası isə
     *  exam_results-dan görünür. */
    const { rows } = await db.query(
      `WITH me AS (
         SELECT u.id AS student_id, sp.grade AS grade
         FROM users u
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
         WHERE REPLACE(LOWER(TRIM(u.id::text)), '-', '') = $1
         LIMIT 1
       ),
       my_exam_ids AS (
         SELECT DISTINCT ea.exam_id AS exam_id
         FROM exam_assignments ea
         WHERE REPLACE(LOWER(TRIM(ea.student_id::text)), '-', '') = $1
         UNION
         SELECT DISTINCT er.exam_id AS exam_id
         FROM exam_results er
         WHERE REPLACE(LOWER(TRIM(er.student_id::text)), '-', '') = $1
       ),
       leaderboard AS (
         SELECT er.exam_id,
                er.student_id,
                COALESCE(sp.grade, '—') AS grade,
                RANK() OVER (
                  PARTITION BY er.exam_id, COALESCE(sp.grade, '—')
                  ORDER BY er.score DESC, er.duration_seconds ASC
                )::int AS rank_in_group
         FROM exam_results er
         JOIN users u ON u.id = er.student_id
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
         WHERE er.submitted_at IS NOT NULL
       )
       SELECT e.*, er.score, er.submitted_at, er.started_at,
         COALESCE(me.grade, '—') AS my_group,
         lb.rank_in_group,
         eq_count.question_count
       FROM my_exam_ids mei
       JOIN exams e ON e.id = mei.exam_id
       CROSS JOIN me
       LEFT JOIN LATERAL (
         SELECT score, submitted_at, started_at FROM exam_results er0
         WHERE er0.exam_id = e.id
           AND REPLACE(LOWER(TRIM(er0.student_id::text)), '-', '') = $1
         ORDER BY er0.submitted_at DESC NULLS LAST, er0.started_at DESC NULLS LAST
         LIMIT 1
       ) er ON TRUE
       LEFT JOIN leaderboard lb
         ON lb.exam_id = e.id
        AND REPLACE(LOWER(TRIM(lb.student_id::text)), '-', '') = $1
        AND lb.grade = COALESCE(me.grade, '—')
       LEFT JOIN (
         SELECT exam_id, COUNT(*) AS question_count FROM exam_questions GROUP BY exam_id
       ) eq_count ON eq_count.exam_id = e.id
       WHERE COALESCE(e.is_deleted, FALSE) = FALSE
       ORDER BY COALESCE(e.available_from, e.start_time) DESC NULLS LAST`,
      [sidHex]
    );
    res.json({ success: true, exams: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Tələbə: təqdim etdikdən sonra öz nəticəsinə və sual üzrə xülasəyə baxış */
const getStudentExamReview = async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }
    const examId = req.params.id;
    const sidHex = normStudentHex(req.user.id);
    if (!sidHex) {
      return res.status(400).json({ success: false, message: 'İstifadəçi identifikatoru yoxdur' });
    }

    const { rows: resultRows } = await db.query(
      `SELECT score, answers, submitted_at FROM exam_results
       WHERE exam_id = $1
         AND REPLACE(LOWER(TRIM(student_id::text)), '-', '') = $2`,
      [examId, sidHex]
    );
    const result = resultRows[0];
    if (result?.submitted_at) {
      /* təqdim olunub — review (təyinatsız köhnə nəticələr də daxil) */
    } else {
      const { rows: assignRows } = await db.query(
        `SELECT 1 FROM exam_assignments
         WHERE exam_id = $1
           AND REPLACE(LOWER(TRIM(student_id::text)), '-', '') = $2`,
        [examId, sidHex]
      );
      if (!assignRows.length) {
        return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
      }
      return res.status(404).json({ success: false, message: 'Hələ təqdim olunmayıb' });
    }

    const { rows: [exam] } = await db.query('SELECT * FROM exams WHERE id = $1', [examId]);
    if (!exam) return res.status(404).json({ success: false, message: 'Tapılmadı' });

    const { rows: questions } = await db.query(
      'SELECT * FROM exam_questions WHERE exam_id = $1 ORDER BY order_num',
      [examId]
    );

    let answers = result.answers;
    if (typeof answers === 'string') {
      try {
        answers = JSON.parse(answers);
      } catch {
        answers = {};
      }
    }
    if (!answers || typeof answers !== 'object') answers = {};

    const breakdown = buildExamResultBreakdown(questions, answers);

    res.json({
      success: true,
      exam,
      score: result.score,
      submitted_at: result.submitted_at,
      breakdown,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Imtahan suallarini al
const getExamQuestions = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows: [exam] } = await db.query('SELECT * FROM exams WHERE id = $1', [id]);
    if (!exam) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    if (exam.is_deleted === true) return res.status(404).json({ success: false, message: 'Tapılmadı' });

    if (req.user.role === 'student') {
      const sidHex = normStudentHex(req.user.id);
      if (!sidHex) {
        return res.status(400).json({ success: false, message: 'İstifadəçi identifikatoru yoxdur' });
      }
      const { rows: assigned } = await db.query(
        `SELECT 1 FROM exam_assignments WHERE exam_id = $1
         AND REPLACE(LOWER(TRIM(student_id::text)), '-', '') = $2`,
        [id, sidHex]
      );
      if (!assigned.length) {
        return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
      }
    } else if (req.user.role === 'instructor') {
      if (normStudentHex(exam.instructor_id) !== normStudentHex(req.user.id)) {
        return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const now = new Date();
    const dur = Number(exam.duration_minutes) || 0;
    const { from, until, allowFinish } = examWindowOrLegacy(exam);
    if (!from || !until) {
      return res.status(400).json({ success: false, message: 'İmtahan vaxtı təyin olunmayıb' });
    }

    let startedAtForStudent = null;
    if (req.user.role === 'student') {
      const sidHex = normStudentHex(req.user.id);
      const { rows: rRows } = await db.query(
        `SELECT id, started_at, submitted_at
         FROM exam_results
         WHERE exam_id = $1
           AND REPLACE(LOWER(TRIM(student_id::text)), '-', '') = $2
         ORDER BY submitted_at DESC NULLS LAST, started_at DESC NULLS LAST
         LIMIT 1`,
        [id, sidHex]
      );
      const attempt = rRows[0] || null;

      if (attempt?.submitted_at) {
        return res.status(400).json({ success: false, message: 'Artıq təqdim edilib' });
      }

      if (attempt?.started_at) {
        const s = new Date(attempt.started_at);
        const personalEnd = new Date(s.getTime() + dur * 60000);
        if (now > personalEnd) return res.status(400).json({ success: false, message: 'Vaxtınız bitib' });
        startedAtForStudent = attempt.started_at;
      } else {
        const { rows: lateRows } = await db.query(
          `SELECT late_access_until
           FROM exam_assignments
           WHERE exam_id = $1
             AND REPLACE(LOWER(TRIM(student_id::text)), '-', '') = $2
           LIMIT 1`,
          [id, sidHex]
        );
        const lateUntil = lateRows[0]?.late_access_until ? new Date(lateRows[0].late_access_until) : null;
        const canStart =
          (now >= from && now <= until) || (lateUntil && !Number.isNaN(lateUntil.getTime()) && now <= lateUntil);
        if (!canStart) return res.status(400).json({ success: false, message: 'İmtahan aktiv deyil' });

        const { rows: inserted } = await db.query(
          `INSERT INTO exam_results (exam_id, student_id, status, started_at)
           VALUES ($1,$2,'in_progress', NOW())
           RETURNING started_at`,
          [id, req.user.id]
        );
        startedAtForStudent = inserted[0]?.started_at || null;
      }

      if (!allowFinish && now > until) {
        return res.status(400).json({ success: false, message: 'İmtahanın giriş müddəti bitib' });
      }
    }

    const { rows: questions } = await db.query(
      'SELECT * FROM exam_questions WHERE exam_id = $1 ORDER BY order_num',
      [id]
    );

    // Tələbəyə correct_answer heç vaxt getməsin; template_hint də yalnız neytral format olsun
    const safe = questions.map(({ correct_answer, template_hint, ...rest }) => {
      if (req.user.role === 'student') {
        if (rest.question_type === 'matching') return { ...rest, template_hint: '1a2b3c' };
        if (rest.question_type === 'multiple') return { ...rest, template_hint: '13' };
      }
      return { ...rest, template_hint };
    });

    res.json({ success: true, exam, questions: safe, started_at: startedAtForStudent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Imtahan cavablarini gondor
const submitExam = async (req, res) => {
  try {
    const { exam_id, answers } = req.body;
    const student_id = req.user.id;

    const sidHex = normStudentHex(student_id);
    if (!sidHex) {
      return res.status(400).json({ success: false, message: 'İstifadəçi identifikatoru yoxdur' });
    }

    const { rows: assignSubmit } = await db.query(
      `SELECT 1 FROM exam_assignments WHERE exam_id = $1
       AND REPLACE(LOWER(TRIM(student_id::text)), '-', '') = $2`,
      [exam_id, sidHex]
    );
    if (!assignSubmit.length) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const already = await db.query(
      `SELECT id, started_at, submitted_at
       FROM exam_results
       WHERE exam_id=$1
         AND REPLACE(LOWER(TRIM(student_id::text)), '-', '') = $2
       ORDER BY submitted_at DESC NULLS LAST, started_at DESC NULLS LAST
       LIMIT 1`,
      [exam_id, sidHex]
    );
    const attempt = already.rows[0] || null;
    if (attempt?.submitted_at) return res.status(400).json({ success: false, message: 'Artıq təqdim edilib' });

    const { rows: questions } = await db.query(
      'SELECT * FROM exam_questions WHERE exam_id=$1',
      [exam_id]
    );
    const { rows: [exam] } = await db.query('SELECT id, is_deleted, duration_minutes FROM exams WHERE id = $1', [exam_id]);
    if (!exam || exam.is_deleted === true) {
      return res.status(404).json({ success: false, message: 'Tapılmadı' });
    }

    const score = calculateScore(questions, answers);
    const breakdown = buildExamResultBreakdown(questions, answers);
    const grading = buildAutoGradingMap(questions, answers);
    const now = new Date();
    const startedAt = attempt?.started_at ? new Date(attempt.started_at) : now;
    const durMin = Number(exam.duration_minutes) || 0;
    if (attempt?.started_at && durMin > 0) {
      const personalEnd = new Date(startedAt.getTime() + durMin * 60000);
      if (now > personalEnd) {
        return res.status(400).json({ success: false, message: 'Vaxtınız bitib' });
      }
    }
    const duration = Math.floor((now - startedAt) / 1000);

    if (attempt?.id) {
      await db.query(
        `UPDATE exam_results
         SET score = $3,
             answers = $4,
             grading = $5,
             status = 'completed',
             started_at = COALESCE(started_at, $6),
             submitted_at = $7,
             duration_seconds = $8
         WHERE id = $1 AND exam_id = $2`,
        [attempt.id, exam_id, score, JSON.stringify(answers), JSON.stringify(grading), startedAt, now, duration]
      );
    } else {
      await db.query(
        `INSERT INTO exam_results (exam_id, student_id, score, answers, grading, status, started_at, submitted_at, duration_seconds)
         VALUES ($1,$2,$3,$4,$5,'completed',$6,$7,$8)`,
        [exam_id, student_id, score, JSON.stringify(answers), JSON.stringify(grading), startedAt, now, duration]
      );
    }

    setImmediate(() => {
      notifyParentExamResultAfterSubmit(exam_id, student_id, score).catch((e) =>
        console.error('notifyParentExamResultAfterSubmit', e.message)
      );
    });

    res.json({ success: true, score, breakdown });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Neticeleri al (sirali)
const getResults = async (req, res) => {
  try {
    const examId = req.params.id;
    const { rows: [exam] } = await db.query('SELECT id, instructor_id FROM exams WHERE id = $1', [examId]);
    if (!exam) return res.status(404).json({ success: false, message: 'Tapılmadı' });

    // Instructor/Admin: all results (optionally filter by grade)
    if (req.user.role === 'admin' || req.user.role === 'instructor') {
      if (req.user.role === 'instructor' && normStudentHex(exam.instructor_id) !== normStudentHex(req.user.id)) {
        return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
      }
      const grade = req.query.grade != null && String(req.query.grade).trim() !== '' ? String(req.query.grade).trim() : null;
      const { rows } = await db.query(
        `SELECT er.id, er.exam_id, er.student_id, u.full_name,
                COALESCE(sp.grade, '—') AS grade,
                er.score, er.duration_seconds, er.submitted_at,
                RANK() OVER (
                  PARTITION BY CASE WHEN $2::text IS NULL THEN 'ALL' ELSE COALESCE(sp.grade, '—') END
                  ORDER BY er.score DESC, er.duration_seconds ASC
                )::int AS rank
         FROM exam_results er
         JOIN users u ON u.id = er.student_id
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
         WHERE er.exam_id = $1
           AND er.submitted_at IS NOT NULL
           AND ($2::text IS NULL OR COALESCE(sp.grade, '—') = $2::text)
         ORDER BY er.score DESC, er.duration_seconds ASC`,
        [examId, grade]
      );
      return res.json({ success: true, results: rows, grade: grade || 'ALL' });
    }

    // Student: only their group
    if (req.user.role === 'student') {
      const sidHex = normStudentHex(req.user.id);
      const { rows: assigned } = await db.query(
        `SELECT 1 FROM exam_assignments WHERE exam_id = $1
         AND REPLACE(LOWER(TRIM(student_id::text)), '-', '') = $2`,
        [examId, sidHex]
      );
      if (!assigned.length) return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
      const { rows: [me] } = await db.query(
        `SELECT COALESCE(sp.grade, '—') AS grade
         FROM student_profiles sp
         WHERE REPLACE(LOWER(TRIM(sp.user_id::text)), '-', '') = $1
         LIMIT 1`,
        [sidHex]
      );
      const grade = me?.grade || '—';
      const { rows } = await db.query(
        `SELECT er.student_id, u.full_name, COALESCE(sp.grade, '—') AS grade,
                er.score, er.duration_seconds, er.submitted_at,
                RANK() OVER (ORDER BY er.score DESC, er.duration_seconds ASC)::int AS rank
         FROM exam_results er
         JOIN users u ON u.id = er.student_id
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
         WHERE er.exam_id = $1
           AND er.submitted_at IS NOT NULL
           AND COALESCE(sp.grade, '—') = $2
         ORDER BY er.score DESC, er.duration_seconds ASC`,
        [examId, grade]
      );
      return res.json({ success: true, results: rows, grade });
    }

    return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Müəllim/Admin: bu imtahanda mövcud qrupların siyahısı (grade-lər) */
const getExamGroups = async (req, res) => {
  try {
    const examId = req.params.id;
    const { rows: [exam] } = await db.query('SELECT id, instructor_id FROM exams WHERE id = $1', [examId]);
    if (!exam) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    if (req.user.role === 'instructor' && normStudentHex(exam.instructor_id) !== normStudentHex(req.user.id)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }
    if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const { rows } = await db.query(
      `SELECT COALESCE(sp.grade, '—') AS grade, COUNT(DISTINCT er.student_id)::int AS taken
       FROM exam_results er
       JOIN users u ON u.id = er.student_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE er.exam_id = $1 AND er.submitted_at IS NOT NULL
       GROUP BY COALESCE(sp.grade, '—')
       ORDER BY COALESCE(sp.grade, '—')`,
      [examId]
    );
    res.json({ success: true, groups: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Müəllim/Admin: bütün qruplar üzrə ümumi top 10 (score desc, duration asc) */
const getExamTop10 = async (req, res) => {
  try {
    const examId = req.params.id;
    const { rows: [exam] } = await db.query('SELECT id, instructor_id FROM exams WHERE id = $1', [examId]);
    if (!exam) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    if (req.user.role === 'instructor' && normStudentHex(exam.instructor_id) !== normStudentHex(req.user.id)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }
    if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const { rows } = await db.query(
      `SELECT er.student_id, u.full_name, COALESCE(sp.grade, '—') AS grade,
              er.score, er.duration_seconds, er.submitted_at,
              RANK() OVER (ORDER BY er.score DESC, er.duration_seconds ASC)::int AS rank
       FROM exam_results er
       JOIN users u ON u.id = er.student_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE er.exam_id = $1 AND er.submitted_at IS NOT NULL
       ORDER BY er.score DESC, er.duration_seconds ASC
       LIMIT 10`,
      [examId]
    );
    res.json({ success: true, top10: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Instructor/Admin: regrade (yenidən qiymətləndir) əvvəl təqdim olunmuş nəticələri.
 * - score yenilənir
 * - grading JSONB yenilənir (matching və digər auto suallar üçün)
 * - status completed olaraq sabitlənir
 *
 * Body (optional):
 * - student_id: yalnız bir tələbənin nəticəsini yenilə
 */
const regradeExamResults = async (req, res) => {
  try {
    const examId = req.params.id;
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && req.user.role !== 'instructor') {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const { rows: [exam] } = await db.query('SELECT id, instructor_id FROM exams WHERE id = $1', [examId]);
    if (!exam) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    if (!isAdmin && normStudentHex(exam.instructor_id) !== normStudentHex(req.user.id)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const studentId = req.body?.student_id != null && String(req.body.student_id).trim() !== ''
      ? String(req.body.student_id).trim()
      : null;

    const { rows: questions } = await db.query(
      'SELECT * FROM exam_questions WHERE exam_id = $1 ORDER BY order_num',
      [examId]
    );

    const { rows: results } = await db.query(
      `SELECT id, student_id, answers, submitted_at
       FROM exam_results
       WHERE exam_id = $1
         AND submitted_at IS NOT NULL
         AND ($2::uuid IS NULL OR student_id = $2::uuid)
       ORDER BY submitted_at DESC`,
      [examId, studentId]
    );

    let updated = 0;
    const sample = [];

    await db.transaction(async (client) => {
      for (const r of results) {
        let answers = r.answers;
        if (typeof answers === 'string') {
          try {
            answers = JSON.parse(answers);
          } catch {
            answers = {};
          }
        }
        if (!answers || typeof answers !== 'object') answers = {};

        const score = calculateScore(questions, answers);
        const grading = buildAutoGradingMap(questions, answers);

        await client.query(
          `UPDATE exam_results
           SET score = $1,
               grading = $2::jsonb,
               status = 'completed'
           WHERE id = $3`,
          [score, JSON.stringify(grading), r.id]
        );
        updated += 1;

        if (sample.length < 3) {
          const breakdown = buildExamResultBreakdown(questions, answers);
          sample.push({ result_id: r.id, student_id: r.student_id, score, breakdown: breakdown.slice(0, 5) });
        }
      }
    });

    res.json({ success: true, exam_id: examId, updated, sample });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Müəllim/Admin: imtahan təyinatları (student_id siyahısı) */
const getExamAssignments = async (req, res) => {
  try {
    const examId = req.params.id;
    const isAdmin = req.user.role === 'admin';
    const { rows: [exam] } = await db.query('SELECT id, instructor_id FROM exams WHERE id = $1', [examId]);
    if (!exam) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    if (!isAdmin && req.user.role === 'instructor') {
      if (normStudentHex(exam.instructor_id) !== normStudentHex(req.user.id)) {
        return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
      }
    } else if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const { rows } = await db.query(
      `SELECT student_id FROM exam_assignments WHERE exam_id = $1 ORDER BY student_id`,
      [examId]
    );
    res.json({ success: true, student_ids: rows.map((r) => r.student_id) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Müəllim/Admin: gecikən tələbəyə fərdi giriş icazəsi ver */
const grantLateAccess = async (req, res) => {
  try {
    const examId = req.params.id;
    const studentId = req.params.studentId;
    const isAdmin = req.user.role === 'admin';

    const { rows: [exam] } = await db.query('SELECT id, instructor_id FROM exams WHERE id = $1', [examId]);
    if (!exam) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    if (!isAdmin && req.user.role === 'instructor') {
      if (normStudentHex(exam.instructor_id) !== normStudentHex(req.user.id)) {
        return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
      }
    } else if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const body = req.body || {};
    const untilRaw = body.until;
    const minutesRaw = body.minutes;

    let until = null;
    if (untilRaw != null && String(untilRaw).trim() !== '') {
      until = normalizeExamStartTime(untilRaw);
    } else if (minutesRaw != null && String(minutesRaw).trim() !== '') {
      const m = Number(minutesRaw);
      if (Number.isFinite(m) && m > 0) {
        const d = new Date(Date.now() + Math.floor(m) * 60000);
        until = d.toISOString();
      }
    } else {
      const d = new Date(Date.now() + 2 * 60 * 60000);
      until = d.toISOString();
    }

    const { rows } = await db.query(
      `UPDATE exam_assignments
       SET late_access_until = $3::timestamptz
       WHERE exam_id = $1 AND student_id = $2
       RETURNING exam_id, student_id, late_access_until`,
      [examId, studentId, until]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Təyinat tapılmadı' });
    }
    res.json({ success: true, late_access: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Müəllim/Admin: imtahanı redaktə et (meta + exam_files/pdf_url + təyinatlar).
 * Body:
 * - title, subject, topic, start_time, duration_minutes, notify_students, show_results
 * - available_from, available_until, allow_finish_after_until
 * - exam_files: [{name,url}] (JSON array)
 * - pdf_url: string|null
 * - student_ids: string[] (təyinatların son vəziyyəti)
 */
const patchExam = async (req, res) => {
  try {
    const examId = req.params.id;
    const isAdmin = req.user.role === 'admin';

    const {
      title,
      subject,
      topic,
      start_time,
      available_from,
      available_until,
      allow_finish_after_until,
      duration_minutes,
      notify_students,
      show_results,
      exam_files,
      pdf_url,
      student_ids,
    } = req.body || {};

    const startNorm = start_time != null && start_time !== '' ? normalizeExamStartTime(start_time) : null;
    const fromNorm =
      available_from != null && available_from !== ''
        ? normalizeExamStartTime(available_from)
        : undefined;
    const untilNorm =
      available_until != null && available_until !== ''
        ? normalizeExamStartTime(available_until)
        : undefined;
    const allowFinishProvided = Object.prototype.hasOwnProperty.call(req.body || {}, 'allow_finish_after_until');
    const allowFinishNext = allowFinishProvided ? allow_finish_after_until !== false : undefined;
    const notifyProvided = Object.prototype.hasOwnProperty.call(req.body || {}, 'notify_students');
    const notifyOn = notifyProvided
      ? notify_students === true ||
        notify_students === 'true' ||
        notify_students === 1 ||
        notify_students === '1'
      : undefined;

    const titleNorm = patchCoalesceStr(title, 255);
    const subjectNorm = patchCoalesceStr(subject, 255);
    const topicNorm = patchCoalesceStr(topic, 255);
    const durationNorm = patchCoalesceInt(duration_minutes);
    const showResultsNorm = patchCoalesceBool(show_results);

    const { rows: [before] } = await db.query(
      'SELECT id, instructor_id, pdf_url, exam_files FROM exams WHERE id = $1',
      [examId]
    );
    if (!before) return res.status(404).json({ success: false, message: 'Imtahan tapilmadi' });
    if (!isAdmin && req.user.role === 'instructor') {
      if (normStudentHex(before.instructor_id) !== normStudentHex(req.user.id)) {
        return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
      }
    } else if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const filesProvided = exam_files !== undefined;
    const pdfProvided = pdf_url !== undefined;
    const studentsProvided = student_ids !== undefined;

    let nextFilesJson = null;
    if (filesProvided) {
      const arr = Array.isArray(exam_files) ? exam_files : parseJsonMaybe(exam_files, []);
      const cleaned = (Array.isArray(arr) ? arr : [])
        .filter((x) => x && typeof x === 'object' && x.url)
        .map((x, i) => ({
          name: x.name || `Fayl ${i + 1}`,
          url: x.url,
        }));
      nextFilesJson = JSON.stringify(cleaned);
    }

    const nextPdf = pdfProvided ? (pdf_url || null) : undefined;

    let updatedExam = null;
    let assignmentSummary = null;

    await db.transaction(async (client) => {
      let idx = 1;
      const sets = [];
      const vals = [];

      const add = (frag, v) => {
        sets.push(frag.replaceAll('__IDX__', String(idx)));
        vals.push(v);
        idx += 1;
      };

      add('title = COALESCE(__IDX__, title)', titleNorm);
      add('subject = COALESCE(__IDX__, subject)', subjectNorm);
      add('topic = COALESCE(__IDX__, topic)', topicNorm);
      add('start_time = COALESCE(__IDX__, start_time)', startNorm);
      add(
        'available_from = CASE WHEN __IDX__::timestamptz IS NULL THEN available_from ELSE __IDX__::timestamptz END',
        fromNorm !== undefined ? fromNorm : null
      );
      add(
        'available_until = CASE WHEN __IDX__::timestamptz IS NULL THEN available_until ELSE __IDX__::timestamptz END',
        untilNorm !== undefined ? untilNorm : null
      );
      if (allowFinishProvided) {
        add('allow_finish_after_until = __IDX__::boolean', allowFinishNext);
      }
      add('duration_minutes = COALESCE(__IDX__, duration_minutes)', durationNorm);
      if (notifyProvided) {
        add('notify_enabled = __IDX__::boolean', notifyOn);
        add('notify_students = __IDX__::boolean', notifyOn);
      }
      add('show_results = COALESCE(__IDX__, show_results)', showResultsNorm);
      add(
        'exam_files = CASE WHEN __IDX__::text IS NULL THEN exam_files ELSE __IDX__::jsonb END',
        filesProvided ? nextFilesJson : null
      );
      add('pdf_url = CASE WHEN __IDX__::text IS NULL THEN pdf_url ELSE __IDX__ END', pdfProvided ? nextPdf : null);

      vals.push(examId);
      const examIdParam = idx;

      const { rows } = await client.query(
        `UPDATE exams SET
          ${sets.join(',\n          ')},
          updated_at = NOW()
        WHERE id = $${examIdParam}
        RETURNING *`,
        vals
      );
      updatedExam = rows[0];
      if (!updatedExam) {
        const err = new Error('Imtahan tapilmadi');
        err.code = 'EXAM_NOT_FOUND';
        throw err;
      }

      if (studentsProvided) {
        const raw = Array.isArray(student_ids) ? student_ids : parseJsonMaybe(student_ids, []);
        const wanted = [
          ...new Set(
            (Array.isArray(raw) ? raw : [])
              .map((x) => String(x || '').trim())
              .filter(Boolean)
          ),
        ];

        const { rows: currentRows } = await client.query(
          `SELECT student_id FROM exam_assignments WHERE exam_id = $1`,
          [examId]
        );
        const current = new Set(currentRows.map((r) => String(r.student_id)));
        const wantedSet = new Set(wanted);

        const toRemove = [...current].filter((sid) => !wantedSet.has(sid));
        if (toRemove.length) {
          await client.query(
            `DELETE FROM exam_assignments ea
             WHERE ea.exam_id = $1
               AND ea.student_id = ANY($2::uuid[])
               AND NOT EXISTS (
                 SELECT 1 FROM exam_results er
                 WHERE er.exam_id = ea.exam_id
                   AND er.student_id = ea.student_id
                   AND er.submitted_at IS NOT NULL
               )`,
            [examId, toRemove]
          );
        }

        const toAdd = wanted.filter((sid) => !current.has(sid));
        for (const sid of toAdd) {
          await client.query(
            `INSERT INTO exam_assignments (exam_id, student_id) VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [examId, sid]
          );
        }

        const { rows: afterRows } = await client.query(
          `SELECT student_id FROM exam_assignments WHERE exam_id = $1`,
          [examId]
        );
        assignmentSummary = { wanted: wanted.length, assigned: afterRows.length };
      }
    });

    if (filesProvided || pdfProvided) {
      const oldFiles = parseJsonMaybe(before.exam_files, []);
      const oldUrls = new Set(
        (Array.isArray(oldFiles) ? oldFiles : [])
          .map((x) => x?.url)
          .filter(Boolean)
          .map(String)
      );
      if (before.pdf_url) oldUrls.add(String(before.pdf_url));

      const newFiles = parseJsonMaybe(updatedExam.exam_files, []);
      const newUrls = new Set(
        (Array.isArray(newFiles) ? newFiles : [])
          .map((x) => x?.url)
          .filter(Boolean)
          .map(String)
      );
      if (updatedExam.pdf_url) newUrls.add(String(updatedExam.pdf_url));

      for (const u of oldUrls) {
        if (!newUrls.has(u)) safeUnlinkUpload(u);
      }
    }

    res.json({ success: true, exam: updatedExam, assignments: assignmentSummary });

    if (notifyProvided || startNorm != null) {
      setImmediate(() => {
        syncExamReminderJob(examId).catch((e) => console.error('syncExamReminderJob', e.message));
      });
    }
  } catch (err) {
    if (res.headersSent) return;
    if (err && err.code === 'EXAM_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Imtahan tapilmadi' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createExam,
  listExams,
  softDeleteExam,
  hardDeleteExam,
  bulkHardDeleteExams,
  getExamAssignments,
  grantLateAccess,
  patchExam,
  instructorStudentExamProgress,
  studentExams,
  getStudentExamReview,
  getExamQuestions,
  submitExam,
  getResults,
  getExamGroups,
  getExamTop10,
  regradeExamResults,
};
