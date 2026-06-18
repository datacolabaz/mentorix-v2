import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../lib/api'
import Brand from '../../components/common/Brand'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import useAuthStore from '../../hooks/useAuth'
import { setPageSeo } from '../../lib/pageSeo'
import UniversitySearchWizard from '../../components/university/UniversitySearchWizard'
import ProgramFiltersSidebar from '../../components/university/ProgramFiltersSidebar'
import ProgramCard from '../../components/university/ProgramCard'
import ProgramDetailModal from '../../components/university/ProgramDetailModal'
import {
  emptyWizardState,
  filtersToSearchParams,
  parseWizardFromSearchParams,
} from '../../lib/universitySearch'

function defaultFilters(searchParams) {
  const countries = searchParams.get('countries')
  return {
    q: searchParams.get('q') || '',
    countries: countries ? countries.split(',').filter(Boolean) : [],
    scholarship: searchParams.get('scholarship') === 'true',
    deadline_before: searchParams.get('deadline_before') || '',
    sort: searchParams.get('sort') || 'ranking',
    degree_level: searchParams.get('degree_level') || '',
    field: searchParams.get('field') || '',
    max_tuition: searchParams.get('max_tuition') || '',
    min_gpa: searchParams.get('min_gpa') || '',
    page: Number(searchParams.get('page') || 1) || 1,
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
  const [programs, setPrograms] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, total_pages: 1 })
  const [loading, setLoading] = useState(false)
  const [selectedProgram, setSelectedProgram] = useState(null)

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

      const res = await api.get('/programs', { params })
      if (res?.success) {
        setPrograms(res.programs || [])
        setPagination(res.pagination || { page: 1, total: 0, total_pages: 1 })
      }
    } catch (e) {
      toast(e?.message || 'Axtarış uğursuz oldu', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (view !== 'results') return
    void fetchPrograms(filters)
  }, [view, filters, fetchPrograms])

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
      setSearchParams(params, { replace: true })
    },
    [setSearchParams],
  )

  const handleWizardSubmit = async ({ state, params }) => {
    setWizardState(state)
    const nextFilters = {
      ...filters,
      degree_level: params.degree_level || '',
      field: params.field || '',
      countries: state.countries,
      max_tuition: params.max_tuition || '',
      min_gpa: params.min_gpa || '',
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
      deadline_before: '',
      sort: 'ranking',
      degree_level: '',
      field: '',
      max_tuition: '',
      min_gpa: '',
      page: 1,
    }
    setFilters(next)
    syncUrl('results', next)
  }

  const resultLabel = useMemo(() => {
    if (loading) return 'Axtarılır…'
    return `${pagination.total || 0} proqram tapıldı`
  }, [loading, pagination.total])

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0">
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
              onChange={(next) => {
                setFilters(next)
                syncUrl('results', next)
              }}
              onReset={resetFilters}
            />

            <section className="space-y-4 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-400">{resultLabel}</p>
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

              {loading ? (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-56 rounded-2xl bg-white/5 animate-pulse" />
                  ))}
                </div>
              ) : programs.length ? (
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
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
                  <p className="text-gray-300">Uyğun proqram tapılmadı.</p>
                  <Button
                    type="button"
                    className="mt-4"
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
