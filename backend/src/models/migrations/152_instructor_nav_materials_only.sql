-- Sidebar: yalnız Kitabxana (Fayl yüklə nav-dan çıxarılır)

UPDATE site_marketing_configs
SET
  payload = jsonb_set(
    payload,
    '{sections}',
    (
      SELECT COALESCE(jsonb_agg(
        CASE
          WHEN elem->>'id' = 'materials' THEN jsonb_set(elem, '{itemKeys}', '["materials_library"]'::jsonb)
          ELSE jsonb_set(
            elem,
            '{itemKeys}',
            COALESCE(
              (
                SELECT jsonb_agg(to_jsonb(k))
                FROM jsonb_array_elements_text(elem->'itemKeys') AS k
                WHERE k <> 'materials_upload'
              ),
              '[]'::jsonb
            )
          )
        END
      ), '[]'::jsonb)
      FROM jsonb_array_elements(payload->'sections') AS elem
    ),
    true
  ),
  updated_at = NOW()
WHERE slug = 'instructor_nav';
