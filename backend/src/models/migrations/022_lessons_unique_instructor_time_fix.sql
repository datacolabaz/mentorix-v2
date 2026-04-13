-- Allow multiple students at the same wall-clock time for one instructor.
-- The previous UNIQUE(instructor_id, lesson_date) was too strict and could break enrollments.

ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_unique_instructor_time;
