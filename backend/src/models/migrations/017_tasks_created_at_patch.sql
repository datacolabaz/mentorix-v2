-- Some older DBs had task_assignments without created_at
ALTER TABLE task_assignments
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

