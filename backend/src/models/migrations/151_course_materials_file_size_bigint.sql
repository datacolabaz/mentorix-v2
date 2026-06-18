-- file_size: BIGINT + 26 MiB tavan (tətbiq 25 MiB tətbiq edir; sərhəd faylları üçün buffer)

BEGIN;

ALTER TABLE course_materials
  DROP CONSTRAINT IF EXISTS course_materials_file_size_check;

ALTER TABLE course_materials
  ALTER COLUMN file_size TYPE BIGINT USING file_size::bigint;

ALTER TABLE course_materials
  ADD CONSTRAINT course_materials_file_size_check
  CHECK (file_size > 0 AND file_size <= 27262976);

ALTER TABLE course_material_blobs
  ALTER COLUMN byte_size TYPE BIGINT USING byte_size::bigint;

COMMIT;
