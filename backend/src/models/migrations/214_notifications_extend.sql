-- Phase A: mövcud `notifications` cədvəlinin genişləndirilməsi (yeni cədvəl yox).
-- Additiv və idempotent: yalnız nullable / sabit default sütunlar, NOT VALID constraint-lər,
-- boş partial index-lər. Köhnə sətirlərə UPDATE/backfill yoxdur — kateqoriya və prioritet
-- köhnə `type` dəyərindən oxunarkən kodda təyin olunur (config/notificationPolicy.js).
-- Rollback: backend/scripts/sql/rollback/214_notifications_extend.rollback.sql (əl ilə).

-- Uzun müddət lock gözləyib bütün oxumaları bloklamasın; alınmasa migrasiya tez uğursuz olur.
SET LOCAL lock_timeout = '10s';

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS related_entity_type TEXT,
  ADD COLUMN IF NOT EXISTS related_entity_id UUID,
  ADD COLUMN IF NOT EXISTS actor_user_id UUID,
  ADD COLUMN IF NOT EXISTS provider_workspace_id UUID,
  ADD COLUMN IF NOT EXISTS group_id UUID,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_status TEXT,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

-- FK-lər NOT VALID: mövcud sətirlər üçün tam cədvəl yoxlaması yoxdur, yeni sətirlər üçün məcburidir.
-- provider_workspace_id üçün FK yoxdur (gələcək provider_workspaces cədvəli; hazırda = instructor user id).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_actor_user_id_fkey' AND conrelid = 'notifications'::regclass
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT notifications_actor_user_id_fkey
      FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_group_id_fkey' AND conrelid = 'notifications'::regclass
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT notifications_group_id_fkey
      FOREIGN KEY (group_id) REFERENCES instructor_groups(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

-- CHECK-lər NULL-a icazə verir (köhnə sətirlər etibarlı qalır); NOT VALID = tam scan yoxdur.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_priority_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_priority_check
  CHECK (priority IN ('CRITICAL', 'HIGH', 'NORMAL', 'LOW')) NOT VALID;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_category_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_category_check
  CHECK (
    category IS NULL
    OR category IN ('security', 'assessment', 'assignment', 'material', 'group', 'grading', 'partner', 'billing', 'system')
  ) NOT VALID;

-- Təkrar hadisə = təkrar bildiriş yox (alıcı üzrə).
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_user_dedupe
  ON notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- Bildiriş mərkəzi siyahısı (bütün sətirlər; mövcud idx_notifications_user_unread yalnız oxunmamışları əhatə edir).
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

-- Aşağıdakılar partial-dır: yaranma anında boşdur, build yalnız bir scan-dır.
CREATE INDEX IF NOT EXISTS idx_notifications_user_category
  ON notifications (user_id, category, created_at DESC)
  WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_entity
  ON notifications (related_entity_type, related_entity_id)
  WHERE related_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_workspace
  ON notifications (provider_workspace_id, created_at DESC)
  WHERE provider_workspace_id IS NOT NULL;

-- ON DELETE SET NULL FK-ləri üçün (istifadəçi/qrup silinəndə tam scan olmasın).
CREATE INDEX IF NOT EXISTS idx_notifications_group
  ON notifications (group_id)
  WHERE group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_actor
  ON notifications (actor_user_id)
  WHERE actor_user_id IS NOT NULL;
