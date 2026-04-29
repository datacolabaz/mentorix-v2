BEGIN;

-- After converting monthly -> 8_lessons, preserve the original start date where available.
-- If student_profiles.payment_start_date exists and enrollment_start_date is missing or later, use it.
UPDATE enrollments e
SET enrollment_start_date = sp.payment_start_date::date
FROM student_profiles sp
WHERE sp.user_id = e.student_id
  AND e.billing_type = '8_lessons'
  AND sp.payment_start_date IS NOT NULL
  AND (
    e.enrollment_start_date IS NULL
    OR e.enrollment_start_date::date > sp.payment_start_date::date
  );

COMMIT;

