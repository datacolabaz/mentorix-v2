const db = require('../utils/db');
const getCurrentPlan = require('./billingGetCurrentPlan');
const {
  materialsLimitsForPlan,
  formatBytesLabel,
  evaluateMaterialsUpload,
  STORAGE_LIMIT_MESSAGE,
  MATERIALS_MAX_SINGLE_FILE_BYTES,
} = require('../constants/materialsPlanLimits');

async function getInstructorMaterialsUsage(instructorId) {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(file_size), 0)::bigint AS used_bytes,
            COUNT(*)::int AS file_count
     FROM course_materials
     WHERE instructor_id = $1`,
    [instructorId],
  );
  return {
    used_bytes: Number(rows[0]?.used_bytes) || 0,
    file_count: Number(rows[0]?.file_count) || 0,
  };
}

async function getMaterialsQuota(instructorId) {
  const plan = await getCurrentPlan(db, instructorId);
  const planSlug = plan?.plan || 'basic';
  const limits = materialsLimitsForPlan(planSlug);
  const usage = await getInstructorMaterialsUsage(instructorId);
  const limitBytes = limits.storageBytes;
  const remainingBytes =
    limitBytes == null ? null : Math.max(0, limitBytes - usage.used_bytes);
  const limitReached =
    (limitBytes != null && usage.used_bytes >= limitBytes) ||
    (limits.maxFiles != null && usage.file_count >= limits.maxFiles);

  return {
    plan: planSlug,
    usage,
    limits: {
      storage_bytes: limitBytes,
      max_files: limits.maxFiles,
      max_single_file_bytes: MATERIALS_MAX_SINGLE_FILE_BYTES,
    },
    remaining_bytes: remainingBytes,
    limit_reached: limitReached,
    storage_limit_message: STORAGE_LIMIT_MESSAGE,
    labels: {
      used: formatBytesLabel(usage.used_bytes),
      limit: limitBytes == null ? 'Limitsiz' : formatBytesLabel(limitBytes),
    },
  };
}

async function assertMaterialsUploadAllowed(instructorId, addBytes) {
  const plan = await getCurrentPlan(db, instructorId);
  const usage = await getInstructorMaterialsUsage(instructorId);
  const verdict = evaluateMaterialsUpload({
    planSlug: plan?.plan || 'basic',
    usedBytes: usage.used_bytes,
    fileCount: usage.file_count,
    addBytes,
  });
  if (!verdict.allowed) {
    const err = new Error(verdict.message || STORAGE_LIMIT_MESSAGE);
    err.code = verdict.code || 'MATERIALS_STORAGE_LIMIT';
    err.status = 429;
    throw err;
  }
  return { usage, plan: plan?.plan || 'basic' };
}

async function listInstructorMaterials(instructorId, filters = {}) {
  const params = [instructorId];
  const clauses = ['cm.instructor_id = $1'];
  let i = 2;

  if (filters.group_id) {
    clauses.push(`cm.group_id = $${i++}`);
    params.push(filters.group_id);
  }
  if (filters.subject_id) {
    clauses.push(`cm.subject_id = $${i++}`);
    params.push(filters.subject_id);
  }
  if (filters.assignment_id) {
    clauses.push(`cm.assignment_id = $${i++}`);
    params.push(filters.assignment_id);
  }

  const { rows } = await db.query(
    `SELECT cm.id, cm.title, cm.file_url, cm.file_type, cm.file_size, cm.original_filename,
            cm.group_id, cm.subject_id, cm.enrollment_lesson_id, cm.assignment_id, cm.created_at,
            ig.name AS group_name,
            isub.name AS subject_name,
            a.title AS assignment_title,
            el.lesson_number, el.starts_at AS lesson_starts_at
     FROM course_materials cm
     LEFT JOIN instructor_groups ig ON ig.id = cm.group_id
     LEFT JOIN instructor_subjects isub ON isub.id = cm.subject_id
     LEFT JOIN assignments a ON a.id = cm.assignment_id
     LEFT JOIN enrollment_lessons el ON el.id = cm.enrollment_lesson_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY cm.created_at DESC`,
    params,
  );
  return rows;
}

async function createCourseMaterial({
  instructorId,
  title,
  fileUrl,
  storageFilename,
  fileType,
  fileSize,
  originalFilename,
  groupId,
  subjectId,
  enrollmentLessonId,
  assignmentId,
}) {
  const { rows } = await db.query(
    `INSERT INTO course_materials (
       instructor_id, title, file_url, storage_filename, file_type, file_size, original_filename,
       group_id, subject_id, enrollment_lesson_id, assignment_id
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      instructorId,
      title,
      fileUrl,
      storageFilename,
      fileType,
      fileSize,
      originalFilename || null,
      groupId || null,
      subjectId || null,
      enrollmentLessonId || null,
      assignmentId || null,
    ],
  );
  return rows[0];
}

async function getMaterialById(materialId) {
  const { rows } = await db.query(`SELECT * FROM course_materials WHERE id = $1 LIMIT 1`, [materialId]);
  return rows[0] || null;
}

async function deleteCourseMaterial(instructorId, materialId) {
  const row = await getMaterialById(materialId);
  if (!row || String(row.instructor_id) !== String(instructorId)) return null;
  await db.query('DELETE FROM course_materials WHERE id = $1 AND instructor_id = $2', [materialId, instructorId]);
  return row;
}

