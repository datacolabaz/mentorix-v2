INSERT INTO billing_settings (key, value, updated_at)
VALUES ('public_whatsapp_msisdn', '994553775770', NOW())
ON CONFLICT (key) DO NOTHING;
