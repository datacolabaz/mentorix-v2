-- BSc/MSc/PhD üçün ayrı apply linkləri (undergrad vs graduate)

BEGIN;

ALTER TABLE universities
  ADD COLUMN IF NOT EXISTS undergrad_apply_link TEXT,
  ADD COLUMN IF NOT EXISTS graduate_apply_link TEXT;

COMMIT;
