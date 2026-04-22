-- Valideyn mətni (parent_id olmadan da). Cədvəl yoxdursa yaradılır.
-- QEYD: DATABASE_URL real Mentorix Postgres olmalıdır (Railway → Postgres → Connect).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS student_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES users(id),
  parent_name VARCHAR(255),
  parent_phone VARCHAR(50),
  grade VARCHAR(50),
  date_of_birth DATE,
  notes TEXT
);

ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS parent_name VARCHAR(255);
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS parent_phone VARCHAR(50);
