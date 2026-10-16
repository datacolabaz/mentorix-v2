-- Faithful legacy boundary fixture, not a replacement baseline or production seed.
CREATE FUNCTION uuid_generate_v4() RETURNS UUID LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
CREATE TABLE users (id UUID PRIMARY KEY, role TEXT NOT NULL);
CREATE TABLE instructor_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), instructor_id UUID NOT NULL REFERENCES users(id), name TEXT
);
CREATE TABLE course_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), instructor_id UUID NOT NULL REFERENCES users(id),
  file_type TEXT, file_url TEXT, original_filename TEXT
);
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), instructor_id UUID REFERENCES users(id), title TEXT NOT NULL
);
CREATE TABLE exam_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  question_type VARCHAR(10) CHECK (question_type IN ('closed','open','matching','multiple','sequence')),
  question_text TEXT, correct_answer VARCHAR(120), options JSONB, points NUMERIC(8,2)
);
CREATE TABLE exam_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), exam_id UUID REFERENCES exams(id),
  student_id UUID REFERENCES users(id), score NUMERIC(5,2), status VARCHAR(20) DEFAULT 'completed', answers JSONB
);
CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY);

-- Stable fixture IDs use prefixes: users 1, subjects 2, materials 3, exams 4,
-- legacy questions 5, attempts 6, topics 7, PDFs 8, bank questions 9, banks a.
INSERT INTO users VALUES
 ('10000000-0000-4000-8000-000000000001','instructor'),
 ('10000000-0000-4000-8000-000000000002','instructor'),
 ('10000000-0000-4000-8000-000000000003','student'),
 ('10000000-0000-4000-8000-000000000004','student'),
 ('10000000-0000-4000-8000-000000000005','admin');
INSERT INTO instructor_subjects VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Math'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Other teacher');
INSERT INTO course_materials VALUES
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','application/pdf','/api/materials/file/owned.pdf','owned.pdf'),
 ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','image/png','/api/materials/file/image.png','image.png'),
 ('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','application/pdf','/api/materials/file/other.pdf','other.pdf');
INSERT INTO exams VALUES
 ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Existing exam'),
 ('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Other exam');
INSERT INTO exam_questions (id,exam_id,question_type,question_text,points) VALUES
 ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','closed','Legacy choice',2),
 ('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','open','Legacy open',3),
 ('50000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','open','Legacy file',4),
 ('50000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000002','closed','Other exam choice',5);
INSERT INTO exam_results (id,exam_id,student_id,score,answers) VALUES
 ('60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003',50,'{"legacy":"A"}'),
 ('60000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004',75,'{}'),
 ('60000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004',0,'{}');
CREATE TABLE legacy_result_baseline AS SELECT * FROM exam_results;
CREATE TABLE legacy_question_baseline AS SELECT * FROM exam_questions;
