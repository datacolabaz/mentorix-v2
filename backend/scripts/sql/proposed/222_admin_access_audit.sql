-- PROPOSAL ONLY — not a migration. The audit plan reserves migration 222 (admin_access_audit) for phase D/E.
-- Phase C code (services/adminAccessAudit.js) already writes to this table and FAILS CLOSED:
-- until this table exists, admin access to teacher activity data via ?instructor_id= returns 503.
-- The owning phase should copy this file to src/models/migrations/222_admin_access_audit.sql.

CREATE TABLE IF NOT EXISTS admin_access_audit (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_type TEXT,
  entity_id UUID,
  reason TEXT NOT NULL CHECK (length(btrim(reason)) >= 5),
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_access_audit_actor ON admin_access_audit (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_access_audit_target ON admin_access_audit (target_user_id, created_at DESC);
