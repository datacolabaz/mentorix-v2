/**
 * Safe Storage wrapper around localStorage and sessionStorage.
 * Prevents uncaught exceptions in environments where Web Storage is:
 * - blocked (Safari Private Browsing, restricted iframes, disabled cookies)
 * - quota exceeded (full device storage)
 * - not available (Node.js test runners without --localstorage-file, SSR)
 */

class FallbackMemoryStore {
  constructor() {
    this.map = new Map()
  }
  getItem(key) {
    return this.map.has(String(key)) ? this.map.get(String(key)) : null
  }
  setItem(key, value) {
    this.map.set(String(key), String(value))
  }
  removeItem(key) {
    this.map.delete(String(key))
  }
  clear() {
    this.map.clear()
  }
}

const fallbackLocal = new FallbackMemoryStore()
const fallbackSession = new FallbackMemoryStore()

function getNativeStorage(type) {
  try {
    if (typeof window !== 'undefined' && window[type]) {
      return window[type]
    }
    if (typeof globalThis !== 'undefined' && globalThis[type]) {
      return globalThis[type]
    }
  } catch {
    /* access denied */
  }
  return null
}

export const safeLocalStorage = {
  getItem(key) {
    try {
      const s = getNativeStorage('localStorage')
      if (s && typeof s.getItem === 'function') {
        const val = s.getItem(key)
        if (val !== null) return val
      }
    } catch {
      /* ignore */
    }
    return fallbackLocal.getItem(key)
  },
  setItem(key, value) {
    try {
      const s = getNativeStorage('localStorage')
      if (s && typeof s.setItem === 'function') {
        s.setItem(key, value)
        return
      }
    } catch {
      /* ignore */
    }
    fallbackLocal.setItem(key, value)
  },
  removeItem(key) {
    try {
      const s = getNativeStorage('localStorage')
      if (s && typeof s.removeItem === 'function') {
        s.removeItem(key)
      }
    } catch {
      /* ignore */
    }
    fallbackLocal.removeItem(key)
  },
  clear() {
    try {
      const s = getNativeStorage('localStorage')
      if (s && typeof s.clear === 'function') {
        s.clear()
      }
    } catch {
      /* ignore */
    }
    fallbackLocal.clear()
  },
  getJSON(key, fallback = null) {
    const raw = this.getItem(key)
    if (!raw) return fallback
    try {
      return JSON.parse(raw)
    } catch {
      return fallback
    }
  },
  setJSON(key, value) {
    this.setItem(key, JSON.stringify(value))
  },
}

export const safeSessionStorage = {
  getItem(key) {
    try {
      const s = getNativeStorage('sessionStorage')
      if (s && typeof s.getItem === 'function') {
        const val = s.getItem(key)
        if (val !== null) return val
      }
    } catch {
      /* ignore */
    }
    return fallbackSession.getItem(key)
  },
  setItem(key, value) {
    try {
      const s = getNativeStorage('sessionStorage')
      if (s && typeof s.setItem === 'function') {
        s.setItem(key, value)
        return
      }
    } catch {
      /* ignore */
    }
    fallbackSession.setItem(key, value)
  },
  removeItem(key) {
    try {
      const s = getNativeStorage('sessionStorage')
      if (s && typeof s.removeItem === 'function') {
        s.removeItem(key)
      }
    } catch {
      /* ignore */
    }
    fallbackSession.removeItem(key)
  },
  clear() {
    try {
      const s = getNativeStorage('sessionStorage')
      if (s && typeof s.clear === 'function') {
        s.clear()
      }
    } catch {
      /* ignore */
    }
    fallbackSession.clear()
  },
}

export default safeLocalStorage
