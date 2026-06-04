-- Bir dəfə OTP telefon təsdiqi vaxtı
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- Köhnə təsdiqlənmiş nömrələr üçün vaxt doldur (yalnız NULL olanlar)
UPDATE users
SET phone_verified_at = COALESCE(phone_verified_at, updated_at, created_at, NOW())
WHERE phone_verified = TRUE AND phone_verified_at IS NULL;
