-- Exam completion certificates (MVP)

CREATE TABLE IF NOT EXISTS certificate_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL DEFAULT 'Default',
  template_key VARCHAR(32) NOT NULL DEFAULT 'classic',
  logo_url TEXT,
  signature_url TEXT,
  background_url TEXT,
  accent_color VARCHAR(16) DEFAULT '#4f46e5',
  locale VARCHAR(8) NOT NULL DEFAULT 'az',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificate_templates_instructor ON certificate_templates (instructor_id);

CREATE TABLE IF NOT EXISTS certificate_counters (
  year INTEGER PRIMARY KEY,
  last_seq INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  certificate_no VARCHAR(32) NOT NULL UNIQUE,
  verification_token VARCHAR(64) NOT NULL UNIQUE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  exam_result_id UUID REFERENCES exam_results(id) ON DELETE SET NULL,
  template_id UUID REFERENCES certificate_templates(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  score_pct NUMERIC(6, 2) NOT NULL,
  pass_pct NUMERIC(6, 2) NOT NULL,
  pdf_filename TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued', 'superseded', 'revoked')),
  previous_certificate_id UUID REFERENCES certificates(id) ON DELETE SET NULL,
  snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  locale VARCHAR(8) NOT NULL DEFAULT 'az',
  expires_at TIMESTAMPTZ,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificates_student ON certificates (student_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_certificates_instructor ON certificates (instructor_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_certificates_exam ON certificates (exam_id);
CREATE INDEX IF NOT EXISTS idx_certificates_token ON certificates (verification_token);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates (status) WHERE status = 'issued';

CREATE TABLE IF NOT EXISTS certificate_file_blobs (
  filename TEXT PRIMARY KEY,
  content_type TEXT NOT NULL DEFAULT 'application/pdf',
  data BYTEA NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS certificate_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS certificate_pass_pct NUMERIC(6, 2) NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS certificate_template_id UUID REFERENCES certificate_templates(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS certificate_issue_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_result_id UUID NOT NULL REFERENCES exam_results(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE (exam_result_id)
);

CREATE OR REPLACE FUNCTION enqueue_certificate_issue_on_exam_submit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.submitted_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.submitted_at IS NULL) THEN
    INSERT INTO certificate_issue_queue (exam_result_id)
    VALUES (NEW.id)
    ON CONFLICT (exam_result_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_certificate_issue_queue ON exam_results;
CREATE TRIGGER trg_certificate_issue_queue
  AFTER INSERT OR UPDATE OF submitted_at ON exam_results
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_certificate_issue_on_exam_submit();
