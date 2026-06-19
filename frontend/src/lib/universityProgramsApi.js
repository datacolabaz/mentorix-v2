import api from './api'
import { buildMockSearchResponse } from './universityMockPrograms'

function apiFiltersFromUi(uiFilters) {
  const fields = Array.isArray(uiFilters.fields)
    ? uiFilters.fields
    : uiFilters.field
      ? String(uiFilters.field).split(',').map((s) => s.trim()).filter(Boolean)
      : [];
  return {
    page: uiFilters.page || 1,
    limit: 24,
    offset: ((uiFilters.page || 1) - 1) * 24,
    degreeLevel: uiFilters.degree_level || null,
    field: fields[0] || null,
    fields,
    countries: uiFilters.countries || [],
    scholarship: uiFilters.scholarship ? true : null,
    maxTuition: uiFilters.max_tuition ? Number(uiFilters.max_tuition) : null,
    minGpa: uiFilters.min_gpa ? Number(uiFilters.min_gpa) : null,
    language: uiFilters.language || null,
    maxRanking: uiFilters.max_ranking ? Number(uiFilters.max_ranking) : null,
    noIelts: uiFilters.no_ielts ? true : null,
    noMotivation: uiFilters.no_motivation ? true : null,
    userIelts: uiFilters.user_ielts ? Number(uiFilters.user_ielts) : null,
    deadlineBefore: uiFilters.deadline_before || null,
    sort: uiFilters.sort || 'ranking',
    q: uiFilters.q || null,
  }
}

function normalizeApiPayload(res) {
  const rows = Array.isArray(res?.data) && res.data.length ? res.data : res?.programs || []
  const count = res?.count != null ? res.count : rows.length
  return {
    success: true,
    programs: rows,
    count,
    pagination: res?.pagination || {
      page: 1,
      limit: 24,
      total: count,
      total_pages: Math.max(1, Math.ceil(count / 24)),
    },
    source: res?.source || 'api',
    usedFallback: Boolean(res?.meta?.fallback || res?.source === 'mock'),
    emptyMessage: res?.meta?.empty_message || null,
    suggestDegreeLevel: res?.meta?.suggest_degree_level || null,
  }
}

export async function searchProgramsWithFallback(params, uiFilters) {
  let apiEmptyMessage = null
  let apiSuggestDegree = null

  try {
    const res = await api.get('/programs', { params })
    const normalized = normalizeApiPayload(res)
    if (normalized.programs.length) return normalized
    apiEmptyMessage = normalized.emptyMessage
    apiSuggestDegree = normalized.suggestDegreeLevel
  } catch (err) {
    console.warn('[universities] API search failed, using client mock:', err?.message || err)
  }

  const mock = buildMockSearchResponse(apiFiltersFromUi(uiFilters))
  const programs = mock.data || mock.programs || []
  return {
    success: true,
    programs,
    count: mock.count || 0,
    pagination: mock.pagination,
    source: programs.length ? 'mock-client' : 'mock-client-empty',
    usedFallback: true,
    emptyMessage: programs.length ? null : (mock.meta?.empty_message || apiEmptyMessage),
    suggestDegreeLevel: programs.length ? null : (mock.meta?.suggest_degree_level || apiSuggestDegree),
  }
}
