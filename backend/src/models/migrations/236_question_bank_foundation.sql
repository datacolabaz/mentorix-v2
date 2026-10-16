-- Question bank, phase 1: schema only. Existing exam APIs/renderers are unchanged.
-- Subject = instructor_subjects; Exam = exams; ExamAttempt = exam_results.
-- Companion tables keep private answer keys out of legacy SELECT * responses.
-- The migration runner owns the transaction. Manual rollback is in scripts/sql/rollback.

-- Composite keys enforce ownership and exam/attempt boundaries without changing old rows.
CREATE UNIQUE INDEX IF NOT EXISTS qb_subject_owner_key ON instructor_subjects (id, instructor_id);
CREATE UNIQUE INDEX IF NOT EXISTS qb_material_owner_key ON course_materials (id, instructor_id);
CREATE UNIQUE INDEX IF NOT EXISTS qb_exam_owner_key ON exams (id, instructor_id);
CREATE UNIQUE INDEX IF NOT EXISTS qb_exam_question_key ON exam_questions (id, exam_id);
CREATE UNIQUE INDEX IF NOT EXISTS qb_attempt_identity_key ON exam_results (id, exam_id, student_id);

CREATE TABLE IF NOT EXISTS question_bank_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  parent_topic_id UUID,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, subject_id, created_by),
  FOREIGN KEY (subject_id, created_by) REFERENCES instructor_subjects(id, instructor_id) ON DELETE RESTRICT,
  FOREIGN KEY (parent_topic_id, subject_id, created_by)
    REFERENCES question_bank_topics(id, subject_id, created_by) ON DELETE RESTRICT,
  CHECK (parent_topic_id IS NULL OR parent_topic_id <> id)
);
CREATE INDEX IF NOT EXISTS qb_topics_parent ON question_bank_topics (created_by, subject_id, parent_topic_id);

CREATE TABLE IF NOT EXISTS source_pdfs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID NOT NULL UNIQUE,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subject_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, subject_id, uploaded_by),
  FOREIGN KEY (material_id, uploaded_by) REFERENCES course_materials(id, instructor_id) ON DELETE RESTRICT,
  FOREIGN KEY (subject_id, uploaded_by) REFERENCES instructor_subjects(id, instructor_id) ON DELETE RESTRICT
);
COMMENT ON TABLE source_pdfs IS
  'Private PDF source only. file_url/file_name are read from course_materials; no second blob or public URL.';

CREATE TABLE IF NOT EXISTS question_banks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  description TEXT,
  saved_filters JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(saved_filters) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, created_by)
);

