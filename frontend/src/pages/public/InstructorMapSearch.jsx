import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import api from '../../lib/api'
import Brand from '../../components/common/Brand'
import InstructorMapMarker from '../../components/public/InstructorMapMarker'
import { BAKU_BBOX, BAKU_CENTER, distanceKm, formatDistanceKm } from '../../lib/geo'
import { reverseGeocodeLabel } from '../../lib/reverseGeocode'

const DARK_TILE = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

function zoomForRadiusKm(r) {
  if (r <= 5) return 13
  if (r <= 10) return 12
  return 11
}

function kindLabel(k) {
  if (k === 'trainer') return 'Təlimçi'
  return 'Müəllim'
}

function resultCountLabel(count, kind) {
  if (kind === 'teacher') return `${count} müəllim tapıldı`
  if (kind === 'trainer') return `${count} təlimçi tapıldı`
  return `${count} nəticə tapıldı`
}

function BoundsTracker({ kind, onBounds, enabled }) {
  const map = useMap()
  const debounceRef = useRef(null)
  const skipNextRef = useRef(false)

  const emit = useCallback(() => {
    if (!enabled || skipNextRef.current) {
      skipNextRef.current = false
      return
    }
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
  }, [map, onBounds, enabled])

  useEffect(() => {
    map.on('moveend', emit)
    return () => {
      map.off('moveend', emit)
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [map, emit])

  return null
}

function FlyTo({ target, onDone }) {
  const map = useMap()
  useEffect(() => {
    if (!target?.center || target.zoom == null) return
    map.flyTo(target.center, target.zoom, { duration: 1.1 })
    const t = window.setTimeout(() => onDone?.(), 1150)
    return () => window.clearTimeout(t)
  }, [map, target, onDone])
  return null
}

function MapInvalidateSize() {
  const map = useMap()
  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 120)
    return () => window.clearTimeout(t)
  }, [map])
  return null
}

