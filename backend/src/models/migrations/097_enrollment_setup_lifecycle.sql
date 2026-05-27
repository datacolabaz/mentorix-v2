-- Tələbə join kodu ilə qoşulduqdan sonra müəllim quraşdırması (pending_setup → active)

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS configured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_due_date DATE,
  ADD COLUMN IF NOT EXISTS initial_payment_status VARCHAR(20) DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS package_history JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN enrollments.status IS 'active | pending_setup | paused | archived | left';
COMMENT ON COLUMN enrollments.initial_payment_status IS 'paid | unpaid | partial — ilk paket ödənişi';

-- Köhnə tam konfiqurasiya olunmuş qeydiyyatlar
UPDATE enrollments
SET configured_at = COALESCE(configured_at, enrolled_at, NOW())
WHERE COALESCE(LOWER(TRIM(status)), 'active') = 'active'
  AND configured_at IS NULL
  AND (
    COALESCE(jsonb_array_length(lesson_weekdays), 0) > 0
    OR EXISTS (
      SELECT 1 FROM lessons l WHERE l.enrollment_id = enrollments.id LIMIT 1
    )
  );

CREATE INDEX IF NOT EXISTS idx_enrollments_status_instructor
  ON enrollments (instructor_id, status)
  WHERE deleted_at IS NULL;
