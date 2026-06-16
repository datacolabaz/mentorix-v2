-- Müəllim paneli və landing-də görünən paket adları (admin: subscription_plans.title).

BEGIN;

UPDATE subscription_plans SET title = 'SADƏ', updated_at = NOW() WHERE slug = 'basic';
UPDATE subscription_plans SET title = 'STANDART', updated_at = NOW() WHERE slug = 'pro';
UPDATE subscription_plans SET title = 'PROFESSİONAL', updated_at = NOW() WHERE slug = 'growth';
UPDATE subscription_plans SET title = 'PREMİUM', updated_at = NOW() WHERE slug = 'premium';

COMMIT;
