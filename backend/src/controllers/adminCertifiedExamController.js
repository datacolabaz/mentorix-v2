const db = require('../utils/db');
const { notifyWaitlistForVerifiedExam } = require('../services/catalogWaitlistService');
const {
  notifyInstructorCatalogApproved,
  notifyInstructorCatalogRejected,
} = require('../services/catalogExamReviewNotifyService');

async function listPendingCertifiedExams(_req, res) {
  try {
    const { rows } = await db.query(
      `SELECT
         e.id, e.title, e.subject, e.level, e.certificate_type,
         e.is_public, e.is_verified, e.certificate_enabled, e.certificate_pass_pct,
         e.created_at, e.updated_at,
         ec.name AS category_name, ec.slug AS category_slug,
         parent.name AS parent_category_name,
         COALESCE(NULLIF(TRIM(u.full_name), ''), NULLIF(TRIM(ip.public_label), ''), u.email, 'Müəllim') AS instructor_name,
         u.email AS instructor_email,
         u.id AS instructor_id,
         (SELECT COUNT(*)::int FROM exam_questions eq WHERE eq.exam_id = e.id) AS question_count
       FROM exams e
       JOIN users u ON u.id = e.instructor_id
       LEFT JOIN instructor_profiles ip ON ip.user_id = u.id
       LEFT JOIN exam_categories ec ON ec.id = e.category_id
       LEFT JOIN exam_categories parent ON parent.id = ec.parent_id
       WHERE e.is_public = TRUE AND e.is_verified = FALSE
         AND COALESCE(e.is_deleted, FALSE) = FALSE AND e.certificate_enabled = TRUE
       ORDER BY e.created_at ASC LIMIT 200`,
    );
    res.json({ success: true, exams: rows, pending_count: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
}

function parseOptions(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function getPendingExamPreview(req, res) {
  try {
    const examId = req.params.id;
    const { rows: examRows } = await db.query(
      `SELECT
         e.id, e.title, e.subject, e.topic, e.duration_minutes, e.certificate_pass_pct,
         e.level, e.certificate_type, e.created_at,
         ec.name AS category_name, parent.name AS parent_category_name,
         COALESCE(NULLIF(TRIM(u.full_name), ''), u.email, 'Müəllim') AS instructor_name
       FROM exams e
       JOIN users u ON u.id = e.instructor_id
       LEFT JOIN exam_categories ec ON ec.id = e.category_id
       LEFT JOIN exam_categories parent ON parent.id = ec.parent_id
       WHERE e.id = $1 AND e.is_public = TRUE AND e.is_verified = FALSE
         AND COALESCE(e.is_deleted, FALSE) = FALSE
       LIMIT 1`,
      [examId],
    );
    const exam = examRows[0];
    if (!exam) return res.status(404).json({ success: false, message: 'Gözləyən imtahan tapılmadı' });

    const { rows: questions } = await db.query(
      `SELECT id, question_text, question_type, options, correct_answer, points, order_num, negative_marking
       FROM exam_questions WHERE exam_id = $1 ORDER BY order_num ASC, id ASC`,
      [examId],
    );

    res.json({
      success: true,
      exam,
      questions: questions.map((q, idx) => ({
        id: q.id,
        order: q.order_num != null ? Number(q.order_num) : idx + 1,
        question_text: q.question_text,
        question_type: q.question_type,
        options: parseOptions(q.options),
        correct_answer: q.correct_answer,
        points: Number(q.points) || 1,
        negative_marking: Number(q.negative_marking) || 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
}

async function approveCertifiedExam(req, res) {
  req.body = { ...(req.body || {}), approve: true };
  return reviewCertifiedExam(req, res);
}

async function rejectCertifiedExam(req, res) {
  const reason = String(req.body?.reason || req.body?.rejection_reason || '').trim();
  if (reason.length < 10) {
    return res.status(400).json({ success: false, message: 'Rədd səbəbi ən azı 10 simvol olmalıdır' });
  }
  req.body = { approve: false, reason };
  return reviewCertifiedExam(req, res);
}

async function reviewCertifiedExam(req, res) {
  try {
    const examId = req.params.id;
    const approve = req.body?.approve === true || req.body?.approve === 'true';
    const reason = String(req.body?.reason || req.body?.rejection_reason || '').trim();

    const { rows: [exam] } = await db.query(
      `SELECT id, title, instructor_id, is_public, certificate_enabled, category_id, is_verified
       FROM exams WHERE id = $1 AND COALESCE(is_deleted, FALSE) = FALSE`,
      [examId],
    );
    if (!exam) return res.status(404).json({ success: false, message: 'İmtahan tapılmadı' });
    if (!exam.certificate_enabled) {
      return res.status(400).json({ success: false, message: 'Sertifikat aktiv deyil' });
    }
    if (!exam.is_public && approve) {
      return res.status(400).json({ success: false, message: 'Müəllim kataloqda göstərməyi seçməyib' });
    }
    if (!exam.category_id && approve) {
      return res.status(400).json({ success: false, message: 'Kateqoriya təyin olunmayıb' });
    }
    if (!approve && reason.length < 10) {
      return res.status(400).json({ success: false, message: 'Rədd səbəbi ən azı 10 simvol olmalıdır' });
    }

    let updated;
    if (approve) {
      const { rows } = await db.query(
        `UPDATE exams SET
           is_verified = TRUE,
           is_public = TRUE,
           catalog_rejection_reason = NULL,
           catalog_rejected_at = NULL,
           updated_at = NOW()
         WHERE id = $1
         RETURNING id, title, is_public, is_verified, category_id, instructor_id`,
        [examId],
      );
      updated = rows[0];
    } else {
      const { rows } = await db.query(
        `UPDATE exams SET
           is_verified = FALSE,
           is_public = FALSE,
           catalog_rejection_reason = $2,
           catalog_rejected_at = NOW(),
           updated_at = NOW()
         WHERE id = $1
         RETURNING id, title, is_public, is_verified, category_id, instructor_id`,
        [examId, reason.slice(0, 2000)],
      );
      updated = rows[0];
    }

    let waitlist = { sent: 0, skipped: 0, marked: 0 };
    if (approve && updated?.is_verified) {
      try {
        waitlist = await notifyWaitlistForVerifiedExam(examId);
      } catch (notifyErr) {
        console.error('[waitlist] notify failed:', notifyErr?.message || notifyErr);
      }
      try {
        await notifyInstructorCatalogApproved({
          instructorId: updated.instructor_id,
          examId: updated.id,
          examTitle: updated.title,
        });
      } catch (notifyErr) {
        console.error('[catalog] approve notify failed:', notifyErr?.message || notifyErr);
      }
    } else if (!approve) {
      try {
        await notifyInstructorCatalogRejected({
          instructorId: updated.instructor_id,
          examId: updated.id,
          examTitle: updated.title,
          reason,
        });
      } catch (notifyErr) {
        console.error('[catalog] reject notify failed:', notifyErr?.message || notifyErr);
      }
    }

    res.json({
      success: true,
      message: approve ? 'İmtahan kataloqda təsdiqləndi' : 'Verifikasiya rədd edildi',
      exam: updated,
      waitlist_notifications: waitlist,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
}

module.exports = {
  listPendingCertifiedExams,
  getPendingExamPreview,
  reviewCertifiedExam,
  approveCertifiedExam,
  rejectCertifiedExam,
};
