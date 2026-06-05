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
