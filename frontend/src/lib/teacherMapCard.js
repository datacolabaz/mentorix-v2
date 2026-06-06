export const TOP_BADGE_MIN_RATING = 4.8
export const TOP_BADGE_MIN_COMPLETED_LESSONS = 10
export const TOP_BADGE_MIN_ACTIVE_STUDENTS = 10

export function qualifiesForTopBadge(instructor) {
  const avg = Number(instructor?.review_avg)
  const reviewCount = Number(instructor?.review_count) || 0
  if (reviewCount <= 0 || !Number.isFinite(avg) || avg < TOP_BADGE_MIN_RATING) return false
  const lessons = Number(instructor?.completed_lessons_count) || 0
  const students = Number(instructor?.active_student_count) || 0
  return (
    lessons >= TOP_BADGE_MIN_COMPLETED_LESSONS || students >= TOP_BADGE_MIN_ACTIVE_STUDENTS
  )
}

export function showTopBadge(instructor) {
  if (instructor?.show_top_badge != null) return Boolean(instructor.show_top_badge)
  return qualifiesForTopBadge(instructor)
}

export function hasTeacherReviews(instructor) {
  const count = Number(instructor?.review_count) || 0
  const avg = Number(instructor?.review_avg)
  return count > 0 && Number.isFinite(avg) && avg > 0
}

export function formatReviewAvg(avg) {
  const n = Number(avg)
  if (!Number.isFinite(n) || n <= 0) return null
  return n.toFixed(1)
}

export function formatReviewCount(count) {
  const n = Number(count) || 0
  if (n <= 0) return null
  return `${n} rəy`
}

export function formatStudentCount(count) {
  const n = Number(count) || 0
  if (n <= 0) return null
  if (n >= 100) return '100+ aktiv tələbə'
  return `${n} aktiv tələbə`
}

export function deliveryFormatBadges(instructor) {
  const labels = Array.isArray(instructor?.format_labels)
    ? instructor.format_labels
    : Array.isArray(instructor?.delivery_formats)
      ? instructor.delivery_formats.map((f) => f.label || f.format).filter(Boolean)
      : []
  return [...new Set(labels.map(String))].filter(Boolean)
}

export function ratingStarsLine(instructor) {
  const avg = formatReviewAvg(instructor?.review_avg)
  const count = formatReviewCount(instructor?.review_count)
  if (!avg && !count) return null
  if (avg && count) return `⭐ ${avg} (${count})`
  if (avg) return `⭐ ${avg}`
  return count
}

/** Tez baxış kartı: fənn altında qızıl ulduz sətri */
export function teacherRatingParts(instructor) {
  const avg = formatReviewAvg(instructor?.review_avg)
  const count = Number(instructor?.review_count) || 0
  if (avg && count > 0) {
    return { avg, count, label: `${avg} (${count} rəy)` }
  }
  if (avg) {
    return { avg, count: 0, label: avg }
  }
  return null
}
