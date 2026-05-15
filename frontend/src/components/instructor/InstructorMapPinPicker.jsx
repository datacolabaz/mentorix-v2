import { useCallback, useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'

const BAKU_CENTER = [40.4093, 49.8671]
const DARK_TILE = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTRIB =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

function parseCoord(v) {
  if (v === '' || v == null) return null
  const n = Number.parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function pinIcon(kind) {
  const color = kind === 'trainer' ? '#f97316' : '#22c55e'
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 12px rgba(0,0,0,.45)"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function formatCoord(n) {
  return n.toFixed(6)
}

function MapFlyTo({ center, flyKey }) {
  const map = useMap()
  useEffect(() => {
    if (!center || flyKey == null || flyKey < 1) return
    map.flyTo(center, 15, { duration: 0.9 })
  }, [map, center, flyKey])
  return null
}

function MapClickPick({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function DraggablePin({ position, kind, onPick }) {
  const markerRef = useRef(null)

  const handlers = useMemo(
    () => ({
      dragend() {
        const ll = markerRef.current?.getLatLng?.()
        if (ll) onPick(ll.lat, ll.lng)
      },
    }),
    [onPick],
  )

  return (
    <Marker
      key={kind}
      ref={markerRef}
      position={position}
      draggable
      icon={pinIcon(kind)}
      eventHandlers={handlers}
    />
  )
}

/**
 * Müəllim mövqeyini xəritədə pin ilə seçmək (klik / sürüşdürmə).
 */
export default function InstructorMapPinPicker({ latitude, longitude, mapKind = 'teacher', flyKey = 0, onChange }) {
  const lat = parseCoord(latitude)
  const lng = parseCoord(longitude)
  const hasPin = lat != null && lng != null
  const center = hasPin ? [lat, lng] : BAKU_CENTER
  const zoom = hasPin ? 14 : 11

  const handlePick = useCallback(
    (la, ln) => {
      onChange?.(formatCoord(la), formatCoord(ln))
    },
    [onChange],
  )

  return (
    <div className="space-y-2">
      <p className="text-xs text-token-textMuted leading-relaxed">
        Xəritədə işlədiyiniz yerə klik edin və ya pini sürüşdürün. Koordinatları əzbərləməyə ehtiyac yoxdur.
      </p>
      <div className="h-[min(52vh,320px)] w-full rounded-xl overflow-hidden border border-white/10 ring-1 ring-black/20 z-0">
        <MapContainer center={center} zoom={zoom} className="h-full w-full" scrollWheelZoom>
          <TileLayer url={DARK_TILE} attribution={TILE_ATTRIB} />
          <MapClickPick onPick={handlePick} />
          <MapFlyTo center={hasPin ? center : null} flyKey={flyKey} />
          {hasPin ? <DraggablePin position={center} kind={mapKind} onPick={handlePick} /> : null}
        </MapContainer>
      </div>
      {!hasPin ? (
        <p className="text-xs text-amber-400/90">
          Hələ pin yoxdur — xəritəyə bir dəfə klik edin və ya «Mövqeyimdən doldur» düyməsini basın.
        </p>
      ) : null}
    </div>
  )
}
