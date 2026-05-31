-- Əlavə yaddaş: GB paketləri (lokal bazar, aylıq)

BEGIN;

INSERT INTO billing_settings (key, value, updated_at)
VALUES (
  'storage_packs',
  '[
    {"quantity_gb":1,"quantity_mb":1024,"price_azn":2,"label":"+1 GB Sənəd Yaddaşı","billing_period":"monthly"},
    {"quantity_gb":5,"quantity_mb":5120,"price_azn":6,"label":"+5 GB Sənəd Yaddaşı","billing_period":"monthly"},
    {"quantity_gb":15,"quantity_mb":15360,"price_azn":14,"label":"+15 GB Sənəd Yaddaşı","billing_period":"monthly"}
  ]',
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

COMMIT;
