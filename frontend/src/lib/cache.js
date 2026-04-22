const PREFIX = 'mentorix_cache_'

function safeNow() {
  try {
    return Date.now()
  } catch {
    return 0
  }
}

export function readCache(key, maxAgeMs) {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const ts = typeof parsed.ts === 'number' ? parsed.ts : 0
    if (!ts) return null
    if (maxAgeMs != null && maxAgeMs > 0) {
      const age = safeNow() - ts
      if (!Number.isFinite(age) || age > maxAgeMs) return null
    }
    return parsed.data ?? null
  } catch {
    return null
  }
}

export function writeCache(key, data) {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    const payload = JSON.stringify({ ts: safeNow(), data })
    window.localStorage.setItem(PREFIX + key, payload)
  } catch {
    // ignore quota / JSON errors
  }
}

