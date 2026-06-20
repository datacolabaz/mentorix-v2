import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../lib/api'
import Brand from '../../components/common/Brand'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import useAuthStore from '../../hooks/useAuth'
import { dashboardPathForRole } from '../../lib/postAuth'
import { setPageSeo } from '../../lib/pageSeo'
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
import { searchProgramsWithFallback } from '../../lib/universityProgramsApi'
import { buildEmptyResultsMessage } from '../../lib/universityProgramFilters'

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

export default function UniversityProgramSearch() {
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
      title: 'Universitet və Proqram Axtarışı | Mentorix',
      description:
        'Bakalavr, magistr və doktorantura proqramlarını ölkə, təqaüd və son tarixə görə filtrləyin.',
    })
  }, [])

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
      toast(e?.message || 'Axtarış uğursuz oldu', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

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
        toast('Müraciət qeydə alındı')
      } catch (e) {
        toast(e?.message || 'Müraciət qeydə alınmadı', 'error')
      }
    }

    if (program.apply_link) {
      window.open(program.apply_link, '_blank', 'noopener,noreferrer')
    } else {
      toast('Rəsmi apply linki mövcud deyil', 'error')
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
    if (loading) return 'Axtarılır…'
    return `${pagination.total || 0} proqram tapıldı`
  }, [loading, pagination.total])

  const displayEmptyMessage = useMemo(() => {
    if (programs.length) return null
    return (
      emptyMessage ||
      buildEmptyResultsMessage({
        ...filters,
        degreeLevel: filters.degree_level,
        fields: filters.fields?.length ? filters.fields : filters.field ? [filters.field] : [],
      })
    )
  }, [programs.length, emptyMessage, filters])

  const countryResultsMeta = useMemo(
    () => buildCountryResultsMeta(programs, filters.countries),
    [programs, filters.countries],
  )

  const displaySuggestDegree = suggestDegreeLevel || (!programs.length && filters.degree_level === 'PhD' ? 'MSc' : null)

  const showCountryBreakdown = filters.countries.length > 0 && !loading
  const useGroupedResults = countryResultsMeta.groups.length > 1

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link to={user ? dashboardPathForRole(user.role) : '/login'} className="shrink-0">
            <Brand />
          </Link>
          <div className="flex items-center gap-2">
            {view === 'results' ? (
              <Button type="button" variant="secondary" className="text-xs" onClick={() => syncUrl('wizard', filters)}>
                Yeni axtarış
              </Button>
            ) : null}
            {!user ? (
              <Link to="/login" className="text-sm text-gray-300 hover:text-white">
                Daxil ol
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        <div className="space-y-2 text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Mentorix Apply</p>
          <h1 className="font-display text-2xl sm:text-4xl font-bold">Universitet və Proqram Axtarışı</h1>
          <p className="text-sm text-gray-400">
            Profilinizi doldurun, uyğun proqramları tapın və rəsmi portala birbaşa keçid edin.
          </p>
        </div>

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
                  Canlı kataloq hazırda əlçatan deyil — nümunə (demo) proqramlar göstərilir. Müraciət linkləri realdır.
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
                      Əvvəlki
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
                      Növbəti
                    </Button>
                  </div>
                ) : null}
              </div>

              {showCountryBreakdown ? (
                <ProgramResultsSummary
                  total={pagination.total || 0}
                  selectedCountries={countryResultsMeta.selectedCountries}
                  countryCounts={countryResultsMeta.countryCounts}
                  coverageMessage={countryResultsMeta.coverageMessage}
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
                    {displayEmptyMessage || 'Uyğun proqram tapılmadı.'}
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
                      Magistr (MSc) ilə yoxla
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant={displaySuggestDegree ? 'ghost' : 'primary'}
                    className={displaySuggestDegree ? 'mt-3' : 'mt-4'}
                    onClick={() => navigate('/universities?view=wizard')}
                  >
                    Filtrləri dəyiş
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
