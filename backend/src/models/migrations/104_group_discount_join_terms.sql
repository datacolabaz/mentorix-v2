-- Qrup dəvəti: endirim şablonu + tələbənin ödəniş şərtlərinə razılığı

ALTER TABLE instructor_groups
  ADD COLUMN IF NOT EXISTS default_discount_percent NUMERIC(5, 2);

ALTER TABLE student_join_requests
  ADD COLUMN IF NOT EXISTS payment_terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_snapshot JSONB;
