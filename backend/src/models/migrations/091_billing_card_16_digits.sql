-- Bank kartı: 16 rəqəm (əvvəlki 12 rəqəmli placeholder köçürmələri yeniləmir — admin paneldə daxil edin)

BEGIN;

UPDATE billing_settings
SET value = '0000000000000000', updated_at = NOW()
WHERE key = 'manual_transfer_account' AND length(regexp_replace(value, '\D', '', 'g')) < 16;

COMMIT;
