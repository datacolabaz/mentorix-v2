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

function examUploadFilenameFromPublicUrl(url) {
  const m = String(url || '').match(/\/api\/uploads\/exams\/([^/?#]+)$/i);
  return m ? m[1] : null;
}

async function deleteExamMaterialBlobByUrl(url) {
  const fn = examUploadFilenameFromPublicUrl(url);
  if (!fn) return;
  try {
    await db.query('DELETE FROM exam_material_blobs WHERE filename = $1', [fn]);
  } catch (e) {
    console.error('deleteExamMaterialBlobByUrl', e.message);
  }
}

/** Disk (köhnə) və ya DB (Railway-də davamlı) */
async function sendExamMaterialFromDiskOrDb(res, filename) {
  const examsDir = path.join(__dirname, '../../uploads/exams');
  const abs = path.join(examsDir, filename);
  if (!abs.startsWith(examsDir)) {
    return res.status(400).json({ success: false, message: 'Yanlış yol' });
  }
  const ext = path.extname(filename).toLowerCase();
  const ctByExt =
    ext === '.pdf'
      ? 'application/pdf'
      : ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : 'application/octet-stream';

  try {
    if (fs.existsSync(abs)) {
      res.setHeader('Content-Type', ctByExt);
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.setHeader('Referrer-Policy', 'no-referrer');
      return res.sendFile(abs);
    }
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }

  const { rows } = await db.query(
    'SELECT data, content_type FROM exam_material_blobs WHERE filename = $1',
    [filename]
  );
  const row = rows[0];
  if (row?.data) {
    const ct = row.content_type || ctByExt;
    res.setHeader('Content-Type', ct);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const buf = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
    return res.send(buf);
  }

  return res.status(404).json({
    success: false,
    message: 'Fayl tapılmadı. Müəllimdən materialı yenidən yükləməsini xahiş edin.',
  });
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
  buildExamTypeSummary,
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
      wrong_penalty_enabled,
      questions,
      student_ids,
    } = req.body;

    const wrongPenaltyOn = wrong_penalty_enabled !== false && wrong_penalty_enabled !== 'false' && wrong_penalty_enabled !== 0;

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
          notify_enabled, notify_students, notify_before_hours, show_results, wrong_penalty_enabled, status)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'scheduled') RETURNING *`,
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
          wrongPenaltyOn,
        ]
      );

      const exam = rows[0];

      if (questions?.length) {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          let neg = 0;
          if (q.question_type === 'closed' || q.question_type === 'multiple') {
            if (!wrongPenaltyOn) neg = 0;
            else if (q.negative_marking != null && q.negative_marking !== '') neg = Number(q.negative_marking);
            else neg = -0.25;
          }
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

    const { rows: [examMedia] } = await db.query(
      'SELECT exam_files, pdf_url FROM exams WHERE id = $1',
      [examId]
    );
    const blobNames = new Set();
    if (examMedia) {
      const arr = parseJsonMaybe(examMedia.exam_files, []);
      if (Array.isArray(arr)) {
        for (const x of arr) {
          if (x && typeof x === 'object' && x.url) {
            const fn = examUploadFilenameFromPublicUrl(x.url);
            if (fn) blobNames.add(fn);
          }
        }
      }
      if (examMedia.pdf_url) {
        const fn = examUploadFilenameFromPublicUrl(examMedia.pdf_url);
        if (fn) blobNames.add(fn);
      }
    }

    await db.transaction(async (client) => {
      if (blobNames.size > 0) {
        await client.query('DELETE FROM exam_material_blobs WHERE filename = ANY($1::text[])', [
          [...blobNames],
        ]);
      }
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

    const { rows: mediaRows } = await db.query(
      'SELECT exam_files, pdf_url FROM exams WHERE id = ANY($1::uuid[])',
      [examIds]
    );
    const blobNames = new Set();
    for (const row of mediaRows) {
      const arr = parseJsonMaybe(row.exam_files, []);
      if (Array.isArray(arr)) {
        for (const x of arr) {
          if (x && typeof x === 'object' && x.url) {
            const fn = examUploadFilenameFromPublicUrl(x.url);
            if (fn) blobNames.add(fn);
          }
        }
      }
      if (row.pdf_url) {
        const fn = examUploadFilenameFromPublicUrl(row.pdf_url);
        if (fn) blobNames.add(fn);
      }
    }

    await db.transaction(async (client) => {
      if (blobNames.size > 0) {
        await client.query('DELETE FROM exam_material_blobs WHERE filename = ANY($1::text[])', [
          [...blobNames],
        ]);
      }
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

/** Müəllim paneli: hər tələbə üçün təqdim olunmuş imtahanlarda orta FAİZ (0–100; score xal / max xal) */
const instructorStudentExamProgress = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const { rows } = await db.query(
      `WITH per_result AS (
         SELECT er.student_id,
                u.full_name,
                er.score::numeric AS score_pts,
                COALESCE(
                  (SELECT SUM(COALESCE(eq.points, 0)::numeric) FROM exam_questions eq WHERE eq.exam_id = er.exam_id),
                  0
                ) AS max_pts
         FROM exam_results er
         JOIN exams e ON e.id = er.exam_id
         JOIN users u ON u.id = er.student_id
         WHERE er.submitted_at IS NOT NULL
           AND COALESCE(e.is_deleted, FALSE) = FALSE
           AND ($1::boolean OR e.instructor_id = $2::uuid)
       )
       SELECT student_id,
              full_name,
              ROUND(
                AVG(
                  CASE
                    WHEN max_pts > 0 THEN LEAST(100, GREATEST(0, (score_pts / max_pts) * 100))
                    ELSE 0::numeric
                  END
                ),
                2
              ) AS exam_avg_score,
              COUNT(*)::int AS exams_taken
       FROM per_result
       GROUP BY student_id, full_name
       ORDER BY full_name`,
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
                en.group_id,
                RANK() OVER (
                  PARTITION BY er.exam_id, en.group_id
                  ORDER BY er.score DESC, er.duration_seconds ASC
                )::int AS rank_in_group
         FROM exam_results er
         JOIN exams ex ON ex.id = er.exam_id
         LEFT JOIN LATERAL (
           SELECT en.group_id
           FROM enrollments en
           WHERE en.student_id = er.student_id AND en.instructor_id = ex.instructor_id
           ORDER BY (en.group_id IS NOT NULL) DESC, en.id DESC
           LIMIT 1
         ) en ON true
         WHERE er.submitted_at IS NOT NULL
       )
       SELECT e.*, er.score, er.submitted_at, er.started_at,
         COALESCE(ig_my.name, NULLIF(TRIM(me.grade), ''), '—') AS my_group,
         lb.rank_in_group,
         eq_count.question_count,
         ea_assign.late_access_until
       FROM my_exam_ids mei
       JOIN exams e ON e.id = mei.exam_id
       CROSS JOIN me
       LEFT JOIN LATERAL (
         SELECT en.group_id
         FROM enrollments en
         WHERE en.student_id = me.student_id AND en.instructor_id = e.instructor_id
         ORDER BY (en.group_id IS NOT NULL) DESC, en.id DESC
         LIMIT 1
       ) my_en ON TRUE
       LEFT JOIN instructor_groups ig_my ON ig_my.id = my_en.group_id
       LEFT JOIN LATERAL (
         SELECT late_access_until
         FROM exam_assignments ea3
         WHERE ea3.exam_id = e.id
           AND REPLACE(LOWER(TRIM(ea3.student_id::text)), '-', '') = $1
         LIMIT 1
       ) ea_assign ON TRUE
       LEFT JOIN LATERAL (
         SELECT score, submitted_at, started_at FROM exam_results er0
         WHERE er0.exam_id = e.id
           AND REPLACE(LOWER(TRIM(er0.student_id::text)), '-', '') = $1
         ORDER BY CASE WHEN er0.submitted_at IS NULL THEN 1 ELSE 0 END DESC,
                  er0.submitted_at DESC NULLS LAST,
                  er0.started_at DESC NULLS LAST
         LIMIT 1
       ) er ON TRUE
       LEFT JOIN leaderboard lb
         ON lb.exam_id = e.id
        AND REPLACE(LOWER(TRIM(lb.student_id::text)), '-', '') = $1
        AND lb.group_id IS NOT DISTINCT FROM my_en.group_id
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
    const wrongPen = exam.wrong_penalty_enabled !== false;
    const typeSummary = buildExamTypeSummary(questions, answers, { wrongPenaltyEnabled: wrongPen });

    res.json({
      success: true,
      exam,
      score: result.score,
      submitted_at: result.submitted_at,
      breakdown,
      type_summary: typeSummary,
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
      const { rows: accessRows } = await db.query(
        `SELECT 1 FROM exam_assignments WHERE exam_id = $1
         AND REPLACE(LOWER(TRIM(student_id::text)), '-', '') = $2
         UNION ALL
         SELECT 1 FROM exam_results er
         WHERE er.exam_id = $1
           AND REPLACE(LOWER(TRIM(er.student_id::text)), '-', '') = $2
           AND er.submitted_at IS NULL
         LIMIT 1`,
        [id, sidHex]
      );
      if (!accessRows.length) {
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
      const { rows: lateRowsEarly } = await db.query(
        `SELECT late_access_until
         FROM exam_assignments
         WHERE exam_id = $1
           AND REPLACE(LOWER(TRIM(student_id::text)), '-', '') = $2
         LIMIT 1`,
        [id, sidHex]
      );
      const lateUntilEarly = lateRowsEarly[0]?.late_access_until
        ? new Date(lateRowsEarly[0].late_access_until)
        : null;
      const inLateWindow = () =>
        !!(lateUntilEarly && !Number.isNaN(lateUntilEarly.getTime()) && now <= lateUntilEarly);
      const inGlobalWindow = () => now >= from && now <= until;
      const canEnterExamWindow = () => inGlobalWindow() || inLateWindow();

      const { rows: rRows } = await db.query(
        `SELECT id, started_at, submitted_at
         FROM exam_results
         WHERE exam_id = $1
           AND REPLACE(LOWER(TRIM(student_id::text)), '-', '') = $2
         ORDER BY CASE WHEN submitted_at IS NULL THEN 1 ELSE 0 END DESC,
                  submitted_at DESC NULLS LAST,
                  started_at DESC NULLS LAST
         LIMIT 1`,
        [id, sidHex]
      );
      const attempt = rRows[0] || null;
      /** Davam: şəxsi müddət bitməyibsə, qlobal pəncərə bitəndən sonra belə bloklamırıq */
      const inProgressResume = !!(attempt?.started_at && !attempt?.submitted_at);

      if (attempt?.submitted_at) {
        return res.status(400).json({ success: false, message: 'Artıq təqdim edilib' });
      }

      if (attempt?.started_at) {
        const s = new Date(attempt.started_at);
        const durMin = Math.max(Number(dur) || 0, 1);
        const personalEnd = new Date(s.getTime() + durMin * 60000);
        if (now > personalEnd) {
          /** Köhnə in_progress: şəxsi müddət bitib, amma müəllimin pəncərəsindədirsə — yeni şəxsi müddət */
          if (canEnterExamWindow()) {
            const { rows: up } = await db.query(
              `UPDATE exam_results
               SET started_at = NOW(),
                   answers = NULL,
                   grading = NULL,
                   status = 'in_progress',
                   score = NULL,
                   duration_seconds = NULL,
                   submitted_at = NULL
               WHERE id = $1 AND exam_id = $2 AND submitted_at IS NULL
               RETURNING started_at`,
              [attempt.id, id]
            );
            if (!up.length) {
              return res.status(400).json({ success: false, message: 'Vaxtınız bitib' });
            }
            startedAtForStudent = up[0].started_at || null;
          } else {
            return res.status(400).json({ success: false, message: 'Vaxtınız bitib' });
          }
        } else {
          startedAtForStudent = attempt.started_at;
        }
      } else {
        if (!canEnterExamWindow()) {
          return res.status(400).json({ success: false, message: 'İmtahan aktiv deyil' });
        }

        const { rows: inserted } = await db.query(
          `INSERT INTO exam_results (exam_id, student_id, status, started_at)
           VALUES ($1,$2,'in_progress', NOW())
           RETURNING started_at`,
          [id, req.user.id]
        );
        startedAtForStudent = inserted[0]?.started_at || null;
      }

      if (!allowFinish && now > until && !inLateWindow() && !inProgressResume) {
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
       AND REPLACE(LOWER(TRIM(student_id::text)), '-', '') = $2
       UNION ALL
       SELECT 1 FROM exam_results er
       WHERE er.exam_id = $1
         AND REPLACE(LOWER(TRIM(er.student_id::text)), '-', '') = $2
         AND er.submitted_at IS NULL
       LIMIT 1`,
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
       ORDER BY CASE WHEN submitted_at IS NULL THEN 1 ELSE 0 END DESC,
                submitted_at DESC NULLS LAST,
                started_at DESC NULLS LAST
       LIMIT 1`,
      [exam_id, sidHex]
    );
    const attempt = already.rows[0] || null;
    if (attempt?.submitted_at) return res.status(400).json({ success: false, message: 'Artıq təqdim edilib' });

    const { rows: questions } = await db.query(
      'SELECT * FROM exam_questions WHERE exam_id=$1',
      [exam_id]
    );
    const { rows: [exam] } = await db.query(
      `SELECT id, is_deleted, duration_minutes, COALESCE(wrong_penalty_enabled, TRUE) AS wrong_penalty_enabled
       FROM exams WHERE id = $1`,
      [exam_id]
    );
    if (!exam || exam.is_deleted === true) {
      return res.status(404).json({ success: false, message: 'Tapılmadı' });
    }

    const wrongPen = exam.wrong_penalty_enabled !== false;
    const score = calculateScore(questions, answers, { wrongPenaltyEnabled: wrongPen });
    const typeSummary = buildExamTypeSummary(questions, answers, { wrongPenaltyEnabled: wrongPen });
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

    res.json({ success: true, score, breakdown, type_summary: typeSummary });
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
      `WITH emax AS (
         SELECT COALESCE(SUM(eq.points::numeric), 0) AS max_pts FROM exam_questions eq WHERE eq.exam_id = $1
       ),
       r AS (
         SELECT er.id, er.exam_id, er.student_id, u.full_name,
                COALESCE(ig.name, NULLIF(TRIM(sp.grade), ''), '—') AS grade,
                er.score, er.duration_seconds, er.submitted_at
         FROM exam_results er
         JOIN exams e ON e.id = er.exam_id
         JOIN users u ON u.id = er.student_id
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
         LEFT JOIN LATERAL (
           SELECT en.group_id
           FROM enrollments en
           WHERE en.student_id = er.student_id AND en.instructor_id = e.instructor_id
           ORDER BY (en.group_id IS NOT NULL) DESC, en.id DESC
           LIMIT 1
         ) en ON true
         LEFT JOIN instructor_groups ig ON ig.id = en.group_id
         WHERE er.exam_id = $1 AND er.submitted_at IS NOT NULL
       )
       SELECT r.id, r.exam_id, r.student_id, r.full_name, r.grade, r.score,
              CASE
                WHEN em.max_pts > 0 THEN LEAST(100, GREATEST(0, (r.score::numeric / em.max_pts) * 100))
                ELSE 0::numeric
              END AS score_pct,
              r.duration_seconds, r.submitted_at,
              RANK() OVER (
                PARTITION BY CASE WHEN $2::text IS NULL THEN 'ALL' ELSE r.grade END
                ORDER BY r.score DESC, r.duration_seconds ASC
              )::int AS rank
       FROM r
       CROSS JOIN emax em
       WHERE $2::text IS NULL OR r.grade = $2::text
       ORDER BY r.score DESC, r.duration_seconds ASC`,
        [examId, grade]
      );
      return res.json({ success: true, results: rows, grade: grade || 'ALL' });
    }

    // Student: yalnız öz enrollment qrupundakı (instructor_groups) yoldaşlarının reytinqi
    if (req.user.role === 'student') {
      const sidHex = normStudentHex(req.user.id);
      const { rows: assigned } = await db.query(
        `SELECT 1 FROM exam_assignments WHERE exam_id = $1
         AND REPLACE(LOWER(TRIM(student_id::text)), '-', '') = $2`,
        [examId, sidHex]
      );
      if (!assigned.length) return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
      const { rows } = await db.query(
        `WITH emax AS (
           SELECT COALESCE(SUM(eq.points::numeric), 0) AS max_pts FROM exam_questions eq WHERE eq.exam_id = $1
         ),
         exam_i AS (
           SELECT id, instructor_id FROM exams WHERE id = $1
         ),
         my_en AS (
           SELECT en.group_id
           FROM enrollments en
           CROSS JOIN exam_i ei
           WHERE REPLACE(LOWER(TRIM(en.student_id::text)), '-', '') = $2
             AND en.instructor_id = ei.instructor_id
           ORDER BY (en.group_id IS NOT NULL) DESC, en.id DESC
           LIMIT 1
         ),
         r AS (
           SELECT er.student_id, u.full_name,
                  COALESCE(ig.name, NULLIF(TRIM(sp.grade), ''), '—') AS grade,
                  er.score, er.duration_seconds, er.submitted_at
           FROM exam_results er
           CROSS JOIN exam_i ex
           JOIN users u ON u.id = er.student_id
           LEFT JOIN student_profiles sp ON sp.user_id = u.id
           LEFT JOIN LATERAL (
             SELECT en.group_id
             FROM enrollments en
             WHERE en.student_id = er.student_id AND en.instructor_id = ex.instructor_id
             ORDER BY (en.group_id IS NOT NULL) DESC, en.id DESC
             LIMIT 1
           ) peer ON true
           LEFT JOIN instructor_groups ig ON ig.id = peer.group_id
           WHERE er.exam_id = $1
             AND er.submitted_at IS NOT NULL
             AND peer.group_id IS NOT DISTINCT FROM (SELECT group_id FROM my_en)
         )
         SELECT r.student_id, r.full_name, r.grade, r.score,
                CASE
                  WHEN em.max_pts > 0 THEN LEAST(100, GREATEST(0, (r.score::numeric / em.max_pts) * 100))
                  ELSE 0::numeric
                END AS score_pct,
                r.duration_seconds, r.submitted_at,
                RANK() OVER (ORDER BY r.score DESC, r.duration_seconds ASC)::int AS rank
         FROM r
         CROSS JOIN emax em
         ORDER BY r.score DESC, r.duration_seconds ASC`,
        [examId, sidHex]
      );
      const self = rows.find((row) => normStudentHex(row.student_id) === sidHex);
      let grade = self?.grade ?? '—';
      if (!self) {
        const { rows: [gl] } = await db.query(
          `SELECT COALESCE(ig.name, NULLIF(TRIM(sp.grade), ''), '—') AS grade
           FROM exams e
           JOIN users u ON REPLACE(LOWER(TRIM(u.id::text)), '-', '') = $2
           LEFT JOIN student_profiles sp ON sp.user_id = u.id
           LEFT JOIN LATERAL (
             SELECT en.group_id
             FROM enrollments en
             WHERE en.student_id = u.id AND en.instructor_id = e.instructor_id
             ORDER BY (en.group_id IS NOT NULL) DESC, en.id DESC
             LIMIT 1
           ) en ON true
           LEFT JOIN instructor_groups ig ON ig.id = en.group_id
           WHERE e.id = $1`,
          [examId, sidHex]
        );
        grade = gl?.grade ?? '—';
      }
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
      `WITH em AS (
         SELECT id AS exam_id, instructor_id FROM exams WHERE id = $1::uuid
       ),
       stu AS (
         SELECT DISTINCT student_id FROM exam_assignments WHERE exam_id = $1::uuid
         UNION
         SELECT DISTINCT student_id FROM exam_results
         WHERE exam_id = $1::uuid AND submitted_at IS NOT NULL
       ),
       labeled AS (
         SELECT s.student_id,
                COALESCE(ig.name, NULLIF(TRIM(sp.grade), ''), '—') AS grade
         FROM stu s
         CROSS JOIN em
         LEFT JOIN student_profiles sp ON sp.user_id = s.student_id
         LEFT JOIN LATERAL (
           SELECT en.group_id
           FROM enrollments en
           WHERE en.student_id = s.student_id AND en.instructor_id = em.instructor_id
           ORDER BY (en.group_id IS NOT NULL) DESC, en.id DESC
           LIMIT 1
         ) en ON true
         LEFT JOIN instructor_groups ig ON ig.id = en.group_id
       ),
       subm AS (
         SELECT DISTINCT student_id FROM exam_results
         WHERE exam_id = $1::uuid AND submitted_at IS NOT NULL
       ),
       agg AS (
         SELECT l.grade,
                COUNT(DISTINCT CASE WHEN l.student_id IN (SELECT student_id FROM subm) THEN l.student_id END)::int AS taken
         FROM labeled l
         GROUP BY l.grade
       ),
       extras AS (
         SELECT ig.name AS grade, 0 AS taken
         FROM em
         JOIN exams e ON e.id = em.exam_id
         JOIN instructor_subjects ist ON ist.instructor_id = e.instructor_id
           AND TRIM(COALESCE(e.subject, '')) <> ''
           AND LOWER(TRIM(ist.name)) = LOWER(TRIM(e.subject))
         JOIN instructor_groups ig ON ig.subject_id = ist.id
       )
       SELECT x.grade, SUM(x.taken)::int AS taken
       FROM (
         SELECT * FROM agg
         UNION ALL
         SELECT * FROM extras
       ) x
       GROUP BY x.grade
       ORDER BY x.grade`,
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
      `WITH emax AS (
         SELECT COALESCE(SUM(eq.points::numeric), 0) AS max_pts FROM exam_questions eq WHERE eq.exam_id = $1
       )
       SELECT er.student_id, u.full_name,
              COALESCE(ig.name, NULLIF(TRIM(sp.grade), ''), '—') AS grade,
              er.score,
              CASE
                WHEN em.max_pts > 0 THEN LEAST(100, GREATEST(0, (er.score::numeric / em.max_pts) * 100))
                ELSE 0::numeric
              END AS score_pct,
              er.duration_seconds, er.submitted_at,
              RANK() OVER (ORDER BY er.score DESC, er.duration_seconds ASC)::int AS rank
       FROM exam_results er
       JOIN exams e ON e.id = er.exam_id
       JOIN users u ON u.id = er.student_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       LEFT JOIN LATERAL (
         SELECT en.group_id
         FROM enrollments en
         WHERE en.student_id = er.student_id AND en.instructor_id = e.instructor_id
         ORDER BY (en.group_id IS NOT NULL) DESC, en.id DESC
         LIMIT 1
       ) en ON true
       LEFT JOIN instructor_groups ig ON ig.id = en.group_id
       CROSS JOIN emax em
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

    const { rows: [exam] } = await db.query(
      `SELECT id, instructor_id, COALESCE(wrong_penalty_enabled, TRUE) AS wrong_penalty_enabled
       FROM exams WHERE id = $1`,
      [examId]
    );
    if (!exam) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    if (!isAdmin && normStudentHex(exam.instructor_id) !== normStudentHex(req.user.id)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const wrongPen = exam.wrong_penalty_enabled !== false;

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

        const score = calculateScore(questions, answers, { wrongPenaltyEnabled: wrongPen });
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
      wrong_penalty_enabled,
      exam_files,
      pdf_url,
      student_ids,
    } = req.body || {};

    const startNorm = start_time != null && start_time !== '' ? normalizeExamStartTime(start_time) : null;
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
    const wrongPenProvided = Object.prototype.hasOwnProperty.call(req.body || {}, 'wrong_penalty_enabled');

    const { rows: [before] } = await db.query('SELECT * FROM exams WHERE id = $1', [examId]);
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

    const nextPdf =
      pdfProvided && pdf_url != null && String(pdf_url).trim() !== '' ? String(pdf_url).trim().slice(0, 500) : null;

    let updatedExam = null;
    let assignmentSummary = null;

    await db.transaction(async (client) => {
      const finalTitle = titleNorm ?? before.title;
      const finalSubject = subjectNorm ?? before.subject;
      const finalTopic = topicNorm ?? before.topic;

      const startCandidate =
        start_time != null && start_time !== '' ? normalizeExamStartTime(start_time) : null;
      const finalStart = startCandidate || before.start_time;

      let finalAvailFrom = before.available_from;
      if (available_from != null && available_from !== '') {
        const n = normalizeExamStartTime(available_from);
        if (n) finalAvailFrom = n;
      }

      let finalAvailUntil = before.available_until;
      if (available_until != null && available_until !== '') {
        const n = normalizeExamStartTime(available_until);
        if (n) finalAvailUntil = n;
      }

      const finalAllowFinish = allowFinishProvided ? allowFinishNext !== false : before.allow_finish_after_until;

      const durParsed = durationNorm;
      const finalDuration =
        durParsed != null && Number.isFinite(durParsed)
          ? durParsed
          : Number.isFinite(Number(before.duration_minutes))
            ? Number(before.duration_minutes)
            : 60;

      const finalNotifyEn = notifyProvided ? !!notifyOn : before.notify_enabled;
      const finalNotifySt = notifyProvided ? !!notifyOn : before.notify_students;

      const finalShow =
        showResultsNorm !== null && showResultsNorm !== undefined ? !!showResultsNorm : before.show_results;

      const wrongPenNorm = patchCoalesceBool(wrong_penalty_enabled);
      const finalWrongPen = wrongPenProvided
        ? wrongPenNorm === null || wrongPenNorm === undefined
          ? before.wrong_penalty_enabled !== false
          : !!wrongPenNorm
        : before.wrong_penalty_enabled !== false;

      let finalExamFiles = before.exam_files;
      if (filesProvided && nextFilesJson != null) {
        try {
          finalExamFiles = JSON.parse(nextFilesJson);
        } catch {
          finalExamFiles = [];
        }
      }
      const examFilesArr = Array.isArray(finalExamFiles)
        ? finalExamFiles
        : parseJsonMaybe(finalExamFiles, []);

      const finalPdfUrl = pdfProvided ? nextPdf : before.pdf_url;

      const { rows } = await client.query(
        `UPDATE exams SET
          title = $1::varchar(255),
          subject = $2::varchar(255),
          topic = $3::varchar(255),
          start_time = $4::timestamp,
          available_from = $5::timestamptz,
          available_until = $6::timestamptz,
          allow_finish_after_until = $7::boolean,
          duration_minutes = $8::integer,
          notify_enabled = $9::boolean,
          notify_students = $10::boolean,
          show_results = $11::boolean,
          wrong_penalty_enabled = $12::boolean,
          exam_files = $13::jsonb,
          pdf_url = $14::varchar(500),
          updated_at = NOW()
        WHERE id = $15
        RETURNING *`,
        [
          finalTitle,
          finalSubject,
          finalTopic,
          finalStart,
          finalAvailFrom,
          finalAvailUntil,
          finalAllowFinish,
          finalDuration,
          finalNotifyEn,
          finalNotifySt,
          finalShow,
          finalWrongPen,
          JSON.stringify(Array.isArray(examFilesArr) ? examFilesArr : []),
          finalPdfUrl,
          examId,
        ]
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
        if (!newUrls.has(u)) {
          safeUnlinkUpload(u);
          await deleteExamMaterialBlobByUrl(u);
        }
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

/** Vercel/Rewrite: /api/uploads bəzən proxysiz qalır; JWT ilə /api/exams/material-file/... */
const serveExamMaterialFile = async (req, res) => {
  const filename = path.basename(String(req.params.filename || ''));
  if (!/^[a-f0-9-]{36}\.(pdf|png|jpe?g|jpeg)$/i.test(filename)) {
    return res.status(400).json({ success: false, message: 'Yanlış fayl adı' });
  }

  const role = req.user.role;
  const userId = req.user.id;
  const sidHex = normStudentHex(userId);
  const instHex = role === 'instructor' ? normStudentHex(userId) : '';
  const needle = `%${filename}%`;

  /** getExamQuestions ilə eyni: tələbə təyinat və ya açıq cəhd (submitted_at NULL) */
  const r = await db.query(
    `SELECT e.id FROM exams e
     WHERE (e.exam_files::text ILIKE $1 OR COALESCE(e.pdf_url::text, '') ILIKE $1)
       AND (
         $2::text = 'admin'
         OR (
           $2::text = 'instructor'
           AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $4
         )
         OR (
           $2::text = 'student'
           AND $3::text <> ''
           AND (
             EXISTS (
               SELECT 1 FROM exam_assignments ea
               WHERE ea.exam_id = e.id
                 AND REPLACE(LOWER(TRIM(ea.student_id::text)), '-', '') = $3
             )
             OR EXISTS (
               SELECT 1 FROM exam_results er
               WHERE er.exam_id = e.id
                 AND REPLACE(LOWER(TRIM(er.student_id::text)), '-', '') = $3
                 AND er.submitted_at IS NULL
             )
           )
         )
       )
     LIMIT 1`,
    [needle, role, sidHex, instHex]
  );

  if (r.rows.length === 0) {
    return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
  }

  return sendExamMaterialFromDiskOrDb(res, filename);
};

/**
 * İmtahan ID + fayl adı: faylın həmin imtahanın exam_files/pdf_url-da olması JSON ilə yoxlanır
 * (material-file ILIKE bəzən uğursuz olur). Dizayn dəyişmir — yalnız etibarlı çatdırılma.
 */
const serveExamAttachmentByExam = async (req, res) => {
  const examId = String(req.params.examId || '').trim();
  const filename = path.basename(String(req.params.filename || ''));
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(examId)) {
    return res.status(400).json({ success: false, message: 'Yanlış imtahan identifikatoru' });
  }
  if (!/^[a-f0-9-]{36}\.(pdf|png|jpe?g|jpeg)$/i.test(filename)) {
    return res.status(400).json({ success: false, message: 'Yanlış fayl adı' });
  }

  const { rows: examRows } = await db.query(
    `SELECT id, instructor_id, pdf_url, exam_files
     FROM exams WHERE id = $1::uuid AND COALESCE(is_deleted, FALSE) = FALSE`,
    [examId]
  );
  const exam = examRows[0];
  if (!exam) return res.status(404).json({ success: false, message: 'İmtahan tapılmadı' });

  const fileList = parseJsonMaybe(exam.exam_files, []);
  const urls = [];
  if (Array.isArray(fileList)) {
    for (const x of fileList) {
      if (x && typeof x === 'object' && x.url) urls.push(String(x.url));
    }
  }
  if (exam.pdf_url) urls.push(String(exam.pdf_url));

  const basenameOk = (u) => {
    const m = String(u).match(/\/([^/?#]+)$/);
    return m && m[1] === filename;
  };
  if (!urls.some(basenameOk)) {
    return res.status(404).json({ success: false, message: 'Fayl bu imtahana aid deyil' });
  }

  const role = req.user.role;
  if (role === 'admin') {
    /* ok */
  } else if (role === 'instructor') {
    if (normStudentHex(exam.instructor_id) !== normStudentHex(req.user.id)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }
  } else if (role === 'student') {
    const sidHex = normStudentHex(req.user.id);
    if (!sidHex) return res.status(400).json({ success: false, message: 'İstifadəçi identifikatoru yoxdur' });
    const { rows: accessRows } = await db.query(
      `SELECT 1 FROM exam_assignments WHERE exam_id = $1::uuid
         AND REPLACE(LOWER(TRIM(student_id::text)), '-', '') = $2
       UNION ALL
       SELECT 1 FROM exam_results er
       WHERE er.exam_id = $1::uuid
         AND REPLACE(LOWER(TRIM(er.student_id::text)), '-', '') = $2
         AND er.submitted_at IS NULL
       LIMIT 1`,
      [examId, sidHex]
    );
    if (!accessRows.length) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }
  } else {
    return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
  }

  return sendExamMaterialFromDiskOrDb(res, filename);
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
  serveExamMaterialFile,
  serveExamAttachmentByExam,
};
