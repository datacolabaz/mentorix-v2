-- MANUAL ONLY. Revert question-bank API/UI first and export its data if already used.
-- DESTRUCTIVE to the new module's data/blobs. Legacy exams/results/materials/subjects are retained.
-- Never put this file in src/models/migrations; never run automatically.
BEGIN;
DROP TABLE IF EXISTS exam_answer_files;
DROP TABLE IF EXISTS exam_answers;
DROP TABLE IF EXISTS exam_attempt_details;
DROP TABLE IF EXISTS exam_bank_questions;
DROP TABLE IF EXISTS exam_bank_settings;
DROP TABLE IF EXISTS question_bank_items;
DROP TABLE IF EXISTS question_options;
DROP TABLE IF EXISTS bank_questions;
DROP TABLE IF EXISTS question_banks;
DROP TRIGGER IF EXISTS qb_material_pdf_type ON course_materials;
DROP TABLE IF EXISTS source_pdfs;
DROP TABLE IF EXISTS question_bank_topics;
DROP FUNCTION IF EXISTS qb_guard_answer_file();
DROP FUNCTION IF EXISTS qb_guard_answer_grade();
DROP FUNCTION IF EXISTS qb_guard_attempt_order();
DROP FUNCTION IF EXISTS qb_guard_material_pdf();
DROP FUNCTION IF EXISTS qb_guard_pdf();
DROP FUNCTION IF EXISTS qb_guard_topic_cycle();
DROP FUNCTION IF EXISTS qb_touch_updated_at();
DROP INDEX IF EXISTS qb_attempt_identity_key;
DROP INDEX IF EXISTS qb_exam_question_key;
DROP INDEX IF EXISTS qb_exam_owner_key;
DROP INDEX IF EXISTS qb_material_owner_key;
DROP INDEX IF EXISTS qb_subject_owner_key;
DELETE FROM schema_migrations WHERE filename = '236_question_bank_foundation.sql';
COMMIT;
