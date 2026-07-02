const MB = 1024 * 1024;

export const ASSIGNMENT_FILE_LIMITS = {
  document: 50 * MB,
  image: 10 * MB,
  zip: 100 * MB,
};

const EXT_CATEGORY = {
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

export const ASSIGNMENT_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.png,.jpg,.jpeg,.zip,' +
  'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,' +
  'application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,' +
  'text/csv,text/plain,image/png,image/jpeg,application/zip,application/x-zip-compressed';

export const ASSIGNMENT_FORMAT_CHIPS = [
  { icon: '📄', key: 'pdf' },
  { icon: '📝', key: 'word' },
  { icon: '📊', key: 'excel' },
  { icon: '📋', key: 'csv' },
  { icon: '📃', key: 'txt' },
  { icon: '📽️', key: 'ppt' },
  { icon: '🖼️', key: 'image' },
  { icon: '📦', key: 'zip' },
];

function getExt(name) {
  const i = String(name || '').lastIndexOf('.');
  return i >= 0 ? String(name).slice(i).toLowerCase() : '';
}

export function getAssignmentFileCategory(file) {
  const ext = getExt(file?.name);
  if (EXT_CATEGORY[ext]) return EXT_CATEGORY[ext];
  const mt = String(file?.type || '').toLowerCase();
  if (mt.startsWith('image/')) return 'image';
  if (mt === 'application/zip' || mt === 'application/x-zip-compressed') return 'zip';
  return 'document';
}

export function getAssignmentFileSizeLimit(category) {
  return ASSIGNMENT_FILE_LIMITS[category] || ASSIGNMENT_FILE_LIMITS.document;
}

export function validateAssignmentFile(file, t) {
  if (!file) return { ok: false, message: t?.('tasks.toasts.fileRequired') || 'Fayl seçilməyib' };
  const ext = getExt(file.name);
  if (!EXT_CATEGORY[ext]) {
    return { ok: false, message: t?.('tasks.toasts.fileTypeUnsupported') || 'Fayl formatı dəstəklənmir' };
  }
  const category = getAssignmentFileCategory(file);
  const limit = getAssignmentFileSizeLimit(category);
  if (file.size > limit) {
    const limitMb = Math.round(limit / MB);
    return {
      ok: false,
      message: t?.('tasks.toasts.fileTooLarge', { limit: limitMb }) || `Fayl çox böyükdür (maks. ${limitMb} MB)`,
    };
  }
  return { ok: true };
}
