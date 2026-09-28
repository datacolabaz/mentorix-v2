-- Yüngül engagement izləməsi: materiallar və tapşırıqlar üzrə müəllimə görünən status.
-- Hər tələbə üçün bir status sətri (dublikat sayılmır); ətraflı hadisələr ayrıca saxlanılır.
-- Tapşırıq təqdimi/qiymətləndirməsi üçün mənbə student_assignments olaraq qalır.

-- Materiala son baxış tarixi (istəyə bağlı)
ALTER TABLE course_materials ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;

-- material_assignment: tələbə × material üzrə cari vəziyyət
CREATE TABLE IF NOT EXISTS material_assignments (
  material_id UUID NOT NULL REFERENCES course_materials(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_opened_at TIMESTAMPTZ,
  first_viewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  max_progress_pct SMALLINT NOT NULL DEFAULT 0 CHECK (max_progress_pct BETWEEN 0 AND 100),
  total_active_seconds INTEGER NOT NULL DEFAULT 0,
  open_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (material_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_material_assignments_student ON material_assignments (student_id);
CREATE INDEX IF NOT EXISTS idx_material_assignments_material_activity
  ON material_assignments (material_id, last_activity_at DESC);

-- material_view_event: xam hadisələr (analitika)
CREATE TABLE IF NOT EXISTS material_view_events (
  id BIGSERIAL PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES course_materials(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'material_assigned', 'material_opened', 'material_viewed', 'material_downloaded',
    'video_started', 'video_progressed', 'video_completed'
  )),
  active_seconds INTEGER CHECK (active_seconds IS NULL OR active_seconds >= 0),
  progress_pct SMALLINT CHECK (progress_pct IS NULL OR progress_pct BETWEEN 0 AND 100),
  client_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_material_view_events_material_time
  ON material_view_events (material_id, created_at DESC);
-- Şəbəkə təkrarları eyni hadisəni ikinci dəfə yazmasın
CREATE UNIQUE INDEX IF NOT EXISTS uq_material_view_events_client
  ON material_view_events (student_id, client_event_id)
  WHERE client_event_id IS NOT NULL;

-- assignment_status: açılma/başlama (təqdim və qiymət student_assignments-dadır)
CREATE TABLE IF NOT EXISTS assignment_status (
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_opened_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  PRIMARY KEY (assignment_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_assignment_status_student ON assignment_status (student_id);

-- student_activity_log: bütün engagement hadisələrinin ümumi jurnalı
CREATE TABLE IF NOT EXISTS student_activity_log (
  id BIGSERIAL PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('material', 'assignment', 'exam')),
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'material_assigned', 'material_opened', 'material_viewed', 'material_downloaded',
    'video_started', 'video_progressed', 'video_completed',
    'assignment_opened', 'assignment_started', 'assignment_submitted', 'assignment_graded',
    'exam_started', 'exam_submitted',
    'reminder_sent'
  )),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_student_activity_log_entity
  ON student_activity_log (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_activity_log_student
  ON student_activity_log (student_id, created_at DESC);

-- reminder_log: müəllimin göndərdiyi xatırlatmalar
CREATE TABLE IF NOT EXISTS reminder_log (
  id BIGSERIAL PRIMARY KEY,
  instructor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('material', 'assignment')),
  entity_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'in_app',
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'skipped_recent', 'failed')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reminder_log_entity_student
  ON reminder_log (entity_type, entity_id, student_id, sent_at DESC);
