-- İmtahan/tapşırıq enrollments: pending_setup → active (paket/cədvəl tələb olunmur)

UPDATE enrollments e
SET enrollment_source = 'exam'
FROM exam_access_requests ear
WHERE e.student_id = ear.student_id
  AND e.instructor_id = ear.instructor_id
  AND UPPER(TRIM(ear.status)) IN ('APPROVED', 'PENDING')
  AND COALESCE(LOWER(TRIM(e.enrollment_source)), 'manual') = 'manual'
  AND (e.deleted_at IS NULL);

UPDATE enrollments e
SET enrollment_source = 'task'
FROM task_access_requests tar
WHERE e.student_id = tar.student_id
  AND e.instructor_id = tar.instructor_id
  AND UPPER(TRIM(tar.status)) IN ('APPROVED', 'PENDING')
  AND COALESCE(LOWER(TRIM(e.enrollment_source)), 'manual') = 'manual'
  AND (e.deleted_at IS NULL);

UPDATE enrollments
SET status = 'active',
    configured_at = COALESCE(configured_at, NOW()),
    notifications_enabled = FALSE
WHERE COALESCE(LOWER(TRIM(enrollment_source)), '') IN ('exam', 'task')
  AND COALESCE(LOWER(TRIM(status)), '') = 'pending_setup'
  AND (deleted_at IS NULL);
