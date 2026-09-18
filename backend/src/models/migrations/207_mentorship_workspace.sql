-- Connected mentor workspace: goals, meetings, commitments, offers, resources and agreements.
CREATE TABLE IF NOT EXISTS mentorship_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  why_text TEXT,
  success_metric TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  progress SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentorship_goals_mentor
  ON mentorship_goals (mentor_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS mentorship_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES mentorship_goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentorship_milestones_goal
  ON mentorship_milestones (goal_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS mentorship_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 15 AND 480),
  format TEXT NOT NULL DEFAULT 'online' CHECK (format IN ('online', 'in_person', 'phone')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'cancelled')),
  agenda JSONB NOT NULL DEFAULT '[]'::jsonb,
  private_notes TEXT,
  shared_summary TEXT,
  check_in SMALLINT CHECK (check_in BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentorship_sessions_mentor
  ON mentorship_sessions (mentor_id, scheduled_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS mentorship_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES mentorship_sessions(id) ON DELETE SET NULL,
  goal_id UUID REFERENCES mentorship_goals(id) ON DELETE SET NULL,
  mentee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  owner_type TEXT NOT NULL DEFAULT 'mentee' CHECK (owner_type IN ('mentor', 'mentee', 'shared')),
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentorship_actions_mentor
  ON mentorship_actions (mentor_id, status, due_date);

CREATE TABLE IF NOT EXISTS mentorship_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  delivery_format TEXT NOT NULL DEFAULT 'one_to_one' CHECK (delivery_format IN ('one_to_one', 'package', 'group')),
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 15 AND 10080),
  price_amount NUMERIC(12,2),
  currency CHAR(3) NOT NULL DEFAULT 'AZN',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentorship_services_mentor
  ON mentorship_services (mentor_id, active, updated_at DESC);

CREATE TABLE IF NOT EXISTS mentorship_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'link' CHECK (resource_type IN ('link', 'article', 'video', 'template', 'book')),
  url TEXT,
  category TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'mentees')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentorship_resources_mentor
  ON mentorship_resources (mentor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mentorship_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meeting_cadence TEXT,
  communication_channel TEXT,
  confidentiality TEXT,
  boundaries TEXT,
  success_definition TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'shared', 'accepted', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mentor_id, mentee_id)
);

CREATE INDEX IF NOT EXISTS idx_mentorship_agreements_mentor
  ON mentorship_agreements (mentor_id, status, updated_at DESC);
