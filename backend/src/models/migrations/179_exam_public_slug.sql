-- Public share URL slug for certified exams (/sertifikatli-imtahanlar/:category/:exam-slug)

ALTER TABLE exams ADD COLUMN IF NOT EXISTS slug VARCHAR(160);

CREATE OR REPLACE FUNCTION slugify_exam_title(raw text) RETURNS text AS $$
DECLARE
  s text;
BEGIN
  s := lower(trim(coalesce(raw, '')));
  s := translate(s, 'əıöüşçğ', 'eiousscg');
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
  s := regexp_replace(s, '^-+|-+$', '', 'g');
  IF s = '' THEN
    RETURN 'imtahan';
  END IF;
  RETURN left(s, 120);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DO $$
DECLARE
  r RECORD;
  base text;
  candidate text;
  suffix int;
BEGIN
  FOR r IN SELECT id, title FROM exams WHERE slug IS NULL OR trim(slug) = '' ORDER BY created_at LOOP
    base := slugify_exam_title(r.title);
    candidate := base;
    suffix := 2;
    WHILE EXISTS (SELECT 1 FROM exams e2 WHERE e2.slug = candidate AND e2.id <> r.id) LOOP
      candidate := base || '-' || suffix;
      suffix := suffix + 1;
    END LOOP;
    UPDATE exams SET slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE exams ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_exams_slug_unique ON exams (slug);

DROP FUNCTION IF EXISTS slugify_exam_title(text);
