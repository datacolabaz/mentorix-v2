-- Rol icazələri (müəllim təsdiqi), müddətli/limitli qrup dəvət tokenləri və canlı dərs mövzusu.
-- Additive and idempotent: new tables, one nullable column, one feature flag row. No UPDATE/DELETE of
-- existing rows; existing users keep every role they already have (user_roles is untouched).
-- Rollback (manual): backend/scripts/sql/rollback/237_role_access_invites_live_topics.rollback.sql

SET LOCAL lock_timeout = '10s';

-- 1) Rol sorğuları: istifadəçi müəllim icazəsi istəyir, platforma admini və ya təşkilat admini təsdiqləyir.
CREATE TABLE IF NOT EXISTS role_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_role TEXT NOT NULL CHECK (requested_role IN ('teacher')),
  -- Təşkilat daxilində sorğu: həmin təşkilatın adminləri də təsdiqləyə bilər. NULL = yalnız platforma admini.
  organization_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  note TEXT,
  source TEXT NOT NULL DEFAULT 'settings' CHECK (source IN ('onboarding', 'settings', 'workspace_switch', 'organization')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Eyni istifadəçinin eyni rol üçün yalnız bir gözləyən sorğusu ola bilər (paralel kliklər üçün DB qoruması).
CREATE UNIQUE INDEX IF NOT EXISTS uq_role_requests_one_pending
  ON role_requests (user_id, requested_role)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_role_requests_status_created
  ON role_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_role_requests_org_pending
  ON role_requests (organization_id, created_at DESC)
  WHERE status = 'pending' AND organization_id IS NOT NULL;

-- 2) Qrup dəvət tokenləri (köhnə instructor_groups.join_code işləməyə davam edir).
CREATE TABLE IF NOT EXISTS group_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES instructor_groups(id) ON DELETE CASCADE,
  label TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INTEGER NOT NULL CHECK (max_uses BETWEEN 1 AND 10000),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  allowed_role TEXT NOT NULL DEFAULT 'student' CHECK (allowed_role IN ('student')),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT group_invites_used_within_limit CHECK (used_count <= max_uses)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_group_invites_token ON group_invites (token);
CREATE INDEX IF NOT EXISTS idx_group_invites_group_created ON group_invites (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_invites_creator_created ON group_invites (created_by, created_at DESC);

-- Kim hansı token ilə qoşuldu (jurnal). Eyni istifadəçi eyni tokenlə yalnız bir dəfə.
CREATE TABLE IF NOT EXISTS group_invite_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES group_invites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES instructor_groups(id) ON DELETE CASCADE,
  enrollment_id UUID,
  join_request_id UUID,
  ip TEXT,
  user_agent TEXT,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_group_invite_redemptions_user UNIQUE (invite_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_invite_redemptions_invite_time
  ON group_invite_redemptions (invite_id, redeemed_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_invite_redemptions_user
  ON group_invite_redemptions (user_id, redeemed_at DESC);

-- 3) Canlı dərs: mövzu sahəsi + dərsdən sonra əlavə olunan material / tapşırıq / imtahan.
ALTER TABLE live_rooms ADD COLUMN IF NOT EXISTS topic TEXT;

CREATE TABLE IF NOT EXISTS live_lesson_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('material', 'task', 'exam')),
  ref_id UUID NOT NULL,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_live_lesson_followups UNIQUE (room_id, kind, ref_id)
);

CREATE INDEX IF NOT EXISTS idx_live_lesson_followups_room
  ON live_lesson_followups (room_id, created_at);

-- 4) Auth jurnalı: rol sorğusu hadisələri (köhnə dəyərlər saxlanılır; NOT VALID — mövcud sətirlər yoxlanmır).
DO $$
BEGIN
  IF to_regclass('auth_events') IS NOT NULL THEN
    ALTER TABLE auth_events DROP CONSTRAINT IF EXISTS auth_events_event_check;
    ALTER TABLE auth_events
      ADD CONSTRAINT auth_events_event_check
      CHECK (event IN (
        'google_sign_in',
        'google_sign_up',
        'account_link_offered',
        'account_linked',
        'account_link_declined',
        'login_failed',
        'legacy_login_blocked',
        'account_switch',
        'role_request',
        'role_request_approved',
        'role_request_rejected'
      )) NOT VALID;
  END IF;
END $$;

-- 5) Platforma açarı: yeni müəllim icazəsi təsdiq tələb edir (admin panelindən söndürülə bilər).
DO $$
BEGIN
  IF to_regclass('platform_feature_flags') IS NOT NULL THEN
    INSERT INTO platform_feature_flags (key, enabled, description)
    VALUES (
      'access.teacher_role_approval.enabled',
      TRUE,
      'Müəllim icazəsi admin və ya təşkilat təsdiqi ilə verilir (sərbəst rol keçidi bağlıdır)'
    )
    ON CONFLICT (key) DO NOTHING;
  END IF;
END $$;
