const db = require('../utils/db');

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
    res.json({ success: true, exams: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
}

async function reviewCertifiedExam(req, res) {
  try {
    const examId = req.params.id;
    const approve = req.body?.approve === true || req.body?.approve === 'true';

    const { rows: [exam] } = await db.query(
      `SELECT id, is_public, certificate_enabled, category_id FROM exams
       WHERE id = $1 AND COALESCE(is_deleted, FALSE) = FALSE`,
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

    const { rows: [updated] } = await db.query(
      `UPDATE exams SET is_verified = $2,
         is_public = CASE WHEN $2 = TRUE THEN is_public ELSE FALSE END,
         updated_at = NOW()
       WHERE id = $1 RETURNING id, title, is_public, is_verified, category_id`,
      [examId, approve],
    );

    res.json({
      success: true,
      message: approve ? 'İmtahan kataloqda təsdiqləndi' : 'Verifikasiya rədd edildi',
      exam: updated,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
}

module.exports = { listPendingCertifiedExams, reviewCertifiedExam };
