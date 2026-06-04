-- Müəllim profil şəkilləri: Railway deploy-dan sonra disk itməsin deyə DB-də saxlanır

CREATE TABLE IF NOT EXISTS instructor_avatar_blobs (
  filename TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  data BYTEA NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instructor_avatar_blobs_created ON instructor_avatar_blobs (created_at);
