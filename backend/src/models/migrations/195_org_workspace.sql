-- Organization workspace: RBAC catalog, memberships, teams, audit log.

CREATE TABLE IF NOT EXISTS org_permissions (
  key TEXT PRIMARY KEY,
  group_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_roles (
  key TEXT PRIMARY KEY,
  name_az TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_role_permissions (
  role_key TEXT NOT NULL REFERENCES org_roles(key) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES org_permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_key, permission_key)
);

CREATE TABLE IF NOT EXISTS org_memberships (
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL REFERENCES org_roles(key),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (course_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON org_memberships (user_id);

CREATE TABLE IF NOT EXISTS org_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_teams_course ON org_teams (course_id) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS org_team_members (
  team_id UUID NOT NULL REFERENCES org_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_kind TEXT NOT NULL DEFAULT 'participant',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_team_members_user ON org_team_members (user_id);

CREATE TABLE IF NOT EXISTS org_audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_audit_course_created
  ON org_audit_events (course_id, created_at DESC);

ALTER TABLE course_students
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_course_students_archived
  ON course_students (course_id)
  WHERE archived_at IS NULL;

ALTER TABLE course_groups
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES org_teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_course_groups_team
  ON course_groups (team_id)
  WHERE team_id IS NOT NULL;

COMMENT ON TABLE org_permissions IS 'Organization permission catalog';
COMMENT ON TABLE org_roles IS 'Organization role templates';
COMMENT ON TABLE org_memberships IS 'User role inside an organization course';
COMMENT ON TABLE org_teams IS 'Organization teams (larger than groups)';
COMMENT ON TABLE org_audit_events IS 'Organization audit trail';
COMMENT ON COLUMN course_students.archived_at IS 'Organization participant archive timestamp';
COMMENT ON COLUMN course_groups.team_id IS 'Optional parent organization team';