CREATE TABLE IF NOT EXISTS bank_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subject_id UUID NOT NULL,
  topic_id UUID,
  source_pdf_id UUID,
  source_page INTEGER CHECK (source_page > 0),
  question_text TEXT NOT NULL CHECK (length(trim(question_text)) > 0),
  question_type TEXT NOT NULL CHECK (question_type IN (
    'single_choice', 'multiple_choice', 'true_false', 'short_answer', 'numeric',
    'matching', 'ordering', 'open_answer', 'file_upload'
  )),
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  points NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (points > 0 AND points <> 'NaN'::numeric),
  explanation TEXT,
  answer_key JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(answer_key) = 'object'),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, created_by),
  UNIQUE (id, subject_id, created_by),
  FOREIGN KEY (subject_id, created_by) REFERENCES instructor_subjects(id, instructor_id) ON DELETE RESTRICT,
  FOREIGN KEY (topic_id, subject_id, created_by)
    REFERENCES question_bank_topics(id, subject_id, created_by) ON DELETE RESTRICT,
  FOREIGN KEY (source_pdf_id, subject_id, created_by)
    REFERENCES source_pdfs(id, subject_id, uploaded_by) ON DELETE RESTRICT,
  CHECK (source_page IS NULL OR source_pdf_id IS NOT NULL),
  CHECK (status <> 'published' OR question_type IN ('open_answer', 'file_upload') OR answer_key <> '{}'::jsonb)
);
CREATE INDEX IF NOT EXISTS qb_questions_filter ON bank_questions (created_by, subject_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS qb_questions_topic ON bank_questions (created_by, topic_id) WHERE topic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS qb_questions_type_difficulty ON bank_questions (created_by, question_type, difficulty);
CREATE INDEX IF NOT EXISTS qb_questions_source ON bank_questions (source_pdf_id) WHERE source_pdf_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS qb_questions_search ON bank_questions USING GIN (to_tsvector('simple', question_text));

CREATE TABLE IF NOT EXISTS question_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES bank_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL CHECK (length(trim(option_text)) > 0),
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  order_num INTEGER NOT NULL CHECK (order_num > 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  UNIQUE (question_id, order_num)
);
COMMENT ON COLUMN question_options.metadata IS 'Type-specific display data, e.g. a matching right-hand label; never a replacement for answer_key.';

CREATE TABLE IF NOT EXISTS question_bank_items (
  bank_id UUID NOT NULL,
  question_id UUID NOT NULL,
  created_by UUID NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bank_id, question_id),
  FOREIGN KEY (bank_id, created_by) REFERENCES question_banks(id, created_by) ON DELETE CASCADE,
  FOREIGN KEY (question_id, created_by) REFERENCES bank_questions(id, created_by) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS qb_items_question ON question_bank_items (question_id);

CREATE TABLE IF NOT EXISTS exam_bank_settings (
  exam_id UUID PRIMARY KEY,
  created_by UUID NOT NULL,
  subject_id UUID NOT NULL,
  exam_type TEXT NOT NULL DEFAULT 'exam' CHECK (length(trim(exam_type)) BETWEEN 1 AND 50),
  shuffle_questions BOOLEAN NOT NULL DEFAULT FALSE,
  shuffle_options BOOLEAN NOT NULL DEFAULT FALSE,
  display_mode TEXT NOT NULL DEFAULT 'all' CHECK (display_mode IN ('all', 'step')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_id, created_by),
  UNIQUE (exam_id, subject_id, created_by),
  FOREIGN KEY (exam_id, created_by) REFERENCES exams(id, instructor_id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id, created_by) REFERENCES instructor_subjects(id, instructor_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS exam_bank_questions (
  exam_question_id UUID PRIMARY KEY,
  exam_id UUID NOT NULL,
  created_by UUID NOT NULL,
  bank_question_id UUID NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN (
    'single_choice', 'multiple_choice', 'true_false', 'short_answer', 'numeric',
    'matching', 'ordering', 'open_answer', 'file_upload'
  )),
  subject_id UUID NOT NULL,
  topic_id UUID,
  points NUMERIC(10,2) NOT NULL CHECK (points > 0 AND points <> 'NaN'::numeric),
  snapshot_version INTEGER NOT NULL DEFAULT 1 CHECK (snapshot_version = 1),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_question_id, exam_id),
  FOREIGN KEY (exam_question_id, exam_id) REFERENCES exam_questions(id, exam_id) ON DELETE CASCADE,
  FOREIGN KEY (exam_id, subject_id, created_by)
    REFERENCES exam_bank_settings(exam_id, subject_id, created_by) ON DELETE CASCADE,
  FOREIGN KEY (bank_question_id, subject_id, created_by)
    REFERENCES bank_questions(id, subject_id, created_by) ON DELETE RESTRICT,
  FOREIGN KEY (subject_id, created_by) REFERENCES instructor_subjects(id, instructor_id) ON DELETE RESTRICT,
  FOREIGN KEY (topic_id, subject_id, created_by)
    REFERENCES question_bank_topics(id, subject_id, created_by) ON DELETE RESTRICT,
  CHECK (snapshot ? 'question_type' AND snapshot->>'question_type' IS NOT DISTINCT FROM question_type),
  CHECK (snapshot ? 'question_text' AND jsonb_typeof(snapshot->'question_text') = 'string'
    AND length(trim(snapshot->>'question_text')) > 0),
  CHECK (snapshot ? 'answer_key' AND jsonb_typeof(snapshot->'answer_key') = 'object'),
  CHECK (snapshot ? 'options' AND jsonb_typeof(snapshot->'options') = 'array')
);
COMMENT ON TABLE exam_bank_questions IS
  'Frozen exam copy, including private answer_key/options/explanation. Never return snapshot through student payloads.';
CREATE INDEX IF NOT EXISTS qb_exam_questions_exam ON exam_bank_questions (exam_id);
CREATE INDEX IF NOT EXISTS qb_exam_questions_source ON exam_bank_questions (bank_question_id);
CREATE INDEX IF NOT EXISTS qb_exam_questions_analytics ON exam_bank_questions (created_by, topic_id, question_type);

CREATE TABLE IF NOT EXISTS exam_attempt_details (
  attempt_id UUID PRIMARY KEY,
  exam_id UUID NOT NULL REFERENCES exam_bank_settings(exam_id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  max_score NUMERIC(10,2) NOT NULL CHECK (max_score > 0 AND max_score <> 'NaN'::numeric),
  raw_score NUMERIC(10,2) CHECK (raw_score >= 0 AND raw_score <= max_score),
  question_order UUID[] NOT NULL CHECK (cardinality(question_order) > 0 AND array_ndims(question_order) = 1),
  option_order JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(option_order) = 'object'),
  UNIQUE (attempt_id, exam_id),
  FOREIGN KEY (attempt_id, exam_id, student_id)
    REFERENCES exam_results(id, exam_id, student_id) ON DELETE CASCADE
);
COMMENT ON TABLE exam_attempt_details IS
  'ExamAttempt companion to exam_results: raw score and stable per-attempt shuffles. Legacy score/status/answers remain unchanged.';
CREATE INDEX IF NOT EXISTS qb_attempts_exam ON exam_attempt_details (exam_id, student_id);

CREATE TABLE IF NOT EXISTS exam_answers (
  attempt_id UUID NOT NULL,
  question_id UUID NOT NULL,
  exam_id UUID NOT NULL,
  answer_data JSONB NOT NULL DEFAULT 'null'::jsonb,
  is_correct BOOLEAN,
  awarded_points NUMERIC(10,2) CHECK (awarded_points >= 0 AND awarded_points <> 'NaN'::numeric),
  status TEXT NOT NULL DEFAULT 'unanswered'
    CHECK (status IN ('unanswered', 'answered', 'auto_graded', 'pending_review', 'reviewed')),
  teacher_feedback TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (attempt_id, question_id),
  FOREIGN KEY (attempt_id, exam_id) REFERENCES exam_attempt_details(attempt_id, exam_id) ON DELETE CASCADE,
  FOREIGN KEY (question_id, exam_id) REFERENCES exam_bank_questions(exam_question_id, exam_id) ON DELETE CASCADE,
  CHECK ((status IN ('auto_graded', 'reviewed') AND awarded_points IS NOT NULL)
    OR (status IN ('unanswered', 'answered', 'pending_review') AND awarded_points IS NULL AND is_correct IS NULL)),
  CHECK (status <> 'auto_graded' OR is_correct IS NOT NULL),
  CHECK (status <> 'reviewed' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS qb_answers_review ON exam_answers (exam_id, status) WHERE status = 'pending_review';
CREATE INDEX IF NOT EXISTS qb_answers_question ON exam_answers (question_id);

CREATE TABLE IF NOT EXISTS exam_answer_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID NOT NULL,
  question_id UUID NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  file_name TEXT NOT NULL CHECK (length(trim(file_name)) BETWEEN 1 AND 255),
  content_type TEXT NOT NULL CHECK (length(trim(content_type)) > 0),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 26214400),
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (attempt_id, question_id) REFERENCES exam_answers(attempt_id, question_id) ON DELETE CASCADE,
  CHECK (octet_length(data) = byte_size)
);
COMMENT ON TABLE exam_answer_files IS
  'Private student upload blobs, using the existing durable Postgres blob pattern. Authenticated delivery only.';
CREATE INDEX IF NOT EXISTS qb_answer_files_answer ON exam_answer_files (attempt_id, question_id);

CREATE OR REPLACE FUNCTION qb_touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS qb_topics_touch ON question_bank_topics;
CREATE TRIGGER qb_topics_touch BEFORE UPDATE ON question_bank_topics FOR EACH ROW EXECUTE FUNCTION qb_touch_updated_at();
DROP TRIGGER IF EXISTS qb_banks_touch ON question_banks;
CREATE TRIGGER qb_banks_touch BEFORE UPDATE ON question_banks FOR EACH ROW EXECUTE FUNCTION qb_touch_updated_at();
DROP TRIGGER IF EXISTS qb_questions_touch ON bank_questions;
CREATE TRIGGER qb_questions_touch BEFORE UPDATE ON bank_questions FOR EACH ROW EXECUTE FUNCTION qb_touch_updated_at();
DROP TRIGGER IF EXISTS qb_answers_touch ON exam_answers;
CREATE TRIGGER qb_answers_touch BEFORE UPDATE ON exam_answers FOR EACH ROW EXECUTE FUNCTION qb_touch_updated_at();

CREATE OR REPLACE FUNCTION qb_guard_topic_cycle() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Serialize edits of one subject's tree, including concurrent reparenting.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.subject_id::text, 236));
  IF NEW.parent_topic_id IS NOT NULL AND EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_topic_id FROM question_bank_topics WHERE id = NEW.parent_topic_id
      UNION
      SELECT t.id, t.parent_topic_id FROM question_bank_topics t JOIN ancestors a ON t.id = a.parent_topic_id
    )
    SELECT 1 FROM ancestors WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Question bank topic cycle' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS qb_topics_cycle ON question_bank_topics;
