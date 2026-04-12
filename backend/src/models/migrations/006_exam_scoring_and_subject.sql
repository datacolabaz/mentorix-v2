ALTER TABLE exams ADD COLUMN IF NOT EXISTS subject VARCHAR(255);

ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS negative_marking NUMERIC(6,3) DEFAULT 0;

-- Köhnə sətirlər DEFAULT 0 alır; qapalı suallar üçün -0.25 menfi bal
UPDATE exam_questions
SET negative_marking = -0.25
WHERE question_type = 'closed' AND COALESCE(negative_marking, 0) = 0;
