BEGIN;

-- Safety: some legacy enrollments may have NULL/empty billing_type.
-- Normalize them to 8-lesson packs (monthly plan is removed).
UPDATE enrollments
SET billing_type = '8_lessons'
WHERE billing_type IS NULL OR NULLIF(TRIM(billing_type), '') IS NULL;

COMMIT;

