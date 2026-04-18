-- Aylıq faktura dövrü (ankor tarixi YYYY-MM-DD); köhnə bazalarda sütun olmaya bilər
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS period VARCHAR(50);
