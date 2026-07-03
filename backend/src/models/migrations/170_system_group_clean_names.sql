-- Sistem (link/imtahan) qrupları: [System] prefiksini sil, is_system=true saxla.
-- is_system artıq mövcuddur — ayrıca is_system_generated sütunu lazım deyil.

UPDATE instructor_groups
SET
  name = NULLIF(
    TRIM(
      BOTH FROM regexp_replace(
        regexp_replace(name, '^\[System\]\s*', '', 'i'),
        '\s+Participants\s*$',
        '',
        'i'
      )
    ),
    ''
  ),
  is_system = TRUE
WHERE COALESCE(is_system, FALSE) = TRUE
   OR name ~* '^\[System\]';

UPDATE instructor_groups
SET name = 'İştirakçılar'
WHERE COALESCE(is_system, FALSE) = TRUE
  AND (name IS NULL OR TRIM(name) = '');

UPDATE instructor_subjects
SET
  name = 'Link iştirakçıları',
  is_system = TRUE
WHERE COALESCE(is_system, FALSE) = TRUE
   OR name ~* '^\[System\]';

COMMENT ON COLUMN instructor_groups.is_system IS 'Avtomatik yaradılmış imtahan/tapşırıq (link) iştirakçı qrupu';
