-- Assignment submission fields (draft + submit)
-- answer_text: rich text HTML (Quill output)
-- attachment_urls: array of uploaded file URLs
-- submitted_at: when student submitted (locks editing)

ALTER TABLE student_assignments
  ADD COLUMN IF NOT EXISTS answer_text TEXT;

ALTER TABLE student_assignments
  ADD COLUMN IF NOT EXISTS attachment_urls TEXT[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE student_assignments
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_student_assignments_submitted_at ON student_assignments (submitted_at);

