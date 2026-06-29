import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import useAuthStore from '../../hooks/useAuth'
import { setPageSeo } from '../../lib/pageSeo'
import PublicPageTopBar from '../../components/public/PublicPageTopBar'
import UniversitySearchWizard from '../../components/university/UniversitySearchWizard'
import ProgramFiltersSidebar from '../../components/university/ProgramFiltersSidebar'
import ProgramCard from '../../components/university/ProgramCard'
import ProgramDetailModal from '../../components/university/ProgramDetailModal'
import ProgramResultsSummary from '../../components/university/ProgramResultsSummary'
import ProgramResultsByCountry from '../../components/university/ProgramResultsByCountry'
import UniversityAiSearch from '../../components/university/UniversityAiSearch'
import {
  emptyWizardState,
  filtersToSearchParams,
  parseWizardFromSearchParams,
  buildCountryResultsMeta,
} from '../../lib/universitySearch'
import { fieldLabel } from '../../lib/universityFieldCatalog'
import { resolveProgramApplyLink } from '../../lib/programApplyLink'
import { searchProgramsWithFallback } from '../../lib/universityProgramsApi'

function defaultFilters(searchParams) {
  const countries = searchParams.get('countries')
  return {
    q: searchParams.get('q') || '',
    countries: countries ? countries.split(',').filter(Boolean) : [],
    scholarship: searchParams.get('scholarship') === 'true',
    english_only: searchParams.get('language') === 'English',
    language: searchParams.get('language') || '',
    no_ielts: searchParams.get('no_ielts') === 'true',
    no_motivation: searchParams.get('no_motivation') === 'true',
    max_ranking: searchParams.get('max_ranking') || '',
    deadline_before: searchParams.get('deadline_before') || '',
    sort: searchParams.get('sort') || 'ranking',
    degree_level: searchParams.get('degree_level') || '',
    field: searchParams.get('field') || '',
    fields: (() => {
      const raw = searchParams.get('fields') || searchParams.get('field') || ''
      return raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []
    })(),
    max_tuition: searchParams.get('max_tuition') || '',
    min_gpa: searchParams.get('min_gpa') || '',
    user_ielts: searchParams.get('user_ielts') || '',
    user_toefl: searchParams.get('user_toefl') || '',
    university_type: searchParams.get('university_type') || '',
    page: Number(searchParams.get('page') || 1) || 1,
  }
}

function aiFiltersToUi(base, ai = {}) {
  return {
    ...base,
    degree_level: ai.degreeLevel || '',
    field: ai.field || '',
    fields: ai.fields?.length ? ai.fields : ai.field ? [ai.field] : base.fields,
    countries: ai.countries?.length ? ai.countries : base.countries,
    scholarship: Boolean(ai.scholarship),
    max_tuition: ai.maxTuition != null ? String(ai.maxTuition) : '',
    min_gpa: ai.minGpa != null ? String(ai.minGpa) : '',
    user_ielts: ai.userIelts != null ? String(ai.userIelts) : base.user_ielts || '',
    language: ai.language || '',
    english_only: ai.language === 'English',
    max_ranking: ai.maxRanking != null ? String(ai.maxRanking) : '',
    no_ielts: Boolean(ai.noIelts),
    no_motivation: Boolean(ai.noMotivation),
    q: ai.q || '',
    page: 1,
  }
}

function translateEmptyMessage(t, filters) {
  const slugs = filters.fields?.length ? filters.fields : filters.field ? [filters.field] : []
  const labels = slugs.map((slug) => fieldLabel(slug) || slug.replace(/_/g, ' '))
  const field = labels.length ? labels.join(', ') : t('universitySearch.empty.selectedField')
  const degree = filters.degreeLevel || filters.degree_level || ''
  const degreeLong = {
    BSc: t('universitySearch.degrees.bscLong'),
    MSc: t('universitySearch.degrees.mscLong'),
    PhD: t('universitySearch.degrees.phdLong'),
  }[degree]

  if (degree === 'PhD') {
    return t('universitySearch.empty.phd', { field })
  }
  if (degree && degreeLong) {
    return t('universitySearch.empty.degreeLimited', { field, degree: degreeLong })
  }
  if (slugs.length) {
    return t('universitySearch.empty.fieldNoMatch', { field })
  }
  return t('universitySearch.empty.generic')
}

