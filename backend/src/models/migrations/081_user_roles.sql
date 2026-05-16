-- Vahid telefon + çoxlu rol: eyni user_id üzrə bir neçə aktiv rol
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'instructor', 'student', 'parent', 'course')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role_active ON user_roles (role) WHERE is_active = TRUE;

-- Mövcud users.role → user_roles
INSERT INTO user_roles (user_id, role, is_active)
SELECT id, role, COALESCE(is_active, TRUE)
FROM users
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

COMMENT ON TABLE user_roles IS 'Bir istifadəçinin aktiv rolları (vahid telefon, çoxlu panel)';
