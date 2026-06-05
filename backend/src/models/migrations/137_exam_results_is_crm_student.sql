-- İmtahan nəticələrində CRM (daimi qrup) vs qonaq iştirakçı ayrımı
ALTER TABLE exam_results
  ADD COLUMN IF NOT EXISTS is_crm_student BOOLEAN;

COMMENT ON COLUMN exam_results.is_crm_student IS 'TRUE: müəllimin rəsmi tədris qrupunda; FALSE: yalnız imtahan linki ilə qonaq';

UPDATE exam_results er
SET is_crm_student = EXISTS (
  SELECT 1
  FROM exams e
  JOIN enrollments en
    ON en.student_id = er.student_id
   AND en.instructor_id = e.instructor_id
  JOIN instructor_groups ig ON ig.id = en.group_id
  WHERE e.id = er.exam_id
    AND en.deleted_at IS NULL
    AND en.group_id IS NOT NULL
    AND COALESCE(ig.is_system, FALSE) = FALSE
    AND COALESCE(LOWER(TRIM(en.status)), '') NOT IN ('rejected', 'left', 'archived', 'deleted')
)
WHERE er.is_crm_student IS NULL;

UPDATE exam_results SET is_crm_student = COALESCE(is_crm_student, FALSE) WHERE is_crm_student IS NULL;
