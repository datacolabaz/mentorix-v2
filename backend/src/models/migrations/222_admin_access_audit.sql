-- Admin həssas giriş auditi (audit planı §10.9, nömrə 222 bu slot üçün ayrılıb).
-- Admin müəllimin tələbə fəaliyyətinə ?instructor_id= ilə baxanda səbəb tələb olunur və hər baxış bura yazılır.
-- Yazmaq alınmasa giriş verilmir (services/adminAccessAudit.js, fail-closed).
-- Yalnız yeni cədvəl və indekslər: mövcud cədvəllərə toxunmur, təkrar işlədilə bilər.
-- Rollback: backend/scripts/sql/rollback/222_admin_access_audit.sql (əl ilə).

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
