import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { BAKU_CENTER, distanceKm, formatDistanceKm } from '../../lib/geo'
import { reverseGeocodeLabel } from '../../lib/reverseGeocode'
import { setPageSeo } from '../../lib/pageSeo'
import PublicSeoFooter from '../../components/public/PublicSeoFooter'
import PublicPageTopBar from '../../components/public/PublicPageTopBar'
import DiscoverSearchFilters from '../../components/discover/DiscoverSearchFilters'
import CategoryMegaMenu from '../../components/discover/CategoryMegaMenu'
import InquiryFormModal from '../../components/discover/InquiryFormModal'
import DiscoverAuthModal from '../../components/discover/DiscoverAuthModal'
import TeacherMapListCard from '../../components/discover/TeacherMapListCard'
import MarketplaceAiSearchPanel from '../../components/discover/MarketplaceAiSearchPanel'
import useAuthStore from '../../hooks/useAuth'
import { useToast } from '../../components/common/Toast'
import { sortInstructorsForMapListing } from '../../lib/mapListingSort'

function mapFilterParams(filters) {
  const p = {}
  if (filters?.category_id) p.category_id = filters.category_id
  if (filters?.format && filters.format !== 'any') p.format = filters.format
  if (filters?.area_id) p.area_id = filters.area_id
  return p
}

