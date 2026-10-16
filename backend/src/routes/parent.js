/**
 * Parent: read-only view of *their own* children's results.
 * A child is linked when student_profiles.parent_id = parent's user id; every query is scoped by that link,
 * and unlinked student ids answer 404 (no existence leak). Exam scores follow the same release rules as the
 * student's own view (hidden until the teacher's result mode releases them).
 */
const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, authorize } = require('../middleware/auth');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function listChildren(parentId) {
  const { rows } = await db.query(
    `SELECT u.id, u.full_name
     FROM student_profiles sp
     JOIN users u ON u.id = sp.user_id AND COALESCE(u.is_active, TRUE) = TRUE
     WHERE sp.parent_id = $1
     ORDER BY u.full_name`,
    [parentId],
  );
  return rows;
}

async function isLinkedChild(parentId, studentId) {
  if (!UUID_RE.test(String(studentId || ''))) return false;
  const { rows } = await db.query(
    `SELECT 1 FROM student_profiles sp
     JOIN users u ON u.id = sp.user_id AND COALESCE(u.is_active, TRUE) = TRUE
     WHERE sp.parent_id = $1 AND sp.user_id = $2 LIMIT 1`,
    [parentId, studentId],
  );
  return Boolean(rows[0]);
}

router.get('/children', authenticate, authorize('parent'), async (req, res) => {
  try {
    res.json({ success: true, children: await listChildren(req.user.id) });
  } catch (err) {
    console.error('[parent] children', err);
    res.status(500).json({ success: false, message: 'Məlumat yüklənmədi' });
  }
});

router.get('/children/:studentId/results', authenticate, authorize('parent'), async (req, res) => {
  try {
    const studentId = String(req.params.studentId || '').trim();
    if (!(await isLinkedChild(req.user.id, studentId))) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Övlad tapılmadı' });
    }
    const sidHex = studentId.toLowerCase().replace(/-/g, '');
    const { rows: examRows } = await db.query(
      `SELECT DISTINCT ON (e.id)
              e.id, e.title, e.show_results, e.result_visibility_mode, e.results_release_at, e.available_until,
              EXISTS(SELECT 1 FROM exam_bank_settings bs WHERE bs.exam_id = e.id) AS question_bank_enabled,
              er.score, er.submitted_at,
              iu.full_name AS instructor_name
       FROM exam_results er
       JOIN exams e ON e.id = er.exam_id AND COALESCE(e.is_deleted, FALSE) = FALSE
       LEFT JOIN users iu ON iu.id = e.instructor_id
       WHERE REPLACE(LOWER(TRIM(er.student_id::text)), '-', '') = $1
         AND er.submitted_at IS NOT NULL
       ORDER BY e.id, er.submitted_at DESC`,
      [sidHex],
    );
    const { applyResultVisibilityToStudentList } = require('../controllers/examController');
    const visible = await applyResultVisibilityToStudentList(examRows, sidHex);
    const exams = visible
      .map((r) => ({
        exam_id: r.id,
        title: r.title,
        instructor_name: r.instructor_name || null,
        submitted_at: r.submitted_at,
        score: r.score == null ? null : Number(r.score),
        released: r.result_visibility?.released !== false,
        release_at: r.result_visibility?.release_at || null,
      }))
      .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

    const { rows: taskRows } = await db.query(
      `SELECT t.id AS assignment_id, t.title, t.due_date, t.max_score,
              a.status, a.score, a.submitted_at, a.reviewed_at,
              iu.full_name AS instructor_name
       FROM student_assignments a
       JOIN assignments t ON t.id = a.assignment_id
       LEFT JOIN users iu ON iu.id = t.instructor_id
       WHERE a.student_id = $1
       ORDER BY COALESCE(a.submitted_at, t.created_at) DESC
       LIMIT 200`,
      [studentId],
    );
    const assignments = taskRows.map((r) => ({
      assignment_id: r.assignment_id,
      title: r.title,
      instructor_name: r.instructor_name || null,
      due_date: r.due_date,
      status: r.status,
      // Teacher score is shown only after review.
      score: r.reviewed_at && r.score != null ? Number(r.score) : null,
      max_score: r.max_score == null ? null : Number(r.max_score),
      submitted_at: r.submitted_at,
      reviewed_at: r.reviewed_at,
    }));

    res.json({ success: true, student_id: studentId, exams, assignments });
  } catch (err) {
    console.error('[parent] results', err);
    res.status(500).json({ success: false, message: 'Nəticələr yüklənmədi' });
  }
});

module.exports = router;
module.exports.isLinkedChild = isLinkedChild;
