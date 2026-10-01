-- MANUAL rollback for 220_exam_student_progress.sql. Never place this file in src/models/migrations.
-- Run only after the Phase C code is reverted.
-- exam_results rows with status 'expired' (time ran out with no answers) or 'voided' stay in place:
-- they have submitted_at IS NULL, so the old code treats them as open attempts and resets them on re-entry
-- (the pre-Phase-C behaviour). Nothing is deleted from exam_results.
BEGIN;

DROP INDEX IF EXISTS idx_exam_results_open_attempts;
DROP INDEX IF EXISTS idx_exam_results_exam_student;
DROP TABLE IF EXISTS exam_student_progress;

DELETE FROM schema_migrations WHERE filename = '220_exam_student_progress.sql';

COMMIT;
