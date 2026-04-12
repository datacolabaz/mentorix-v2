-- Çoxseçimli şablon (template_hint), uzun correct_answer (məs. "23", "145")
ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS template_hint TEXT;

ALTER TABLE exam_questions
  ALTER COLUMN correct_answer TYPE VARCHAR(120);
