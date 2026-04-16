-- Rebrand data cleanup (PostgreSQL)
-- Replace stored message bodies/titles containing old brand "Mentorix" -> "Edupanel".
-- Run on Railway Postgres if you have historical rows that still show old brand.

BEGIN;

-- 1) Notifications table (panel internal messages)
UPDATE notifications
SET title = REPLACE(title, 'Mentorix', 'Edupanel')
WHERE title LIKE '%Mentorix%';

UPDATE notifications
SET body = REPLACE(body, 'Mentorix', 'Edupanel')
WHERE body LIKE '%Mentorix%';

-- 2) SMS logs (already-sent SMS text history)
UPDATE sms_logs
SET message = REPLACE(message, 'Mentorix', 'Edupanel')
WHERE message LIKE '%Mentorix%';

COMMIT;

