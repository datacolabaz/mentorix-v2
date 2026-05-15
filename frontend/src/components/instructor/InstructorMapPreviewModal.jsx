import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import Button from '../common/Button'
import { Link } from 'react-router-dom'
import { formatDistanceKm } from '../../lib/geo'

const DARK_TILE = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTRIB =
  '&copy; OpenStreetMap &copy; CARTO'

function kindLabel(k) {
  return k === 'trainer' ? 'Təlimçi' : 'Müəllim'
}

/**
 * Müəllimin /search səhifəsində necə görünəcəyinin önizləməsi.
 */
export default function InstructorMapPreviewModal({
  open,
  onClose,
  fullName,
  subject,
  mapKind,
  latitude,
  longitude,
  locationLabel,
  mapVisible,
  radiusKm = 10,
}) {
  if (!open) return null

  const lat = Number(latitude)
  const lng = Number(longitude)
  const hasPin = Number.isFinite(lat) && Number.isFinite(lng)
  const isTrainer = mapKind === 'trainer'
  const color = isTrainer ? '#f59e0b' : '#00E676'

  return (
    <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#121212] shadow-2xl overflow-hidden"
        role="dialog"
        aria-labelledby="map-preview-title"
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-start justify-between gap-3">
          <div>
            <h3 id="map-preview-title" className="font-display font-bold text-white text-lg">
              Axtarışda necə görünürsünüz
            </h3>
            <p className="text-xs text-gray-400 mt-1">Bu, tələbələrin /search səhifəsində gördüyü görünüşdür</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none px-1"
            aria-label="Bağla"
          >
            ×
          </button>
        </div>

        <div className="h-52 relative">
          {hasPin ? (
            <MapContainer center={[lat, lng]} zoom={14} className="h-full w-full" scrollWheelZoom={false}>
              <TileLayer url={DARK_TILE} attribution={TILE_ATTRIB} />
              <CircleMarker
                center={[lat, lng]}
                radius={11}
                pathOptions={{
                  color: '#fff',
                  fillColor: color,
                  fillOpacity: 1,
                  weight: 3,
                }}
              >
                <Popup>
                  <div className="text-gray-900 text-sm min-w-[140px]">
                    <div className="font-bold">{fullName}</div>
                    <div className="text-xs text-gray-600 mt-0.5">{subject || '—'}</div>
                    <div className="text-[11px] mt-1">{kindLabel(mapKind)}</div>
                  </div>
                </Popup>
              </CircleMarker>
            </MapContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-gray-500 px-6 text-center">
              Əvvəlcə xəritədə pin qoyun
            </div>
          )}
        </div>

        <div className="p-5 space-y-3">
          <div
            className={`rounded-xl border p-4 flex gap-3 ${
              mapVisible ? 'border-primary/40 bg-primary/5' : 'border-amber-500/30 bg-amber-500/5'
            }`}
          >
            <span
              className="h-10 w-10 rounded-full shrink-0 flex items-center justify-center text-lg ring-2 ring-white/20"
              style={{ backgroundColor: color }}
            >
              {isTrainer ? '🥊' : '👨‍🏫'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-white">{fullName || 'Müəllim'}</div>
              {locationLabel ? (
                <div className="text-xs text-primary mt-0.5">📍 {locationLabel}</div>
              ) : null}
              <div className="text-xs text-gray-400 mt-0.5">{subject || 'Fənn göstərilməyib'}</div>
              <div className="text-[11px] text-gray-500 mt-1">
                {kindLabel(mapKind)} · ~{formatDistanceKm(radiusKm)} radiusda axtarışda
              </div>
              {!mapVisible ? (
                <p className="text-xs text-amber-400 mt-2">⚠ Hazırda gizlisiniz — «Tələbələr sizi tapa bilsin» aktiv edin</p>
              ) : (
                <p className="text-xs text-emerald-400/90 mt-2">✓ Tələbələr sizi xəritədə görə bilər</p>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center">
              Bağla
            </Button>
            {mapVisible && hasPin ? (
              <Link to="/search" className="flex-1">
                <Button type="button" className="w-full justify-center">
                  Canlı xəritəyə bax
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
