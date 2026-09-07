-- Use-case persona (how the account uses Mentorix) is separate from users.role
-- (authorization). Existing role-selected accounts are treated as already onboarded.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS persona VARCHAR(40),
  ADD COLUMN IF NOT EXISTS persona_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users
SET
  persona = CASE role
    WHEN 'instructor' THEN 'teacher'
    WHEN 'course' THEN 'education_center'
    WHEN 'student' THEN 'student'
    WHEN 'parent' THEN 'parent'
    ELSE persona
  END,
  onboarding_completed = TRUE
WHERE COALESCE(role_selected, TRUE) = TRUE
  AND role IN ('instructor', 'student', 'parent', 'course', 'admin')
  AND onboarding_completed = FALSE;

UPDATE users
SET onboarding_completed = TRUE
WHERE role = 'admin'
  AND onboarding_completed = FALSE;

CREATE INDEX IF NOT EXISTS idx_users_onboarding_pending
  ON users (id)
  WHERE onboarding_completed = FALSE;

COMMENT ON COLUMN users.persona IS 'Use-case persona: teacher, education_center, student, parent, hr_company, other';
COMMENT ON COLUMN users.persona_profile IS 'Per-persona onboarding answers; keyed by persona so later switches do not wipe history';
COMMENT ON COLUMN users.onboarding_completed IS 'Account cannot use a dashboard until persona onboarding is finished';
