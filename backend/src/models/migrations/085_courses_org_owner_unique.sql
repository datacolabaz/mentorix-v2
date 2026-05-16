-- Tədris mərkəzi (org) üçün sahib başına bir sətir; tədris kursları (is_organization=false) çox ola bilər
CREATE UNIQUE INDEX IF NOT EXISTS courses_owner_org_unique
  ON courses (owner_user_id)
  WHERE COALESCE(is_organization, FALSE) = TRUE AND owner_user_id IS NOT NULL;
