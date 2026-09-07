const path = require('path');
const {
  mapPresentationRow,
  countPdfPages,
  listPresentations,
  getPresentationForInstructor,
  createPresentation,
  updatePresentation,
  deletePresentation,
  listAnnotations,
  upsertAnnotations,
  assertMaterialsUploadAllowed,
  getMaterialsQuota,
} = require('../services/presentationsService');
const {
  readPresentationBuffer,
  deletePresentationBlob,
  resolveUploadedFileBytesAsync,
} = require('../services/presentationStorage');
const { STORAGE_LIMIT_MESSAGE, MATERIALS_MAX_SINGLE_FILE_BYTES } = require('../constants/materialsPlanLimits');

const list = async (req, res) => {
  try {
    const presentations = await listPresentations(req.user.id);
    const quota = await getMaterialsQuota(req.user.id);
    res.json({ success: true, presentations, quota });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Xəta' });
  }
};

const getOne = async (req, res) => {
  try {
    const row = await getPresentationForInstructor(req.user.id, req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Təqdimat tapılmadı' });
    const annotations = await listAnnotations(row.id);
    res.json({ success: true, presentation: mapPresentationRow(row), annotations });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Xəta' });
  }
};

const create = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'PDF faylı tələb olunur' });
    }

    const fileSize = await resolveUploadedFileBytesAsync(req.file);
    if (!fileSize) {
      return res.status(400).json({
        success: false,
        message: 'Fayl boşdur və ya oxunmadı — başqa fayl seçib yenidən cəhd edin',
      });
    }
    if (fileSize > MATERIALS_MAX_SINGLE_FILE_BYTES) {
      return res.status(400).json({
        success: false,
        code: 'MATERIALS_FILE_TOO_LARGE',
        message: 'Tək fayl ölçüsü 25 MB-dan çox ola bilməz.',
      });
    }

    await assertMaterialsUploadAllowed(req.user.id, fileSize);

    const hit = await readPresentationBuffer(req.file.filename);
    const slideCount = await countPdfPages(hit?.buffer);

    const title = String(req.body.title || req.file.originalname || 'Təqdimat')
      .replace(/\.pdf$/i, '')
      .trim()
      .slice(0, 200) || 'Təqdimat';
    const rel = `/api/presentations/file/${req.file.filename}`;

    const row = await createPresentation({
      instructorId: req.user.id,
      title,
      fileUrl: rel,
      storageFilename: req.file.filename,
      fileSize,
      originalFilename: req.file.originalname || null,
      slideCount,
    });

    const quota = await getMaterialsQuota(req.user.id);
    res.json({ success: true, presentation: mapPresentationRow(row), quota });
  } catch (e) {
    if (e.code === '23514') {
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
      message: e.message || STORAGE_LIMIT_MESSAGE,
    });
  }
};

const patch = async (req, res) => {
  try {
    const row = await updatePresentation(req.user.id, req.params.id, {
      title: req.body?.title,
      slide_count: req.body?.slide_count,
    });
    if (!row) return res.status(404).json({ success: false, message: 'Təqdimat tapılmadı' });
    res.json({ success: true, presentation: mapPresentationRow(row) });
  } catch (e) {
    const status = e.status || 500;
    res.status(status).json({ success: false, message: e.message || 'Xəta' });
  }
};

const remove = async (req, res) => {
  try {
    const row = await deletePresentation(req.user.id, req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Təqdimat tapılmadı' });
    await deletePresentationBlob(row.storage_filename);
    const quota = await getMaterialsQuota(req.user.id);
    res.json({ success: true, quota });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Xəta' });
  }
};

const putAnnotations = async (req, res) => {
  try {
    const slideIndex = req.body?.slide_index;
    if (slideIndex == null || !Number.isFinite(Number(slideIndex))) {
      return res.status(400).json({ success: false, message: 'slide_index tələb olunur' });
    }
    const saved = await upsertAnnotations(req.user.id, req.params.id, slideIndex, req.body?.strokes);
    if (!saved) return res.status(404).json({ success: false, message: 'Təqdimat tapılmadı' });
    res.json({ success: true, annotation: saved });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Xəta' });
  }
};

const serveFile = async (req, res) => {
  try {
    const filename = path.basename(String(req.params.filename || ''));
    const { rows } = await require('../utils/db').query(
      `SELECT * FROM presentations WHERE storage_filename = $1 LIMIT 1`,
      [filename],
    );
    const presentation = rows[0];
    if (!presentation) return res.status(404).json({ success: false, message: 'Fayl tapılmadı' });

    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Giriş tələb olunur' });
    if (user.role !== 'instructor' || String(presentation.instructor_id) !== String(user.id)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const hit = await readPresentationBuffer(filename);
    if (!hit) return res.status(404).json({ success: false, message: 'Fayl tapılmadı' });

    const downloadName = presentation.original_filename || presentation.title || filename;
    const safeName = String(downloadName).replace(/["\r\n]/g, '');
    const forceDownload = ['1', 'true', 'yes'].includes(String(req.query?.download || '').toLowerCase());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${forceDownload ? 'attachment' : 'inline'}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
    );
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return res.send(hit.buffer);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Xəta' });
  }
};

module.exports = {
  list,
  getOne,
  create,
  patch,
  remove,
  putAnnotations,
  serveFile,
};
