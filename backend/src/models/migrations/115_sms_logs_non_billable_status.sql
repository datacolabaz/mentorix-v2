-- Köhnə "sent" qeydləri: ödəniş təsdiqi / WhatsApp / provaydersiz — limitə sayılmır.
UPDATE sms_logs
SET status = 'logged'
WHERE LOWER(TRIM(status)) = 'sent'
  AND (
    COALESCE(LOWER(type), '') IN ('payment', 'payment_confirm', 'payment_receipt', 'payment_logged')
    OR (
      COALESCE(LOWER(type), '') = 'payment'
      AND message ~* 'ödəniş təsdiqləndi|odenis tesdiqlendi'
    )
    OR (
      http_status IS NULL
      AND msisdn IS NULL
      AND provider IS NULL
      AND delivered_at IS NULL
    )
  );

UPDATE sms_logs
SET status = 'whatsapp'
WHERE COALESCE(LOWER(package_type), '') = 'whatsapp'
  AND LOWER(TRIM(status)) = 'sent';
