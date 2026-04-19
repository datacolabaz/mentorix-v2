-- İmtahan səviyyəsində qapalı/çoxseçimli səhvə cərimə (0.25) aktiv/deaktiv
ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS wrong_penalty_enabled BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE exams SET wrong_penalty_enabled = TRUE WHERE wrong_penalty_enabled IS NULL;