CREATE TRIGGER qb_topics_cycle BEFORE INSERT OR UPDATE OF parent_topic_id, subject_id ON question_bank_topics
  FOR EACH ROW EXECUTE FUNCTION qb_guard_topic_cycle();

CREATE OR REPLACE FUNCTION qb_guard_pdf() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM course_materials WHERE id = NEW.material_id AND instructor_id = NEW.uploaded_by
      AND lower(trim(file_type)) = 'application/pdf'
    FOR SHARE
  ) THEN
    RAISE EXCEPTION 'Source must be an owned PDF material' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS qb_source_pdf_type ON source_pdfs;
CREATE TRIGGER qb_source_pdf_type BEFORE INSERT OR UPDATE ON source_pdfs
  FOR EACH ROW EXECUTE FUNCTION qb_guard_pdf();

CREATE OR REPLACE FUNCTION qb_guard_material_pdf() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF lower(trim(NEW.file_type)) IS DISTINCT FROM 'application/pdf'
    AND EXISTS (SELECT 1 FROM source_pdfs WHERE material_id = OLD.id) THEN
    RAISE EXCEPTION 'A source PDF must remain a PDF' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS qb_material_pdf_type ON course_materials;
CREATE TRIGGER qb_material_pdf_type BEFORE UPDATE OF file_type ON course_materials
  FOR EACH ROW EXECUTE FUNCTION qb_guard_material_pdf();

