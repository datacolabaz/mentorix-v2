const ALLOWED_EXT = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'txt',
  'html',
  'htm',
  'csv',
  'xlsx',
  'xls',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'odt',
  'ods',
  'py',
  'js',
  'jsx',
  'ts',
  'tsx',
  'java',
  'c',
  'cpp',
  'h',
  'go',
  'rb',
  'php',
  'css',
  'json',
  'xml',
  'md',
  'sql',
  'r',
  'ipynb',
  'zip',
  'rtf',
]);

const BLOCKED_EXT = new Set(['exe', 'bat', 'cmd', 'com', 'msi', 'dll', 'scr', 'ps1', 'sh', 'svg', 'htmld', 'vbs']);

const INLINE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf']);

function extOf(name) {
  const m = String(name || '')
    .toLowerCase()
    .match(/\.([a-z0-9]{1,8})$/);
  return m ? m[1] : '';
}

function isAllowedLiveChatFilename(name, mime) {
  const ext = extOf(name);
  if (BLOCKED_EXT.has(ext)) return false;
  if (ALLOWED_EXT.has(ext)) return true;
  const type = String(mime || '').toLowerCase();
  if (type === 'image/svg+xml') return false;
  if (type.startsWith('image/')) return true;
  if (type.startsWith('text/')) return true;
  return false;
}

function shouldInlineLiveChatFile(name) {
  return INLINE_EXT.has(extOf(name));
}

module.exports = {
  ALLOWED_EXT,
  BLOCKED_EXT,
  extOf,
  isAllowedLiveChatFilename,
  shouldInlineLiveChatFile,
};
