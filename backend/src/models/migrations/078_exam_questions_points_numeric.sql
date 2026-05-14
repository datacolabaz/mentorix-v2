-- Sual balları: tam ədəd + kəsr (məs. 1.5, 2.5)
ALTER TABLE exam_questions
  ALTER COLUMN points TYPE NUMERIC(8, 2)
  USING COALESCE(points, 10)::numeric;

ALTER TABLE exam_questions
  ALTER COLUMN points SET DEFAULT 10;
