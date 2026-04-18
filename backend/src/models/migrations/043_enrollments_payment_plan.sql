-- Aylıq: tam ödəniş vs hissəli (yalnız məlumat/hesabat; borc hələ də ankor təqvimidir)
ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS payment_plan VARCHAR(20) NOT NULL DEFAULT 'full';

COMMENT ON COLUMN enrollments.payment_plan IS 'monthly: full | partial (UI/tarixçə üçün)';
