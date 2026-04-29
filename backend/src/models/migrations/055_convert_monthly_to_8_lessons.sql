BEGIN;

-- Convert deprecated monthly billing to 8-lesson packs.
-- Safety: keep historical payments/attendance; just switch the billing model.
UPDATE enrollments
SET billing_type = '8_lessons',
    billing_cycle = COALESCE(NULLIF(billing_cycle, 0), 1),
    lesson_count = 0
WHERE billing_type = 'monthly';

-- Monthly attendance slots become irrelevant after the switch; keep rows for history but archive them.
UPDATE monthly_attendance_slots s
SET status = 'archived',
    updated_at = NOW()
FROM enrollments e
WHERE s.enrollment_id = e.id
  AND e.billing_type = '8_lessons'
  AND s.status IN ('pending','attended','absent');

COMMIT;

