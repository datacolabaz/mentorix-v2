CREATE TABLE IF NOT EXISTS instructor_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instructor_tasks_instructor ON instructor_tasks (instructor_id);

CREATE TABLE IF NOT EXISTS task_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES instructor_tasks(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','done')),
  done_at TIMESTAMPTZ,
  seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT task_assignments_unique UNIQUE (task_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignments_student ON task_assignments (student_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON task_assignments (task_id);

