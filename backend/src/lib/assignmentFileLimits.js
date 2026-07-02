const path = require('path');

const MB = 1024 * 1024;

const ASSIGNMENT_FILE_LIMITS = {
  document: 50 * MB,
  image: 10 * MB,
  zip: 100 * MB,
};

const ASSIGNMENT_EXT_CATEGORY = {
  '.pdf': 'document',
  '.doc': 'document',
  '.docx': 'document',
  '.xls': 'document',
  '.xlsx': 'document',
  '.ppt': 'document',
  '.pptx': 'document',
  '.csv': 'document',
  '.txt': 'document',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.zip': 'zip',
};

const ASSIGNMENT_MIME_OK = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'text/csv',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
]);

const ASSIGNMENT_SUPPORTED_EXTENSIONS = Object.keys(ASSIGNMENT_EXT_CATEGORY);

const ASSIGNMENT_MAX_UPLOAD_BYTES = Math.max(...Object.values(ASSIGNMENT_FILE_LIMITS));

function getAssignmentFileCategory(file) {
  const ext = path.extname(file?.originalname || file?.name || '').toLowerCase();
  if (ASSIGNMENT_EXT_CATEGORY[ext]) return ASSIGNMENT_EXT_CATEGORY[ext];
  const mt = String(file?.mimetype || '').toLowerCase();
  if (mt.startsWith('image/')) return 'image';
  if (mt === 'application/zip' || mt === 'application/x-zip-compressed') return 'zip';
  return 'document';
}

function getAssignmentFileSizeLimit(category) {
  return ASSIGNMENT_FILE_LIMITS[category] || ASSIGNMENT_FILE_LIMITS.document;
}

function assignmentFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const extOk = ASSIGNMENT_SUPPORTED_EXTENSIONS.includes(ext);
  if (ASSIGNMENT_MIME_OK.has(file.mimetype) || extOk) return cb(null, true);
  return cb(
    new Error('Fayl formatı dəstəklənmir (PDF, Word, Excel, PowerPoint, CSV, TXT, şəkil, ZIP)'),
  );
}

function validateAssignmentFileSize(file) {
  if (!file) return { ok: false, message: 'Fayl tələb olunur' };
  const category = getAssignmentFileCategory(file);
  const limit = getAssignmentFileSizeLimit(category);
  if (file.size > limit) {
    const limitMb = Math.round(limit / MB);
    const labels = { document: 'sənəd', image: 'şəkil', zip: 'ZIP' };
    return {
      ok: false,
      message: `${labels[category] || 'Fayl'} üçün maksimum ölçü ${limitMb} MB-dır`,
    };
  }
  return { ok: true };
}

module.exports = {
  ASSIGNMENT_FILE_LIMITS,
  ASSIGNMENT_EXT_CATEGORY,
  ASSIGNMENT_MIME_OK,
  ASSIGNMENT_SUPPORTED_EXTENSIONS,
  ASSIGNMENT_MAX_UPLOAD_BYTES,
  getAssignmentFileCategory,
  getAssignmentFileSizeLimit,
  assignmentFileFilter,
  validateAssignmentFileSize,
};
