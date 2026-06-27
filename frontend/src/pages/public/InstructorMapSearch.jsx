import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../../lib/api'
import Brand from '../../components/common/Brand'
import { BAKU_CENTER, distanceKm, formatDistanceKm } from '../../lib/geo'
import { reverseGeocodeLabel } from '../../lib/reverseGeocode'
import { setPageSeo } from '../../lib/pageSeo'
import PublicSeoFooter from '../../components/public/PublicSeoFooter'
import DiscoverSearchFilters from '../../components/discover/DiscoverSearchFilters'
import CategoryMegaMenu from '../../components/discover/CategoryMegaMenu'
import InquiryFormModal from '../../components/discover/InquiryFormModal'
import DiscoverAuthModal from '../../components/discover/DiscoverAuthModal'
import TeacherMapListCard from '../../components/discover/TeacherMapListCard'
import MarketplaceAiSearchPanel from '../../components/discover/MarketplaceAiSearchPanel'
import useAuthStore from '../../hooks/useAuth'
import { useToast } from '../../components/common/Toast'
import { sortInstructorsForMapListing } from '../../lib/mapListingSort'

function kindLabel(k) {
  if (k === 'trainer') return 'Təlimçi'
  return 'Müəllim'
}

function resultCountLabel(count, kind) {
  if (kind === 'teacher') return `${count} müəllim tapıldı`
  if (kind === 'trainer') return `${count} təlimçi tapıldı`
  return `${count} nəticə tapıldı`
}

function nearestResultsHeadline(count, kind) {
  if (count === 0) return 'Müəllim tapılmadı'
  if (kind === 'teacher') return `Sizə ən yaxın ${count} müəllim tapıldı`
  if (kind === 'trainer') return `Sizə ən yaxın ${count} təlimçi tapıldı`
  return `Sizə ən yaxın ${count} nəticə tapıldı`
}

function mapFilterParams(filters) {
  const p = {}
  if (filters?.category_id) p.category_id = filters.category_id
  if (filters?.format && filters.format !== 'any') p.format = filters.format
  if (filters?.area_id) p.area_id = filters.area_id
  return p
}

