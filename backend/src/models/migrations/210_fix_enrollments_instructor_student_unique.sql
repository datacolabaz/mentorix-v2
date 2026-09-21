-- Drop existing legacy/strict constraint if it exists and recreate unique index allowing multiple non-active/soft-deleted or ON CONFLICT handling
DO $$
BEGIN
    -- Drop old constraint if exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_instructor_id_student_id_key'
    ) THEN
        ALTER TABLE enrollments DROP CONSTRAINT enrollments_instructor_id_student_id_key;
    END IF;

    -- Drop old index if exists
    DROP INDEX IF EXISTS enrollments_instructor_id_student_id_key;
    DROP INDEX IF EXISTS idx_enrollments_instructor_student_active;

    -- Create partial unique index only for active/pending enrollments
    CREATE UNIQUE INDEX idx_enrollments_instructor_student_active
    ON enrollments (instructor_id, student_id)
    WHERE deleted_at IS NULL AND COALESCE(LOWER(TRIM(status)), '') NOT IN ('rejected', 'left', 'archived');
END $$;
