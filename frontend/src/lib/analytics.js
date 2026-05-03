/**
 * Lightweight client-side analytics bridge.
 *
 * Göndərir:
 * - window.dataLayer (Google Tag Manager / GA4 üçün Custom Event kimi)
 * - window.gtag("event", name, props) əgər gtag yüklənibsə
 *
 * Əlavə DEV log: `VITE_ANALYTICS_DEBUG=1` (Vite ilə)
 */

function getWindowSafe() {
  return typeof window !== 'undefined' ? window : null
}

/**
 * @param {string} name
 * @param {Record<string, string | number | boolean | null | undefined>} [props]
 */
export function trackEvent(name, props = {}) {
  const w = getWindowSafe()
  if (!w || !name) return

  const clean = {}
  for (const [k, v] of Object.entries(props)) {
    if (v !== undefined && v !== null && v !== '') clean[k] = v
  }

  try {
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({
      event: name,
      ...clean,
    })
  } catch {
    /* ignore */
  }

  try {
    if (typeof w.gtag === 'function') {
      w.gtag('event', name, clean)
    }
  } catch {
    /* ignore */
  }

  try {
    if (import.meta.env.DEV === true && String(import.meta.env.VITE_ANALYTICS_DEBUG || '') === '1') {
      console.debug('[mentorix:analytics]', name, clean)
    }
  } catch {
    /* ignore */
  }
}
