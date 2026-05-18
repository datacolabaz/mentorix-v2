-- 084 avtomatik "Ümumi kurs" saxta kartını sil (müəllim kataloqu); org kurslara toxunulmur
UPDATE payments p
SET course_id = NULL
FROM courses c
WHERE p.course_id = c.id
  AND COALESCE(c.is_organization, FALSE) = FALSE
  AND TRIM(c.name) = 'Ümumi kurs';

UPDATE enrollments e
SET course_id = NULL
FROM courses c
WHERE e.course_id = c.id
  AND COALESCE(c.is_organization, FALSE) = FALSE
  AND TRIM(c.name) = 'Ümumi kurs';

DELETE FROM course_students cs
USING courses c
WHERE cs.course_id = c.id
  AND COALESCE(c.is_organization, FALSE) = FALSE
  AND TRIM(c.name) = 'Ümumi kurs';

DELETE FROM course_groups cg
USING courses c
WHERE cg.course_id = c.id
  AND COALESCE(c.is_organization, FALSE) = FALSE
  AND TRIM(c.name) = 'Ümumi kurs';

DELETE FROM courses
WHERE COALESCE(is_organization, FALSE) = FALSE
  AND TRIM(name) = 'Ümumi kurs';
