-- Mövcud axtarış profillərini region/rayon ilə doldur
UPDATE instructor_profiles ip
SET region = sa.name_az
FROM instructor_service_areas isa
INNER JOIN service_areas sa ON sa.id = isa.area_id
WHERE isa.user_id = ip.user_id
  AND ip.region IS NULL
  AND sa.kind = 'region';

UPDATE instructor_profiles ip
SET region = 'Bakı',
    baku_district = sa.name_az
FROM instructor_service_areas isa
INNER JOIN service_areas sa ON sa.id = isa.area_id
WHERE isa.user_id = ip.user_id
  AND ip.region IS NULL
  AND sa.kind = 'district';

UPDATE instructor_profiles
SET region = 'Bakı'
WHERE region IS NULL
  AND COALESCE(map_visible, TRUE) = TRUE
  AND latitude IS NOT NULL;
