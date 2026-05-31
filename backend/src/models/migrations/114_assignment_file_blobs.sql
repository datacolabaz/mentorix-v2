-- Tapşırıq faylları (Word/PDF): deploydan sonra disk itməsin deyə DB-də saxlanır

CREATE TABLE IF NOT EXISTS assignment_file_blobs (
  filename TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  data BYTEA NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_file_blobs_created ON assignment_file_blobs (created_at);
