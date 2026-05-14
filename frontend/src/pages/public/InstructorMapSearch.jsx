import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import api from '../../lib/api'
import Brand from '../../components/common/Brand'

const BAKU_CENTER = [40.4093, 49.8671]

const DARK_TILE = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTRIB =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

function zoomForRadiusKm(r) {
  if (r <= 5) return 13
  if (r <= 10) return 12
  return 11
}

function BoundsTracker({ kind, onBounds }) {
  const map = useMap()
  const debounceRef = useRef(null)

  const emit = useCallback(() => {
    const b = map.getBounds()
    const payload = {
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      onBounds(payload)
    }, 320)
  }, [map, onBounds])

  useEffect(() => {
    emit()
    map.on('moveend', emit)
    return () => {
      map.off('moveend', emit)
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [map, emit, kind])

  return null
}

function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target?.center && target.zoom != null) {
      map.flyTo(target.center, target.zoom, { duration: 1.2 })
    }
  }, [map, target])
  return null
}

function kindLabel(k) {
  if (k === 'trainer') return 'Təlimçi'
  return 'Müəllim'
}

export default function InstructorMapSearch() {
  const [kind, setKind] = useState('all')
  const [instructors, setInstructors] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [listOnly, setListOnly] = useState(false)
  const [radiusKm, setRadiusKm] = useState(10)
  const [flyTarget, setFlyTarget] = useState(null)
  const lastBoundsRef = useRef(null)

  const load = useCallback(
    async (bbox) => {
      setLoading(true)
      setErr('')
      try {
        const { data } = await api.get('/public/instructors-map', {
          params: {
            north: bbox.north,
            south: bbox.south,
            east: bbox.east,
            west: bbox.west,
            kind,
          },
        })
        if (data?.success) setInstructors(Array.isArray(data.instructors) ? data.instructors : [])
        else setErr(data?.message || 'Məlumat alınmadı')
      } catch (e) {
        setErr(e?.message || 'Şəbəkə xətası')
        setInstructors([])
      } finally {
        setLoading(false)
      }
    },
    [kind],
  )

  const onBounds = useCallback(
    (bbox) => {
      lastBoundsRef.current = bbox
      void load(bbox)
    },
    [load],
  )

  useEffect(() => {
    if (listOnly && !lastBoundsRef.current) {
      lastBoundsRef.current = { north: 40.52, south: 40.32, east: 50.05, west: 49.72 }
    }
    if (lastBoundsRef.current) void load(lastBoundsRef.current)
  }, [kind, listOnly, load])

  const nearMe = () => {
    if (!navigator.geolocation) {
      setErr('Brauzeriniz yaxınlıq məlumatını dəstəkləmir')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setFlyTarget({ center: [lat, lng], zoom: zoomForRadiusKm(radiusKm) })
      },
      () => setErr('Yaxınlıq icazəsi verilmədi və ya mövqe tapılmadı'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    )
  }

  return (
    <div className="min-h-[100svh] bg-[#0b0b0b] text-white flex flex-col">
      <header className="border-b border-white/10 bg-[#0f0f0f]/95 backdrop-blur-sm z-[500]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Brand className="h-8 w-auto shrink-0" />
            <div className="min-w-0">
              <h1 className="font-display font-bold text-lg sm:text-xl truncate">Təlimçini xəritədə tap</h1>
              <p className="text-xs text-gray-500 hidden sm:block">Xəritəni hərəkət etdirdikcə siyahı yenilənir</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/login"
              className="text-sm font-medium text-primary hover:brightness-110 px-2 py-1 rounded-lg border border-primary/30"
            >
              Girişə qayıt
            </Link>
            <button
              type="button"
              onClick={() => setListOnly((v) => !v)}
              className="text-xs sm:text-sm font-semibold rounded-xl border border-white/15 bg-white/5 px-3 py-2 hover:bg-white/10"
            >
              {listOnly ? 'Xəritə + siyahı' : 'Yalnız siyahı'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {!listOnly ? (
          <div className="w-full lg:w-[58%] h-[42vh] lg:h-auto lg:min-h-0 border-b lg:border-b-0 lg:border-r border-white/10 relative z-0">
            <MapContainer
              center={BAKU_CENTER}
              zoom={11}
              className="h-full w-full z-0"
              scrollWheelZoom
              attributionControl
            >
              <TileLayer attribution={TILE_ATTRIB} url={DARK_TILE} />
              <BoundsTracker kind={kind} onBounds={onBounds} />
              {flyTarget ? <FlyTo target={flyTarget} /> : null}
              {instructors.map((p) => {
                const isTrainer = p.map_profile_kind === 'trainer'
                const color = isTrainer ? '#f59e0b' : '#00E676'
                return (
                  <CircleMarker
                    key={String(p.id)}
                    center={[p.latitude, p.longitude]}
                    radius={isTrainer ? 9 : 8}
                    pathOptions={{
                      color,
                      fillColor: color,
                      fillOpacity: 0.88,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="text-gray-900 text-sm min-w-[160px]">
                        <div className="font-bold">{p.full_name}</div>
                        <div className="text-gray-600 text-xs mt-1">{p.subject}</div>
                        <div className="text-[11px] mt-1 font-semibold text-gray-700">{kindLabel(p.map_profile_kind)}</div>
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              })}
            </MapContainer>
            {loading ? (
              <div className="pointer-events-none absolute bottom-3 left-3 text-xs bg-black/70 px-2 py-1 rounded-md text-gray-300">
                Yenilənir…
              </div>
            ) : null}
          </div>
        ) : null}

        <aside className={`flex-1 flex flex-col min-h-0 bg-[#0b0b0b] ${listOnly ? 'w-full' : 'lg:w-[42%]'}`}>
          <div className="p-4 border-b border-white/10 space-y-3 shrink-0">
            <div className="flex flex-wrap gap-2">
              {[
                ['all', 'Hamısı'],
                ['teacher', 'Müəllim'],
                ['trainer', 'Təlimçi'],
              ].map(([k, lab]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                    kind === k
                      ? 'bg-primary/20 border-primary/50 text-primary'
                      : 'border-white/15 text-gray-400 hover:border-white/25'
                  }`}
                >
                  {lab}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={nearMe}
                className="text-xs font-bold rounded-xl bg-primary/15 border border-primary/40 text-primary px-3 py-2 hover:bg-primary/25"
              >
                Mənim yaxınlığımda
              </button>
              <label className="text-xs text-gray-500 flex items-center gap-1.5">
                <span className="text-gray-400">Radius</span>
                <select
                  className="bg-[#13112e] border border-white/15 rounded-lg px-2 py-1 text-gray-200 text-xs"
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                >
                  <option value={5}>5 km</option>
                  <option value={10}>10 km</option>
                  <option value={25}>25 km</option>
                </select>
              </label>
            </div>
            {err ? <p className="text-xs text-red-400">{err}</p> : null}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {!instructors.length && !loading ? (
              <p className="text-sm text-gray-500">
                Bu ərazidə koordinatı olan müəllim/təlimçi yoxdur. Müəllimlər profilində xəritə mövqeyini əlavə edəndə burada
                görünəcək.
              </p>
            ) : null}
            {instructors.map((p) => {
              const isTrainer = p.map_profile_kind === 'trainer'
              return (
                <div
                  key={String(p.id)}
                  className="rounded-xl border border-white/10 bg-[#121212]/90 p-3 flex gap-3 items-start"
                >
                  <span
                    className="mt-1 h-3 w-3 rounded-full shrink-0 ring-2 ring-white/20"
                    style={{ backgroundColor: isTrainer ? '#f59e0b' : '#00E676' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white text-sm">{p.full_name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{p.subject}</div>
                    <div className="text-[11px] text-gray-500 mt-1">{kindLabel(p.map_profile_kind)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </aside>
      </div>
    </div>
  )
}
