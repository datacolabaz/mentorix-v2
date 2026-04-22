-- Rebrand data cleanup (PostgreSQL)
-- Replace stored message bodies/titles containing old brand "Edupanel" -> "Mentorix".
-- Run on Railway Postgres if you have historical rows that still show old brand.

BEGIN;

-- 1) Notifications table (panel internal messages)
UPDATE notifications
SET title = REPLACE(title, 'Edupanel', 'Mentorix')
WHERE title LIKE '%Edupanel%';

UPDATE notifications
SET body = REPLACE(body, 'Edupanel', 'Mentorix')
WHERE body LIKE '%Edupanel%';

-- 2) SMS logs (already-sent SMS text history)
UPDATE sms_logs
SET message = REPLACE(message, 'Edupanel', 'Mentorix')
WHERE message LIKE '%Edupanel%';

COMMIT;

