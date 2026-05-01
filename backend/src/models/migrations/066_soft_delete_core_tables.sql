-- Soft delete support for audit/analytics.

ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS users_deleted_at_idx ON users(deleted_at);
CREATE INDEX IF NOT EXISTS enrollments_deleted_at_idx ON enrollments(deleted_at);
CREATE INDEX IF NOT EXISTS lessons_deleted_at_idx ON lessons(deleted_at);
CREATE INDEX IF NOT EXISTS payments_deleted_at_idx ON payments(deleted_at);

