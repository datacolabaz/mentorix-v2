import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '../../lib/googleMapsLoader'

export default function GoogleMapPreview({ latitude, longitude, fillColor = '#22c55e', className = 'h-full w-full' }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const [err, setErr] = useState(null)

  const lat = Number(latitude)
  const lng = Number(longitude)
  const ok = Number.isFinite(lat) && Number.isFinite(lng)

  useEffect(() => {
    if (!ok) return
    let cancelled = false
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return
        const center = { lat, lng }
        const map = new maps.Map(containerRef.current, {
          center,
          zoom: 14,
          gestureHandling: 'cooperative',
          scrollwheel: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
        })
        mapRef.current = map
        markerRef.current = new maps.Marker({
          map,
          position: center,
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 11,
            fillColor,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          },
        })
      })
      .catch((e) => {
        if (!cancelled) setErr(e?.message || 'Xəritə yüklənmədi')
      })
    return () => {
      cancelled = true
      markerRef.current?.setMap(null)
      markerRef.current = null
      mapRef.current = null
    }
  }, [ok, lat, lng, fillColor])

  if (!ok) return null
  if (err) {
    return <div className={`${className} flex items-center justify-center text-xs text-gray-500 px-4 text-center`}>{err}</div>
  }
  return <div ref={containerRef} className={className} />
}
