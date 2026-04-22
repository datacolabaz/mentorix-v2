ALTER TABLE teacher_schedules
ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES instructor_subjects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES instructor_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_schedules_group_lock
ON teacher_schedules (instructor_id, day_of_week, start_time, is_occupied, group_id);

