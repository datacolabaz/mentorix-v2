-- Phase C: student_activity_log kanonik append-only hadisə jurnalıdır (yeni cədvəl yaradılmır).
-- Yalnız əlavə dəyişikliklər: nullable sütunlar, NOT VALID CHECK (cədvəl skan edilmir), IF NOT EXISTS indekslər.
-- Rollback: backend/scripts/sql/rollback/217_student_activity_log_extend.sql (əl ilə).

ALTER TABLE student_activity_log
  ADD COLUMN IF NOT EXISTS group_id UUID,
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Hadisə növləri: 212-dəki siyahının üst çoxluğu (köhnə sətirlər etibarlı qalır)
ALTER TABLE student_activity_log DROP CONSTRAINT IF EXISTS student_activity_log_event_type_check;
ALTER TABLE student_activity_log ADD CONSTRAINT student_activity_log_event_type_check CHECK (event_type IN (
  'material_assigned', 'material_opened', 'material_viewed', 'material_downloaded', 'material_file_downloaded',
  'video_started', 'video_progressed', 'video_completed',
  'file_uploaded', 'file_downloaded',
  'assignment_opened', 'assignment_started', 'assignment_submitted', 'assignment_late_submitted',
  'assignment_graded', 'assignment_returned',
  'exam_viewed', 'exam_started', 'exam_autosaved', 'exam_submitted', 'exam_expired',
  'exam_result_released', 'exam_attempt_voided',
  'reminder_sent'
)) NOT VALID;

ALTER TABLE student_activity_log DROP CONSTRAINT IF EXISTS student_activity_log_source_check;
ALTER TABLE student_activity_log ADD CONSTRAINT student_activity_log_source_check
  CHECK (source IS NULL OR source IN ('client', 'server', 'backfill')) NOT VALID;

-- Təkrar (retry / eyni anda iki sorğu) hadisə ikinci dəfə yazılmasın
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_activity_log_dedupe
  ON student_activity_log (entity_type, entity_id, student_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_activity_log_instructor
  ON student_activity_log (instructor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_activity_log_event
  ON student_activity_log (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_activity_log_group
  ON student_activity_log (group_id, created_at DESC)
  WHERE group_id IS NOT NULL;
