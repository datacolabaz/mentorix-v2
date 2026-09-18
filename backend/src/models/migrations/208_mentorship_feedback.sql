-- Structured mentee feedback requests support evidence-based quality improvement.
CREATE TABLE IF NOT EXISTS mentorship_feedback_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES mentorship_sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed')),
  goal_clarity SMALLINT CHECK (goal_clarity BETWEEN 1 AND 5),
  session_value SMALLINT CHECK (session_value BETWEEN 1 AND 5),
  psychological_safety SMALLINT CHECK (psychological_safety BETWEEN 1 AND 5),
  progress_confidence SMALLINT CHECK (progress_confidence BETWEEN 1 AND 5),
  comment TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE (mentor_id, mentee_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_mentorship_feedback_mentor
  ON mentorship_feedback_requests (mentor_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentorship_feedback_mentee
  ON mentorship_feedback_requests (mentee_id, status, requested_at DESC);
