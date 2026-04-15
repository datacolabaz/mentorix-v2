-- Instructor usage precision: store bytes for precise display/percent
ALTER TABLE instructor_profiles
  ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0;

