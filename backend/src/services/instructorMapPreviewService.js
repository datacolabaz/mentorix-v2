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

async function getAddressBatch(instructorIds) {
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

  const [reviewStats, formats, studentCounts, nextSlots, addresses] = await Promise.all([
    getReviewStatsBatch(ids),
    getDeliveryFormatsBatch(ids),
    getActiveStudentCountsBatch(ids),
    getNextSlotBatch(ids),
    getAddressBatch(ids),
  ]);

  return rows.map((row) => {
    const id = String(row.id);
    const stats = reviewStats[id] || {};
    const base = enrichInstructorListingRow(row);
    const delivery_formats = formats[id] || [];
    return {
      ...base,
      delivery_formats,
      format_labels: delivery_formats.map((f) => f.label),
      teacher_place_address_short: addresses[id] || null,
      next_available_slot: nextSlots[id] || null,
      active_student_count: studentCounts[id] || 0,
      review_avg: stats.review_avg ?? null,
      review_count: stats.review_count ?? 0,
      latest_review_snippet: stats.latest_review_snippet ?? null,
      latest_review_rating: stats.latest_review_rating ?? null,
    };
  });
}

module.exports = {
  enrichMapInstructorRows,
  FORMAT_LABELS,
};
