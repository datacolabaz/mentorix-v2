-- Catalog verification rejection reason (admin panel)

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS catalog_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS catalog_rejected_at TIMESTAMPTZ;