CREATE OR REPLACE FUNCTION qb_guard_attempt_order() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE expected_count INTEGER; actual_count INTEGER; distinct_count INTEGER; expected_score NUMERIC;
BEGIN
  SELECT count(*), sum(points) INTO expected_count, expected_score FROM exam_bank_questions WHERE exam_id = NEW.exam_id;
  SELECT count(*), count(DISTINCT q) INTO actual_count, distinct_count FROM unnest(NEW.question_order) q;
  IF expected_count = 0 OR NEW.max_score IS DISTINCT FROM expected_score
    OR actual_count <> expected_count OR distinct_count <> actual_count OR EXISTS (
    SELECT 1 FROM unnest(NEW.question_order) q
    WHERE NOT EXISTS (SELECT 1 FROM exam_bank_questions WHERE exam_id = NEW.exam_id AND exam_question_id = q)
  ) THEN
    RAISE EXCEPTION 'Attempt question order must contain each exam question exactly once' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS qb_attempt_order ON exam_attempt_details;
CREATE TRIGGER qb_attempt_order BEFORE INSERT OR UPDATE OF question_order, exam_id, max_score ON exam_attempt_details
  FOR EACH ROW EXECUTE FUNCTION qb_guard_attempt_order();

CREATE OR REPLACE FUNCTION qb_guard_answer_grade() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE q_type TEXT; q_points NUMERIC; owner_id UUID;
BEGIN
  SELECT q.question_type, q.points, q.created_by INTO q_type, q_points, owner_id
    FROM exam_bank_questions q WHERE q.exam_question_id = NEW.question_id AND q.exam_id = NEW.exam_id;
  IF q_type IN ('open_answer', 'file_upload') AND NEW.status = 'auto_graded' THEN
    RAISE EXCEPTION 'Open and file answers require manual review' USING ERRCODE = '23514';
  END IF;
  IF NEW.awarded_points > q_points THEN
    RAISE EXCEPTION 'Awarded points exceed exam question points' USING ERRCODE = '23514';
  END IF;
  IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_by <> owner_id AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = NEW.reviewed_by AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Reviewer must own the exam or be an admin' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS qb_answer_grade ON exam_answers;
CREATE TRIGGER qb_answer_grade BEFORE INSERT OR UPDATE ON exam_answers
  FOR EACH ROW EXECUTE FUNCTION qb_guard_answer_grade();

CREATE OR REPLACE FUNCTION qb_guard_answer_file() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM exam_attempt_details a
    JOIN exam_answers answer ON answer.attempt_id = a.attempt_id AND answer.question_id = NEW.question_id
    JOIN exam_bank_questions q ON q.exam_question_id = answer.question_id
    WHERE a.attempt_id = NEW.attempt_id AND a.student_id = NEW.uploaded_by AND q.question_type = 'file_upload'
  ) THEN
    RAISE EXCEPTION 'Only the attempt student may upload to a file question' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS qb_answer_file ON exam_answer_files;
CREATE TRIGGER qb_answer_file BEFORE INSERT OR UPDATE ON exam_answer_files
  FOR EACH ROW EXECUTE FUNCTION qb_guard_answer_file();
