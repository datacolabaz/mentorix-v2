-- instructor_profiles.user_id must be unique so persona onboarding can
-- INSERT ... ON CONFLICT (user_id) DO NOTHING safely.

DELETE FROM instructor_profiles a
USING instructor_profiles b
WHERE a.user_id IS NOT NULL
  AND a.user_id = b.user_id
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_instructor_profiles_user_id
  ON instructor_profiles (user_id);
