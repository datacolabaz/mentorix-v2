-- Contextual group, assignment, and direct chat rooms.

BEGIN;

CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_kind TEXT NOT NULL CHECK (room_kind IN ('group', 'assignment', 'direct')),
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instructor_group_id UUID REFERENCES instructor_groups(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chat_rooms_kind_refs_chk CHECK (
    (
      room_kind = 'group'
      AND instructor_group_id IS NOT NULL
      AND assignment_id IS NULL
      AND student_id IS NULL
    )
    OR (
      room_kind = 'assignment'
      AND assignment_id IS NOT NULL
      AND instructor_group_id IS NULL
      AND student_id IS NULL
    )
    OR (
      room_kind = 'direct'
      AND student_id IS NOT NULL
      AND instructor_group_id IS NULL
      AND assignment_id IS NULL
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_group_uidx
  ON chat_rooms (instructor_group_id)
  WHERE room_kind = 'group';

CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_assignment_uidx
  ON chat_rooms (assignment_id)
  WHERE room_kind = 'assignment';

CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_direct_uidx
  ON chat_rooms (instructor_id, student_id)
  WHERE room_kind = 'direct';

CREATE INDEX IF NOT EXISTS chat_rooms_instructor_idx ON chat_rooms (instructor_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chat_messages_body_nonempty_chk CHECK (char_length(btrim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS chat_messages_room_created_idx
  ON chat_messages (room_id, created_at DESC);

COMMIT;
