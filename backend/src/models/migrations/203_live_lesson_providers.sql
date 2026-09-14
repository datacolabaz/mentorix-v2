-- Phase 1: teacher BYO provider connections + live_rooms provider metadata (Google Meet first).
-- Rollback: 203_live_lesson_providers.down.sql

BEGIN;

CREATE TABLE IF NOT EXISTS teacher_provider_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google_meet', 'zoom', 'teams')),
  provider_account_id TEXT,
  account_email TEXT,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'needs_reauth', 'revoked')),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (instructor_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_teacher_provider_connections_instructor
  ON teacher_provider_connections (instructor_id);

CREATE TABLE IF NOT EXISTS oauth_pending_states (
  state TEXT PRIMARY KEY,
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  return_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_pending_states_expires
  ON oauth_pending_states (expires_at);

ALTER TABLE live_rooms
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'mentorix_live',
  ADD COLUMN IF NOT EXISTS provider_meeting_id TEXT,
  ADD COLUMN IF NOT EXISTS join_url TEXT,
  ADD COLUMN IF NOT EXISTS start_url TEXT,
  ADD COLUMN IF NOT EXISTS passcode TEXT,
  ADD COLUMN IF NOT EXISTS provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS connection_id UUID REFERENCES teacher_provider_connections(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'live_rooms_provider_check'
  ) THEN
    ALTER TABLE live_rooms
      ADD CONSTRAINT live_rooms_provider_check
      CHECK (provider IN ('mentorix_live', 'google_meet', 'zoom', 'teams'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_live_rooms_provider
  ON live_rooms (instructor_id, provider);

COMMIT;
