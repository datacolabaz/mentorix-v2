const fs = require('fs');
const path = require('path');
const db = require('../utils/db');
const {
  isCrmStudentForInstructor,
  parseExamAudienceFilter,
  sqlExamAudienceWhere,
} = require('../services/crmStudentService');
const { STUDENT_CONTACT_PHONE_SQL } = require('../utils/studentPhone');
const { upsertStudentContactPhone } = require('../utils/studentPhone');
const { normalizeExamStartTime } = require('../utils/examTime');
const { recomputeInstructorStorageUsageMb } = require('../services/resourceUsageService');
const { certificateFieldsFromBody } = require('../lib/examCertificateFields');
const { parseCatalogFields } = require('../lib/examCatalogFields');
const { instructorHasCertificateFeature } = require('../services/certificateService');
const { displayGroupLabel } = require('../lib/participantGroupLabels');

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

/** Uyğunluq: sol/sağ cədvəli üstün tuturuq; köhnə sətirlərdə yalnız `correct_answer` qalıbsa ondan istifadə. */
function buildMatchingCorrectFromPayload(q) {
  const c = matchingCanonicalCorrect(q);
  return c || null;
}

function normalizeSequenceAnswer(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, '');
  return digits ? digits.slice(0, 120) : null;
}

function normalizeSequenceAnswerFromPayload(q) {
  const direct = normalizeSequenceAnswer(q?.correct_answer);
  if (direct) return direct;
  // UX fallback: müəllim bəzən "düzgün cavab"ı nümunə sahəsinə yazır
  return normalizeSequenceAnswer(q?.template_hint);
}

