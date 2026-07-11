-- Epic 1 (BE-11): link published generation drafts to real assignments

ALTER TABLE generation_drafts
  ADD COLUMN IF NOT EXISTS published_assignment_id UUID NULL
    REFERENCES assignments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_generation_drafts_published_assignment
  ON generation_drafts (published_assignment_id)
  WHERE published_assignment_id IS NOT NULL;

COMMENT ON COLUMN generation_drafts.published_assignment_id IS
  'assignments.id created when this draft is published (BE-11).';