async function studentCanAccessMaterial(studentId, material) {
  if (!material || !studentId) return false;

  const { rows: guestRows } = await db.query(
    `SELECT 1 FROM course_material_guest_students
     WHERE material_id = $1::uuid AND student_id = $2::uuid
     LIMIT 1`,
    [material.id, studentId],
  );
  if (guestRows[0]) return true;

  if (material.assignment_id) {
    const { rows } = await db.query(
      `SELECT 1 FROM student_assignments sa
       WHERE sa.assignment_id = $1 AND sa.student_id = $2
       LIMIT 1`,
      [material.assignment_id, studentId],
    );
    if (rows[0]) return true;
  }

  if (material.group_id) {
    const { rows } = await db.query(
      `SELECT 1 FROM instructor_group_members igm
       WHERE igm.group_id = $1 AND igm.student_id = $2
       UNION
       SELECT 1 FROM enrollments e
       WHERE e.group_id = $1 AND e.student_id = $2 AND e.status IN ('active','pending_setup')
       LIMIT 1`,
      [material.group_id, studentId],
    );
    if (rows[0]) return true;
  }

  if (!material.group_id && !material.assignment_id) {
    const { rows } = await db.query(
      `SELECT 1 FROM enrollments e
       WHERE e.instructor_id = $1 AND e.student_id = $2 AND e.status IN ('active','pending_setup')
       LIMIT 1`,
      [material.instructor_id, studentId],
    );
    return Boolean(rows[0]);
  }

  return false;
}

async function listStudentMaterials(studentId, { groupId, enrollmentId } = {}) {
  const params = [studentId];
  let groupClause = '';

  if (groupId) {
    groupClause = 'AND (cm.group_id = $2 OR cm.group_id IS NULL)';
    params.push(groupId);
  } else if (enrollmentId) {
    groupClause = `AND (
      cm.group_id IS NULL
      OR cm.group_id = (SELECT group_id FROM enrollments WHERE id = $2 AND student_id = $1 LIMIT 1)
    )`;
    params.push(enrollmentId);
  }

  const { rows } = await db.query(
    `SELECT DISTINCT cm.id, cm.title, cm.file_url, cm.file_type, cm.file_size, cm.original_filename,
            cm.group_id, cm.assignment_id, cm.created_at,
            ig.name AS group_name,
            a.title AS assignment_title
     FROM course_materials cm
     LEFT JOIN instructor_groups ig ON ig.id = cm.group_id
     LEFT JOIN assignments a ON a.id = cm.assignment_id
     LEFT JOIN instructor_group_members igm ON igm.group_id = cm.group_id AND igm.student_id = $1
     LEFT JOIN enrollments e ON e.group_id = cm.group_id AND e.student_id = $1
         AND e.status IN ('active','pending_setup')
     LEFT JOIN student_assignments sa ON sa.assignment_id = cm.assignment_id AND sa.student_id = $1
     LEFT JOIN course_material_guest_students cmgs ON cmgs.material_id = cm.id AND cmgs.student_id = $1
     WHERE (
       cmgs.material_id IS NOT NULL
       OR (cm.group_id IS NOT NULL AND (igm.student_id IS NOT NULL OR e.id IS NOT NULL))
       OR (cm.assignment_id IS NOT NULL AND sa.id IS NOT NULL)
       OR (cm.group_id IS NULL AND cm.assignment_id IS NULL AND EXISTS (
         SELECT 1 FROM enrollments ex
         WHERE ex.student_id = $1 AND ex.instructor_id = cm.instructor_id
           AND ex.status IN ('active','pending_setup')
       ))
     )
     ${groupClause}
     ORDER BY cm.created_at DESC`,
    params,
  );
  return rows;
}

async function listMaterialsForAssignment(assignmentId, studentId) {
  const { rows } = await db.query(
    `SELECT cm.id, cm.title, cm.file_url, cm.file_type, cm.file_size, cm.original_filename, cm.created_at
     FROM course_materials cm
     JOIN student_assignments sa ON sa.assignment_id = cm.assignment_id AND sa.student_id = $2
     WHERE cm.assignment_id = $1
     ORDER BY cm.created_at ASC`,
    [assignmentId, studentId],
  );
  return rows;
}

async function listUploadOptions(instructorId) {
  const [groupsRes, assignmentsRes, lessonsRes] = await Promise.all([
    db.query(
      `SELECT ig.id, ig.name, ig.subject_id, isub.name AS subject_name
       FROM instructor_groups ig
       JOIN instructor_subjects isub ON isub.id = ig.subject_id
       WHERE ig.instructor_id = $1
       ORDER BY isub.sort_order, isub.name, ig.sort_order, ig.name`,
      [instructorId],
    ),
    db.query(
      `SELECT id, title, group_id, subject_id
       FROM assignments
       WHERE instructor_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [instructorId],
    ),
    db.query(
      `SELECT el.id, el.lesson_number, el.starts_at, e.group_id, ig.name AS group_name
       FROM enrollment_lessons el
       JOIN enrollments e ON e.id = el.enrollment_id
       JOIN instructor_groups ig ON ig.id = e.group_id
       WHERE e.instructor_id = $1 AND e.group_id IS NOT NULL
       ORDER BY el.starts_at DESC
       LIMIT 300`,
      [instructorId],
    ),
  ]);

  return {
    subjects: [...new Map(
      (groupsRes.rows || [])
        .filter((g) => g.subject_id)
        .map((g) => [g.subject_id, { id: g.subject_id, name: g.subject_name }]),
    ).values()],
    groups: groupsRes.rows || [],
    assignments: assignmentsRes.rows || [],
    lessons: lessonsRes.rows || [],
  };
}

module.exports = {
  getInstructorMaterialsUsage,
  getMaterialsQuota,
  assertMaterialsUploadAllowed,
  listInstructorMaterials,
  createCourseMaterial,
  getMaterialById,
  deleteCourseMaterial,
  studentCanAccessMaterial,
  listStudentMaterials,
  listMaterialsForAssignment,
  listUploadOptions,
};
