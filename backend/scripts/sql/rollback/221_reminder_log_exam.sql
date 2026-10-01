-- MANUAL rollback for 221_reminder_log_exam.sql. Never place this file in src/models/migrations.
-- Run only after the Phase D code is reverted: the Phase D reminder code writes these columns and exam rows.
-- Exam reminder rows must be removed before the original CHECK can be restored; export them first if needed:
--   \copy (SELECT * FROM reminder_log WHERE entity_type = 'exam') TO 'reminder_log_exam_backup.csv' CSV HEADER
BEGIN;

DELETE FROM reminder_log WHERE entity_type = 'exam';

ALTER TABLE reminder_log DROP CONSTRAINT IF EXISTS reminder_log_entity_type_check;
ALTER TABLE reminder_log ADD CONSTRAINT reminder_log_entity_type_check
  CHECK (entity_type IN ('material', 'assignment'));

ALTER TABLE reminder_log
  DROP COLUMN IF EXISTS error_code,
  DROP COLUMN IF EXISTS batch_id,
  DROP COLUMN IF EXISTS message_preview,
  DROP COLUMN IF EXISTS notification_id;

DELETE FROM schema_migrations WHERE filename = '221_reminder_log_exam.sql';

COMMIT;
