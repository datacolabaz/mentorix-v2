/**
 * Müəllim gəlir statistikası — silinmiş tələbələrin nağd ödənişləri də daxil (illik/aylıq hesabat).
 * Yalnız müəllimin ödənişi silməsi (payments.deleted_at) və balans düzəlişi xaric edilir.
 */
const SQL_EXCLUDE_BALANCE_ADJUSTMENT =
  "AND (p.notes IS NULL OR TRIM(p.notes) NOT LIKE '[Balans düzəlişi]%')";

/** $1 = instructor norm uuid (no dashes, lower) */
const SQL_INSTRUCTOR_REVENUE_FROM = `
  FROM payments p
  INNER JOIN enrollments e ON e.id = p.enrollment_id
  WHERE REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1
    AND p.status = 'completed'
    AND (p.deleted_at IS NULL)
    ${SQL_EXCLUDE_BALANCE_ADJUSTMENT}`;

module.exports = {
  SQL_EXCLUDE_BALANCE_ADJUSTMENT,
  SQL_INSTRUCTOR_REVENUE_FROM,
};
