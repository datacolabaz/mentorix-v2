-- Phase C: material_assignments = material_student_progress (tələbə × material üzrə bir sətir, PK unikallığı təmin edir).
-- Unikal baxan = first_viewed_at IS NOT NULL; ümumi baxış = SUM(view_count).
-- Unikal yükləyən = download_count > 0; ümumi yükləmə = SUM(download_count) (yalnız server tərəfində sayılır).
-- Sabit default-lu sütun əlavə etmək PG 11+ -də cədvəli yenidən yazmır.
-- Rollback: backend/scripts/sql/rollback/218_material_progress_extend.sql (əl ilə).

ALTER TABLE material_assignments
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_downloaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_downloaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE material_assignments DROP CONSTRAINT IF EXISTS material_assignments_view_count_check;
ALTER TABLE material_assignments ADD CONSTRAINT material_assignments_view_count_check
  CHECK (view_count >= 0) NOT VALID;
