-- Əlavə yaddaş paketləri (SMS top-up ilə eyni axın)

BEGIN;

ALTER TABLE usage_counters
  ADD COLUMN IF NOT EXISTS extra_storage_bytes BIGINT NOT NULL DEFAULT 0;

ALTER TABLE billing_payments
  ADD COLUMN IF NOT EXISTS storage_mb INTEGER;

INSERT INTO billing_settings (key, value)
VALUES
  (
    'storage_packs',
    '[{"quantity_mb":5,"price_azn":5,"label":"+5 MB yaddaş"},{"quantity_mb":10,"price_azn":9,"label":"+10 MB yaddaş"},{"quantity_mb":20,"price_azn":16,"label":"+20 MB yaddaş"}]'
  )
ON CONFLICT (key) DO NOTHING;

COMMIT;
