-- Add join codes for instructor groups (classes).
-- Students can join via code/link; prevents duplicate joins.

ALTER TABLE instructor_groups
  ADD COLUMN IF NOT EXISTS join_code TEXT,
  ADD COLUMN IF NOT EXISTS join_code_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_instructor_groups_join_code_unique
  ON instructor_groups (join_code)
  WHERE join_code IS NOT NULL AND TRIM(join_code) <> '';

-- Backfill join codes for existing groups.
-- Format: MX-12345 (5 digits). Collision probability low; retry via UPDATE .. WHERE join_code IS NULL.
DO $$
DECLARE
  r RECORD;
  code TEXT;
  tries INT;
BEGIN
  FOR r IN SELECT id FROM instructor_groups WHERE join_code IS NULL LOOP
    tries := 0;
    LOOP
      tries := tries + 1;
      code := 'MX-' || LPAD((FLOOR(RANDOM() * 100000))::int::text, 5, '0');
      BEGIN
        UPDATE instructor_groups SET join_code = code WHERE id = r.id AND join_code IS NULL;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF tries > 25 THEN
          RAISE EXCEPTION 'could not generate unique join_code for group %', r.id;
        END IF;
      END;
    END LOOP;
  END LOOP;
END $$;

