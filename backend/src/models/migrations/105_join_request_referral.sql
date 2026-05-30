-- Qoşulma sorğusu: kim yönləndirdi (müəllim üçün marketinq)

ALTER TABLE student_join_requests
  ADD COLUMN IF NOT EXISTS referral_source_id UUID REFERENCES referral_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_notes TEXT;
