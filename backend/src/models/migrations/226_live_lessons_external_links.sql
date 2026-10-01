-- Canlı dərslər müəllimin Google Meet / Zoom / digər HTTPS linki ilə (Mentorix video yayımı etmir).
-- Mövcud live_rooms cədvəli genişləndirilir (köhnə otaq kodları və URL-lər işləməyə davam edir).
-- Additive and idempotent: nullable columns / constant defaults (metadata-only), CHECKs re-added NOT VALID,
-- one new table, partial indexes. No UPDATE of existing rows. Internal-video tables are only COMMENTed.
-- Rollback (manual): backend/scripts/sql/rollback/226_live_lessons_external_links.rollback.sql

SET LOCAL lock_timeout = '10s';

ALTER TABLE live_rooms
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS student_id UUID,
  ADD COLUMN IF NOT EXISTS reminder_offset_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS notify_email BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS recurrence_rule JSONB,
  ADD COLUMN IF NOT EXISTS series_id UUID,
  ADD COLUMN IF NOT EXISTS link_source TEXT,
  ADD COLUMN IF NOT EXISTS materials JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'live_rooms_student_id_fkey' AND conrelid = 'live_rooms'::regclass
  ) THEN
    ALTER TABLE live_rooms
      ADD CONSTRAINT live_rooms_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

-- 'cancelled' status (ləğv edilmiş dərs silinmir, iştirakçılar ləğvi görür).
ALTER TABLE live_rooms DROP CONSTRAINT IF EXISTS live_rooms_status_check;
ALTER TABLE live_rooms
  ADD CONSTRAINT live_rooms_status_check
  CHECK (status IN ('waiting', 'live', 'ended', 'cancelled')) NOT VALID;

-- 'other' platform (müəllimin seçdiyi digər HTTPS video platforması).
ALTER TABLE live_rooms DROP CONSTRAINT IF EXISTS live_rooms_provider_check;
ALTER TABLE live_rooms
  ADD CONSTRAINT live_rooms_provider_check
  CHECK (provider IN ('mentorix_live', 'google_meet', 'zoom', 'teams', 'other')) NOT VALID;

ALTER TABLE live_rooms DROP CONSTRAINT IF EXISTS live_rooms_link_source_check;
ALTER TABLE live_rooms
  ADD CONSTRAINT live_rooms_link_source_check
  CHECK (link_source IS NULL OR link_source IN ('manual', 'oauth')) NOT VALID;

ALTER TABLE live_rooms DROP CONSTRAINT IF EXISTS live_rooms_reminder_offset_check;
ALTER TABLE live_rooms
  ADD CONSTRAINT live_rooms_reminder_offset_check
  CHECK (reminder_offset_minutes IS NULL OR reminder_offset_minutes IN (15, 30, 60, 1440)) NOT VALID;

-- Reminder job: due, not yet reminded, not cancelled.
CREATE INDEX IF NOT EXISTS idx_live_rooms_reminder_due
  ON live_rooms (scheduled_at)
  WHERE reminder_sent_at IS NULL AND cancelled_at IS NULL AND reminder_offset_minutes IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_live_rooms_series
  ON live_rooms (series_id, scheduled_at)
  WHERE series_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_live_rooms_student
  ON live_rooms (student_id, scheduled_at DESC)
  WHERE student_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_live_rooms_group_scheduled
  ON live_rooms (group_id, scheduled_at DESC)
  WHERE group_id IS NOT NULL;

-- Manual attendance only (never automatic): İştirak edib / İştirak etməyib / Gecikib / Üzrlü.
CREATE TABLE IF NOT EXISTS live_lesson_attendance (
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('attended', 'absent', 'late', 'excused')),
  note TEXT,
  marked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_live_lesson_attendance_student
  ON live_lesson_attendance (student_id, marked_at DESC);

-- Internal LiveKit video is retired: data is kept (read-only), not dropped. See specs/audit-sms-video-pricing.md.
DO $$
BEGIN
  IF to_regclass('public.live_sessions') IS NOT NULL THEN
    EXECUTE $c$COMMENT ON TABLE live_sessions IS 'DEPRECATED (internal LiveKit video retired). Kept read-only for history; drop only per the later-drop plan.'$c$;
  END IF;
  IF to_regclass('public.live_recordings') IS NOT NULL THEN
    EXECUTE $c$COMMENT ON TABLE live_recordings IS 'DEPRECATED (internal LiveKit recordings retired). Files kept until the owner approves a retention/export decision.'$c$;
  END IF;
  IF to_regclass('public.live_guest_invites') IS NOT NULL THEN
    EXECUTE $c$COMMENT ON TABLE live_guest_invites IS 'DEPRECATED (internal LiveKit video retired).'$c$;
  END IF;
  IF to_regclass('public.live_guest_participants') IS NOT NULL THEN
    EXECUTE $c$COMMENT ON TABLE live_guest_participants IS 'DEPRECATED (internal LiveKit video retired).'$c$;
  END IF;
  IF to_regclass('public.live_admission_requests') IS NOT NULL THEN
    EXECUTE $c$COMMENT ON TABLE live_admission_requests IS 'DEPRECATED (internal LiveKit video retired).'$c$;
  END IF;
  IF to_regclass('public.live_chat_messages') IS NOT NULL THEN
    EXECUTE $c$COMMENT ON TABLE live_chat_messages IS 'DEPRECATED (internal LiveKit video retired).'$c$;
  END IF;
  IF to_regclass('public.live_chat_attachments') IS NOT NULL THEN
    EXECUTE $c$COMMENT ON TABLE live_chat_attachments IS 'DEPRECATED (internal LiveKit video retired).'$c$;
  END IF;
END $$;
