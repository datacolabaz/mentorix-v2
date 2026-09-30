-- MANUAL rollback for 217_student_activity_log_extend.sql. Never place this file in src/models/migrations.
-- Run only after the Phase C code is reverted (the code writes the new columns and event types).
-- Rows with new event types are deleted first, otherwise the original CHECK cannot be restored.
BEGIN;

DROP INDEX IF EXISTS uq_student_activity_log_dedupe;
DROP INDEX IF EXISTS idx_student_activity_log_instructor;
DROP INDEX IF EXISTS idx_student_activity_log_event;
DROP INDEX IF EXISTS idx_student_activity_log_group;

ALTER TABLE student_activity_log DROP CONSTRAINT IF EXISTS student_activity_log_source_check;
ALTER TABLE student_activity_log DROP CONSTRAINT IF EXISTS student_activity_log_event_type_check;

DELETE FROM student_activity_log WHERE event_type NOT IN (
  'material_assigned', 'material_opened', 'material_viewed', 'material_downloaded',
  'video_started', 'video_progressed', 'video_completed',
  'assignment_opened', 'assignment_started', 'assignment_submitted', 'assignment_graded',
  'exam_started', 'exam_submitted',
  'reminder_sent'
);

ALTER TABLE student_activity_log ADD CONSTRAINT student_activity_log_event_type_check CHECK (event_type IN (
  'material_assigned', 'material_opened', 'material_viewed', 'material_downloaded',
  'video_started', 'video_progressed', 'video_completed',
  'assignment_opened', 'assignment_started', 'assignment_submitted', 'assignment_graded',
  'exam_started', 'exam_submitted',
  'reminder_sent'
));

ALTER TABLE student_activity_log
  DROP COLUMN IF EXISTS group_id,
  DROP COLUMN IF EXISTS dedupe_key,
  DROP COLUMN IF EXISTS source;

DELETE FROM schema_migrations WHERE filename = '217_student_activity_log_extend.sql';

COMMIT;