export default function InstructorMapSearch() {
  const { user, token } = useAuthStore()
  const isAuthenticated = Boolean(token && user)
  const toast = useToast()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [whatsappBusy, setWhatsappBusy] = useState(false)
  const [highlightId, setHighlightId] = useState(null)
  const cardRefs = useRef(new Map())
  const listScrollRef = useRef(null)
  const [kind, setKind] = useState('all')
  const [instructors, setInstructors] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasFetched, setHasFetched] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [locationHint, setLocationHint] = useState('')
  const [radiusKm, setRadiusKm] = useState(10)
  const [selectedId, setSelectedId] = useState(null)
  const [refPoint, setRefPoint] = useState({ lat: BAKU_CENTER[0], lng: BAKU_CENTER[1] })
  /** user = GPS, baku = fallback/default, loading = sorğu gedir */
  const [distanceOrigin, setDistanceOrigin] = useState('baku')
  const [userLocationLabel, setUserLocationLabel] = useState('')
  const [locating, setLocating] = useState(false)
  const [nearMeActive, setNearMeActive] = useState(false)
  const [userLocated, setUserLocated] = useState(false)
  const geoWatchRef = useRef(null)
  const loadSeqRef = useRef(0)
  const skipReloadRef = useRef(true)
  const autoNearestDoneRef = useRef(false)
  const [discoverFilters, setDiscoverFilters] = useState({
    format: 'any',
    category_id: null,
    category_slug: null,
    category_name: null,
    area_id: null,
  })
  const [inquiryTarget, setInquiryTarget] = useState(null)
  const geoResolvedRef = useRef(false)
  const [searchParams] = useSearchParams()
  const categoryFromUrl = searchParams.get('category')

  useEffect(() => {
    const slug = String(categoryFromUrl || '').trim()
    if (!slug) return
    let cancelled = false
    void (async () => {
      try {
        const res = await api.get(`/public/categories/${encodeURIComponent(slug)}`)
        if (cancelled || !res?.success || !res?.category) return
        const c = res.category
        setDiscoverFilters((f) => ({
          ...f,
          category_id: c.id,
          category_slug: c.slug,
          category_name: c.name_az,
        }))
      } catch {
        /* ignore — axtarış filteri olmadan davam */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [categoryFromUrl])

  useEffect(() => {
    if (discoverFilters.category_name) {
      const slug = discoverFilters.category_slug || discoverFilters.category_id
      setPageSeo({
        title: `${discoverFilters.category_name} müəllimi tap — Mentorix | Bakı`,
        description: `${discoverFilters.category_name} repetitoru və müəllimi axtarırsınız? Mentorix-də yaxınlığınızdakı təlimçiləri reytinq və formatla müqayisə edin.`,
        canonicalPath: slug ? `/search?category=${encodeURIComponent(slug)}` : '/search',
        keywords: `${discoverFilters.category_name}, repetitor, müəllim tap, Bakı, Mentorix`,
        breadcrumbs: [
          { name: 'Mentorix', path: '/' },
          { name: 'Müəllim tap', path: '/search' },
          { name: discoverFilters.category_name, path: slug ? `/search?category=${encodeURIComponent(slug)}` : '/search' },
        ],
      })
      return
    }
    setPageSeo({
      title: 'Müəllim tap — axtarış | Mentorix',
      description:
        'Yaxınlığınızdakı müəllim, repetitor və təlimçiləri məsafəyə görə tapın. Mentorix təhsil idarəetmə platformasının ictimai müəllim axtarış bölməsidir.',
      canonicalPath: '/search',
      keywords:
        'müəllim tap, repetitor axtarışı, təlimçi, Bakı, təhsil idarəetmə platforması, Mentorix',
      breadcrumbs: [
        { name: 'Mentorix', path: '/' },
        { name: 'Müəllim tap', path: '/search' },
      ],
    })
  }, [discoverFilters.category_name, discoverFilters.category_slug, discoverFilters.category_id])

  const loadByRadius = useCallback(
    async (lat, lng, radius, userLat = refPoint.lat, userLng = refPoint.lng) => {
      const seq = ++loadSeqRef.current
      setLoading(true)
      setFetchError('')
      try {
        const res = await api.get('/public/instructors-map', {
          params: {
            lat,
            lng,
            radius_km: radius,
            kind,
            user_lat: userLat,
            user_lng: userLng,
            ...mapFilterParams(discoverFilters),
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
    [kind, refPoint.lat, refPoint.lng, discoverFilters],
  )

  const reloadSearch = useCallback(() => {
    void loadByRadius(refPoint.lat, refPoint.lng, radiusKm)
  }, [loadByRadius, refPoint.lat, refPoint.lng, radiusKm])

  useEffect(() => {
    if (skipReloadRef.current) {
      skipReloadRef.current = false
      return
    }
    reloadSearch()
  }, [kind, discoverFilters, refPoint.lat, refPoint.lng, radiusKm, reloadSearch])

  const resolveUserLabel = useCallback(async (lat, lng) => {
    const label = await reverseGeocodeLabel(lat, lng)
    setUserLocationLabel(label || 'Cari mövqeyiniz')
  }, [])

  const applyCenter = useCallback(
    (lat, lng, { fallback = false, loadSearch = true } = {}) => {
      setRefPoint({ lat, lng })
      setUserLocated(!fallback)
      setDistanceOrigin(fallback ? 'baku' : 'user')
      setNearMeActive(!fallback)
      if (loadSearch) {
        void loadByRadius(lat, lng, radiusKm, lat, lng)
      }
      if (fallback) {
        setUserLocationLabel('Bakı (Badamdar / mərkəz)')
        setLocationHint('')
      } else {
        setLocationHint('')
        void resolveUserLabel(lat, lng)
      }
    },
    [loadByRadius, radiusKm, resolveUserLabel],
  )

  const requestUserLocation = useCallback(
    (opts = {}) => {
      const { silent = false, forBoot = false } = opts
      if (!navigator.geolocation) {
        applyCenter(BAKU_CENTER[0], BAKU_CENTER[1], { fallback: true })
        return
      }
      setLocating(true)
      setDistanceOrigin('loading')
      if (!silent) setLocationHint('Mövqəniz müəyyən edilir…')
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocating(false)
          geoResolvedRef.current = true
          applyCenter(pos.coords.latitude, pos.coords.longitude, {
            fallback: false,
            loadSearch: forBoot || !silent,
          })
        },
        () => {
          setLocating(false)
          geoResolvedRef.current = true
          applyCenter(BAKU_CENTER[0], BAKU_CENTER[1], { fallback: true })
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 },
      )
    },
    [applyCenter],
  )

  const geoBootRef = useRef(false)
  useEffect(() => {
    if (geoBootRef.current) return
    geoBootRef.current = true
    requestUserLocation({ silent: true, forBoot: true })
    return () => {
      if (geoWatchRef.current != null) {
        navigator.geolocation?.clearWatch(geoWatchRef.current)
        geoWatchRef.current = null
      }
    }
  }, [requestUserLocation])

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
    const withDist = instructors.map((p) => {
      const fromApi = p.distance_km != null ? Number(p.distance_km) : null
      const distanceKmVal =
        fromApi != null && Number.isFinite(fromApi)
          ? fromApi
          : distanceKm(refPoint.lat, refPoint.lng, p.latitude, p.longitude)
      return { ...p, distanceKm: distanceKmVal }
    })
    return sortInstructorsForMapListing(withDist, (p) => p.distanceKm ?? Infinity)
  }, [instructors, refPoint])

  const nearestInstructor = instructorsSorted[0] ?? null

  useEffect(() => {
    if (autoNearestDoneRef.current || loading || !nearestInstructor) return
    if (distanceOrigin !== 'user') return
    autoNearestDoneRef.current = true
    setSelectedId(nearestInstructor.id)
  }, [distanceOrigin, loading, nearestInstructor])

  const requireContactAuth = (action) => {
    if (isAuthenticated) {
      action()
      return
    }
    setAuthModalOpen(true)
  }

  const scrollToCard = useCallback((id) => {
    const el = cardRefs.current.get(String(id))
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  const focusInstructor = useCallback(
    (p) => {
      if (!p?.id) return
      setSelectedId(p.id)
      setHighlightId(p.id)
      window.setTimeout(() => scrollToCard(p.id), 80)
      window.setTimeout(() => setHighlightId(null), 2600)
    },
    [scrollToCard],
  )

  const onInquiryClick = (p) => {
    requireContactAuth(() => setInquiryTarget(p))
  }

  const onWhatsAppClick = (p) => {
    requireContactAuth(async () => {
      setWhatsappBusy(true)
      try {
        const d = await api.get(`/public/instructors/${encodeURIComponent(p.id)}/messaging`)
        if (d?.whatsapp_available && d.whatsapp_url) {
          window.open(d.whatsapp_url, '_blank', 'noopener,noreferrer')
        } else {
          toast('Müəllimin WhatsApp nömrəsi yoxdur — müraciət formunu doldurun.', 'info')
          setInquiryTarget(p)
        }
      } catch (e) {
        toast(e?.message || 'WhatsApp açılmadı', 'error')
      } finally {
        setWhatsappBusy(false)
      }
    })
  }

  const handleCategoryPick = (pick) => {
    setDiscoverFilters((f) => ({
      ...f,
      category_id: pick.category_id,
      category_slug: pick.category_slug,
      category_name: pick.category_name,
    }))
  }

  const handleAiApplyFilters = useCallback((patch) => {
    if (!patch) return
    setDiscoverFilters((f) => ({
      ...f,
      ...patch,
    }))
  }, [])

  const handleAiFocusTutor = useCallback(
    (tutor) => {
      if (!tutor?.id) return
      focusInstructor(tutor)
    },
    [focusInstructor],
  )

  const count = instructorsSorted.length
  const isEmpty = hasFetched && !loading && count === 0 && !fetchError

  return (
    <div className="min-h-[100svh] bg-[#0b0b0b] text-white flex flex-col">
      <header className="border-b border-white/10 bg-[#0f0f0f]/95 backdrop-blur-sm z-[500] shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 min-w-0 w-full sm:flex-row sm:items-center sm:gap-3 sm:flex-1">
            <Brand className="h-7 w-auto shrink-0 self-start sm:h-8" />
            <div className="min-w-0 w-full">
              <h1 className="font-display font-bold text-base leading-snug sm:text-lg md:text-xl text-white break-words">
                Müəllim tap — Mentorix
              </h1>
              <p className="text-[11px] sm:text-xs text-gray-500 mt-1 leading-snug">
                Məsafəyə görə sıralanmış müəllimlər · reytinq · format · WhatsApp (qeydiyyatdan sonra)
              </p>
            </div>
          </div>
          <div className="flex flex-row flex-wrap items-center gap-2 w-full sm:w-auto sm:shrink-0 sm:justify-end">
            <Link
              to="/login"
              className="flex-1 sm:flex-initial text-center text-sm font-medium text-primary hover:brightness-110 px-3 py-2 rounded-lg border border-primary/30 min-h-[40px] inline-flex items-center justify-center"
            >
              Girişə qayıt
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <main className="order-2 lg:order-1 flex-1 flex flex-col min-h-0 lg:w-[58%] lg:border-r border-white/10 min-h-[50vh] lg:min-h-0">
          <div className="shrink-0 px-4 py-4 border-b border-white/10 space-y-1">
            {hasFetched && !fetchError ? (
              <>
                <p className="text-base sm:text-lg font-semibold text-white leading-snug">
                  {nearestResultsHeadline(count, kind)}
                </p>
                <p className="text-xs text-gray-500">
                  Məsafə: {distanceFromLabel}
                  {loading ? <span className="text-gray-400"> · Yenilənir…</span> : null}
                </p>
              </>
            ) : loading ? (
              <p className="text-sm text-gray-400">Müəllimlər axtarılır…</p>
            ) : null}
            {fetchError ? <p className="text-xs text-red-400 mt-1">{fetchError}</p> : null}
          </div>

          <div ref={listScrollRef} className="flex-1 overflow-y-auto p-4">
            {nearestInstructor && distanceOrigin === 'user' && count > 0 && !loading ? (
              <div className="rounded-xl border border-sky-500/35 bg-gradient-to-r from-sky-500/10 to-emerald-500/10 p-3 mb-4">
                <p className="text-[10px] font-bold text-sky-400 uppercase tracking-wide">📍 Sizə ən yaxın</p>
                <p className="text-sm font-semibold text-white mt-1">
                  {kindLabel(nearestInstructor.map_profile_kind)}: {nearestInstructor.full_name}
                  <span className="text-primary ml-1">({formatDistanceKm(nearestInstructor.distanceKm)})</span>
                </p>
              </div>
            ) : null}

            {loading && !count ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-28 rounded-xl bg-white/5 animate-pulse border border-white/5" />
                ))}
              </div>
            ) : null}

            {isEmpty ? (
              <div className="rounded-xl border border-white/10 bg-[#121212]/80 p-6 text-center space-y-2 max-w-lg mx-auto">
                <p className="text-sm font-semibold text-white">Bu ərazidə müəllim yoxdur</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Radiusu artırın və ya filteri dəyişin.
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
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {instructorsSorted.map((p, idx) => {
                  const isNearest = idx === 0
                  return (
                    <TeacherMapListCard
                      key={String(p.id)}
                      instructor={p}
                      comfortable
                      selected={selectedId === p.id}
                      highlighted={highlightId === p.id}
                      isNearest={isNearest}
                      distanceOrigin={distanceOrigin}
                      cardRef={(el) => {
                        if (el) cardRefs.current.set(String(p.id), el)
                        else cardRefs.current.delete(String(p.id))
                      }}
                      onFocus={focusInstructor}
                      onInquiry={onInquiryClick}
                      onWhatsApp={onWhatsAppClick}
                      whatsappBusy={whatsappBusy}
                    />
                  )
                })}
              </div>
            ) : null}
          </div>
        </main>

        <aside className="order-1 lg:order-2 lg:w-[42%] flex flex-col min-h-0 bg-[#0b0b0b] border-b lg:border-b-0 border-white/10 shrink-0 lg:shrink">
          <div className="p-4 space-y-3 overflow-y-auto lg:max-h-none">
            <MarketplaceAiSearchPanel
              userLat={refPoint.lat}
              userLng={refPoint.lng}
              onApplyFilters={handleAiApplyFilters}
              onInquiry={onInquiryClick}
              onWhatsApp={onWhatsAppClick}
              onFocusTutor={handleAiFocusTutor}
              whatsappBusy={whatsappBusy}
            />
            <CategoryMegaMenu
              activeCategoryId={discoverFilters.category_id}
              onPick={handleCategoryPick}
            />
            <DiscoverSearchFilters
              value={discoverFilters}
              onChange={(next) => {
                setDiscoverFilters(next)
              }}
            />
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
            {hasFetched && !fetchError && count > 0 ? (
              <p className="text-[11px] text-gray-500 pt-1 border-t border-white/10">
                {resultCountLabel(count, kind)} · {distanceFromLabel}
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      <InquiryFormModal
        open={Boolean(inquiryTarget) && isAuthenticated}
        onClose={() => setInquiryTarget(null)}
        instructor={inquiryTarget}
        categoryId={discoverFilters.category_id}
        categoryName={discoverFilters.category_name}
      />

      <DiscoverAuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      <PublicSeoFooter className="shrink-0" />
    </div>
  )
}
