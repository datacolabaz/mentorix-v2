-- Platform səviyyəli feature flag-lar (admin idarə edir) + dəyişiklik audit log-u.
-- Modullar silinmir: flag OFF olanda yalnız route/nav/CTA gizlədilir, data qorunur.

CREATE TABLE IF NOT EXISTS platform_feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS platform_feature_flag_audit (
  id BIGSERIAL PRIMARY KEY,
  flag_key TEXT NOT NULL,
  old_enabled BOOLEAN,
  new_enabled BOOLEAN NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_platform_feature_flag_audit_key_time
  ON platform_feature_flag_audit (flag_key, changed_at DESC);

INSERT INTO platform_feature_flags (key, enabled, description) VALUES
  ('feature.university_search.enabled', FALSE, 'Universitet və proqram axtarışı, müraciətlər'),
  ('feature.marketplace.enabled', FALSE, 'Müəllim marketplace-i: xəritə, kəşf, AI axtarış, müraciətlər, seçilmişlər'),
  ('feature.mentor_services.enabled', FALSE, 'Mentor kabineti və mentorluq xidmətləri'),
  ('feature.live_room.enabled', FALSE, 'Daxili Mentorix Live otağı (LiveKit). Zoom/Google Meet dərsləri buna daxil deyil'),
  ('feature.exam_result_modes.enabled', TRUE, 'İmtahan nəticələrinin göstərilmə rejimləri'),
  ('feature.proctoring.enabled', FALSE, 'Kamera ilə nəzarət (proctoring). Ayrıca mərhələdə açılacaq')
ON CONFLICT (key) DO NOTHING;
