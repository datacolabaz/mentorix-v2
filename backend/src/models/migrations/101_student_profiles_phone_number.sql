-- Tələbə əlaqə telefonu (SMS / WhatsApp). Railway SQL editor: hər blok ayrıca da işləyir; BEGIN/COMMIT lazım deyil.

ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

UPDATE student_profiles sp
SET phone_number = u.phone
FROM users u
WHERE u.id = sp.user_id
  AND u.phone IS NOT NULL
  AND trim(COALESCE(u.phone::text, '')) <> ''
  AND (sp.phone_number IS NULL OR trim(COALESCE(sp.phone_number::text, '')) = '');

INSERT INTO student_profiles (user_id, phone_number)
SELECT u.id, u.phone
FROM users u
WHERE u.role = 'student'
  AND u.is_active = TRUE
  AND u.phone IS NOT NULL
  AND trim(COALESCE(u.phone::text, '')) <> ''
  AND NOT EXISTS (SELECT 1 FROM student_profiles sp WHERE sp.user_id = u.id);

CREATE INDEX IF NOT EXISTS student_profiles_phone_number_idx
  ON student_profiles (phone_number)
  WHERE phone_number IS NOT NULL AND trim(phone_number::text) <> '';
