-- Soft-deleted users must not keep google_sub / stay "active".
-- Zombie rows (deleted_at set, email wiped, google_sub kept) were still
-- loggable via Google and landed as iştirakçı while admin email search missed them.

BEGIN;

UPDATE users
SET
  is_active = FALSE,
  google_sub = NULL
WHERE deleted_at IS NOT NULL
  AND (
    COALESCE(is_active, TRUE) = TRUE
    OR TRIM(COALESCE(google_sub::text, '')) <> ''
  );

COMMIT;
