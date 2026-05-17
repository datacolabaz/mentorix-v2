-- Org CRM: fərdi müəllim qrupları (instructor_groups → course_groups sync) təmizlə
DELETE FROM course_group_members cgm
USING course_groups cg
INNER JOIN courses c ON c.id = cg.course_id
WHERE cgm.group_id = cg.id
  AND COALESCE(c.is_organization, FALSE) = TRUE
  AND cg.instructor_group_id IS NOT NULL;

DELETE FROM course_groups cg
USING courses c
WHERE cg.course_id = c.id
  AND COALESCE(c.is_organization, FALSE) = TRUE
  AND cg.instructor_group_id IS NOT NULL;

COMMENT ON COLUMN course_groups.instructor_group_id IS 'NULL = kurs CRM qrupu; dolu = köhnə müəllim paneli sync (org-da göstərilmir)';
