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
  }
}

export async function searchProgramsWithFallback(params, uiFilters) {
  try {
    const res = await api.get('/programs', { pa