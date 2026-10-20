-- «Təşkilat yarat» sorğuları, aktiv təşkilat konteksti və mövcud təşkilat sahiblərinin üzvlük qeydi.
-- Additive and idempotent. The only data change is the owner-membership backfill below (insert-only, never
-- updates or deletes an existing membership), so existing organization owners keep access through the
-- organization portal. Rollback (manual): backend/scripts/sql/rollback/240_organization_requests_workspaces.rollback.sql

SET LOCAL lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS organization_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  org_type TEXT NOT NULL CHECK (org_type IN ('education_center', 'school', 'company', 'other')),
  description TEXT CHECK (description IS NULL OR length(description) <= 1000),
  source TEXT NOT NULL DEFAULT 'workspace' CHECK (source IN ('workspace', 'onboarding')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  organization_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organization_requests_approved_has_org CHECK (status <> 'approved' OR organization_id IS NOT NULL)
);

-- One pending request per user (parallel clicks collapse into one row).
CREATE UNIQUE INDEX IF NOT EXISTS uq_organization_requests_one_pending
  ON organization_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_organization_requests_status_created
  ON organization_requests (status, created_at DESC);

-- Active organization of the organization cabinet (NULL = first owned / oldest membership, as before).
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_organization_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_active_organization_id_fkey' AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_active_organization_id_fkey
      FOREIGN KEY (active_organization_id) REFERENCES courses(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

-- Existing organization owners: make sure the owner membership row exists (it used to be created lazily
-- on the first /org visit), so the organization portal and cabinet list recognise every current owner.
INSERT INTO org_roles (key, name_az, sort_order)
VALUES ('owner', 'Sahib', 0)
ON CONFLICT (key) DO NOTHING;

INSERT INTO org_memberships (course_id, user_id, role_key)
SELECT c.id, c.owner_user_id, 'owner'
FROM courses c
WHERE COALESCE(c.is_organization, FALSE) = TRUE
  AND c.owner_user_id IS NOT NULL
ON CONFLICT (course_id, user_id) DO NOTHING;

-- Auth journal: organization request events (old values kept; NOT VALID — existing rows are not rechecked).
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
        'role_request_rejected',
        'organization_request',
        'organization_request_approved',
        'organization_request_rejected'
      )) NOT VALID;
  END IF;
END $$;
