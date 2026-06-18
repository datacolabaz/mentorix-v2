-- Kitabxana yalnız MATERİALLAR bölməsində qalsın (MANAGEMENT-dən çıxarılır).

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
                WHERE k NOT IN ('materials_upload', 'materials_library')
              ),
              '[]'::jsonb
            )
          )
        END
        ORDER BY ord
      ), '[]'::jsonb)
      FROM jsonb_array_elements(payload->'sections') WITH ORDINALITY AS t(elem, ord)
    ),
    true
  ),
  updated_at = NOW()
WHERE slug = 'instructor_nav';
