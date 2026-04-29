BEGIN;

-- Some legacy enrollments ended up with NULL/empty billing_type after monthly→pack changes.
-- This breaks all pack counters (lesson_limit/calendar) on student payments page.
UPDATE enrollments
SET billing_type = '8_lessons'
WHERE billing_type IS NULL OR TRIM(billing_type) = '';

-- Safety: normalize cycles/counters
UPDATE enrollments
SET billing_cycle = 1
WHERE billing_cycle IS NULL OR billing_cycle < 1;

UPDATE enrollments
SET lesson_count = 0
WHERE lesson_count IS NULL OR lesson_count < 0;

COMMIT;

