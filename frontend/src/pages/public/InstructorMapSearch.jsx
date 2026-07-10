import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { setPageSeo } from '../../lib/pageSeo'
import {
  BAKU,
  formatResultsLocationPhrase,
  instructorLocationBadge,
} from '@shared/azerbaijanRegions.mjs'
import PublicSeoFooter from '../../components/public/PublicSeoFooter'
import PublicPageTopBar from '../../components/public/PublicPageTopBar'
import DiscoverSearchFilters from '../../components/discover/DiscoverSearchFilters'
import RegionSearchFilter from '../../components/discover/RegionSearchFilter'
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
  const [selectedId, setSelectedId] = useState(null)
  const [region, setRegion] = useState(BAKU)
  const [bakuDistrict, setBakuDistrict] = useState(null)
  const [includeNeighbors, setIncludeNeighbors] = useState(false)
  const loadSeqRef = useRef(0)
  const skipReloadRef = useRef(true)
  const [discoverFilters, setDiscoverFilters] = useState({
    format: 'any',
    category_id: null,
    category_slug: null,
    category_name: null,
    area_id: null,
  })
  const [inquiryTarget, setInquiryTarget] = useState(null)
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const categoryFromUrl = searchParams.get('category')

  const locationPhrase = useMemo(
    () => formatResultsLocationPhrase(region, bakuDistrict),
    [region, bakuDistrict],
  )

  const resultCountLabel = useCallback(
    (count, k) => {
      if (k === 'teacher') return t('marketplace.results.teachersFound', { count })
      if (k === 'trainer') return t('marketplace.results.trainersFound', { count })
      return t('marketplace.results.allFound', { count })
    },
    [t],
  )

  const regionResultsHeadline = useCallback(
    (count, k, location) => {
      if (count === 0) return t('marketplace.results.noneFound')
      if (k === 'teacher') return t('marketplace.results.regionTeachers', { count, location })
      if (k === 'trainer') return t('marketplace.results.regionTrainers', { count, location })
      return t('marketplace.results.regionAll', { count, location })
    },
    [t],
  )

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    listScrollRef.current?.scrollTo({ top: 0, left: 0 })
  }, [location.pathname, location.key])

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
        /* ignore */
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

  const loadByRegion = useCallback(
    async (searchRegion, searchBakuDistrict, searchIncludeNeighbors) => {
      if (!searchRegion) return
      const seq = ++loadSeqRef.current
      setLoading(true)
      setFetchError('')
      try {
        const res = await api.get('/public/instructors-map', {
          params: {
            region: searchRegion,
            ...(searchBakuDistrict ? { baku_district: searchBakuDistrict } : {}),
            ...(searchIncludeNeighbors ? { include_neighbors: '1' } : {}),
            kind,
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
    [kind, discoverFilters, t],
  )

  const reloadSearch = useCallback(() => {
    void loadByRegion(region, bakuDistrict, includeNeighbors)
  }, [loadByRegion, region, bakuDistrict, includeNeighbors])

  useEffect(() => {
    if (skipReloadRef.current) {
      skipReloadRef.current = false
      void loadByRegion(region, bakuDistrict, includeNeighbors)
      return
    }
    reloadSearch()
  }, [kind, discoverFilters, region, bakuDistrict, includeNeighbors, reloadSearch, loadByRegion])

  const instructorsSorted = useMemo(() => {
    return sortInstructorsForMapListing(instructors, () => 0)
  }, [instructors])

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

  const handleRegionChange = useCallback(({ region: r, bakuDistrict: d, includeNeighbors: inc }) => {
    setRegion(r)
    setBakuDistrict(d)
    setIncludeNeighbors(Boolean(inc))
  }, [])

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
        <main className="order-1 flex-1 flex flex-col min-h-0 lg:w-[58%] lg:border-r border-white/10 min-h-[50vh] lg:min-h-0">
          <div className="shrink-0 px-4 py-4 border-b border-white/10 space-y-1">
            {hasFetched && !fetchError ? (
              <>
                <p className="text-base sm:text-lg font-semibold text-white leading-snug">
                  {regionResultsHeadline(count, kind, locationPhrase)}
                </p>
                {loading ? (
                  <p className="text-xs text-gray-500">
                    {t('marketplace.distance.refreshing')}
                  </p>
                ) : null}
              </>
            ) : loading ? (
              <p className="text-sm text-gray-400">{t('marketplace.searching')}</p>
            ) : null}
            {fetchError ? <p className="text-xs text-red-400 mt-1">{fetchError}</p> : null}
          </div>

          <div ref={listScrollRef} className="flex-1 overflow-y-auto p-4">
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
              </div>
            ) : null}

            {count > 0 ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {instructorsSorted.map((p) => (
                  <TeacherMapListCard
                    key={String(p.id)}
                    instructor={p}
                    comfortable
                    selected={selectedId === p.id}
                    highlighted={highlightId === p.id}
                    locationBadge={
                      p.region_user_set
                        ? instructorLocationBadge(p.region, p.baku_district)
                        : null
                    }
                    cardRef={(el) => {
                      if (el) cardRefs.current.set(String(p.id), el)
                      else cardRefs.current.delete(String(p.id))
                    }}
                    onFocus={focusInstructor}
                    onInquiry={onInquiryClick}
                    onWhatsApp={onWhatsAppClick}
                    whatsappBusy={whatsappBusy}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </main>

        <aside className="order-2 lg:w-[42%] flex flex-col min-h-0 bg-[#0b0b0b] border-b lg:border-b-0 border-white/10 shrink-0 lg:shrink">
          <div className="p-4 space-y-3 overflow-y-auto lg:max-h-none">
            <MarketplaceAiSearchPanel
              userLat={null}
              userLng={null}
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
            <RegionSearchFilter
              region={region}
              bakuDistrict={bakuDistrict}
              includeNeighbors={includeNeighbors}
              onChange={handleRegionChange}
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
            {hasFetched && !fetchError && count > 0 ? (
              <p className="text-[11px] text-gray-500 pt-1 border-t border-white/10">
                {resultCountLabel(count, kind)} · {locationPhrase}
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
