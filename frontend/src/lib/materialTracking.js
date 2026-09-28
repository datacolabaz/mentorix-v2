import api from './api'

/**
 * Tələbə tərəfində material hadisələri. Səhvlər tələbəni narahat etmir (fire-and-forget).
 * client_event_id şəbəkə təkrarlarının ikinci dəfə yazılmasının qarşısını alır.
 */

const SESSION = Math.random().toString(36).slice(2, 10)
let seq = 0

export function trackMaterialEvent(materialId, eventType, extra = {}) {
  if (!materialId) return
  seq += 1
  api
    .post(`/engagement/materials/${encodeURIComponent(materialId)}/events`, {
      event_type: eventType,
      client_event_id: `${SESSION}:${seq}`,
      ...extra,
    })
    .catch(() => {})
}

/** Klient tərəfi növ: baxış pəncərəsinin necə açılacağını seçmək üçün. */
export function clientMaterialKind(fileType, url) {
  const t = String(fileType || '').toLowerCase()
  const u = String(url || '').toLowerCase().split(/[?#]/)[0]
  const ext = u.includes('.') ? u.split('.').pop() : ''
  if (t.startsWith('video/') || ['mp4', 'webm', 'mov', 'm4v'].includes(ext)) return 'video'
  if (t.includes('pdf') || ext === 'pdf') return 'pdf'
  if (t.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image'
  if (/^https?:\/\//.test(u) && !u.includes('/api/materials/file/')) return 'link'
  return 'file'
}

/**
 * Yalnız səhifə görünən və fokusda olanda saniyə sayır.
 * @returns {{ stop: () => number, seconds: () => number }}
 */
export function startActiveTimer(onTick) {
  let seconds = 0
  const isActive = () => document.visibilityState === 'visible' && document.hasFocus()
  const id = setInterval(() => {
    if (!isActive()) return
    seconds += 1
    onTick?.(seconds)
  }, 1000)
  return {
    seconds: () => seconds,
    stop: () => {
      clearInterval(id)
      return seconds
    },
  }
}
