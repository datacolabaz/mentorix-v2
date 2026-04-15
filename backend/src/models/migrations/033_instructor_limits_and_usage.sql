-- Instructor limits/usage: add RAM usage + last sync timestamp
ALTER TABLE instructor_profiles
  ADD COLUMN IF NOT EXISTS ram_used_mb INTEGER DEFAULT 0;

ALTER TABLE instructor_profiles
  ADD COLUMN IF NOT EXISTS usage_synced_at TIMESTAMPTZ;