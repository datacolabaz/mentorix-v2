-- Epic 1 (US 1.1–1.3): AI-generated question drafts
-- Stores editable question sets produced from generation_requests.

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS generation_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES generation_requests(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID NULL REFERENCES instructor_groups(id) ON DELETE SET NULL,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'discarded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generation_drafts_teacher_status
  ON generation_drafts (teacher_id, status);

CREATE INDEX IF NOT EXISTS idx_generation_drafts_request
  ON generation_drafts (request_id);

DROP TRIGGER IF EXISTS trg_generation_drafts_set_updated_at ON generation_drafts;
CREATE TRIGGER trg_generation_drafts_set_updated_at
  BEFORE UPDATE ON generation_drafts
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

COMMENT ON TABLE generation_drafts IS
  'Editable AI-generated question drafts (Epic 1). Ownership enforced in Express, not RLS.';
COMMENT ON COLUMN generation_drafts.request_id IS
  'Parent generation_requests row that produced this draft.';
COMMENT ON COLUMN generation_drafts.teacher_id IS
  'Owning teacher (users.id); must match authenticated instructor in application layer.';
COMMENT ON COLUMN generation_drafts.group_id IS
  'Optional instructor_groups.id target for publish flow.';
COMMENT ON COLUMN generation_drafts.questions IS
  'Array of generated question objects (JSONB).';
COMMENT ON COLUMN generation_drafts.status IS
  'draft | published | discarded';
