export const LIVE_CHAT_FILE_MAX_BYTES = 5 * 1024 * 1024

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
])

const BLOCKED_EXT = new Set(['exe', 'bat', 'cmd', 'com', 'msi', 'dll', 'scr', 'ps1', 'sh', 'svg', 'vbs'])

export const LIVE_CHAT_FILE_ACCEPT = [...ALLOWED_EXT].map((e) => `.${e}`).join(',')

function extOf(name) {
  const m = String(name || '')
    .toLowerCase()
    .match(/\.([a-z0-9]{1,8})$/)
  return m ? m[1] : ''
}

export function isAllowedLiveChatFilename(name, mime = '') {
  const ext = extOf(name)
  if (BLOCKED_EXT.has(ext)) return false
  if (ALLOWED_EXT.has(ext)) return true
  const type = String(mime || '').toLowerCase()
  if (type === 'image/svg+xml') return false
  if (type.startsWith('image/')) return true
  if (type.startsWith('text/')) return true
  return false
}

export function isAllowedLiveChatAttachmentUrl(url) {
  return /^\/api\/live\/chat-attachments\/[A-Za-z0-9._-]+$/.test(String(url || '').trim())
}

export function sanitizeLiveChatFile(raw) {
  if (!raw || typeof raw !== 'object') return null
  const url = String(raw.url || '').trim()
  if (!isAllowedLiveChatAttachmentUrl(url)) return null
  return {
    url,
    name: String(raw.name || 'file').slice(0, 180),
    type: String(raw.type || '').slice(0, 80),
    size: Number(raw.size) || 0,
  }
}

export function liveChatFileOpenUrl(file, guestAuth) {
  const safe = sanitizeLiveChatFile(file)
  if (!safe) return ''
  const fn = safe.url.split('/').pop()
  const params = new URLSearchParams()
  if (guestAuth?.inviteToken && guestAuth?.participantId) {
    params.set('invite', guestAuth.inviteToken)
    params.set('participantId', guestAuth.participantId)
  } else if (typeof localStorage !== 'undefined') {
    const token = localStorage.getItem('mx_token')
    if (token) params.set('token', token)
  }
  const q = params.toString()
  const path = `/api/live/chat-attachments/${encodeURIComponent(fn)}${q ? `?${q}` : ''}`
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
}

export function isLiveChatImage(file) {
  const ext = extOf(file?.name)
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return true
  return /^image\/(jpeg|jpg|png|webp|gif)$/i.test(String(file?.type || ''))
}

export function mapLiveChatHistory(rows, { userId, guestParticipantId } = {}) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row.id,
    text: row.text || '',
    file: sanitizeLiveChatFile(row.file),
    name: row.sender_name || '',
    local: Boolean(
      (userId && row.user_id && String(row.user_id) === String(userId)) ||
        (guestParticipantId &&
          row.guest_participant_id &&
          String(row.guest_participant_id) === String(guestParticipantId)),
    ),
    at: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  }))
}
