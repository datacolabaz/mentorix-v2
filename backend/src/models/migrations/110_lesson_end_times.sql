-- Həftəlik cədvəl: hər gün üçün bitmə saatı (əvvəl avtomatik +60 dəq idi)

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS lesson_end_times JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE instructor_groups
  ADD COLUMN IF NOT EXISTS default_lesson_end_times JSONB NOT NULL DEFAULT '{}'::jsonb;
