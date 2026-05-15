import { useCallback, useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet'

const BAKU_CENTER = [40.4093, 49.8671]
const DARK_TILE = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTRIB =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

function parseCoord(v) {
  if (v === '' || v == null) return null
  const n = Number.parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function pinIcon(kind, displayName) {
  const color = kind === 'trainer' ? '#f97316' : '#22c55e'
  const glow = kind === 'trainer' ? 'rgba(249,115,22,0.55)' : 'rgba(34,197,94,0.55)'
  const emoji = kind === 'trainer' ? '🥊' : '👨‍🏫'
  const initial = (displayName || 'M').trim().charAt(0).toUpperCase() || 'M'

  return L.divIcon({
    className: 'mentorix-map-pin',
    html: `
      <div style="position:relative;width:52px;height:58px;margin:-48px 0 0 -26px;pointer-events:none;">
        <div style="position:absolute;inset:4px 8px 12px;border-radius:50%;background:${glow};filter:blur(8px);opacity:0.9;"></div>
        <div style="position:relative;width:44px;height:44px;margin:0 auto;border-radius:50%;background:linear-gradient(145deg,${color},#0f172a);border:3px solid #fff;box-shadow:0 4px 18px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;color:#fff;font-family:system-ui,sans-serif;">
          ${initial}
        </div>
        <div style="position:absolute;right:-2px;bottom:10px;width:22px;height:22px;border-radius:50%;background:#1a1a1a;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:12px;line-height:1;box-shadow:0 2px 8px rgba(0,0,0,.4);">${emoji}</div>
        <div style="position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid #fff;"></div>
      </div>
    `,
    iconSize: [52, 58],
    iconAnchor: [26, 52],
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

function DraggablePin({ position, kind, displayName, onPick }) {
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
      key={`${kind}-${displayName}`}
      ref={markerRef}
      position={position}
      draggable
      icon={pinIcon(kind, displayName)}
      eventHandlers={handlers}
      zIndexOffset={1000}
    />
  )
}

/**
 * Müəllim mövqeyini xəritədə pin ilə seçmək (klik / sürüşdürmə).
 */
export default function InstructorMapPinPicker({
  latitude,
  longitude,
  mapKind = 'teacher',
  flyKey = 0,
  displayName = '',
  radiusKm = 10,
  onChange,
}) {
  const lat = parseCoord(latitude)
  const lng = parseCoord(longitude)
  const hasPin = lat != null && lng != null
  const center = hasPin ? [lat, lng] : BAKU_CENTER
  const zoom = hasPin ? 14 : 11
  const radiusM = Math.max(500, (radiusKm || 10) * 1000)

  const handlePick = useCallback(
    (la, ln) => {
      onChange?.(formatCoord(la), formatCoord(ln))
    },
    [onChange],
  )

  return (
    <div className="space-y-2">
      <p className="text-xs text-token-textMuted leading-relaxed">
        <span className="text-white font-medium">Addım 1:</span> işlədiyiniz yerə klik edin və ya pini sürüşdürün.
        <span className="block mt-1">
          <span className="text-white font-medium">Addım 2:</span> aşağıdan saxlayın — tələbələr sizi xəritədə görəcək.
        </span>
      </p>
      <div className="h-[min(52vh,340px)] w-full rounded-xl overflow-hidden border border-white/10 ring-1 ring-primary/20 z-0 relative">
        <MapContainer center={center} zoom={zoom} className="h-full w-full" scrollWheelZoom>
          <TileLayer url={DARK_TILE} attribution={TILE_ATTRIB} />
          <MapClickPick onPick={handlePick} />
          <MapFlyTo center={hasPin ? center : null} flyKey={flyKey} />
          {hasPin ? (
            <>
              <Circle
                center={center}
                radius={radiusM}
                pathOptions={{
                  color: mapKind === 'trainer' ? '#f97316' : '#22c55e',
                  fillColor: mapKind === 'trainer' ? '#f97316' : '#22c55e',
                  fillOpacity: 0.08,
                  weight: 2,
                  dashArray: '6 8',
                }}
              />
              <DraggablePin position={center} kind={mapKind} displayName={displayName} onPick={handlePick} />
            </>
          ) : null}
        </MapContainer>
        {!hasPin ? (
          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 to-transparent pointer-events-none">
            <p className="text-xs text-amber-300 text-center font-medium">👆 Xəritəyə toxunun — pin burada görünəcək</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
