/** Google Maps JS API — bir dəfə yüklənir (Settings + axtarış). */

let loadPromise = null

export function getGoogleMapsApiKey() {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined
  const k = env?.VITE_GOOGLE_MAPS_API_KEY
  return k != null && String(k).trim() !== '' ? String(k).trim() : null
}

export function isGoogleMapsConfigured() {
  return Boolean(getGoogleMapsApiKey())
}

function waitForGoogleMapsNamespace(timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      if (window.google?.maps) {
        resolve(window.google.maps)
        return
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error('Google Maps yüklənmədi'))
        return
      }
      setTimeout(tick, 40)
    }
    tick()
  })
}

/**
 * `loading=async` ilə google.maps.Map konstruktor deyil — əvvəl importLibrary('maps') lazımdır.
 * Köhnə skript üçün də eyni nəticə: hazır `google.maps` qaytarır.
 */
export function loadGoogleMaps() {
  const key = getGoogleMapsApiKey()
  if (!key) {
    return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY təyin edilməyib'))
  }
  if (typeof window !== 'undefined' && typeof window.google?.maps?.Map === 'function') {
    return Promise.resolve(window.google.maps)
  }
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    try {
      const id = 'mentorix-google-maps-js'
      if (!document.getElementById(id)) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script')
          script.id = id
          script.async = true
          script.defer = true
          script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&language=az&region=AZ&libraries=maps,marker`
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Google Maps skripti yüklənmədi'))
          document.head.appendChild(script)
        })
      }

      const maps = await waitForGoogleMapsNamespace()
      if (typeof maps.importLibrary === 'function') {
        await maps.importLibrary('maps')
        try {
          await maps.importLibrary('marker')
        } catch {
          /* Marker köhnə namespace-də qala bilər */
        }
      }
      if (typeof maps.Map !== 'function') {
        throw new Error('Google Maps Map yüklənmədi')
      }
      return maps
    } catch (err) {
      loadPromise = null
      throw err
    }
  })()

  return loadPromise
}
