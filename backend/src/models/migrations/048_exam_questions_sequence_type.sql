-- Add new exam question type: sequence (ordering)
ALTER TABLE exam_questions DROP CONSTRAINT IF EXISTS exam_questions_question_type_check;
ALTER TABLE exam_questions ADD CONSTRAINT exam_questions_question_type_check
  CHECK (question_type IN ('closed', 'open', 'matching', 'multiple', 'sequence'));

