-- Ensure unique constraint or index exists for (instructor_id, student_id) so ON CONFLICT (instructor_id, student_id) succeeds
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_instructor_id_student_id_key'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'enrollments_instructor_id_student_id_key'
    ) THEN
        ALTER TABLE enrollments ADD CONSTRAINT enrollments_instructor_id_student_id_key UNIQUE (instructor_id, student_id);
    END IF;
END $$;
