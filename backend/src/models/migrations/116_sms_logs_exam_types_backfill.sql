-- Köhnə imtahan SMS/qeydlərinə düzgün type (UI mənbə etiketi üçün).
UPDATE sms_logs
SET type = 'exam_placed'
WHERE COALESCE(NULLIF(TRIM(type), ''), '') = ''
  AND message ~* 'imtahanı sizin üçün planlaşdırılıb';

UPDATE sms_logs
SET type = 'exam_result'
WHERE COALESCE(NULLIF(TRIM(type), ''), '') IN ('', 'system')
  AND message ~* 'imtahanında.*(bal toplay|% toplay)';

UPDATE sms_logs
SET type = 'exam_reminder'
WHERE COALESCE(NULLIF(TRIM(type), ''), '') = ''
  AND message ~* 'imtahanı.*başlayacaq';