/** Sual balları: tam və kəsr (məs. 1.5); iki onluq yerə yuvarlanır, 0.01–1000 aralığında. */
function normalizeQuestionPoints(raw, fallback = 10) {
  if (raw == null || raw === '') return fallback;
  const n =
    typeof raw === 'number'
      ? raw
      : Number(String(raw).trim().replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return fallback;
  const clamped = Math.min(1000, Math.max(0.01, n));
  return Math.round(clamped * 100) / 100;
}
const {
  calculateScore,
  buildExamTypeSummary,
  buildExamResultBreakdown,
  buildAutoGradingMap,
  matchingStudentTemplateHint,
  stripExamQuestionForStudent,
  matchingCanonicalCorrect,
  rankResults,
  syncExamReminderJob,
  sendExamPlacedNotifications,
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

    const certParsed = certificateFieldsFromBody(req.body);
    let certificateEnabled = certParsed.enabledProvided ? !!certParsed.certificate_enabled : false;
    let certificatePassPct = certParsed.passProvided ? certParsed.certificate_pass_pct : 70;
    let certificateTemplateId = certParsed.templateProvided ? certParsed.certificate_template_id : null;
    if (certificateEnabled && req.user.role === 'instructor') {
      const certAllowed = await instructorHasCertificateFeature(req.user.id);
      if (!certAllowed) certificateEnabled = false;
    }

    const catalogParsed = parseCatalogFields(req.body);
    let isPublic = catalogParsed.publicProvided ? !!catalogParsed.is_public : false;
    let catalogCategoryId = catalogParsed.categoryIdProvided ? catalogParsed.category_id : null;
    let catalogLevel = catalogParsed.levelProvided ? catalogParsed.level : 'beginner';
    let catalogCertType = catalogParsed.certTypeProvided ? catalogParsed.certificate_type : 'professional';
    if (!certificateEnabled) {
      isPublic = false;
      catalogCategoryId = null;
    } else if (isPublic && !catalogCategoryId) {
      isPublic = false;
    }

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
          notify_enabled, notify_students, notify_before_hours, show_results, wrong_penalty_enabled,
          certificate_enabled, certificate_pass_pct, certificate_template_id,
          category_id, level, certificate_type, is_public, is_verified, status)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,FALSE,'scheduled') RETURNING *`,
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
          certificateEnabled,
          certificatePassPct,
          certificateTemplateId,
          catalogCategoryId,
          catalogLevel,
          catalogCertType,
          isPublic,
        ]
      );

      const exam = rows[0];

      const { ensureExamParticipantGroup } = require('../services/participantGroupService');
      await ensureExamParticipantGroup(client, req.user.id, exam.id, exam.title);

      if (questions?.length) {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          let neg = 0;
          if (q.question_type === 'closed') {
            if (!wrongPenaltyOn) neg = 0;
            else if (q.negative_marking != null && q.negative_marking !== '') neg = Number(q.negative_marking);
            else neg = -0.25;
          }
          const qText = (q.question_text && String(q.question_text).trim()) || `Sual ${i + 1}`;
          const correctAns =
            q.question_type === 'matching'
              ? buildMatchingCorrectFromPayload(q)
              : q.question_type === 'sequence'
                ? normalizeSequenceAnswerFromPayload(q)
              : q.correct_answer != null && q.correct_answer !== ''
                ? q.correct_answer
                : null;
          const templateHint =
            q.template_hint != null && String(q.template_hint).trim() !== ''
              ? String(q.template_hint).trim()
              : null;
          const safeTemplateHint =
            q.question_type === 'matching'
              ? templateHint || matchingStudentTemplateHint({ template_hint: '', options: q.options })
              : q.question_type === 'multiple'
                ? '13'
                : q.question_type === 'sequence'
                  ? (templateHint ? templateHint.replace(/\D/g, '').slice(0, 120) : null)
                : templateHint;
          const modelAnswer =
            q.question_type === 'open' && q.model_answer != null && String(q.model_answer).trim() !== ''
              ? String(q.model_answer).trim()
              : null;
          await client.query(
            `INSERT INTO exam_questions (exam_id, question_text, question_type, options, correct_answer, points, order_num, negative_marking, template_hint, model_answer)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
              exam.id,
              qText,
              q.question_type,
              JSON.stringify(q.options || null),
              correctAns,
              normalizeQuestionPoints(q.points),
              i + 1,
              neg,
              safeTemplateHint,
              modelAnswer,
            ]
          );
        }
      }

      let assignIds = Array.isArray(student_ids)
        ? [...new Set(student_ids.filter((x) => x != null && String(x).trim() !== ''))]
        : [];
      /** Boş array = müəllim heç kimi seçməyib (yalnız link/QR qonaqları). undefined/null = köhnə addım atlama. */
      if (assignIds.length === 0 && student_ids == null && req.user.role === 'instructor') {
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
      const { addStudentToExamParticipantGroup } = require('../services/participantGroupService');
      for (const sid of assignIds) {
        await client.query(
          `INSERT INTO exam_assignments (exam_id, student_id) VALUES ($1,$2)
           ON CONFLICT DO NOTHING`,
          [exam.id, sid]
        );
        await addStudentToExamParticipantGroup(client, exam.id, sid);
      }

      return exam;
    });

    res.status(201).json({ success: true, exam: result });
    setImmediate(() => {
      sendExamPlacedNotifications(result.id).catch((e) =>
        console.error('sendExamPlacedNotifications', e.message)
      );
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
        COUNT(DISTINCT ea.student_id)::int AS student_count,
        COUNT(DISTINCT er.student_id) FILTER (WHERE er.submitted_at IS NOT NULL)::int AS results_count,
        COUNT(DISTINCT er.student_id) FILTER (
          WHERE er.submitted_at IS NOT NULL AND COALESCE(er.is_crm_student, FALSE) = TRUE
        )::int AS crm_results_count,
        COUNT(DISTINCT er.student_id) FILTER (
          WHERE er.submitted_at IS NOT NULL AND COALESCE(er.is_crm_student, FALSE) = FALSE
        )::int AS guest_results_count,
        ROUND(AVG(er.score) FILTER (WHERE er.submitted_at IS NOT NULL))::int AS avg_score,
        (
          SELECT COUNT(DISTINCT igm.student_id)::int
          FROM instructor_group_members igm
          WHERE e.participant_group_id IS NOT NULL
            AND igm.group_id = e.participant_group_id
            AND COALESCE(igm.membership_source, '') IN ('exam', 'task')
        ) AS participant_count
       FROM exams e
       JOIN users u ON u.id = e.instructor_id
       LEFT JOIN exam_assignments ea ON ea.exam_id = e.id
       LEFT JOIN exam_results er ON er.exam_id = e.id
       WHERE ($1 OR e.instructor_id = $2)
         AND COALESCE(e.is_deleted, FALSE) = FALSE
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

    if (exam.instructor_id) {
      await recomputeInstructorStorageUsageMb(exam.instructor_id, { persist: true });
    }

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

    const instructorIds = [...new Set(exams.map((e) => e.instructor_id).filter(Boolean))];
    for (const iid of instructorIds) {
      await recomputeInstructorStorageUsageMb(iid, { persist: true });
    }

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
const { resolveEnrollmentScope } = require('../services/studentEnrollmentsService');

const studentExams = async (req, res) => {
  try {
    const sidHex = normStudentHex(req.user.id);
    if (!sidHex) {
      return res.status(400).json({ success: false, message: 'İstifadəçi identifikatoru yoxdur' });
    }
    const enrollmentId = String(req.query.enrollment_id || '').trim() || null;
    const scope = enrollmentId ? await resolveEnrollmentScope(req.user.id, enrollmentId) : null;
    if (enrollmentId && !scope) {
      return res.status(404).json({ success: false, message: 'Qrup tapılmadı' });
    }
    const instructorFilter = scope?.instructor_id || null;
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
         AND ($2::uuid IS NULL OR e.instructor_id = $2)
       ORDER BY COALESCE(e.available_from, e.start_time) DESC NULLS LAST`,
      [sidHex, instructorFilter]
    );
    res.json({ success: true, exams: rows, enrollment_id: scope?.enrollment_id || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Tələbə: öz nəticəsi; müəllim/admin: ?student_id= ilə hər hansı tələbənin cavabları + düzgün açarlar */
const getStudentExamReview = async (req, res) => {
  try {
    const examId = req.params.id;
    const role = req.user.role;
    const instructorView = role === 'instructor' || role === 'admin';
    const targetStudentId = instructorView
      ? String(req.query.student_id || req.query.studentId || '').trim()
      : null;

    if (instructorView) {
      if (!targetStudentId) {
        return res.status(400).json({ success: false, message: 'student_id sorğu parametri lazımdır' });
      }
      const { rows: [exam] } = await db.query('SELECT * FROM exams WHERE id = $1', [examId]);
      if (!exam) return res.status(404).json({ success: false, message: 'Tapılmadı' });
      if (exam.is_deleted === true) return res.status(404).json({ success: false, message: 'Tapılmadı' });
      if (role === 'instructor' && normStudentHex(exam.instructor_id) !== normStudentHex(req.user.id)) {
        return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
      }
      const targetHex = normStudentHex(targetStudentId);
      if (!targetHex) {
        return res.status(400).json({ success: false, message: 'Yanlış tələbə identifikatoru' });
      }
      const { rows: resultRows } = await db.query(
        `SELECT er.id, er.score, er.answers, er.grading, er.submitted_at, u.full_name AS student_name
         FROM exam_results er
         JOIN users u ON u.id = er.student_id
         WHERE er.exam_id = $1
           AND REPLACE(LOWER(TRIM(er.student_id::text)), '-', '') = $2
           AND er.submitted_at IS NOT NULL
         ORDER BY er.submitted_at DESC
         LIMIT 1`,
        [examId, targetHex]
      );
      const result = resultRows[0];
      if (!result) {
        return res.status(404).json({ success: false, message: 'Bu tələbə üçün təqdim olunmuş nəticə tapılmadı' });
      }

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

      let grading = result.grading;
      if (typeof grading === 'string') {
        try {
          grading = JSON.parse(grading);
        } catch {
          grading = {};
        }
      }
      if (!grading || typeof grading !== 'object') grading = {};

      const breakdown = buildExamResultBreakdown(questions, answers, {
        showCorrectAnswers: true,
        showOpenGrading: true,
        grading,
      });
      const wrongPen = exam.wrong_penalty_enabled !== false;
      const typeSummary = buildExamTypeSummary(questions, answers, { wrongPenaltyEnabled: wrongPen, grading });
      const { hasUnconfirmedOpenGrading } = require('../services/openExamGradingService');
      const grading_pending = hasUnconfirmedOpenGrading(questions, answers, grading);

      return res.json({
        success: true,
        exam,
        result_id: result.id,
        score: result.score,
        submitted_at: result.submitted_at,
        breakdown,
        type_summary: typeSummary,
        student_name: result.student_name || null,
        student_id: targetStudentId,
        grading_pending,
      });
    }

    if (role !== 'student') {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const sidHex = normStudentHex(req.user.id);
    if (!sidHex) {
      return res.status(400).json({ success: false, message: 'İstifadəçi identifikatoru yoxdur' });
    }

    const { rows: resultRows } = await db.query(
      `SELECT score, answers, grading, submitted_at FROM exam_results
       WHERE exam_id = $1
         AND REPLACE(LOWER(TRIM(student_id::text)), '-', '') = $2
         AND submitted_at IS NOT NULL
       ORDER BY submitted_at DESC NULLS LAST
       LIMIT 1`,
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

    let grading = result.grading;
    if (typeof grading === 'string') {
      try {
        grading = JSON.parse(grading);
      } catch {
        grading = {};
      }
    }
    if (!grading || typeof grading !== 'object') grading = {};

    const { hasUnconfirmedOpenGrading } = require('../services/openExamGradingService');
    const gradingPending = hasUnconfirmedOpenGrading(questions, answers, grading);

    const breakdown = buildExamResultBreakdown(questions, answers, {
      showCorrectAnswers: exam.show_results !== false,
      grading,
      studentView: true,
    });
    const wrongPen = exam.wrong_penalty_enabled !== false;
    const typeSummary = buildExamTypeSummary(questions, answers, { wrongPenaltyEnabled: wrongPen, grading });

    let certificate = null;
    let certificateMeta = null;
    try {
      const { getOrIssueCertificateForStudentExam } = require('../services/certificateService');
      const certOutcome = await getOrIssueCertificateForStudentExam(req.user.id, examId);
      certificate = certOutcome.certificate;
      certificateMeta = certOutcome.eligibility;
    } catch (certErr) {
      console.error('review certificate', certErr.message);
    }

    res.json({
      success: true,
      exam,
      score: result.score,
      grading_pending: gradingPending,
      score_display: gradingPending ? 'pending' : result.score,
      submitted_at: result.submitted_at,
      breakdown,
      type_summary: typeSummary,
      /** Modalda breakdown.student_answer boş qalsa, birbaşa təqdim olunmuş cavab obyekti ilə doldurmaq üçün */
      answers,
      certificate,
      certificate_meta: certificateMeta,
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

    let startedAtForStudent = null;
    let savedAnswers = null;
    if (req.user.role === 'student') {
      if (!from || !until) {
        return res.status(400).json({ success: false, message: 'İmtahan vaxtı təyin olunmayıb' });
      }
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
        `SELECT id, started_at, submitted_at, answers
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
          if (attempt.answers && typeof attempt.answers === 'object') {
            savedAnswers = attempt.answers;
          } else if (typeof attempt.answers === 'string') {
            try {
              savedAnswers = JSON.parse(attempt.answers);
            } catch {
              savedAnswers = null;
            }
          }
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

    let remainingSeconds = null;
    if (req.user.role === 'student' && startedAtForStudent) {
      const s = new Date(startedAtForStudent);
      const durMin = Math.max(Number(dur) || 0, 1);
      const personalEndMs = s.getTime() + durMin * 60000;
      remainingSeconds = Math.max(0, Math.ceil((personalEndMs - now.getTime()) / 1000));
      if (remainingSeconds <= 0) {
        return res.status(400).json({ success: false, message: 'Vaxtınız bitib' });
      }
    }

    const { rows: questions } = await db.query(
      'SELECT * FROM exam_questions WHERE exam_id = $1 ORDER BY order_num',
      [id]
    );

    // Tələbəyə correct_answer və uyğunluq cütləri (options) getməsin.
    const safe =
      req.user.role === 'student'
        ? questions.map((q) => stripExamQuestionForStudent(q))
        : questions.map((q) => ({ ...q }));

    res.json({
      success: true,
      exam,
      questions: safe,
      started_at: startedAtForStudent,
      remaining_seconds: remainingSeconds,
      answers: req.user.role === 'student' ? savedAnswers : undefined,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Imtahan cavablarini gondor
const submitExam = async (req, res) => {
  try {
    let { exam_id, answers } = req.body;
    if (typeof answers === 'string') {
      try {
        answers = JSON.parse(answers);
      } catch {
        answers = {};
      }
    }
    if (!answers || typeof answers !== 'object') answers = {};
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
      `SELECT id, is_deleted, duration_minutes,
              COALESCE(wrong_penalty_enabled, TRUE) AS wrong_penalty_enabled,
              COALESCE(show_results, TRUE) AS show_results
       FROM exams WHERE id = $1`,
      [exam_id]
    );
    if (!exam || exam.is_deleted === true) {
      return res.status(404).json({ success: false, message: 'Tapılmadı' });
    }

    const wrongPen = exam.wrong_penalty_enabled !== false;
    const grading = buildAutoGradingMap(questions, answers);
    const score = calculateScore(questions, answers, { wrongPenaltyEnabled: wrongPen, grading });
    const typeSummary = buildExamTypeSummary(questions, answers, { wrongPenaltyEnabled: wrongPen, grading });
    const breakdown = buildExamResultBreakdown(questions, answers, {
      showCorrectAnswers: exam.show_results !== false,
      grading,
      studentView: true,
    });
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
    const isCrmStudent = await isCrmStudentForInstructor(exam.instructor_id, student_id);

    let examResultId = attempt?.id || null;

    if (attempt?.id) {
      await db.query(
        `UPDATE exam_results
         SET score = $3,
             answers = $4,
             grading = $5,
             status = 'completed',
             started_at = COALESCE(started_at, $6),
             submitted_at = $7,
             duration_seconds = $8,
             is_crm_student = $9
         WHERE id = $1 AND exam_id = $2`,
        [
          attempt.id,
          exam_id,
          score,
          JSON.stringify(answers),
          JSON.stringify(grading),
          startedAt,
          now,
          duration,
          isCrmStudent,
        ],
      );
    } else {
      const { rows: inserted } = await db.query(
        `INSERT INTO exam_results (
           exam_id, student_id, score, answers, grading, status,
           started_at, submitted_at, duration_seconds, is_crm_student
         ) VALUES ($1,$2,$3,$4,$5,'completed',$6,$7,$8,$9)
         RETURNING id`,
        [
          exam_id,
          student_id,
          score,
          JSON.stringify(answers),
          JSON.stringify(grading),
          startedAt,
          now,
          duration,
          isCrmStudent,
        ],
      );
      examResultId = inserted[0]?.id || null;
    }

    let certificate = null;
    try {
      const { maybeIssueCertificateAfterExamSubmit, evaluateCertificateEligibility, slimCertificateRow } = require('../services/certificateService');
      const { hasUnconfirmedOpenGrading, hasOpenQuestionsNeedingAi, enqueueOpenGradingJob } = require('../services/openExamGradingService');

      if (hasOpenQuestionsNeedingAi(questions, answers, grading) && examResultId) {
        setImmediate(() => {
          enqueueOpenGradingJob(examResultId).catch((e) =>
            console.error('enqueueOpenGradingJob', e.message),
          );
        });
      }

      if (!hasUnconfirmedOpenGrading(questions, answers, grading)) {
        const cert = await maybeIssueCertificateAfterExamSubmit({
          examId: exam_id,
          studentId: student_id,
          examResultId,
          score,
        });
        if (cert) {
          certificate = slimCertificateRow(cert);
        }
      }
    } catch (certErr) {
      console.error('certificate on submit', certErr.message);
    }

    let certificateMeta = null;
    let gradingPending = false;
    try {
      const { hasUnconfirmedOpenGrading } = require('../services/openExamGradingService');
      gradingPending = hasUnconfirmedOpenGrading(questions, answers, grading);
      certificateMeta = await evaluateCertificateEligibility(exam_id, score, null, { examResultId });
    } catch (metaErr) {
      console.error('certificate meta on submit', metaErr.message);
    }

    try {
      await db.transaction(async (client) => {
        const { addStudentToExamParticipantGroup } = require('../services/participantGroupService');
        await addStudentToExamParticipantGroup(client, exam_id, student_id);
      });
    } catch (e) {
      console.error('addStudentToExamParticipantGroup', e.message);
    }

    setImmediate(() => {
      notifyParentExamResultAfterSubmit(exam_id, student_id, score).catch((e) =>
        console.error('notifyParentExamResultAfterSubmit', e.message)
      );
    });

    res.json({
      success: true,
      score,
      grading_pending: gradingPending,
      score_display: gradingPending ? 'pending' : score,
      breakdown,
      type_summary: typeSummary,
      answers,
      certificate,
      certificate_meta: certificateMeta,
    });
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
      const audience = parseExamAudienceFilter(req.query.audience);
      const { rows } = await db.query(
      `WITH emax AS (
         SELECT COALESCE(SUM(eq.points::numeric), 0) AS max_pts FROM exam_questions eq WHERE eq.exam_id = $1
       ),
       r AS (
         SELECT er.id, er.exam_id, er.student_id, u.full_name,
                COALESCE(ig.name, NULLIF(TRIM(sp.grade), ''), '—') AS grade,
                er.score, er.duration_seconds, er.submitted_at,
                COALESCE(er.is_crm_student, FALSE) AS is_crm_student,
                ${STUDENT_CONTACT_PHONE_SQL} AS phone
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
         LEFT JOIN instructor_groups ig ON ig.id = en.group_id AND COALESCE(ig.is_system, FALSE) = FALSE
         WHERE er.exam_id = $1 AND er.submitted_at IS NOT NULL
           AND ${sqlExamAudienceWhere('er', 3)}
       )
       SELECT r.id, r.exam_id, r.student_id, r.full_name, r.grade, r.score,
              r.is_crm_student, r.phone,
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
        [examId, grade, audience],
      );
      return res.json({ success: true, results: rows, grade: grade || 'ALL', audience });
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
    const { rows: [examMeta] } = await db.query(
      'SELECT id, instructor_id, participant_group_id, title FROM exams WHERE id = $1',
      [examId],
    );
    if (!examMeta) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    if (req.user.role === 'instructor' && normStudentHex(examMeta.instructor_id) !== normStudentHex(req.user.id)) {
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
                COALESCE(
                  CASE WHEN COALESCE(ig.is_system, FALSE) THEN NULLIF(TRIM(ex_link.title), '') END,
                  CASE WHEN COALESCE(ig.is_system, FALSE) THEN NULLIF(TRIM(ig.name), '') END,
                  ig.name,
                  NULLIF(TRIM(sp.grade), ''),
                  '—'
                ) AS grade,
                COALESCE(ig.is_system, FALSE) AS is_system_group
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
         LEFT JOIN exams ex_link ON ig.system_kind = 'exam_participants' AND ex_link.id = ig.system_ref_id
       ),
       subm AS (
         SELECT DISTINCT student_id FROM exam_results
         WHERE exam_id = $1::uuid AND submitted_at IS NOT NULL
       ),
       agg AS (
         SELECT l.grade,
                BOOL_OR(l.is_system_group) AS is_system_group,
                COUNT(DISTINCT CASE WHEN l.student_id IN (SELECT student_id FROM subm) THEN l.student_id END)::int AS taken
         FROM labeled l
         GROUP BY l.grade
       ),
       extras AS (
         SELECT ig.name AS grade, FALSE AS is_system_group, 0 AS taken
         FROM em
         JOIN exams e ON e.id = em.exam_id
         JOIN instructor_subjects ist ON ist.instructor_id = e.instructor_id
           AND TRIM(COALESCE(e.subject, '')) <> ''
           AND LOWER(TRIM(ist.name)) = LOWER(TRIM(e.subject))
         JOIN instructor_groups ig ON ig.subject_id = ist.id
       )
       SELECT x.grade, BOOL_OR(x.is_system_group) AS is_system_group, SUM(x.taken)::int AS taken
       FROM (
         SELECT * FROM agg
         UNION ALL
         SELECT * FROM extras
       ) x
       GROUP BY x.grade
       ORDER BY x.grade`,
      [examId]
    );
    const groups = rows.map((r) => ({
      grade: displayGroupLabel({
        name: r.grade,
        is_system: Boolean(r.is_system_group),
        exam_title: examMeta.title,
      }),
      taken: r.taken,
      is_system_group: Boolean(r.is_system_group),
    }));
    const { rows: sumRows } = await db.query(
      `SELECT
         COUNT(DISTINCT er.student_id) FILTER (
           WHERE er.submitted_at IS NOT NULL AND COALESCE(er.is_crm_student, FALSE) = TRUE
         )::int AS crm_count,
         COUNT(DISTINCT er.student_id) FILTER (
           WHERE er.submitted_at IS NOT NULL AND COALESCE(er.is_crm_student, FALSE) = FALSE
         )::int AS guest_count
       FROM exam_results er
       WHERE er.exam_id = $1::uuid`,
      [examId],
    );
    const summary = sumRows[0] || { crm_count: 0, guest_count: 0 };
    res.json({
      success: true,
      groups,
      participant_group_id: examMeta.participant_group_id || null,
      summary: {
        crm_count: Number(summary.crm_count) || 0,
        guest_count: Number(summary.guest_count) || 0,
        total_count: (Number(summary.crm_count) || 0) + (Number(summary.guest_count) || 0),
      },
    });
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

    const audience = parseExamAudienceFilter(req.query.audience);
    const { rows } = await db.query(
      `WITH emax AS (
         SELECT COALESCE(SUM(eq.points::numeric), 0) AS max_pts FROM exam_questions eq WHERE eq.exam_id = $1
       )
       SELECT er.student_id, u.full_name,
              COALESCE(ig.name, NULLIF(TRIM(sp.grade), ''), '—') AS grade,
              er.score,
              COALESCE(er.is_crm_student, FALSE) AS is_crm_student,
              ${STUDENT_CONTACT_PHONE_SQL} AS phone,
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
       LEFT JOIN instructor_groups ig ON ig.id = en.group_id AND COALESCE(ig.is_system, FALSE) = FALSE
       CROSS JOIN emax em
       WHERE er.exam_id = $1 AND er.submitted_at IS NOT NULL
         AND ${sqlExamAudienceWhere('er', 2)}
       ORDER BY er.score DESC, er.duration_seconds ASC
       LIMIT 10`,
      [examId, audience],
    );
    res.json({ success: true, top10: rows, audience });
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
      `SELECT id, instructor_id,
              COALESCE(wrong_penalty_enabled, TRUE) AS wrong_penalty_enabled,
              COALESCE(show_results, TRUE) AS show_results
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
      `SELECT id, student_id, answers, grading, submitted_at
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

        let existingGrading = r.grading;
        if (typeof existingGrading === 'string') {
          try {
            existingGrading = JSON.parse(existingGrading);
          } catch {
            existingGrading = {};
          }
        }
        const grading = buildAutoGradingMap(questions, answers, existingGrading || {});
        const score = calculateScore(questions, answers, { wrongPenaltyEnabled: wrongPen, grading });

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
          const breakdown = buildExamResultBreakdown(questions, answers, {
            showCorrectAnswers: exam.show_results !== false,
          });
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
 * - questions (optional): [{ id, question_text, points, options, correct_answer, template_hint, negative_marking, order_num }] — mövcud sualları yeniləyir; təqdim olunmuş exam_results üçün bal avtomatik yenidən hesablanır
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
      questions,
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
    const certParsed = certificateFieldsFromBody(req.body);
    const catalogParsed = parseCatalogFields(req.body);

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
    const questionsProvided = Array.isArray(questions);

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

    const certWasEnabled = before.certificate_enabled === true;

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

      let finalCertEnabled = before.certificate_enabled === true;
      if (certParsed.enabledProvided) {
        finalCertEnabled = !!certParsed.certificate_enabled;
        if (finalCertEnabled && req.user.role === 'instructor') {
          const certAllowed = await instructorHasCertificateFeature(req.user.id);
          if (!certAllowed) finalCertEnabled = false;
        }
      }
      const finalCertPassPct = certParsed.passProvided
        ? certParsed.certificate_pass_pct
        : Number(before.certificate_pass_pct || 70);
      const finalCertTemplateId = certParsed.templateProvided
        ? certParsed.certificate_template_id
        : before.certificate_template_id;

      let finalCategoryId = before.category_id || null;
      if (catalogParsed.categoryIdProvided) finalCategoryId = catalogParsed.category_id;
      let finalLevel = before.level || 'beginner';
      if (catalogParsed.levelProvided) finalLevel = catalogParsed.level;
      let finalCertType = before.certificate_type || 'professional';
      if (catalogParsed.certTypeProvided) finalCertType = catalogParsed.certificate_type;
      let finalIsPublic = before.is_public === true;
      if (catalogParsed.publicProvided) finalIsPublic = !!catalogParsed.is_public;
      if (!finalCertEnabled) {
        finalIsPublic = false;
        finalCategoryId = null;
      } else if (finalIsPublic && !finalCategoryId) {
        finalIsPublic = false;
      }
      const catalogChanged =
        (catalogParsed.publicProvided && finalIsPublic !== (before.is_public === true)) ||
        (catalogParsed.categoryIdProvided && finalCategoryId !== (before.category_id || null)) ||
        (catalogParsed.levelProvided && finalLevel !== (before.level || 'beginner'));
      const finalIsVerified =
        isAdmin && req.body?.is_verified === true
          ? true
          : catalogChanged || (certParsed.enabledProvided && finalCertEnabled !== certWasEnabled)
            ? false
            : before.is_verified === true;

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
          certificate_enabled = $15::boolean,
          certificate_pass_pct = $16::numeric,
          certificate_template_id = $17::uuid,
          category_id = $18::uuid,
          level = $19::varchar(32),
          certificate_type = $20::varchar(32),
          is_public = $21::boolean,
          is_verified = $22::boolean,
          updated_at = NOW()
        WHERE id = $23
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
          finalCertEnabled,
          finalCertPassPct,
          finalCertTemplateId,
          finalCategoryId,
          finalLevel,
          finalCertType,
          finalIsPublic,
          finalIsVerified,
          examId,
        ]
      );
      updatedExam = rows[0];
      if (!updatedExam) {
        const err = new Error('Imtahan tapilmadi');
        err.code = 'EXAM_NOT_FOUND';
        throw err;
      }

      if (questionsProvided) {
        for (const q of questions) {
          if (!q || q.id == null || String(q.id).trim() === '') continue;
          const { rows: qrows } = await client.query(
            `SELECT id, question_type, order_num, correct_answer AS stored_correct_answer
             FROM exam_questions WHERE id = $1::uuid AND exam_id = $2::uuid`,
            [q.id, examId]
          );
          const row = qrows[0];
          if (!row) continue;

          const qText = (q.question_text != null && String(q.question_text).trim()) || 'Sual';
          const pts = normalizeQuestionPoints(q.points != null ? q.points : 10);

          let opts = q.options;
          if (typeof opts === 'string') {
            try {
              opts = JSON.parse(opts);
            } catch {
              opts = [];
            }
          }
          if (!Array.isArray(opts)) opts = [];

          /** JSON-da `correct_answer` açarı yoxdursa — köhnə dəyəri saxla (boş forma ilə təsadüfi silinməsin). Açar var və boşdursa — NULL. */
          const sentCorrectKey = Object.prototype.hasOwnProperty.call(q, 'correct_answer');
          let correctAns = sentCorrectKey
            ? q.correct_answer != null && String(q.correct_answer).trim() !== ''
              ? String(q.correct_answer).trim()
              : null
            : row.stored_correct_answer != null && String(row.stored_correct_answer).trim() !== ''
              ? String(row.stored_correct_answer).trim()
              : null;
          if (row.question_type === 'closed' && correctAns) {
            correctAns = correctAns.toUpperCase().slice(0, 1);
          }
          if (row.question_type === 'multiple' && correctAns != null) {
            correctAns = correctAns
              .replace(/\D/g, '')
              .split('')
              .filter((c, idx, arr) => arr.indexOf(c) === idx)
              .sort()
              .join('');
          }
          if (row.question_type === 'matching') {
            const derived = buildMatchingCorrectFromPayload({
              ...q,
              question_type: 'matching',
              correct_answer: correctAns,
              options: opts,
            });
            if (derived) correctAns = derived;
          }

          const hintRaw = q.template_hint != null ? String(q.template_hint).trim() : '';
          if (row.question_type === 'sequence') {
            // correct_answer açarı gəlirsə — onu normalize et; gəlmirsə amma stored boşdursa, template_hint-dən fallback et.
            if (sentCorrectKey) correctAns = normalizeSequenceAnswer(correctAns);
            if (!sentCorrectKey && !correctAns) {
              const fallback = normalizeSequenceAnswer(hintRaw);
              if (fallback) correctAns = fallback;
            }
          }
          const templateHint =
            row.question_type === 'matching'
              ? hintRaw || matchingStudentTemplateHint({ template_hint: '', options: opts })
              : row.question_type === 'multiple'
                ? '13'
                : row.question_type === 'sequence'
                  ? (hintRaw ? hintRaw.replace(/\D/g, '').slice(0, 120) : null)
                : hintRaw || null;
          const modelAnswer =
            row.question_type === 'open' && q.model_answer != null
              ? (String(q.model_answer).trim() || null)
              : null;

          let negMark = 0;
          if (row.question_type === 'closed') {
            const negRaw = q.negative_marking != null && q.negative_marking !== '' ? Number(q.negative_marking) : 0;
            negMark = Number.isFinite(negRaw) ? negRaw : 0;
            if (!finalWrongPen) negMark = 0;
          }

          const ordRaw = parseInt(String(q.order_num != null ? q.order_num : row.order_num), 10);
          const orderNum = Number.isFinite(ordRaw) ? Math.max(1, ordRaw) : Math.max(1, Number(row.order_num) || 1);

          await client.query(
            `UPDATE exam_questions SET
              question_text = $1,
              points = $2,
              options = $3::jsonb,
              correct_answer = $4,
              template_hint = $5,
              negative_marking = $6::numeric,
              order_num = $7,
              model_answer = $8
             WHERE id = $9::uuid AND exam_id = $10::uuid`,
            [
              qText,
              pts,
              JSON.stringify(opts),
              correctAns,
              templateHint,
              negMark,
              orderNum,
              modelAnswer,
              q.id,
              examId,
            ]
          );
        }
      }

      /** Suallar (xüsusən `points` / cavab açarı) dəyişəndə artıq təqdim olunmuş nəticələrin balını yenilə */
      if (questionsProvided && Array.isArray(questions) && questions.length > 0) {
        const { rows: questionsFresh } = await client.query(
          'SELECT * FROM exam_questions WHERE exam_id = $1 ORDER BY order_num',
          [examId]
        );
        const wrongPenaltyEnabled = finalWrongPen !== false;
        const { rows: resultRows } = await client.query(
          `SELECT id, answers, grading FROM exam_results
           WHERE exam_id = $1 AND submitted_at IS NOT NULL`,
          [examId]
        );
        for (const r of resultRows) {
          let answers = r.answers;
          if (typeof answers === 'string') {
            try {
              answers = JSON.parse(answers);
            } catch {
              answers = {};
            }
          }
          if (!answers || typeof answers !== 'object') answers = {};
          let existingGrading = r.grading;
          if (typeof existingGrading === 'string') {
            try {
              existingGrading = JSON.parse(existingGrading);
            } catch {
              existingGrading = {};
            }
          }
          const grading = buildAutoGradingMap(questionsFresh, answers, existingGrading || {});
          const score = calculateScore(questionsFresh, answers, { wrongPenaltyEnabled, grading });
          await client.query(
            `UPDATE exam_results
             SET score = $1,
                 grading = $2::jsonb,
                 status = 'completed'
             WHERE id = $3`,
            [score, JSON.stringify(grading), r.id]
          );
        }
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
        assignmentSummary = {
          wanted: wanted.length,
          assigned: afterRows.length,
          ...(toAdd.length ? { new_student_ids: toAdd } : {}),
        };
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

      let filesRemoved = false;
      for (const u of oldUrls) {
        if (!newUrls.has(u)) {
          filesRemoved = true;
          safeUnlinkUpload(u);
          await deleteExamMaterialBlobByUrl(u);
        }
      }
      if (filesRemoved && before.instructor_id) {
        await recomputeInstructorStorageUsageMb(before.instructor_id, { persist: true });
      }
    }

    res.json({ success: true, exam: updatedExam, assignments: assignmentSummary });

    const certNowEnabled = updatedExam?.certificate_enabled === true;
    if (certNowEnabled && !certWasEnabled) {
      setImmediate(() => {
        const { backfillCertificatesForExam } = require('../services/certificateService');
        backfillCertificatesForExam(examId).catch((e) =>
          console.error('backfillCertificatesForExam', examId, e.message),
        );
      });
    }

    const newAssignees = assignmentSummary?.new_student_ids;
    if (Array.isArray(newAssignees) && newAssignees.length) {
      setImmediate(() => {
        sendExamPlacedNotifications(examId, { studentIds: newAssignees }).catch((e) =>
          console.error('sendExamPlacedNotifications(new)', e.message)
        );
      });
    }

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

const {
  getStudentAccessStatus,
  createExamAccessRequest,
} = require('../services/examAccessRequestService');
const { autoGrantExamAccessForStudent } = require('../services/guestAccessService');

const getExamAccessStatus = async (req, res) => {
  try {
    const data = await getStudentAccessStatus(req.user.id, req.params.id);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

const postExamAccessRequest = async (req, res) => {
  try {
    const result = await createExamAccessRequest(req.user.id, req.params.id);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }
};

/** İmtahan paylaşım linki: avtomatik icazə (qonaq / CRM olmayan tələbə) */
const postExamAccessFromLink = async (req, res) => {
  try {
    if (req.body?.phone != null && String(req.body.phone).trim() !== '') {
      await upsertStudentContactPhone(db, req.user.id, req.body.phone);
    }
    const result = await autoGrantExamAccessForStudent(req.user.id, req.params.id);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }
};

const bulkPatchOpenModelAnswers = async (req, res) => {
  try {
    const examId = req.params.id;
    const isAdmin = req.user.role === 'admin';
    const { entries } = req.body || {};
    if (!Array.isArray(entries) || !entries.length) {
      return res.status(400).json({ success: false, message: 'entries array tələb olunur' });
    }

    const { rows: [exam] } = await db.query(
      'SELECT id, instructor_id FROM exams WHERE id = $1 AND COALESCE(is_deleted, FALSE) = FALSE',
      [examId],
    );
    if (!exam) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    if (!isAdmin && normStudentHex(exam.instructor_id) !== normStudentHex(req.user.id)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const { rows: questions } = await db.query(
      `SELECT id, order_num, question_type FROM exam_questions WHERE exam_id = $1 ORDER BY order_num`,
      [examId],
    );
    const byId = new Map(questions.map((q) => [String(q.id), q]));
    const byOrder = new Map(questions.map((q) => [Number(q.order_num), q]));

    let updated = 0;
    const skipped = [];

    await db.transaction(async (client) => {
      for (const entry of entries) {
        const text = entry?.model_answer != null ? String(entry.model_answer).trim() : '';
        if (!text) continue;
        let q = null;
        if (entry?.question_id && byId.has(String(entry.question_id))) {
          q = byId.get(String(entry.question_id));
        } else if (entry?.order_num != null) {
          const ord = Number(entry.order_num);
          if (Number.isFinite(ord)) q = byOrder.get(ord);
        }
        if (!q || q.question_type !== 'open') {
          skipped.push(entry?.order_num ?? entry?.question_id ?? '?');
          continue;
        }
        await client.query(
          `UPDATE exam_questions SET model_answer = $1 WHERE id = $2::uuid AND exam_id = $3::uuid`,
          [text, q.id, examId],
        );
        updated += 1;
      }
    });

    return res.json({ success: true, updated, skipped });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const confirmOpenQuestionGrading = async (req, res) => {
  try {
    const examId = req.params.id;
    const examResultId = req.params.resultId;
    const questionId = req.params.questionId;
    const { action, final_score: finalScore } = req.body || {};
    const { confirmOpenGrading } = require('../services/openExamGradingService');
    const result = await confirmOpenGrading({
      examId,
      examResultId,
      questionId,
      instructorId: req.user.id,
      action,
      finalScore,
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
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
  bulkPatchOpenModelAnswers,
  instructorStudentExamProgress,
  studentExams,
  getExamAccessStatus,
  postExamAccessRequest,
  postExamAccessFromLink,
  getStudentExamReview,
  getExamQuestions,
  submitExam,
  confirmOpenQuestionGrading,
  getResults,
  getExamGroups,
  getExamTop10,
  regradeExamResults,
  serveExamMaterialFile,
  serveExamAttachmentByExam,
};
