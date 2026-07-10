const crypto = require('crypto');
const db = require('../utils/db');

function normalizeTags(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(/[,\s#]+/);
  return [...new Set(list.map((t) => String(t || '').trim().replace(/^#/, '').toLowerCase()).filter(Boolean))].slice(0, 20);
}

function generateShareToken() {
  return crypto.randomBytes(16).toString('base64url');
}
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

  const q = String(filters.q || '').trim();
  if (q) {
    clauses.push(`(
      cm.title ILIKE $${i}
      OR COALESCE(ig.name, '') ILIKE $${i}
      OR EXISTS (SELECT 1 FROM unnest(cm.tags) AS t(tag) WHERE t.tag ILIKE $${i})
    )`);
    params.push(`%${q}%`);
    i += 1;
  }

  const { rows } = await db.query(
    `SELECT cm.id, cm.title, cm.file_url, cm.file_type, cm.file_size, cm.original_filename,
            cm.group_id, cm.subject_id, cm.enrollment_lesson_id, cm.assignment_id, cm.created_at,
            cm.tags, cm.is_shared, cm.share_token, cm.view_count,
            ig.name AS group_name,
            isub.name AS subject_name,
            a.title AS assignment_title,
            el.lesson_number, el.starts_at AS lesson_starts_at,
            (SELECT COUNT(*)::int FROM exam_material_links eml WHERE eml.material_id = cm.id) AS exam_link_count,
            (SELECT COUNT(*)::int FROM assignment_material_links aml WHERE aml.material_id = cm.id) AS assignment_link_count,
            (SELECT COUNT(*)::int FROM course_material_guest_students cmgs WHERE cmgs.material_id = cm.id) AS guest_student_count
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
  tags,
}) {
  const tagList = normalizeTags(tags);
  const { rows } = await db.query(
    `INSERT INTO course_materials (
       instructor_id, title, file_url, storage_filename, file_type, file_size, original_filename,
       group_id, subject_id, enrollment_lesson_id, assignment_id, tags
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
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
      tagList,
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

  const { rows: assignmentLinkRows } = await db.query(
    `SELECT 1 FROM assignment_material_links aml
     JOIN student_assignments sa ON sa.assignment_id = aml.assignment_id AND sa.student_id = $2
     WHERE aml.material_id = $1
     LIMIT 1`,
    [material.id, studentId],
  );
  if (assignmentLinkRows[0]) return true;

  const { rows: examLinkRows } = await db.query(
    `SELECT 1 FROM exam_material_links eml
     JOIN exam_assignments ea ON ea.exam_id = eml.exam_id AND ea.student_id = $2
     WHERE eml.material_id = $1
     LIMIT 1`,
    [material.id, studentId],
  );
  if (examLinkRows[0]) return true;

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
     JOIN student_assignments sa ON sa.student_id = $2
     WHERE sa.assignment_id = $1
       AND (
         cm.assignment_id = $1
         OR EXISTS (
           SELECT 1 FROM assignment_material_links aml
           WHERE aml.assignment_id = $1 AND aml.material_id = cm.id
         )
       )
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

async function parentCanAccessMaterial(parentId, material) {
  if (!material || !parentId) return false;
  const { rows } = await db.query(
    `SELECT user_id FROM student_profiles WHERE parent_id = $1::uuid`,
    [parentId],
  );
  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop
    if (await studentCanAccessMaterial(row.user_id, material)) return true;
  }
  return false;
}

async function updateCourseMaterialMeta(instructorId, materialId, { tags, title }) {
  const row = await getMaterialById(materialId);
  if (!row || String(row.instructor_id) !== String(instructorId)) return null;

  const updates = [];
  const params = [materialId, instructorId];
  let idx = 3;

  if (tags !== undefined) {
    updates.push(`tags = $${idx}`);
    params.push(normalizeTags(tags));
    idx += 1;
  }
  if (title !== undefined) {
    const trimmed = String(title).trim();
    if (!trimmed) throw new Error('Material adı boş ola bilməz');
    if (trimmed.length > 200) throw new Error('Material adı çox uzundur');
    updates.push(`title = $${idx}`);
    params.push(trimmed);
    idx += 1;
  }

  if (!updates.length) return row;

  const { rows } = await db.query(
    `UPDATE course_materials SET ${updates.join(', ')} WHERE id = $1 AND instructor_id = $2 RETURNING *`,
    params,
  );
  return rows[0] || null;
}

async function enableMaterialShare(instructorId, materialId) {
  const row = await getMaterialById(materialId);
  if (!row || String(row.instructor_id) !== String(instructorId)) return null;
  const token = row.share_token || generateShareToken();
  const { rows } = await db.query(
    `UPDATE course_materials
     SET is_shared = true, share_token = $3
     WHERE id = $1 AND instructor_id = $2
     RETURNING *`,
    [materialId, instructorId, token],
  );
  return rows[0] || null;
}

async function getMaterialByShareToken(token) {
  const t = String(token || '').trim();
  if (!t) return null;
  const { rows } = await db.query(
    `SELECT cm.*, u.full_name AS instructor_name
     FROM course_materials cm
     JOIN users u ON u.id = cm.instructor_id
     WHERE cm.share_token = $1 AND cm.is_shared = true
     LIMIT 1`,
    [t],
  );
  return rows[0] || null;
}

async function incrementMaterialViewCount(materialId) {
  await db.query(
    `UPDATE course_materials SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1`,
    [materialId],
  );
}

async function linkMaterialToTarget(instructorId, materialId, targetType, targetId) {
  const material = await getMaterialById(materialId);
  if (!material || String(material.instructor_id) !== String(instructorId)) {
    const err = new Error('Material tapılmadı');
    err.status = 404;
    throw err;
  }

  const type = String(targetType || '').trim().toLowerCase();
  const tid = String(targetId || '').trim();
  if (!tid) {
    const err = new Error('Hədəf seçilməyib');
    err.status = 400;
    throw err;
  }

  if (type === 'exam') {
    const { rows } = await db.query(
      `SELECT id FROM exams WHERE id = $1 AND instructor_id = $2 LIMIT 1`,
      [tid, instructorId],
    );
    if (!rows[0]) {
      const err = new Error('İmtahan tapılmadı');
      err.status = 404;
      throw err;
    }
    await db.query(
      `INSERT INTO exam_material_links (exam_id, material_id) VALUES ($1, $2)
       ON CONFLICT (exam_id, material_id) DO NOTHING`,
      [tid, materialId],
    );
    return { target_type: 'exam', target_id: tid };
  }

  if (type === 'assignment') {
    const { rows } = await db.query(
      `SELECT id FROM assignments WHERE id = $1 AND instructor_id = $2 LIMIT 1`,
      [tid, instructorId],
    );
    if (!rows[0]) {
      const err = new Error('Tapşırıq tapılmadı');
      err.status = 404;
      throw err;
    }
    await db.query(
      `INSERT INTO assignment_material_links (assignment_id, material_id) VALUES ($1, $2)
       ON CONFLICT (assignment_id, material_id) DO NOTHING`,
      [tid, materialId],
    );
    return { target_type: 'assignment', target_id: tid };
  }

  if (type === 'group') {
    const { rows } = await db.query(
      `SELECT id, subject_id FROM instructor_groups WHERE id = $1 AND instructor_id = $2 LIMIT 1`,
      [tid, instructorId],
    );
    if (!rows[0]) {
      const err = new Error('Qrup tapılmadı');
      err.status = 404;
      throw err;
    }
    await db.query(
      `UPDATE course_materials SET group_id = $3, subject_id = $4 WHERE id = $1 AND instructor_id = $2`,
      [materialId, instructorId, tid, rows[0].subject_id],
    );
    return { target_type: 'group', target_id: tid };
  }

  if (type === 'lesson') {
    const { rows } = await db.query(
      `SELECT el.id FROM enrollment_lessons el
       JOIN enrollments e ON e.id = el.enrollment_id
       WHERE el.id = $1 AND e.instructor_id = $2
       LIMIT 1`,
      [tid, instructorId],
    );
    if (!rows[0]) {
      const err = new Error('Dərs tapılmadı');
      err.status = 404;
      throw err;
    }
    await db.query(
      `UPDATE course_materials SET enrollment_lesson_id = $3 WHERE id = $1 AND instructor_id = $2`,
      [materialId, instructorId, tid],
    );
    return { target_type: 'lesson', target_id: tid };
  }

  if (type === 'student') {
    const { rows } = await db.query(
      `SELECT u.id FROM users u
       JOIN enrollments e ON e.student_id = u.id AND e.instructor_id = $1
       WHERE u.id = $2 AND u.role = 'student' AND e.status IN ('active','pending_setup')
       LIMIT 1`,
      [instructorId, tid],
    );
    if (!rows[0]) {
      const err = new Error('Tələbə tapılmadı');
      err.status = 404;
      throw err;
    }
    await db.query(
      `INSERT INTO course_material_guest_students (material_id, student_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [materialId, tid],
    );
    return { target_type: 'student', target_id: tid };
  }

  const err = new Error('Naməlum əlaqə növü');
  err.status = 400;
  throw err;
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
  parentCanAccessMaterial,
  listStudentMaterials,
  listMaterialsForAssignment,
  listUploadOptions,
  updateCourseMaterialMeta,
  enableMaterialShare,
  getMaterialByShareToken,
  incrementMaterialViewCount,
  linkMaterialToTarget,
  normalizeTags,
};
