const path = require('path');
const {
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
} = require('../services/courseMaterialsService');
const {
  readCourseMaterialBuffer,
  deleteCourseMaterialBlob,
  contentTypeForFilename,
  resolveUploadedFileBytes,
} = require('../services/courseMaterialStorage');
const { STORAGE_LIMIT_MESSAGE, MATERIALS_MAX_SINGLE_FILE_BYTES } = require('../constants/materialsPlanLimits');

function mapMaterialRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    file_url: row.file_url,
    file_type: row.file_type,
    file_size: row.file_size,
    original_filename: row.original_filename,
    group_id: row.group_id,
    subject_id: row.subject_id,
    enrollment_lesson_id: row.enrollment_lesson_id,
    assignment_id: row.assignment_id,
    created_at: row.created_at,
    group_name: row.group_name || null,
    subject_name: row.subject_name || null,
    assignment_title: row.assignment_title || null,
    lesson_number: row.lesson_number ?? null,
    lesson_starts_at: row.lesson_starts_at || null,
  };
}

const getQuota = async (req, res) => {
  try {
    const quota = await getMaterialsQuota(req.user.id);
    res.json({ success: true, quota });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Xəta' });
  }
};

const listMaterials = async (req, res) => {
  try {
    const rows = await listInstructorMaterials(req.user.id, {
      group_id: req.query.group_id || null,
      subject_id: req.query.subject_id || null,
      assignment_id: req.query.assignment_id || null,
    });
    res.json({ success: true, materials: rows.map(mapMaterialRow) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Xəta' });
  }
};

const getOptions = async (req, res) => {
  try {
    const options = await listUploadOptions(req.user.id);
    res.json({ success: true, options });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Xəta' });
  }
};

const postMaterial = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Fayl tələb olunur' });
    }

    const fileSize = resolveUploadedFileBytes(req.file);
    if (!fileSize) {
      return res.status(400).json({ success: false, message: 'Fayl ölçüsü oxunmadı — yenidən cəhd edin' });
    }
    if (fileSize > MATERIALS_MAX_SINGLE_FILE_BYTES) {
      return res.status(400).json({
        success: false,
        code: 'MATERIALS_FILE_TOO_LARGE',
        message: 'Tək fayl ölçüsü 25 MB-dan çox ola bilməz.',
      });
    }

    await assertMaterialsUploadAllowed(req.user.id, fileSize);

    const title = String(req.body.title || req.file.originalname || 'Material').trim().slice(0, 200);
    const rel = `/api/materials/file/${req.file.filename}`;
    const fileType = req.file.mimetype || contentTypeForFilename(req.file.filename);

    const row = await createCourseMaterial({
      instructorId: req.user.id,
      title,
      fileUrl: rel,
      storageFilename: req.file.filename,
      fileType,
      fileSize,
      originalFilename: req.file.originalname || null,
      groupId: req.body.group_id || null,
      subjectId: req.body.subject_id || null,
      enrollmentLessonId: req.body.enrollment_lesson_id || null,
      assignmentId: req.body.assignment_id || null,
    });

    const quota = await getMaterialsQuota(req.user.id);
    res.json({ success: true, material: mapMaterialRow(row), quota });
  } catch (e) {
    if (e.code === '23514' && /course_materials_file_size/i.test(String(e.constraint || e.message || ''))) {
      return res.status(400).json({
        success: false,
        code: 'MATERIALS_FILE_TOO_LARGE',
        message: 'Tək fayl ölçüsü 25 MB-dan çox ola bilməz.',
      });
    }
    const status = e.status || (e.code?.startsWith('MATERIALS_') ? 429 : 500);
    res.status(status).json({
      success: false,
      code: e.code || 'UPLOAD_FAILED',
      message: e.message || 'Yükləmə uğursuz oldu',
    });
  }
};

const removeMaterial = async (req, res) => {
  try {
    const row = await deleteCourseMaterial(req.user.id, req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Material tapılmadı' });
    await deleteCourseMaterialBlob(row.storage_filename);
    const quota = await getMaterialsQuota(req.user.id);
    res.json({ success: true, quota });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Xəta' });
  }
};

const serveMaterialFile = async (req, res) => {
  try {
    const filename = path.basename(String(req.params.filename || ''));
    const { rows } = await require('../utils/db').query(
      `SELECT cm.* FROM course_materials cm
       WHERE cm.storage_filename = $1
       LIMIT 1`,
      [filename],
    );
    const material = rows[0];
    if (!material) {
      return res.status(404).json({ success: false, message: 'Fayl tapılmadı' });
    }

    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Giriş tələb olunur' });

    if (user.role === 'instructor' && String(material.instructor_id) !== String(user.id)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    if (user.role === 'student') {
      const ok = await studentCanAccessMaterial(user.id, material);
      if (!ok) return res.status(403).json({ success: false, message: 'Bu materiala giriş yoxdur' });
    }

    if (!['instructor', 'student', 'parent', 'admin'].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const hit = await readCourseMaterialBuffer(filename);
    if (!hit) {
      return res.status(404).json({ success: false, message: 'Fayl tapılmadı' });
    }

    const downloadName = material.original_filename || material.title || filename;
    res.setHeader('Content-Type', hit.content_type);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(downloadName)}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return res.send(hit.buffer);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Xəta' });
  }
};

const listMyMaterials = async (req, res) => {
  try {
    const rows = await listStudentMaterials(req.user.id, {
      groupId: req.query.group_id || null,
      enrollmentId: req.query.enrollment_id || null,
    });
    res.json({ success: true, materials: rows.map(mapMaterialRow) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Xəta' });
  }
};

const listAssignmentMaterials = async (req, res) => {
  try {
    const rows = await listMaterialsForAssignment(req.params.assignmentId, req.user.id);
    res.json({ success: true, materials: rows.map(mapMaterialRow) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Xəta' });
  }
};

module.exports = {
  getQuota,
  listMaterials,
  getOptions,
  postMaterial,
  removeMaterial,
  serveMaterialFile,
  listMyMaterials,
  listAssignmentMaterials,
  STORAGE_LIMIT_MESSAGE,
};
