-- Allow instructors to attach a question file to an assignment
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS question_file_url TEXT;

