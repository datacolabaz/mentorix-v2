/** Google Maps JS API — bir dəfə yüklənir (Settings + axtarış) */

let loadPromise = null

export function getGoogleMapsApiKey() {
  const k = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  return k != null && String(k).trim() !== '' ? String(k).trim() : null
}

export function isGoogleMapsConfigured() {
  return Boolean(getGoogleMapsApiKey())
}

export function loadGoogleMaps() {
  const key = getGoogleMapsApiKey()
  if (!key) {
    return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY təyin edilməyib'))
  }
  if (typeof window !== 'undefined' && window.google?.maps) {
    return Promise.resolve(window.google.maps)
  }
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const id = 'mentorix-google-maps-js'
    if (document.getElementById(id)) {
      const wait = () => {
        if (window.google?.maps) resolve(window.google.maps)
        else setTimeout(wait, 50)
      }
      wait()
      return
    }
    const script = document.createElement('script')
    script.id = id
    script.async = true
    script.defer = true
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&v=weekly&language=az&region=AZ`
    script.onload = () => {
      if (window.google?.maps) resolve(window.google.maps)
      else reject(new Error('Google Maps yüklənmədi'))
    }
    script.onerror = () => reject(new Error('Google Maps skripti yüklənmədi'))
    document.head.appendChild(script)
  })

  return loadPromise
}
