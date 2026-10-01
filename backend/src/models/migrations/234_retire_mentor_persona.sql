-- Retire the standalone "mentor" persona / mentorship workspace. Product roles are only
-- Təlimçi (users.role = 'instructor'), Tələbə, Valideyn, Admin. users.role never held 'mentor';
-- the mentor persona already authorised as 'instructor', so access, subscriptions, students,
-- exams, results, certificates and storage are untouched (they key off users.id / role).
--
-- Additive + idempotent: re-running changes nothing. Nothing is dropped:
--   * legacy_mentor_persona_backup keeps every touched users.persona / persona_profile (rollback source);
--   * programs.source_type CHECK becomes a superset ('mentor' stays allowed, deprecated);
--   * mentorship_* tables keep their data (feature removed from product, tables marked LEGACY);
--   * the retired feature flag row stays (forced off) together with its audit history.
-- Rollback (manual): backend/scripts/sql/rollback/234_retire_mentor_persona.rollback.sql

SET LOCAL lock_timeout = '10s';

-- 1) Backup of every row the persona rewrite touches (first run wins; re-runs keep the original values).
CREATE TABLE IF NOT EXISTS legacy_mentor_persona_backup (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  persona VARCHAR(40),
  persona_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE legacy_mentor_persona_backup IS
  'LEGACY: pre-migration-234 persona values of users whose persona was mentor. Rollback source; safe to drop after sign-off.';

INSERT INTO legacy_mentor_persona_backup (user_id, persona, persona_profile)
SELECT u.id, u.persona, COALESCE(u.persona_profile, '{}'::jsonb)
FROM users u
WHERE u.persona = 'mentor'
   OR COALESCE(u.persona_profile, '{}'::jsonb) ? 'mentor'
   OR COALESCE(u.persona_profile, '{}'::jsonb) ->> 'current' = 'mentor'
ON CONFLICT (user_id) DO NOTHING;

-- 2) mentor persona -> teacher (Təlimçi). Auth role is already 'instructor'; make sure it stays granted.
UPDATE users SET persona = 'teacher' WHERE persona = 'mentor';

UPDATE users
SET persona_profile = CASE
    WHEN persona_profile ->> 'current' = 'mentor'
      THEN jsonb_set(persona_profile - 'mentor', '{current}', '"teacher"'::jsonb)
    ELSE persona_profile - 'mentor'
  END
WHERE persona_profile ? 'mentor' OR persona_profile ->> 'current' = 'mentor';

DO $$
BEGIN
  IF to_regclass('public.user_roles') IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role)
    SELECT b.user_id, 'instructor'
    FROM legacy_mentor_persona_backup b
    JOIN users u ON u.id = b.user_id AND u.role = 'instructor'
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

COMMENT ON COLUMN users.persona IS
  'Use-case persona: teacher, education_center, student, parent, hr_company, partner, other (mentor retired in 234 -> teacher)';

-- 3) University programme contributions: 'mentor' source -> 'instructor' (Təlimçi).
DO $$
DECLARE
  c record;
BEGIN
  IF to_regclass('public.programs') IS NULL THEN
    RETURN;
  END IF;
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.programs'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%source_type%'
      AND con.conname <> 'programs_source_type_chk'
  LOOP
    EXECUTE format('ALTER TABLE programs DROP CONSTRAINT %I', c.conname);
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.programs'::regclass AND conname = 'programs_source_type_chk'
  ) THEN
    -- 'mentor' stays allowed (deprecated) so a rollback / old writer never fails mid-deploy.
    ALTER TABLE programs ADD CONSTRAINT programs_source_type_chk
      CHECK (source_type IN ('seed', 'scraper', 'instructor', 'admin', 'mentor'));
  END IF;

  UPDATE programs SET source_type = 'instructor' WHERE source_type = 'mentor';
  UPDATE programs SET portal_source = 'instructor' WHERE portal_source = 'mentor';
  UPDATE programs
  SET ai_raw_json = (ai_raw_json - 'mentor_notes')
      || jsonb_build_object('contributor_notes', ai_raw_json -> 'mentor_notes')
  WHERE ai_raw_json ? 'mentor_notes';

  COMMENT ON COLUMN programs.mentor_display_name IS
    'LEGACY column name: contributor (Təlimçi) display name. API exposes it as contributor_display_name.';
END $$;

-- 4) Retired feature flag: forced off (audit row only if it was on). Row + history kept.
DO $$
DECLARE
  was_enabled BOOLEAN;
BEGIN
  IF to_regclass('public.platform_feature_flags') IS NULL THEN
    RETURN;
  END IF;
  SELECT enabled INTO was_enabled
  FROM platform_feature_flags WHERE key = 'feature.mentor_services.enabled' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  UPDATE platform_feature_flags
  SET enabled = FALSE,
      description = 'RETIRED (migration 234): legacy module removed from the product',
      updated_at = CASE WHEN was_enabled THEN NOW() ELSE updated_at END
  WHERE key = 'feature.mentor_services.enabled'
    AND (enabled IS DISTINCT FROM FALSE OR description IS DISTINCT FROM 'RETIRED (migration 234): legacy module removed from the product');
  IF was_enabled AND to_regclass('public.platform_feature_flag_audit') IS NOT NULL THEN
    INSERT INTO platform_feature_flag_audit (flag_key, old_enabled, new_enabled, changed_by, ip, user_agent)
    VALUES ('feature.mentor_services.enabled', TRUE, FALSE, NULL, NULL, 'migration 234_retire_mentor_persona');
  END IF;
END $$;

-- 5) Mentorship workspace tables: data kept, no API reads or writes them any more.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'mentorship_goals', 'mentorship_milestones', 'mentorship_sessions', 'mentorship_actions',
    'mentorship_services', 'mentorship_resources', 'mentorship_agreements', 'mentorship_feedback_requests'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format(
        'COMMENT ON TABLE %I IS %L', t,
        'LEGACY (retired in migration 234): historical data only; feature removed from the product. Drop only after owner sign-off.'
      );
    END IF;
  END LOOP;
END $$;
