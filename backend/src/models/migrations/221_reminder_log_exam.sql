-- Phase D: əl ilə göndərilən xatırlatmalar imtahanlara da şamil olunur (audit planı §10.8, slot 221).
-- Yalnız əlavə dəyişikliklər: nullable sütunlar (cədvəl yenidən yazılmır), NOT VALID CHECK (skan yoxdur).
-- Fayl yenidən işlədilə bilər. BEGIN/COMMIT yoxdur: runner özü tranzaksiyaya salır.
-- Rollback: backend/scripts/sql/rollback/221_reminder_log_exam.sql (əl ilə).

ALTER TABLE reminder_log
  ADD COLUMN IF NOT EXISTS notification_id UUID,
  ADD COLUMN IF NOT EXISTS message_preview TEXT,
  ADD COLUMN IF NOT EXISTS batch_id UUID,
  ADD COLUMN IF NOT EXISTS error_code TEXT;

ALTER TABLE reminder_log DROP CONSTRAINT IF EXISTS reminder_log_entity_type_check;
ALTER TABLE reminder_log ADD CONSTRAINT reminder_log_entity_type_check
  CHECK (entity_type IN ('material', 'assignment', 'exam')) NOT VALID;