export default function InstructorMapSearch() {
  const [kind, setKind] = useState('all')
  const [instructors, setInstructors] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasFetched, setHasFetched] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [locationHint, setLocationHint] = useState('')
  const [listOnly, setListOnly] = useState(false)
  const [radiusKm, setRadiusKm] = useState(10)
  const [flyTarget, setFlyTarget] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [refPoint, setRefPoint] = useState({ lat: BAKU_CENTER[0], lng: BAKU_CENTER[1] })
  /** user = GPS, baku = fallback/default, loading = sorğu gedir */
  const [distanceOrigin, setDistanceOrigin] = useState('baku')
  const [userLocationLabel, setUserLocationLabel] = useState('')
  const [locating, setLocating] = useState(false)
  const [nearMeActive, setNearMeActive] = useState(false)
  const [userLocated, setUserLocated] = useState(false)
  const geoWatchRef = useRef(null)
  const lastBoundsRef = useRef(BAKU_BBOX)
  const [radiusMode, setRadiusMode] = useState(false)
  const suppressBoundsRef = useRef(false)
  const loadSeqRef = useRef(0)
  const skipKindReloadRef = useRef(true)
  const autoNearestDoneRef = useRef(false)

  const loadByBbox = useCallback(
    async (bbox) => {
      const seq = ++loadSeqRef.current
      setLoading(true)
      setFetchError('')
      lastBoundsRef.current = bbox
      setRadiusMode(false)
      try {
        const res = await api.get('/public/instructors-map', {
          params: {
            north: bbox.north,
            south: bbox.south,
            east: bbox.east,
            west: bbox.west,
            kind,
            user_lat: refPoint.lat,
            user_lng: refPoint.lng,
          },
        })
        if (seq !== loadSeqRef.current) return
        if (res?.success) {
          setInstructors(Array.isArray(res.instructors) ? res.instructors : [])
        } else {
          setInstructors([])
          setFetchError(res?.message || 'Məlumat alınmadı')
        }
      } catch (e) {
        if (seq !== loadSeqRef.current) return
        setInstructors([])
        setFetchError(e?.message || 'Şəbəkə xətası')
      } finally {
        if (seq === loadSeqRef.current) {
          setLoading(false)
          setHasFetched(true)
        }
      }
    },
    [kind, refPoint.lat, refPoint.lng],
  )

  const loadByRadius = useCallback(
    async (lat, lng, radius) => {
      const seq = ++loadSeqRef.current
      setLoading(true)
      setFetchError('')
      setRadiusMode(true)
      try {
        const res = await api.get('/public/instructors-map', {
          params: {
            lat,
            lng,
            radius_km: radius,
            kind,
            user_lat: refPoint.lat,
            user_lng: refPoint.lng,
          },
        })
        if (seq !== loadSeqRef.current) return
        if (res?.success) {
          setInstructors(Array.isArray(res.instructors) ? res.instructors : [])
        } else {
          setInstructors([])
          setFetchError(res?.message || 'Məlumat alınmadı')
        }
      } catch (e) {
        if (seq !== loadSeqRef.current) return
        setInstructors([])
        setFetchError(e?.message || 'Şəbəkə xətası')
      } finally {
        if (seq === loadSeqRef.current) {
          setLoading(false)
          setHasFetched(true)
        }
      }
    },
    [kind, refPoint.lat, refPoint.lng],
  )

  /** İlk giriş: Bakı + müəllimlər */
  useEffect(() => {
    void loadByBbox(BAKU_BBOX)
  }, [loadByBbox])

  const onBounds = useCallback(
    (bbox) => {
      if (suppressBoundsRef.current) return
      void loadByBbox(bbox)
    },
    [loadByBbox],
  )

  useEffect(() => {
    if (skipKindReloadRef.current) {
      skipKindReloadRef.current = false
      return
    }
    if (radiusMode && userLocated) {
      void loadByRadius(refPoint.lat, refPoint.lng, radiusKm)
    } else {
      void loadByBbox(lastBoundsRef.current || BAKU_BBOX)
    }
  }, [kind, loadByBbox, loadByRadius, radiusMode, userLocated, refPoint.lat, refPoint.lng, radiusKm])

  useEffect(() => {
    if (!radiusMode || !userLocated) return
    void loadByRadius(refPoint.lat, refPoint.lng, radiusKm)
  }, [radiusKm, radiusMode, userLocated, refPoint.lat, refPoint.lng, loadByRadius])

  const resolveUserLabel = useCallback(async (lat, lng) => {
    const label = await reverseGeocodeLabel(lat, lng)
    setUserLocationLabel(label || 'Cari mövqeyiniz')
  }, [])

  const applyCenter = useCallback(
    (lat, lng, { fallback = false, useRadius = true } = {}) => {
      setRefPoint({ lat, lng })
      setUserLocated(!fallback)
      setDistanceOrigin(fallback ? 'baku' : 'user')
      setNearMeActive(!fallback)
      suppressBoundsRef.current = true
      setFlyTarget({ center: [lat, lng], zoom: zoomForRadiusKm(radiusKm), key: Date.now() })
      window.setTimeout(() => {
        suppressBoundsRef.current = false
      }, 1400)
      if (useRadius) {
        setRadiusMode(true)
        void loadByRadius(lat, lng, radiusKm)
      }
      if (fallback) {
        setUserLocationLabel('')
        setLocationHint('Mövqe alınmadı — məsafə Bakı mərkəzindən göstərilir. Brauzerdə mövqe icazəsi verin.')
      } else {
        setLocationHint('')
        void resolveUserLabel(lat, lng)
      }
    },
    [loadByRadius, radiusKm, resolveUserLabel],
  )

  const requestUserLocation = useCallback(
    (opts = {}) => {
      const { silent = false } = opts
      if (!navigator.geolocation) {
        if (!silent) applyCenter(BAKU_CENTER[0], BAKU_CENTER[1], { fallback: true })
        return
      }
      setLocating(true)
      setDistanceOrigin('loading')
      if (!silent) setLocationHint('Mövqəniz müəyyən edilir…')
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocating(false)
          applyCenter(pos.coords.latitude, pos.coords.longitude, { fallback: false })
        },
        () => {
          setLocating(false)
          if (nearMeActive || !silent) {
            applyCenter(BAKU_CENTER[0], BAKU_CENTER[1], { fallback: true })
          } else {
            setDistanceOrigin('baku')
            setLocationHint('Mövqe icazəsi yoxdur — «Mənim yaxınlığımda» ilə aktiv edin')
          }
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
      )
    },
    [applyCenter, nearMeActive],
  )

  /** Səhifəyə girəndə bir dəfə GPS soruş — məsafə dəqiq olsun */
  const geoBootRef = useRef(false)
  useEffect(() => {
    if (geoBootRef.current) return
    geoBootRef.current = true
    requestUserLocation({ silent: true })
    return () => {
      if (geoWatchRef.current != null) {
        navigator.geolocation?.clearWatch(geoWatchRef.current)
        geoWatchRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nearMe = () => {
    setNearMeActive(true)
    requestUserLocation({ silent: false })
  }

  const distanceFromLabel =
    distanceOrigin === 'user'
      ? userLocationLabel
        ? `Sizdən (${userLocationLabel})`
        : 'Sizdən'
      : distanceOrigin === 'loading'
        ? 'Mövqe axtarılır…'
        : 'Bakı mərkəzindən (təxmini)'

  const instructorsSorted = useMemo(() => {
    return instructors
      .map((p) => {
        const fromApi = p.distance_km != null ? Number(p.distance_km) : null
        const distanceKmVal =
          fromApi != null && Number.isFinite(fromApi)
            ? fromApi
            : distanceKm(refPoint.lat, refPoint.lng, p.latitude, p.longitude)
        return { ...p, distanceKm: distanceKmVal }
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }, [instructors, refPoint])

  const nearestInstructor = instructorsSorted[0] ?? null
  const nearestId = nearestInstructor?.id ?? null

  useEffect(() => {
    if (autoNearestDoneRef.current || loading || !nearestInstructor) return
    if (distanceOrigin !== 'user') return
    autoNearestDoneRef.current = true
    setSelectedId(nearestInstructor.id)
  }, [distanceOrigin, loading, nearestInstructor])

  const focusInstructor = (p) => {
    setSelectedId(p.id)
    setFlyTarget({ center: [p.latitude, p.longitude], zoom: 15, key: Date.now() })
    if (listOnly) setListOnly(false)
  }

  const count = instructorsSorted.length
  const isEmpty = hasFetched && !loading && count === 0 && !fetchError

  return (
    <div className="min-h-[100svh] bg-[#0b0b0b] text-white flex flex-col">
      <header className="border-b border-white/10 bg-[#0f0f0f]/95 backdrop-blur-sm z-[500]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Brand className="h-8 w-auto shrink-0" />
            <div className="min-w-0">
              <h1 className="font-display font-bold text-lg sm:text-xl truncate">Təlimçini xəritədə tap</h1>
              <p className="text-xs text-gray-500 hidden sm:block">
                Sizə ən yaxın müəllim və təlimçi · məsafəyə görə sıralanır
              </p>
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
          <div className="w-full lg:w-[58%] h-[42vh] lg:h-auto lg:min-h-[420px] border-b lg:border-b-0 lg:border-r border-white/10 relative z-0">
            <MapContainer
              center={BAKU_CENTER}
              zoom={11}
              className="h-full w-full z-0"
              scrollWheelZoom
              attributionControl={false}
            >
              <TileLayer url={DARK_TILE} attribution="" />
              <MapInvalidateSize />
              <BoundsTracker kind={kind} onBounds={onBounds} enabled={!radiusMode} />
              {flyTarget ? <FlyTo target={flyTarget} /> : null}
              {distanceOrigin === 'user' && userLocated ? (
                <CircleMarker
                  center={[refPoint.lat, refPoint.lng]}
                  radius={8}
                  pathOptions={{
                    color: '#60a5fa',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.95,
                    weight: 3,
                  }}
                >
                  <Popup>
                    <div className="text-gray-900 text-xs font-semibold">Siz buradasınız</div>
                    {userLocationLabel ? <div className="text-gray-600 text-[11px]">{userLocationLabel}</div> : null}
                  </Popup>
                </CircleMarker>
              ) : null}
              {instructorsSorted.map((p) => (
                <InstructorMapMarker
                  key={String(p.id)}
                  instructor={p}
                  isNearest={p.id === nearestId}
                  selected={selectedId === p.id}
                  onSelect={focusInstructor}
                />
              ))}
            </MapContainer>
            {nearestInstructor && distanceOrigin === 'user' && !loading ? (
              <div className="absolute top-3 left-3 right-3 sm:right-auto sm:max-w-sm z-[400] pointer-events-auto">
                <button
                  type="button"
                  onClick={() => focusInstructor(nearestInstructor)}
                  className="w-full text-left rounded-xl border border-amber-500/50 bg-black/85 backdrop-blur-md px-3 py-2.5 shadow-lg hover:border-amber-400/70 transition-colors"
                >
                  <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">Sizə ən yaxın</p>
                  <p className="text-sm font-semibold text-white mt-0.5 leading-snug">
                    {kindLabel(nearestInstructor.map_profile_kind)}: {nearestInstructor.full_name}
                    <span className="text-primary ml-1">({formatDistanceKm(nearestInstructor.distanceKm)})</span>
                  </p>
                </button>
              </div>
            ) : null}
            {loading ? (
              <div className="pointer-events-none absolute bottom-3 left-3 text-xs bg-black/75 px-2.5 py-1 rounded-md text-gray-300 border border-white/10">
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
                disabled={locating}
                className={`text-xs font-bold rounded-xl border px-3 py-2 transition-colors ${
                  nearMeActive && distanceOrigin === 'user'
                    ? 'bg-primary/25 border-primary/50 text-primary'
                    : 'bg-white/5 border-white/15 text-gray-300 hover:border-white/25'
                }`}
              >
                {locating ? 'Mövqe axtarılır…' : 'Mənim yaxınlığımda'}
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
            {locationHint ? <p className="text-xs text-amber-400/90">{locationHint}</p> : null}
            {fetchError ? <p className="text-xs text-red-400">{fetchError}</p> : null}
            {hasFetched && !fetchError ? (
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-white">
                  Nəticə: <span className="text-primary">{resultCountLabel(count, kind)}</span>
                </p>
                <p className="text-[11px] text-gray-500">Məsafə: {distanceFromLabel}</p>
              </div>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">

            {nearestInstructor && distanceOrigin === 'user' && count > 0 && !loading ? (
              <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-emerald-500/10 p-3 mb-3">
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">Sizə ən yaxın</p>
                <p className="text-sm font-semibold text-white mt-1">
                  {kindLabel(nearestInstructor.map_profile_kind)}: {nearestInstructor.full_name}
                  <span className="text-primary ml-1">({formatDistanceKm(nearestInstructor.distanceKm)})</span>
                </p>
                <button
                  type="button"
                  onClick={() => focusInstructor(nearestInstructor)}
                  className="mt-2 text-xs font-bold text-primary hover:underline"
                >
                  Xəritədə göstər →
                </button>
              </div>
            ) : null}

            {loading && !count ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse border border-white/5" />
                ))}
              </div>
            ) : null}

            {isEmpty ? (
              <div className="rounded-xl border border-white/10 bg-[#121212]/80 p-5 text-center space-y-2">
                <p className="text-sm font-semibold text-white">Bu ərazidə müəllim yoxdur</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Radiusu artır və ya filteri dəyiş. Xəritəni başqa əraziyə sürüşdürün.
                </p>
                <button
                  type="button"
                  onClick={nearMe}
                  className="mt-2 text-xs font-bold text-primary hover:underline"
                >
                  Mənim yaxınlığımda yenidən yoxla
                </button>
              </div>
            ) : null}

            {count > 0 ? (
              <div className="flex items-center justify-between mb-1 px-0.5">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ən yaxın təlimçilər</h2>
                <span className="text-[10px] text-gray-500">məsafəyə görə</span>
              </div>
            ) : null}

            {instructorsSorted.map((p, idx) => {
              const isTrainer = p.map_profile_kind === 'trainer'
              const selected = selectedId === p.id
              const rank = idx + 1
              const isNearest = rank === 1
              return (
                <button
                  key={String(p.id)}
                  type="button"
                  onClick={() => focusInstructor(p)}
                  className={`w-full text-left rounded-xl border p-3 flex gap-3 items-start transition-colors ${
                    selected
                      ? 'border-primary/60 bg-primary/10 ring-1 ring-primary/30'
                      : isNearest
                        ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-400/50'
                        : 'border-white/10 bg-[#121212]/90 hover:border-white/20 hover:bg-[#161616]'
                  }`}
                >
                  <span className="mt-0.5 w-6 shrink-0 text-center text-sm font-bold text-gray-500">{rank}.</span>
                  <span
                    className="mt-1.5 h-3.5 w-3.5 rounded-full shrink-0 ring-2 ring-white/25"
                    style={{ backgroundColor: isTrainer ? '#f59e0b' : '#00E676' }}
                  />
                  <div className="min-w-0 flex-1">
                    {isNearest ? (
                      <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 mb-1">
                        ⭐ Ən yaxın
                      </span>
                    ) : null}
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-white text-sm truncate">{p.full_name}</span>
                      <span className="text-xs font-bold text-primary shrink-0 text-right">
                        {formatDistanceKm(p.distanceKm)}
                        <span className="block text-[10px] font-normal text-gray-500">
                          {distanceOrigin === 'user' ? 'sizdən' : 'təxmini'}
                        </span>
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{p.subject}</div>
                    <div className="text-[11px] text-gray-500 mt-1">{kindLabel(p.map_profile_kind)}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>
      </div>
    </div>
  )
}
