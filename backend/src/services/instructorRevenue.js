/**
 * Müəllim gəlir statistikası:
 * - Silinmiş tələbənin silinməyə QƏDƏR ödənişləri sayılır (illik/aylıq hesabat).
 * - Silindikdən sonra həmin tələbə üçün yeni ödəniş əlavə olunmur (enrollmentGuards).
 */
const SQL_EXCLUDE_BALANCE_ADJUSTMENT =
  "AND (p.notes IS NULL OR TRIM(p.notes) NOT LIKE '[Balans düzəlişi]%')";

/** Silinmə tarixindən sonrakı ödənişlər (əgər səhvən yazılsa) gəlirə daxil deyil */
const SQL_REVENUE_ONLY_UNTIL_ENROLLMENT_DELETED = `
    AND (
      e.deleted_at IS NULL
      OR COALESCE(
        p.payment_date::date,
        (p.paid_at AT TIME ZONE 'Asia/Baku')::date
      ) <= (e.deleted_at AT TIME ZONE 'Asia/Baku')::date
    )`;

/** $1 = instructor norm uuid (no dashes, lower) */
const SQL_INSTRUCTOR_REVENUE_FROM = `
  FROM payments p
  INNER JOIN enrollments e ON e.id = p.enrollment_id
  WHERE REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1
    AND p.status = 'completed'
    AND (p.deleted_at IS NULL)
    ${SQL_EXCLUDE_BALANCE_ADJUSTMENT}
    ${SQL_REVENUE_ONLY_UNTIL_ENROLLMENT_DELETED}`;

module.exports = {
  SQL_EXCLUDE_BALANCE_ADJUSTMENT,
  SQL_REVENUE_ONLY_UNTIL_ENROLLMENT_DELETED,
  SQL_INSTRUCTOR_REVENUE_FROM,
};
