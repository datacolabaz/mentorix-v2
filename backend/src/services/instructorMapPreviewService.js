const db = require('../utils/db');
const { enrichInstructorListingRow } = require('./mapListingPlanService');
const { getReviewStatsBatch } = require('./teacherReviewService');
const { computeNextLessonSlot, shortAddress } = require('../utils/nextLessonSlot');

const FORMAT_LABELS = {
  online: 'Onlayn',
  teacher_place: 'Əyani',
  student_place: 'Tələbənin yanında',
};

async function getDeliveryFormatsBatch(instructorIds) {
  const ids = [...new Set((instructorIds || []).map(String).filter(Boolean))];
  const out = {};
  for (const id of ids) out[id] = [];
  if (!ids.length) return out;

  const { rows } = await db.query(
    `SELECT user_id, format
     FROM instructor_delivery_formats
     WHERE user_id = ANY($1::uuid[])
     ORDER BY user_id, format`,
    [ids],
  );
  for (const r of rows) {
    const key = String(r.user_id);
    if (!out[key]) out[key] = [];
    out[key].push({
      format: r.format,
      label: FORMAT_LABELS[r.format] || r.format,
    });
  }
  return out;
}

async function getActiveStudentCountsBatch(instructorIds) {
  const ids = [...new Set((instructorIds || []).map(String).filter(Boolean))];
  const out = {};
  for (const id of ids) out[id] = 0;
  if (!ids.length) return out;

  const { rows } = await db.query(
    `SELECT e.instructor_id, COUNT(DISTINCT e.student_id)::int AS n
     FROM enrollments e
     JOIN instructor_groups ig ON ig.id = e.group_id
     JOIN users su ON su.id = e.student_id AND su.deleted_at IS NULL AND su.role = 'student'
     WHERE e.instructor_id = ANY($1::uuid[])
       AND e.deleted_at IS NULL
       AND e.group_id IS NOT NULL
       AND COALESCE(ig.is_system, FALSE) = FALSE
       AND COALESCE(LOWER(TRIM(e.status)), 'active') = 'active'
     GROUP BY e.instructor_id`,
    [ids],
  );
  for (const r of rows) {
    out[String(r.instructor_id)] = Number(r.n) || 0;
  }
  return out;
}

async function getNextSlotBatch(instructorIds) {
  const ids = [...new Set((instructorIds || []).map(String).filter(Boolean))];
  const out = {};
  for (const id of ids) out[id] = null;
  if (!ids.length) return out;

  const { rows } = await db.query(
    `SELECT DISTINCT ON (ig.instructor_id)
            ig.instructor_id,
            ig.default_lesson_weekdays,
            ig.default_lesson_times
     FROM instructor_groups ig
     WHERE ig.instructor_id = ANY($1::uuid[])
       AND COALESCE(ig.is_system, FALSE) = FALSE
       AND ig.default_lesson_weekdays IS NOT NULL
     ORDER BY ig.instructor_id, ig.sort_order ASC NULLS LAST, ig.name ASC`,
    [ids],
  );
  for (const r of rows) {
    const slot = computeNextLessonSlot(r.default_lesson_weekdays, r.default_lesson_times);
    out[String(r.instructor_id)] = slot?.label || null;
  }
  return out;
}

const TOP_BADGE_MIN_RATING = 4.8;
const TOP_BADGE_MIN_COMPLETED_LESSONS = 10;
const TOP_BADGE_MIN_ACTIVE_STUDENTS = 10;

function qualifiesForTopBadge({
  review_avg,
  review_count,
  completed_lessons_count,
  active_student_count,
}) {
  const avg = Number(review_avg);
  const reviewCount = Number(review_count) || 0;
  if (reviewCount <= 0 || !Number.isFinite(avg) || avg < TOP_BADGE_MIN_RATING) {
    return false;
  }
  const lessons = Number(completed_lessons_count) || 0;
  const students = Number(active_student_count) || 0;
  return (
    lessons >= TOP_BADGE_MIN_COMPLETED_LESSONS || students >= TOP_BADGE_MIN_ACTIVE_STUDENTS
  );
}

async function getCompletedLessonsCountBatch(instructorIds) {
  const ids = [...new Set((instructorIds || []).map(String).filter(Boolean))];
  const out = {};
  for (const id of ids) out[id] = 0;
  if (!ids.length) return out;

  try {
    const { rows } = await db.query(
      `SELECT e.instructor_id, COUNT(*)::int AS n
       FROM lessons l
       INNER JOIN enrollments e ON e.id = l.enrollment_id
       LEFT JOIN instructor_groups ig ON ig.id = e.group_id
       WHERE e.instructor_id = ANY($1::uuid[])
         AND e.deleted_at IS NULL
         AND COALESCE(ig.is_system, FALSE) = FALSE
         AND l.lesson_date <= NOW()
       GROUP BY e.instructor_id`,
      [ids],
    );
    for (const r of rows) {
      out[String(r.instructor_id)] = Number(r.n) || 0;
    }
  } catch {
    /* lessons cədvəli yoxdursa */
  }
  return out;
}

  const ids = [...new Set((instructorIds || []).map(String).filter(Boolean))];
  const out = {};
  for (const id of ids) out[id] = null;
  if (!ids.length) return out;

  const { rows } = await db.query(
    `SELECT user_id, teacher_place_address
     FROM instructor_profiles
     WHERE user_id = ANY($1::uuid[])`,
    [ids],
  );
  for (const r of rows) {
    out[String(r.user_id)] = shortAddress(r.teacher_place_address);
  }
  return out;
}

async function enrichMapInstructorRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const ids = rows.map((r) => r.id);

  const [reviewStats, formats, studentCounts, nextSlots, addresses, completedLessons] =
    await Promise.all([
    getReviewStatsBatch(ids),
    getDeliveryFormatsBatch(ids),
    getActiveStudentCountsBatch(ids),
    getNextSlotBatch(ids),
    getAddressBatch(ids),
    getCompletedLessonsCountBatch(ids),
  ]);

  return rows.map((row) => {
    const id = String(row.id);
    const stats = reviewStats[id] || {};
    const base = enrichInstructorListingRow(row);
    const delivery_formats = formats[id] || [];
    const active_student_count = studentCounts[id] || 0;
    const completed_lessons_count = completedLessons[id] || 0;
    const review_avg = stats.review_avg ?? null;
    const review_count = stats.review_count ?? 0;
    const show_top_badge = qualifiesForTopBadge({
      review_avg,
      review_count,
      completed_lessons_count,
      active_student_count,
    });
    return {
      ...base,
      delivery_formats,
      format_labels: delivery_formats.map((f) => f.label),
      teacher_place_address_short: addresses[id] || null,
      next_available_slot: nextSlots[id] || null,
      active_student_count,
      completed_lessons_count,
      review_avg,
      review_count,
      latest_review_snippet: stats.latest_review_snippet ?? null,
      latest_review_rating: stats.latest_review_rating ?? null,
      show_top_badge,
      is_top_listing: show_top_badge,
    };
  });
}

module.exports = {
  enrichMapInstructorRows,
  FORMAT_LABELS,
  qualifiesForTopBadge,
  TOP_BADGE_MIN_RATING,
  TOP_BADGE_MIN_COMPLETED_LESSONS,
  TOP_BADGE_MIN_ACTIVE_STUDENTS,
};
