BEGIN;

-- Normalize package start dates after removing monthly billing.
-- Some legacy anchors (payment_start_date / enrollment_start_date) may point far into the future (wrong year).
-- For 8/12 lesson packs, start date should be near the actual enrollment creation time.
UPDATE enrollments e
SET enrollment_start_date = to_char((e.enrolled_at AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD')::date
WHERE e.billing_type IN ('8_lessons', '12_lessons')
  AND (
    e.enrollment_start_date IS NULL
    OR e.enrollment_start_date::date >
      ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date + INTERVAL '45 days')::date
  );

COMMIT;

