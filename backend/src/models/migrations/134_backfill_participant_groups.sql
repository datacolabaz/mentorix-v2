-- Mövcud imtahan/tapşırıqlar üçün sistem iştirakçı qrupları (üzvlük 135-dən sonra)

DO $$
DECLARE
  r RECORD;
  sub_id UUID;
  grp_id UUID;
  gname TEXT;
BEGIN
  FOR r IN
    SELECT DISTINCT instructor_id
    FROM (
      SELECT instructor_id FROM exams WHERE participant_group_id IS NULL
      UNION
      SELECT instructor_id FROM assignments WHERE participant_group_id IS NULL
    ) x
  LOOP
    SELECT id INTO sub_id
    FROM instructor_subjects
    WHERE instructor_id = r.instructor_id AND is_system = TRUE
    LIMIT 1;
    IF sub_id IS NULL THEN
      INSERT INTO instructor_subjects (instructor_id, name, sort_order, is_system)
      VALUES (r.instructor_id, '[System] Participants', 9999, TRUE)
      RETURNING id INTO sub_id;
    END IF;
  END LOOP;

  FOR r IN SELECT id, instructor_id, title FROM exams WHERE participant_group_id IS NULL LOOP
    SELECT id INTO sub_id FROM instructor_subjects WHERE instructor_id = r.instructor_id AND is_system = TRUE LIMIT 1;
    gname := '[System] ' || LEFT(COALESCE(NULLIF(TRIM(r.title), ''), 'İmtahan'), 160) || ' Participants';
    SELECT id INTO grp_id FROM instructor_groups
    WHERE instructor_id = r.instructor_id AND is_system = TRUE AND system_kind = 'exam_participants' AND system_ref_id = r.id
    LIMIT 1;
    IF grp_id IS NULL THEN
      INSERT INTO instructor_groups (
        instructor_id, subject_id, name, sort_order, is_system, system_kind, system_ref_id,
        default_notifications_enabled, default_lesson_weekdays, default_lesson_times, default_lesson_end_times
      ) VALUES (
        r.instructor_id, sub_id, gname, 0, TRUE, 'exam_participants', r.id, FALSE, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb
      )
      RETURNING id INTO grp_id;
    END IF;
    IF grp_id IS NOT NULL THEN
      UPDATE exams SET participant_group_id = grp_id WHERE id = r.id;
    END IF;
  END LOOP;

  FOR r IN SELECT id, instructor_id, title FROM assignments WHERE participant_group_id IS NULL LOOP
    SELECT id INTO sub_id FROM instructor_subjects WHERE instructor_id = r.instructor_id AND is_system = TRUE LIMIT 1;
    gname := '[System] ' || LEFT(COALESCE(NULLIF(TRIM(r.title), ''), 'Tapşırıq'), 160) || ' Participants';
    SELECT id INTO grp_id FROM instructor_groups
    WHERE instructor_id = r.instructor_id AND is_system = TRUE AND system_kind = 'assignment_participants' AND system_ref_id = r.id
    LIMIT 1;
    IF grp_id IS NULL THEN
      INSERT INTO instructor_groups (
        instructor_id, subject_id, name, sort_order, is_system, system_kind, system_ref_id,
        default_notifications_enabled, default_lesson_weekdays, default_lesson_times, default_lesson_end_times
      ) VALUES (
        r.instructor_id, sub_id, gname, 0, TRUE, 'assignment_participants', r.id, FALSE, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb
      )
      RETURNING id INTO grp_id;
    END IF;
    IF grp_id IS NOT NULL THEN
      UPDATE assignments SET participant_group_id = grp_id WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
