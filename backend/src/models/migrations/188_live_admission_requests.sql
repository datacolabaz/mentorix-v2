-- Instructor must approve students/guests before they enter a live room.

BEGIN;

CREATE TABLE IF NOT EXISTS live_admission_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  requester_kind VARCHAR(16) NOT NULL CHECK (requester_kind IN ('user', 'guest')),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  guest_invite_id UUID REFERENCES live_guest_invites(id) ON DELETE CASCADE,
  guest_participant_id UUID REFERENCES live_guest_participants(id) ON DELETE SET NULL,
  display_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone_number VARCHAR(32),
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_admission_pending_user
  ON live_admission_requests (room_id, user_id)
  WHERE status = 'pending' AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_admission_pending_guest_email
  ON live_admission_requests (room_id, lower(email))
  WHERE status = 'pending' AND requester_kind = 'guest' AND email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_live_admission_room_status
  ON live_admission_requests (room_id, status, requested_at DESC);

COMMIT;
