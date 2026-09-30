-- MANUAL rollback for 218_material_progress_extend.sql. Never place this file in src/models/migrations.
-- Run only after the Phase C code is reverted. Server-recorded download timestamps and view counts are lost.
BEGIN;

ALTER TABLE material_assignments DROP CONSTRAINT IF EXISTS material_assignments_view_count_check;
ALTER TABLE material_assignments
  DROP COLUMN IF EXISTS last_viewed_at,
  DROP COLUMN IF EXISTS view_count,
  DROP COLUMN IF EXISTS first_downloaded_at,
  DROP COLUMN IF EXISTS last_downloaded_at,
  DROP COLUMN IF EXISTS updated_at;

DELETE FROM schema_migrations WHERE filename = '218_material_progress_extend.sql';

COMMIT;
