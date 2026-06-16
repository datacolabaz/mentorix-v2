-- Chat message attachments (images, PDF).

BEGIN;

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS attachment_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT NULL;

COMMIT;