export default function InstructorMapSearch() {
  const { t } = useTranslation()
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

  const kindLabel = useCallback(
    (k) => (k === 'trainer' ? t('marketplace.kind.trainer') : t('marketplace.kind.teacher')),
    [t],
  )

  const resultCountLabel = useCallback(
    (count, k) => {
      if (k === 'teacher') return t('marketplace.results.teachersFound', { count })
      if (k === 'trainer') return t('marketplace.results.trainersFound', { count })
      return t('marketplace.results.allFound', { count })
    },
    [t],
  )

  const nearestResultsHeadline = useCallback(
    (count, k) => {
      if (count === 0) return t('marketplace.results.noneFound')
      if (k === 'teacher') return t('marketplace.results.nearestTeachers', { count })
      if (k === 'trainer') return t('marketplace.results.nearestTrainers', { count })
      return t('marketplace.results.nearestAll', { count })
    },
    [t],
  )

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
      const category = discoverFilters.category_name
      setPageSeo({
        title: t('marketplace.seo.categoryTitle', { category }),
        description: t('marketplace.seo.categoryDescription', { category }),
        canonicalPath: slug ? `/search?category=${encodeURIComponent(slug)}` : '/search',
        keywords: t('marketplace.seo.categoryKeywords', { category }),
        breadcrumbs: [
          { name: t('marketplace.seo.brand'), path: '/' },
          { name: t('marketplace.seo.searchTitle'), path: '/search' },
          { name: category, path: slug ? `/search?category=${encodeURIComponent(slug)}` : '/search' },
        ],
      })
      return
    }
    setPageSeo({
      title: t('marketplace.seo.defaultTitle'),
      description: t('marketplace.seo.defaultDescription'),
      canonicalPath: '/search',
      keywords: t('marketplace.seo.defaultKeywords'),
      breadcrumbs: [
        { name: t('marketplace.seo.brand'), path: '/' },
        { name: t('marketplace.seo.searchTitle'), path: '/search' },
      ],
    })
  }, [discoverFilters.category_name, discoverFilters.category_slug, discoverFilters.category_id, t])

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
          setFetchError(res?.message || t('marketplace.errors.fetchFailed'))
        }
      } catch (e) {
        if (seq !== loadSeqRef.current) return
        setInstructors([])
        setFetchError(e?.message || t('marketplace.errors.network'))
      } finally {
        if (seq === loadSeqRef.current) {
          setLoading(false)
          setHasFetched(true)
        }
      }
    },
    [kind, refPoint.lat, refPoint.lng, discoverFilters, t],
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

  const resolveUserLabel = useCallback(
    async (lat, lng) => {
      const label = await reverseGeocodeLabel(lat, lng)
      setUserLocationLabel(label || t('marketplace.distance.currentPosition'))
    },
    [t],
  )

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
        setUserLocationLabel(t('marketplace.distance.bakuCenter'))
        setLocationHint('')
      } else {
        setLocationHint('')
        void resolveUserLabel(lat, lng)
      }
    },
    [loadByRadius, radiusKm, resolveUserLabel, t],
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
      if (!silent) setLocationHint(t('marketplace.distance.locatingHint'))
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
    [applyCenter, t],
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
        ? t('marketplace.distance.fromYouWithLabel', { label: userLocationLabel })
        : t('marketplace.distance.fromYou')
      : distanceOrigin === 'loading'
        ? t('marketplace.distance.locating')
        : t('marketplace.distance.fromBakuCenter')

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
          toast(t('marketplace.errors.whatsappNoNumber'), 'info')
          setInquiryTarget(p)
        }
      } catch (e) {
        toast(e?.message || t('marketplace.errors.whatsappOpenFailed'), 'error')
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

  const kindOptions = useMemo(
    () => [
      ['all', t('marketplace.kind.all')],
      ['teacher', t('marketplace.kind.teacher')],
      ['trainer', t('marketplace.kind.trainer')],
    ],
    [t],
  )

  return (
    <div className="min-h-[100svh] bg-[#0b0b0b] text-white flex flex-col">
      <PublicPageTopBar
        backTo="/"
        title={t('marketplace.title')}
        subtitle={t('marketplace.subtitle')}
      >
        <Link
          to="/login"
          className="flex-1 sm:flex-initial text-center text-sm font-medium text-primary hover:brightness-110 px-3 py-2 rounded-lg border border-primary/30 min-h-[40px] inline-flex items-center justify-center"
        >
          {t('marketplace.backToLogin')}
        </Link>
      </PublicPageTopBar>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <main className="order-2 lg:order-1 flex-1 flex flex-col min-h-0 lg:w-[58%] lg:border-r border-white/10 min-h-[50vh] lg:min-h-0">
          <div className="shrink-0 px-4 py-4 border-b border-white/10 space-y-1">
            {hasFetched && !fetchError ? (
              <>
                <p className="text-base sm:text-lg font-semibold text-white leading-snug">
                  {nearestResultsHeadline(count, kind)}
                </p>
                <p className="text-xs text-gray-500">
                  {t('marketplace.distance.label')}: {distanceFromLabel}
                  {loading ? (
                    <span className="text-gray-400"> · {t('marketplace.distance.refreshing')}</span>
                  ) : null}
                </p>
              </>
            ) : loading ? (
              <p className="text-sm text-gray-400">{t('marketplace.searching')}</p>
            ) : null}
            {fetchError ? <p className="text-xs text-red-400 mt-1">{fetchError}</p> : null}
          </div>

          <div ref={listScrollRef} className="flex-1 overflow-y-auto p-4">
            {nearestInstructor && distanceOrigin === 'user' && count > 0 && !loading ? (
              <div className="rounded-xl border border-sky-500/35 bg-gradient-to-r from-sky-500/10 to-emerald-500/10 p-3 mb-4">
                <p className="text-[10px] font-bold text-sky-400 uppercase tracking-wide">
                  {t('marketplace.nearestBadge')}
                </p>
                <p className="text-sm font-semibold text-white mt-1">
                  {t('marketplace.nearestKindName', {
                    kind: kindLabel(nearestInstructor.map_profile_kind),
                    name: nearestInstructor.full_name,
                  })}
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
                <p className="text-sm font-semibold text-white">{t('marketplace.empty.title')}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{t('marketplace.empty.hint')}</p>
                <button
                  type="button"
                  onClick={nearMe}
                  className="mt-2 text-xs font-bold text-primary hover:underline"
                >
                  {t('marketplace.empty.retryNearMe')}
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
              {kindOptions.map(([k, lab]) => (
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
                {locating ? t('marketplace.distance.locating') : t('marketplace.nearMe')}
              </button>
              <label className="text-xs text-gray-500 flex items-center gap-1.5">
                <span className="text-gray-400">{t('marketplace.radius')}</span>
                <select
                  className="bg-[#13112e] border border-white/15 rounded-lg px-2 py-1 text-gray-200 text-xs"
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                >
                  {[5, 10, 25].map((km) => (
                    <option key={km} value={km}>
                      {t('marketplace.radiusKm', { km })}
                    </option>
                  ))}
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
