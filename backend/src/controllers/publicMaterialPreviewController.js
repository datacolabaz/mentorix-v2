const path = require('path');
const {
  getMaterialByShareToken,
  incrementMaterialViewCount,
} = require('../services/courseMaterialsService');
const { readCourseMaterialBuffer } = require('../services/courseMaterialStorage');
const { withUtf8Charset } = require('../lib/contentTypeCharset');

/** GET /api/public/material-preview/:token */
async function getPublicMaterialPreview(req, res) {
  try {
    const material = await getMaterialByShareToken(req.params.token);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material tapılmadı və ya paylaşım bağlıdır' });
    }
    await incrementMaterialViewCount(material.id);
    res.json({
      success: true,
      material: {
        id: material.id,
        title: material.title,
        file_type: material.file_type,
        file_size: material.file_size,
        instructor_name: material.instructor_name,
        view_count: (Number(material.view_count) || 0) + 1,
        tags: Array.isArray(material.tags) ? material.tags : [],
      },
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

/** GET /api/public/material-preview/:token/file */
async function servePublicMaterialPreviewFile(req, res) {
  try {
    const material = await getMaterialByShareToken(req.params.token);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material tapılmadı' });
    }

    const filename = path.basename(String(material.storage_filename || ''));
    const hit = await readCourseMaterialBuffer(filename);
    if (!hit) {
      return res.status(404).json({ success: false, message: 'Fayl tapılmadı' });
    }

    const downloadName = material.original_filename || material.title || filename;
    res.setHeader('Content-Type', withUtf8Charset(hit.content_type));
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(downloadName)}"`);
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(hit.buffer);
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

module.exports = { getPublicMaterialPreview, servePublicMaterialPreviewFile };
