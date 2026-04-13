ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS billing_cycle INTEGER;

-- Backfill: use current enrollment cycle when missing
UPDATE payments p
SET billing_cycle = e.billing_cycle
FROM enrollments e
WHERE p.enrollment_id = e.id
  AND p.billing_cycle IS NULL;

