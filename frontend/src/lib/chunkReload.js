const RELOAD_KEY = 'mx:chunk-reload-at'
const RELOAD_COOLDOWN_MS = 30_000

const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Loading chunk [\w-]+ failed/i,
  /Unable to preload CSS/i,
]

export function isChunkLoadError(error) {
  const msg = String(error?.message || error || '')
  return CHUNK_ERROR_PATTERNS.some((re) => re.test(msg))
}

/**
 * A new deploy replaces hashed asset names, so a tab opened before the deploy
 * requests chunks that no longer exist. Reload once to pick up the new index.html;
 * the cooldown prevents a reload loop when the chunk is genuinely missing.
 */
export function reloadOnceForChunkError() {
  if (typeof window === 'undefined') return false
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0)
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}

export function installChunkReloadHandler() {
  if (typeof window === 'undefined') return
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadOnceForChunkError()) event.preventDefault()
  })
}
