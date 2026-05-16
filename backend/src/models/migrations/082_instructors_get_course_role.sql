-- Mövcud müəllimlərə avtomatik Kurs paneli rolu (əl ilə SQL olmadan giriş)
INSERT INTO user_roles (user_id, role, is_active)
SELECT DISTINCT ip.user_id, 'course', TRUE
FROM instructor_profiles ip
INNER JOIN users u ON u.id = ip.user_id AND COALESCE(u.is_active, TRUE) = TRUE
ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;

INSERT INTO course_profiles (user_id, course_name)
SELECT u.id, COALESCE(NULLIF(TRIM(cp.course_name), ''), u.full_name, 'Kursum')
FROM users u
INNER JOIN instructor_profiles ip ON ip.user_id = u.id
LEFT JOIN course_profiles cp ON cp.user_id = u.id
WHERE COALESCE(u.is_active, TRUE) = TRUE
ON CONFLICT (user_id) DO NOTHING;
