-- Email-first notifications: new preference/notification categories.
--   live_lesson — canlı dərs (Meet/Zoom linki) yaradılması, dəyişməsi, ləğvi, xatırlatma
--   parent      — valideynə tələbə nəticə xülasəsi
--   digest      — müəllimə həftəlik nəticə və aktivlik xülasəsi
--   marketing   — məhsul yenilikləri (yalnız istifadəçi açarsa; default OFF)
-- Only CHECK constraints change; both are re-added NOT VALID (no table scan, existing rows untouched).
-- Rollback (manual): backend/scripts/sql/rollback/225_notification_categories_email_first.rollback.sql

SET LOCAL lock_timeout = '10s';

ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_category_check;
ALTER TABLE notification_preferences
  ADD CONSTRAINT notification_preferences_category_check
  CHECK (
    category IN (
      'security', 'assessment', 'assignment', 'material', 'group', 'grading', 'partner', 'billing', 'system',
      'live_lesson', 'parent', 'digest', 'marketing'
    )
  ) NOT VALID;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_category_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_category_check
  CHECK (
    category IS NULL
    OR category IN (
      'security', 'assessment', 'assignment', 'material', 'group', 'grading', 'partner', 'billing', 'system',
      'live_lesson', 'parent', 'digest', 'marketing'
    )
  ) NOT VALID;
