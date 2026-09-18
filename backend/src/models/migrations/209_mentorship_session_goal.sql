-- Link each mentoring session to the goal it advances.
ALTER TABLE mentorship_sessions
  ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES mentorship_goals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mentorship_sessions_goal
  ON mentorship_sessions (goal_id, scheduled_at DESC NULLS LAST);
