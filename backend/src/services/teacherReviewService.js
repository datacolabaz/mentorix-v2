const db = require('../utils/db');

function parseRating(raw) {
  const n = parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return n;
}

function parseReviewText(raw) {
  const t = String(raw || '').trim();
  if (t.length < 10) return null;
  if (t.length > 2000) return t.slice(0, 2000);
  return t;
}

/** Təsdiqlənmiş CRM tələbə + bu müəllimlə real əlaqə (qrup və ya ödəniş) */
async function canStudentReviewInstructor(studentId, instructorId, client = null) {
  if (!studentId || !instructorId) {
    return { allowed: false, reason: 'INVALID' };
  }
  const conn = client?.query ? client : db;

  const { rows: users } = await conn.query(
    `SELECT id, role, COALESCE(is_verified, FALSE) AS is_verified
     FROM users
     WHERE id = $1::uuid AND deleted_at IS NULL
     LIMIT 1`,
    [studentId],
  );
  const u = users[0];
  if (!u || u.role !== 'student') {
    return { allowed: false, reason: 'NOT_STUDENT' };
  }
  if (!u.is_verified) {
    return { allowed: false, reason: 'NOT_VERIFIED' };
  }

  const { rows: eligible } = await conn.query(
    `SELECT 1
     WHERE EXISTS (
       SELECT 1
       FROM enrollments e
       JOIN instructor_groups ig ON ig.id = e.group_id
       WHERE e.student_id = $1::uuid
         AND e.instructor_id = $2::uuid
         AND e.deleted_at IS NULL
         AND e.group_id IS NOT NULL
         AND COALESCE(ig.is_system, FALSE) = FALSE
         AND COALESCE(LOWER(TRIM(e.enrollment_source)), 'manual') NOT IN ('exam', 'task')
         AND COALESCE(LOWER(TRIM(e.status)), '') NOT IN ('rejected', 'pending_setup', 'pending_approval')
     )
     OR EXISTS (
       SELECT 1
       FROM payments p
       INNER JOIN enrollments e ON e.id = p.enrollment_id
       WHERE e.student_id = $1::uuid
         AND e.instructor_id = $2::uuid
         AND e.deleted_at IS NULL
         AND p.status = 'completed'
         AND (p.deleted_at IS NULL)
     )
     LIMIT 1`,
    [studentId, instructorId],
  );

  if (!eligible[0]) {
    return { allowed: false, reason: 'NO_ENROLLMENT_HISTORY' };
  }

  return { allowed: true, reason: null };
}

async function upsertTeacherReview({ studentId, instructorId, rating, reviewText }) {
  const gate = await canStudentReviewInstructor(studentId, instructorId);
  if (!gate.allowed) {
    const err = new Error('Yalnız təsdiqlənmiş CRM tələbələr rəy yaza bilər');
    err.statusCode = 403;
    err.code = gate.reason || 'FORBIDDEN';
    throw err;
  }

  const { rows } = await db.query(
    `INSERT INTO teacher_reviews (instructor_user_id, student_user_id, rating, review_text)
     VALUES ($1::uuid, $2::uuid, $3, $4)
     ON CONFLICT (instructor_user_id, student_user_id)
     DO UPDATE SET rating = EXCLUDED.rating,
                   review_text = EXCLUDED.review_text,
                   updated_at = NOW()
     RETURNING id, rating, review_text, created_at, updated_at`,
    [instructorId, studentId, rating, reviewText],
  );
  return rows[0];
}

async function getStudentReviewForInstructor(studentId, instructorId) {
  const { rows } = await db.query(
    `SELECT id, rating, review_text, created_at, updated_at
     FROM teacher_reviews
     WHERE instructor_user_id = $1::uuid AND student_user_id = $2::uuid
     LIMIT 1`,
    [instructorId, studentId],
  );
  return rows[0] || null;
}

async function getReviewStatsBatch(instructorIds) {
  const ids = [...new Set((instructorIds || []).map(String).filter(Boolean))];
  const out = {};
  for (const id of ids) {
    out[id] = {
      review_avg: null,
      review_count: 0,
      latest_review_snippet: null,
      latest_review_rating: null,
    };
  }
  if (!ids.length) return out;

  try {
    const { rows: agg } = await db.query(
    `SELECT instructor_user_id,
            ROUND(AVG(rating)::numeric, 1)::float8 AS review_avg,
            COUNT(*)::int AS review_count
     FROM teacher_reviews
     WHERE instructor_user_id = ANY($1::uuid[])
     GROUP BY instructor_user_id`,
    [ids],
  );
  for (const r of agg) {
    out[String(r.instructor_user_id)] = {
      ...out[String(r.instructor_user_id)],
      review_avg: r.review_avg != null ? Number(r.review_avg) : null,
      review_count: Number(r.review_count) || 0,
    };
  }

  const { rows: latest } = await db.query(
    `SELECT DISTINCT ON (tr.instructor_user_id)
            tr.instructor_user_id,
            tr.rating AS latest_review_rating,
            LEFT(TRIM(tr.review_text), 120) AS latest_review_snippet
     FROM teacher_reviews tr
     WHERE tr.instructor_user_id = ANY($1::uuid[])
     ORDER BY tr.instructor_user_id, tr.created_at DESC`,
    [ids],
  );
  for (const r of latest) {
    out[String(r.instructor_user_id)] = {
      ...out[String(r.instructor_user_id)],
      latest_review_snippet: r.latest_review_snippet || null,
      latest_review_rating: r.latest_review_rating != null ? Number(r.latest_review_rating) : null,
    };
  }

  return out;
  } catch (e) {
    if (!/teacher_reviews/i.test(String(e.message || ''))) throw e;
    return out;
  }
}

module.exports = {
  parseRating,
  parseReviewText,
  canStudentReviewInstructor,
  upsertTeacherReview,
  getStudentReviewForInstructor,
  getReviewStatsBatch,
};
