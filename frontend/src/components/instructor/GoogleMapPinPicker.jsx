import { useCallback, useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '../../lib/googleMapsLoader'

const BAKU = { lat: 40.4093, lng: 49.8671 }

function parseCoord(v) {
  if (v === '' || v == null) return null
  const n = Number.parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function formatCoord(n) {
  return n.toFixed(6)
}

function kindColor(kind) {
  return kind === 'trainer' ? '#f97316' : '#22c55e'
}

/**
 * Google Maps — pin seçimi. gestureHandling: cooperative → səhifə scroll touchpad ilə işləyir.
 */
export default function GoogleMapPinPicker({
  latitude,
  longitude,
  mapKind = 'teacher',
  flyKey = 0,
  radiusKm = 10,
  onChange,
  className = 'h-[min(52vh,340px)] w-full rounded-xl overflow-hidden border border-[color:var(--border-subtle)] ring-1 ring-primary/20 relative',
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const circleRef = useRef(null)
  const clickListenerRef = useRef(null)
  const dragListenerRef = useRef(null)
  const [loadErr, setLoadErr] = useState(null)
  const [ready, setReady] = useState(false)

  const lat = parseCoord(latitude)
  const lng = parseCoord(longitude)
  const hasPin = lat != null && lng != null
  const radiusM = Math.max(500, (radiusKm || 10) * 1000)

  const applyPick = useCallback(
    (la, ln) => {
      onChange?.(formatCoord(la), formatCoord(ln))
    },
    [onChange],
  )

  useEffect(() => {
    let cancelled = false
    setLoadErr(null)
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return
        const center = hasPin ? { lat, lng } : BAKU
        const map = new maps.Map(containerRef.current, {
          center,
          zoom: hasPin ? 14 : 11,
          gestureHandling: 'cooperative',
          scrollwheel: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
        })
        mapRef.current = map

        clickListenerRef.current = map.addListener('click', (e) => {
          const la = e.latLng?.lat()
          const ln = e.latLng?.lng()
          if (la == null || ln == null) return
          applyPick(la, ln)
        })

        setReady(true)
      })
      .catch((e) => {
        if (!cancelled) setLoadErr(e?.message || 'Xəritə yüklənmədi')
      })

    return () => {
      cancelled = true
      setReady(false)
      if (clickListenerRef.current) {
        window.google?.maps?.event?.removeListener(clickListenerRef.current)
        clickListenerRef.current = null
      }
      if (dragListenerRef.current) {
        window.google?.maps?.event?.removeListener(dragListenerRef.current)
        dragListenerRef.current = null
      }
      markerRef.current?.setMap(null)
      circleRef.current?.setMap(null)
      markerRef.current = null
      circleRef.current = null
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!ready || !mapRef.current || !window.google?.maps) return
    const maps = window.google.maps
    const center = hasPin ? { lat, lng } : BAKU
    const color = kindColor(mapKind)

    if (hasPin) {
      mapRef.current.setCenter(center)
      if (flyKey > 0) {
        mapRef.current.panTo(center)
        mapRef.current.setZoom(15)
      }

      if (!markerRef.current) {
        markerRef.current = new maps.Marker({
          map: mapRef.current,
          position: center,
          draggable: true,
          animation: maps.Animation?.DROP,
        })
        dragListenerRef.current = markerRef.current.addListener('dragend', () => {
          const p = markerRef.current?.getPosition()
          if (p) applyPick(p.lat(), p.lng())
        })
      } else {
        markerRef.current.setPosition(center)
        markerRef.current.setMap(mapRef.current)
      }

      if (!circleRef.current) {
        circleRef.current = new maps.Circle({
          map: mapRef.current,
          center,
          radius: radiusM,
          strokeColor: color,
          strokeOpacity: 0.85,
          strokeWeight: 2,
          fillColor: color,
          fillOpacity: 0.1,
        })
      } else {
        circleRef.current.setCenter(center)
        circleRef.current.setRadius(radiusM)
        circleRef.current.setOptions({
          strokeColor: color,
          fillColor: color,
        })
        circleRef.current.setMap(mapRef.current)
      }
    } else {
      markerRef.current?.setMap(null)
      circleRef.current?.setMap(null)
      mapRef.current.setCenter(BAKU)
      mapRef.current.setZoom(11)
    }
  }, [ready, lat, lng, hasPin, mapKind, radiusM, flyKey, applyPick])

  if (loadErr) {
    return (
      <div className={`${className} flex items-center justify-center p-4 bg-token-surfaceMain/50`}>
        <p className="text-sm text-amber-700 dark:text-amber-200 text-center">{loadErr}</p>
      </div>
    )
  }

  return (
    <div className={className}>
      <div ref={containerRef} className="h-full w-full" />
      {!hasPin ? (
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
          <p className="text-xs text-amber-200 text-center font-medium">
            Xəritəyə klik edin — pin yerləşəcək (səhifəni scroll etmək üçün xəritə xaricində süpürün)
          </p>
        </div>
      ) : (
        <p className="absolute top-2 left-2 right-2 text-[10px] text-center text-white/90 bg-black/50 rounded-lg px-2 py-1 pointer-events-none">
          Ctrl + scroll ilə zoom · Pin sürüşdürülə bilər
        </p>
      )}
    </div>
  )
}
