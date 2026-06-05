-- Mövcud imtahan/tapşırıq təyinatları → iştirakçı qrup üzvlüyü (135 cədvəlindən sonra)

INSERT INTO instructor_group_members (
  instructor_id, student_id, group_id, subject_id, membership_source, source_ref_id, joined_at
)
SELECT e.instructor_id, ea.student_id, ig.id, ig.subject_id, 'exam', e.id, NOW()
FROM exam_assignments ea
JOIN exams e ON e.id = ea.exam_id
JOIN instructor_groups ig ON ig.id = e.participant_group_id
WHERE ig.id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO instructor_group_members (
  instructor_id, student_id, group_id, subject_id, membership_source, source_ref_id, joined_at
)
SELECT t.instructor_id, sa.student_id, ig.id, ig.subject_id, 'task', t.id, NOW()
FROM student_assignments sa
JOIN assignments t ON t.id = sa.assignment_id
JOIN instructor_groups ig ON ig.id = t.participant_group_id
WHERE ig.id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Yüngül enrollment (qrupsuz): birinci iştirakçı qrupunu enrollment-a yaz
UPDATE enrollments en
SET group_id = gm.group_id,
    subject_id = gm.subject_id,
    enrollment_source = gm.membership_source,
    status = 'active',
    configured_at = COALESCE(en.configured_at, NOW()),
    notifications_enabled = FALSE
FROM (
  SELECT DISTINCT ON (igm.student_id, igm.instructor_id)
         igm.student_id, igm.instructor_id, igm.group_id, igm.subject_id, igm.membership_source
  FROM instructor_group_members igm
  ORDER BY igm.student_id, igm.instructor_id, igm.joined_at ASC
) gm
WHERE en.student_id = gm.student_id
  AND en.instructor_id = gm.instructor_id
  AND en.deleted_at IS NULL
  AND en.group_id IS NULL
  AND COALESCE(LOWER(TRIM(en.status)), '') NOT IN ('rejected', 'left', 'archived');
