-- İmtahan SMS: cədvəldə PATCH üçün vaxt izi
ALTER TABLE exams ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
