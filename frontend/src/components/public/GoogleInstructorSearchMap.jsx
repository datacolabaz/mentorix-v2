import { useCallback, useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '../../lib/googleMapsLoader'
import { BAKU_CENTER } from '../../lib/geo'
import { instructorInitials } from '../../lib/instructorInitials'

const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d2d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
]

function kindColor(kind) {
  return kind === 'trainer' ? '#f97316' : '#22c55e'
}

function pinIconUrl({ initial, kind, isNearest, selected }) {
  const color = kindColor(kind)
  const ring = isNearest ? '#fbbf24' : '#ffffff'
  const size = selected ? 40 : isNearest ? 38 : 34
  const fontSize = selected ? 15 : 13
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}" stroke="${ring}" stroke-width="3"/>
    <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="800">${initial}</text>
  </svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function boundsPayloadFromGoogle(bounds) {
  if (!bounds) return null
  const ne = bounds.getNorthEast?.()
  const sw = bounds.getSouthWest?.()
  if (!ne || !sw) return null
  return {
    north: ne.lat(),
    south: sw.lat(),
    east: ne.lng(),
    west: sw.lng(),
  }
}

export default function GoogleInstructorSearchMap({
  instructors,
  refPoint,
  showUserLocation,
  selectedId,
  nearestId,
  flyTarget,
  radiusMode,
  mapCenter,
  mapZoom = 11,
  onBounds,
  onSelect,
  onMapReady,
  className = 'h-full w-full',
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef(new Map())
  const userMarkerRef = useRef(null)
  const skipBoundsRef = useRef(false)
  const boundsDebounceRef = useRef(null)
  const [loadErr, setLoadErr] = useState(null)
  const [ready, setReady] = useState(false)

  const emitBounds = useCallback(() => {
    if (radiusMode || skipBoundsRef.current || !mapRef.current) return
    const b = mapRef.current.getBounds()
    const payload = boundsPayloadFromGoogle(b)
    if (!payload) return
    if (boundsDebounceRef.current) window.clearTimeout(boundsDebounceRef.current)
    boundsDebounceRef.current = window.setTimeout(() => onBounds?.(payload), 320)
  }, [radiusMode, onBounds])

  useEffect(() => {
    let cancelled = false
    setLoadErr(null)
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return
        const c = mapCenter || { lat: BAKU_CENTER[0], lng: BAKU_CENTER[1] }
        const map = new maps.Map(containerRef.current, {
          center: { lat: c.lat, lng: c.lng },
          zoom: mapZoom,
          styles: DARK_MAP_STYLES,
          gestureHandling: 'greedy',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
        })
        mapRef.current = map
        map.addListener('idle', emitBounds)
        setReady(true)
        onMapReady?.(map)
      })
      .catch((e) => {
        if (!cancelled) setLoadErr(e?.message || 'Xəritə yüklənmədi')
      })

    return () => {
      cancelled = true
      setReady(false)
      if (boundsDebounceRef.current) window.clearTimeout(boundsDebounceRef.current)
      markersRef.current.forEach((m) => m.setMap(null))
      markersRef.current.clear()
      userMarkerRef.current?.setMap(null)
      userMarkerRef.current = null
      mapRef.current = null
    }
  }, [emitBounds])

  useEffect(() => {
    if (!ready || !mapRef.current || !mapCenter) return
    skipBoundsRef.current = true
    mapRef.current.setCenter({ lat: mapCenter.lat, lng: mapCenter.lng })
    const t = window.setTimeout(() => {
      skipBoundsRef.current = false
      emitBounds()
    }, 400)
    return () => window.clearTimeout(t)
  }, [ready, mapCenter?.lat, mapCenter?.lng, emitBounds])

  useEffect(() => {
    if (!ready || !mapRef.current || !flyTarget?.center) return
    const [lat, lng] = flyTarget.center
    skipBoundsRef.current = true
    mapRef.current.panTo({ lat, lng })
    if (flyTarget.zoom != null) mapRef.current.setZoom(flyTarget.zoom)
    const t = window.setTimeout(() => {
      skipBoundsRef.current = false
    }, 1400)
    return () => window.clearTimeout(t)
  }, [ready, flyTarget])

  useEffect(() => {
    if (!ready || !mapRef.current || !window.google?.maps) return
    const maps = window.google.maps
    const map = mapRef.current
    const seen = new Set()

    for (const p of instructors) {
      const id = String(p.id)
      seen.add(id)
      const isNearest = p.id === nearestId
      const selected = p.id === selectedId
      const initial = instructorInitials(p.full_name).replace(/\./g, '') || 'M'
      const icon = {
        url: pinIconUrl({ initial, kind: p.map_profile_kind, isNearest, selected }),
        scaledSize: new maps.Size(selected ? 40 : isNearest ? 38 : 34, selected ? 40 : isNearest ? 38 : 34),
        anchor: new maps.Point(selected ? 20 : isNearest ? 19 : 17, selected ? 20 : isNearest ? 19 : 17),
      }
      let marker = markersRef.current.get(id)
      if (!marker) {
        marker = new maps.Marker({
          map,
          position: { lat: p.latitude, lng: p.longitude },
          icon,
          zIndex: isNearest ? 2000 : selected ? 1500 : 500,
        })
        marker.addListener('click', () => onSelect?.(p))
        markersRef.current.set(id, marker)
      } else {
        marker.setPosition({ lat: p.latitude, lng: p.longitude })
        marker.setIcon(icon)
        marker.setZIndex(isNearest ? 2000 : selected ? 1500 : 500)
      }
    }

    markersRef.current.forEach((marker, id) => {
      if (!seen.has(id)) {
        marker.setMap(null)
        markersRef.current.delete(id)
      }
    })
  }, [ready, instructors, selectedId, nearestId, onSelect])

  useEffect(() => {
    if (!ready || !mapRef.current || !window.google?.maps) return
    const maps = window.google.maps
    const map = mapRef.current

    if (showUserLocation && refPoint) {
      const pos = { lat: refPoint.lat, lng: refPoint.lng }
      if (!userMarkerRef.current) {
        userMarkerRef.current = new maps.Marker({
          map,
          position: pos,
          zIndex: 3000,
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: '#3b82f6',
            fillOpacity: 0.95,
            strokeColor: '#60a5fa',
            strokeWeight: 3,
          },
          title: 'Siz buradasınız',
        })
      } else {
        userMarkerRef.current.setPosition(pos)
        userMarkerRef.current.setMap(map)
      }
    } else {
      userMarkerRef.current?.setMap(null)
    }
  }, [ready, showUserLocation, refPoint])

  if (loadErr) {
    return (
      <div className={`${className} flex items-center justify-center p-4 bg-black/50`}>
        <p className="text-sm text-amber-400 text-center">{loadErr}</p>
      </div>
    )
  }

  return <div ref={containerRef} className={className} />
}
