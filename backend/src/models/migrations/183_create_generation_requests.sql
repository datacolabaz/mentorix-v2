-- Epic 1 (US 1.1–1.3): AI generation request audit log
-- Tracks each teacher generation call (payload, status, model metrics).

CREATE TABLE IF NOT EXISTS generation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed')),
  model_used TEXT,
  token_usage JSONB,
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generation_requests_teacher_created
  ON generation_requests (teacher_id, created_at DESC);

COMMENT ON TABLE generation_requests IS
  'AI content generation requests initiated by teachers (Epic 1).';
COMMENT ON COLUMN generation_requests.teacher_id IS
  'Owning teacher (users.id with instructor role enforced at application layer).';
COMMENT ON COLUMN generation_requests.request_payload IS
  'Sanitized input sent to the generation service (prompt, filters, group context).';
COMMENT ON COLUMN generation_requests.status IS
  'pending | success | failed';
COMMENT ON COLUMN generation_requests.token_usage IS
  'Provider token breakdown, e.g. {"prompt": 120, "completion": 340, "total": 460}.';
