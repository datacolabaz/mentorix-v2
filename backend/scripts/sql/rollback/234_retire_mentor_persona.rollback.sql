-- MANUAL rollback for migration 234_retire_mentor_persona.sql.
-- This folder is NOT read by scripts/migrate.js. Never copy this file into src/models/migrations/.
-- Deploy the previous backend + frontend first (they still know the mentor persona / workspace).
-- Restores users.persona / persona_profile from legacy_mentor_persona_backup for rows that are still
-- persona = 'teacher' (a user who changed persona after the migration keeps the newer choice), puts
-- programme contributions back to source_type 'mentor', restores the original CHECK and flag text.
-- user_roles grants added by 234 are kept (the mentor persona authorised as instructor anyway).
--
-- Usage (non-production first):  psql "$DATABASE_URL" -f backend/scripts/sql/rollback/234_retire_mentor_persona.rollback.sql

BEGIN;

SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF to_regclass('public.legacy_mentor_persona_backup') IS NOT NULL THEN
    UPDATE users u
    SET persona = b.persona,
        persona_profile = b.persona_profile
    FROM legacy_mentor_persona_backup b
    WHERE u.id = b.user_id
      AND u.persona IS NOT DISTINCT FROM CASE WHEN b.persona = 'mentor' THEN 'teacher' ELSE b.persona END;
  END IF;
END $$;

DROP TABLE IF EXISTS legacy_mentor_persona_backup;

COMMENT ON COLUMN users.persona IS 'Use-case persona: teacher, education_center, student, parent, hr_company, other';

DO $$
BEGIN
  IF to_regclass('public.programs') IS NULL THEN
    RETURN;
  END IF;
  UPDATE programs SET source_type = 'mentor' WHERE source_type = 'instructor';
  UPDATE programs SET portal_source = 'mentor' WHERE portal_source = 'instructor';
  UPDATE programs
  SET ai_raw_json = (ai_raw_json - 'contributor_notes')
      || jsonb_build_object('mentor_notes', ai_raw_json -> 'contributor_notes')
  WHERE ai_raw_json ? 'contributor_notes';
  ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_source_type_chk;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.programs'::regclass AND conname = 'programs_source_type_check'
  ) THEN
    ALTER TABLE programs ADD CONSTRAINT programs_source_type_check
      CHECK (source_type IN ('seed', 'scraper', 'mentor', 'admin'));
  END IF;
  COMMENT ON COLUMN programs.mentor_display_name IS NULL;
END $$;

-- Flag stays OFF (it was OFF in production); only the original description comes back.
UPDATE platform_feature_flags
SET description = 'Mentor kabineti və mentorluq xidmətləri'
WHERE key = 'feature.mentor_services.enabled';

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'mentorship_goals', 'mentorship_milestones', 'mentorship_sessions', 'mentorship_actions',
    'mentorship_services', 'mentorship_resources', 'mentorship_agreements', 'mentorship_feedback_requests'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('COMMENT ON TABLE %I IS NULL', t);
    END IF;
  END LOOP;
END $$;

DELETE FROM schema_migrations WHERE filename = '234_retire_mentor_persona.sql';

COMMIT;
