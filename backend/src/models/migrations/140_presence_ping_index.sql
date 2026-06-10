-- Online presence (presence_ping) sorğuları üçün
CREATE INDEX IF NOT EXISTS idx_access_events_presence_recent
  ON access_events (created_at DESC)
  WHERE event_type = 'presence_ping';
