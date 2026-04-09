CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20) UNIQUE,
  password_hash VARCHAR(255),
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin','instructor','student','parent')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

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
  grade VARCHAR(50),
  date_of_birth DATE,
  notes TEXT
);

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
  status VARCHAR(20) DEFAULT 'active',
  referral_source_id UUID REFERENCES referral_sources(id),
  referral_notes TEXT,
  enrolled_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID REFERENCES enrollments(id),
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
  pdf_url VARCHAR(500),
  duration_minutes INTEGER DEFAULT 60,
  start_time TIMESTAMP,
  status VARCHAR(20) DEFAULT 'draft',
  notify_before_hours INTEGER,
  notify_enabled BOOLEAN DEFAULT FALSE,
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
  order_num INTEGER
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
  amount NUMERIC(10,2),
  currency VARCHAR(5) DEFAULT 'AZN',
  payment_method VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  period VARCHAR(50),
  notes TEXT,
  paid_at TIMESTAMP DEFAULT NOW()
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
