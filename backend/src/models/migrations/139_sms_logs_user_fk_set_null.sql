-- sms_logs.user FK-ləri user silinəndə bloklamasın; tarixçə saxlanılsın.

ALTER TABLE sms_logs DROP CONSTRAINT IF EXISTS sms_logs_student_id_fkey;
ALTER TABLE sms_logs
  ADD CONSTRAINT sms_logs_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE sms_logs DROP CONSTRAINT IF EXISTS sms_logs_instructor_id_fkey;
ALTER TABLE sms_logs
  ADD CONSTRAINT sms_logs_instructor_id_fkey
  FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE SET NULL;
