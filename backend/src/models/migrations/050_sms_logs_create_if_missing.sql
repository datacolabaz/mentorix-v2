-- Ensure sms_logs exists in fresh environments (idempotent).

CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID REFERENCES users(id),
  student_id UUID REFERENCES users(id),
  phone TEXT,
  type VARCHAR(32),
  message TEXT,
  status TEXT,
  package_type VARCHAR(32),
  http_status INTEGER,
  msisdn TEXT,
  provider JSONB,
  sent_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_instructor_id_created_at ON sms_logs (instructor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_logs_student_id_created_at ON sms_logs (student_id, created_at DESC);

