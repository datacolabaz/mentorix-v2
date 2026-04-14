CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20) UNIQUE,
  password_hash VARCHAR(255),
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin','instructor','student','parent')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique_not_null
  ON users (lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '';

CREATE TABLE instructor_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255),
  billing_type VARCHAR(20) DEFAULT '8_lessons',
  sms_limit INTEGER DEFAULT 100,
  sms_used INTEGER DEFAULT 0,
  storage_limit_mb INTEGER DEFAULT 1024,
  storage_used_mb INTEGER DEFAULT 0,
  ram_limit_mb INTEGER DEFAULT 512,
  max_concurrent_students INTEGER DEFAULT 30,
  alert_lessons_before INTEGER DEFAULT 2
);

CREATE TABLE student_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES users(id),
  parent_name VARCHAR(255),
  parent_phone VARCHAR(50),
  grade VARCHAR(50),
  date_of_birth DATE,
  notes TEXT,
  monthly_fee NUMERIC(10,2),
  payment_start_date DATE
);

CREATE TABLE teacher_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_occupied BOOLEAN NOT NULL DEFAULT FALSE,
  enrollment_id UUID,
  student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT teacher_schedules_time_order CHECK (start_time < end_time),
  CONSTRAINT teacher_schedules_unique_slot UNIQUE (instructor_id, day_of_week, start_time, end_time)
);

CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  topic TEXT,
  question_file_url TEXT,
  description TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignments_instructor ON assignments (instructor_id);

CREATE TABLE student_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  answer_text TEXT,
  attachment_urls TEXT[] NOT NULL DEFAULT '{}'::text[],
  done_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT student_assignments_unique UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_assignments_student ON student_assignments (student_id);
CREATE INDEX IF NOT EXISTS idx_student_assignments_assignment ON student_assignments (assignment_id);
CREATE INDEX IF NOT EXISTS idx_student_assignments_submitted_at ON student_assignments (submitted_at);

CREATE TABLE student_prep_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT student_prep_slots_time_order CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_student_prep_slots_student ON student_prep_slots (student_id);
CREATE INDEX IF NOT EXISTS idx_student_prep_slots_student_day ON student_prep_slots (student_id, day_of_week);

CREATE TABLE referral_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50)
);

INSERT INTO referral_sources (name, icon) VALUES
  ('Facebook','facebook'),('Instagram','instagram'),
  ('TikTok','tiktok'),('WhatsApp','whatsapp'),
  ('Recommendation','star'),('Other','globe');

CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID REFERENCES users(id),
  student_id UUID REFERENCES users(id),
  billing_type VARCHAR(20) DEFAULT '8_lessons',
  lesson_count INTEGER DEFAULT 0,
  billing_cycle INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) DEFAULT 'active',
  referral_source_id UUID REFERENCES referral_sources(id),
  referral_notes TEXT,
  enrolled_at TIMESTAMP DEFAULT NOW(),
  lesson_weekdays JSONB DEFAULT '[]'::jsonb,
  lesson_times JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE enrollment_lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  billing_cycle INTEGER NOT NULL DEFAULT 1,
  lesson_number INTEGER NOT NULL,
  starts_at TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','done','absent')),
  marked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT enrollment_lessons_unique UNIQUE (enrollment_id, billing_cycle, lesson_number)
);

CREATE INDEX IF NOT EXISTS idx_enrollment_lessons_enrollment ON enrollment_lessons (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_lessons_starts_at ON enrollment_lessons (starts_at);

CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_date TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','absent','cancelled')),
  lesson_number INTEGER NOT NULL,
  billing_cycle INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT lessons_unique_enrollment_cycle_number UNIQUE (enrollment_id, billing_cycle, lesson_number)
);

CREATE INDEX IF NOT EXISTS idx_lessons_student ON lessons (student_id);
CREATE INDEX IF NOT EXISTS idx_lessons_instructor ON lessons (instructor_id);
CREATE INDEX IF NOT EXISTS idx_lessons_lesson_date ON lessons (lesson_date);
CREATE INDEX IF NOT EXISTS idx_lessons_enrollment ON lessons (enrollment_id);

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID REFERENCES enrollments(id),
  billing_cycle INTEGER NOT NULL DEFAULT 1,
  lesson_number INTEGER,
  date DATE DEFAULT CURRENT_DATE,
  attended BOOLEAN DEFAULT TRUE,
  session_score INTEGER CHECK (session_score BETWEEN 0 AND 100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE otp_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(20),
  code VARCHAR(10),
  expires_at TIMESTAMP,
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  pdf_url VARCHAR(500),
  exam_files JSONB DEFAULT '[]'::jsonb,
  duration_minutes INTEGER DEFAULT 60,
  start_time TIMESTAMP,
  status VARCHAR(20) DEFAULT 'draft',
  notify_before_hours INTEGER,
  notify_enabled BOOLEAN DEFAULT FALSE,
  notify_students BOOLEAN DEFAULT FALSE,
  show_results BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE exam_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(10) CHECK (question_type IN ('closed','open')),
  options JSONB,
  correct_answer VARCHAR(5),
  points INTEGER DEFAULT 10,
  order_num INTEGER,
  negative_marking NUMERIC(6,3) DEFAULT 0
);

CREATE TABLE exam_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES exams(id),
  student_id UUID REFERENCES users(id)
);

CREATE TABLE exam_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES exams(id),
  student_id UUID REFERENCES users(id),
  score NUMERIC(5,2),
  answers JSONB,
  started_at TIMESTAMP,
  submitted_at TIMESTAMP,
  duration_seconds INTEGER
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID REFERENCES enrollments(id),
  student_id UUID REFERENCES users(id),
  amount NUMERIC(10,2),
  currency VARCHAR(5) DEFAULT 'AZN',
  payment_method VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  period VARCHAR(50),
  billing_cycle INTEGER,
  notes TEXT,
  paid_at TIMESTAMP DEFAULT NOW(),
  payment_date DATE
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  title VARCHAR(255),
  body TEXT,
  type VARCHAR(50),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sms_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID REFERENCES users(id),
  phone VARCHAR(20),
  message TEXT,
  status VARCHAR(20),
  sent_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrollments_instructor_id ON enrollments (instructor_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_enrollment_id ON attendance (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_exams_instructor_id ON exams (instructor_id);
CREATE INDEX IF NOT EXISTS idx_exam_assignments_exam_id ON exam_assignments (exam_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role) WHERE is_active = TRUE;