function translateCoverageMessage(t, meta) {
  const selected = meta.selectedCountries?.length || 0
  const withResults = meta.countriesWithResults?.length || 0
  if (selected <= 1) return null
  if (withResults === 0) {
    return t('universitySearch.results.coverageNone', { total: selected })
  }
  if (withResults < selected) {
    return t('universitySearch.results.coveragePartial', { total: selected, withResults })
  }
  return null
}

export default function UniversityProgramSearch() {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()

  const view = searchParams.get('view') || 'wizard'
  const [wizardState, setWizardState] = useState(() => parseWizardFromSearchParams(searchParams))
  const [filters, setFilters] = useState(() => defaultFilters(searchParams))
  const [qDraft, setQDraft] = useState(() => searchParams.get('q') || '')
  const [programs, setPrograms] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, total_pages: 1 })
  const [loading, setLoading] = useState(false)
  const [selectedProgram, setSelectedProgram] = useState(null)
  const [usedFallback, setUsedFallback] = useState(false)
  const [emptyMessage, setEmptyMessage] = useState(null)
  const [suggestDegreeLevel, setSuggestDegreeLevel] = useState(null)

  useEffect(() => {
    setPageSeo({
      title: t('universitySearch.seo.title'),
      description: t('universitySearch.seo.description'),
    })
  }, [t])

  const fetchPrograms = useCallback(async (nextFilters) => {
    setLoading(true)
    try {
      const params = filtersToSearchParams(nextFilters)
      if (nextFilters.deadline_before) params.deadline_before = nextFilters.deadline_before
      if (nextFilters.min_gpa) params.min_gpa = nextFilters.min_gpa
      if (nextFilters.max_tuition) params.max_tuition = nextFilters.max_tuition
      if (nextFilters.user_ielts) params.user_ielts = nextFilters.user_ielts
      if (nextFilters.user_toefl) params.user_toefl = nextFilters.user_toefl
      if (nextFilters.university_type) params.university_type = nextFilters.university_type

      const result = await searchProgramsWithFallback(params, nextFilters)
      setPrograms(result.programs || [])
      setPagination(result.pagination || { page: 1, total: 0, total_pages: 1 })
      setUsedFallback(Boolean(result.usedFallback))
      setEmptyMessage(result.emptyMessage || null)
      setSuggestDegreeLevel(result.suggestDegreeLevel || null)
    } catch (e) {
      setUsedFallback(true)
      toast(e?.message || t('universitySearch.toasts.searchFailed'), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast, t])

  const syncUrl = useCallback(
    (nextView, nextFilters) => {
      const params = new URLSearchParams()
      params.set('view', nextView)
      Object.entries(filtersToSearchParams(nextFilters)).forEach(([k, v]) => {
        if (v != null && v !== '') params.set(k, String(v))
      })
      if (nextFilters.deadline_before) params.set('deadline_before', nextFilters.deadline_before)
      if (nextFilters.min_gpa) params.set('min_gpa', nextFilters.min_gpa)
      if (nextFilters.max_tuition) params.set('max_tuition', nextFilters.max_tuition)
      if (nextFilters.user_ielts) params.set('user_ielts', nextFilters.user_ielts)
      if (nextFilters.user_toefl) params.set('user_toefl', nextFilters.user_toefl)
      if (nextFilters.university_type) params.set('university_type', nextFilters.university_type)
      setSearchParams(params, { replace: true })
    },
    [setSearchParams],
  )

  useEffect(() => {
    if (view !== 'results') return
    void fetchPrograms(filters)
  }, [view, filters, fetchPrograms])

  useEffect(() => {
    if (view !== 'results') return undefined
    const timer = setTimeout(() => {
      setFilters((prev) => {
        if (prev.q === qDraft) return prev
        const next = { ...prev, q: qDraft, page: 1 }
        syncUrl('results', next)
        return next
      })
    }, 400)
    return () => clearTimeout(timer)
  }, [qDraft, view, syncUrl])

  const handleWizardSubmit = async ({ state, params }) => {
    setWizardState(state)
    const nextFilters = {
      ...filters,
      degree_level: params.degree_level || '',
      field: params.field || '',
      fields: state.field ? [state.field] : [],
      countries: state.countries,
      max_tuition: params.max_tuition || '',
      min_gpa: params.min_gpa || '',
      user_ielts:
        state.languageType === 'ielts' && state.languageScore !== '' ? String(state.languageScore) : '',
      user_toefl:
        state.languageType === 'toefl' && state.languageScore !== '' ? String(state.languageScore) : '',
      page: 1,
    }
    setFilters(nextFilters)
    syncUrl('results', nextFilters)

    if (user?.id) {
      try {
        await api.post('/programs/wizard', {
          profile: {
            current_degree: state.degreeLevel,
            gpa: state.gpa,
            language_scores: {
              [state.languageType]: state.languageScore,
            },
            budget_range: state.budgetRange,
            preferred_countries: state.countries,
          },
          filters: params,
        })
      } catch {
        /* optional profile save */
      }
    }
  }

  const handleApply = async (program) => {
    if (user?.id) {
      try {
        await api.post('/applications', {
          program_id: program.id,
          status: 'submitted',
        })
        toast(t('universitySearch.toasts.applicationRecorded'))
      } catch (e) {
        toast(e?.message || t('universitySearch.toasts.applicationFailed'), 'error')
      }
    }

    const applyUrl = resolveProgramApplyLink(program)
    if (applyUrl) {
      window.open(applyUrl, '_blank', 'noopener,noreferrer')
    } else {
      toast(t('universitySearch.toasts.noApplyLink'), 'error')
    }
  }

  const resetFilters = () => {
    const next = {
      q: '',
      countries: [],
      scholarship: false,
      english_only: false,
      language: '',
      no_ielts: false,
      no_motivation: false,
      max_ranking: '',
      deadline_before: '',
      sort: 'ranking',
      degree_level: '',
      field: '',
      fields: [],
      max_tuition: '',
      min_gpa: '',
      user_ielts: '',
      page: 1,
    }
    setQDraft('')
    setFilters(next)
    syncUrl('results', next)
  }

  const handleAiResults = (result) => {
    const nextFilters = aiFiltersToUi(filters, result.filters || {})
    setQDraft(nextFilters.q)
    setFilters(nextFilters)
    syncUrl('results', nextFilters)
  }

  const resultLabel = useMemo(() => {
    if (loading) return t('universitySearch.results.searching')
    return t('universitySearch.results.programsFound', { count: pagination.total || 0 })
  }, [loading, pagination.total, t])

  const displayEmptyMessage = useMemo(() => {
    if (programs.length) return null
    if (emptyMessage) return emptyMessage
    return translateEmptyMessage(t, filters)
  }, [programs.length, emptyMessage, filters, t])

  const countryResultsMeta = useMemo(
    () => buildCountryResultsMeta(programs, filters.countries),
    [programs, filters.countries],
  )

  const coverageMessage = useMemo(
    () => translateCoverageMessage(t, countryResultsMeta),
    [t, countryResultsMeta],
  )

  const displaySuggestDegree = suggestDegreeLevel || (!programs.length && filters.degree_level === 'PhD' ? 'MSc' : null)

  const showCountryBreakdown = filters.countries.length > 0 && !loading
  const useGroupedResults = countryResultsMeta.groups.length > 1

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <PublicPageTopBar
        backTo="/"
        title={t('universitySearch.page.title')}
        subtitle={t('universitySearch.page.subtitle')}
      >
        {view === 'results' ? (
          <Button type="button" variant="secondary" className="text-xs" onClick={() => syncUrl('wizard', filters)}>
            {t('universitySearch.actions.newSearch')}
          </Button>
        ) : null}
        {!user ? (
          <Link
            to="/login"
            className="inline-flex items-center justify-center min-h-[40px] px-3 text-sm font-semibold text-gray-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            {t('universitySearch.actions.login')}
          </Link>
        ) : null}
      </PublicPageTopBar>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8 w-full flex-1">
        {view === 'wizard' ? (
          <div className="space-y-2 text-center max-w-2xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              {t('universitySearch.page.badge')}
            </p>
          </div>
        ) : null}

        {view === 'wizard' ? (
          <UniversitySearchWizard
            initialState={wizardState || emptyWizardState()}
            onSubmit={handleWizardSubmit}
          />
        ) : (
          <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">
            <ProgramFiltersSidebar
              filters={filters}
              qDraft={qDraft}
              onQDraftChange={setQDraft}
              countryCounts={showCountryBreakdown ? countryResultsMeta.countryCounts : null}
              onChange={(next) => {
                setQDraft(next.q || '')
                setFilters(next)
                syncUrl('results', next)
              }}
              onReset={resetFilters}
            />

            <section className="space-y-4 min-w-0">
              <UniversityAiSearch
                onResults={handleAiResults}
                onError={(msg) => toast(msg, 'error')}
              />
              {usedFallback ? (
                <p className="text-xs text-amber-300/90 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
                  {t('universitySearch.results.fallbackNotice')}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-white font-medium">{resultLabel}</p>
                {pagination.total_pages > 1 ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="text-xs"
                      disabled={filters.page <= 1 || loading}
                      onClick={() => {
                        const next = { ...filters, page: filters.page - 1 }
                        setFilters(next)
                        syncUrl('results', next)
                      }}
                    >
                      {t('universitySearch.actions.previous')}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="text-xs"
                      disabled={filters.page >= pagination.total_pages || loading}
                      onClick={() => {
                        const next = { ...filters, page: filters.page + 1 }
                        setFilters(next)
                        syncUrl('results', next)
                      }}
                    >
                      {t('universitySearch.actions.next')}
                    </Button>
                  </div>
                ) : null}
              </div>

              {showCountryBreakdown ? (
                <ProgramResultsSummary
                  total={pagination.total || 0}
                  selectedCountries={countryResultsMeta.selectedCountries}
                  countryCounts={countryResultsMeta.countryCounts}
                  coverageMessage={coverageMessage}
                  countriesWithResults={countryResultsMeta.countriesWithResults}
                />
              ) : null}

              {loading ? (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-56 rounded-2xl bg-white/5 animate-pulse" />
                  ))}
                </div>
              ) : programs.length ? (
                useGroupedResults ? (
                  <ProgramResultsByCountry
                    groups={countryResultsMeta.groups}
                    onDetails={setSelectedProgram}
                    onApply={handleApply}
                  />
                ) : (
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {programs.map((program) => (
                      <ProgramCard
                        key={program.id}
                        program={program}
                        onDetails={setSelectedProgram}
                        onApply={handleApply}
                      />
                    ))}
                  </div>
                )
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
                  <p className="text-gray-300">
                    {displayEmptyMessage || t('universitySearch.results.noResults')}
                  </p>
                  {displaySuggestDegree ? (
                    <Button
                      type="button"
                      className="mt-4"
                      onClick={() => {
                        const next = { ...filters, degree_level: displaySuggestDegree, page: 1 }
                        setFilters(next)
                        syncUrl('results', next)
                        fetchPrograms(next)
                      }}
                    >
                      {t('universitySearch.actions.tryMsc')}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant={displaySuggestDegree ? 'ghost' : 'primary'}
                    className={displaySuggestDegree ? 'mt-3' : 'mt-4'}
                    onClick={() => navigate('/universities?view=wizard')}
                  >
                    {t('universitySearch.actions.changeFilters')}
                  </Button>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <ProgramDetailModal
        program={selectedProgram}
        open={Boolean(selectedProgram)}
        onClose={() => setSelectedProgram(null)}
        onApply={(p) => {
          handleApply(p)
          setSelectedProgram(null)
        }}
      />
    </div>
  )
}
