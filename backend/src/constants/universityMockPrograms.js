const { fieldMeta, fieldSearchTerms, relatedFieldSlugs } = require('./universityFieldCatalog');
const {
  collectFieldSlugs,
  programMatchesAnyField,
  programMatchesDegree,
  programMatchesUserIelts,
  resolveFieldFromText,
  buildEmptyResultsMessage,
} = require('../utils/universityProgramFilters');

function futureDeadline(monthsAhead = 8) {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return d.toISOString().slice(0, 10);
}

const MOCK_PROGRAMS = [
  {
    id: 'mock-de-tum-cs',
    degree_level: 'MSc',
    name: 'Informatics',
    field: 'computer_science',
    field_category: 'cs',
    duration_years: 2,
    tuition_fee: 0,
    scholarship_available: true,
    language: 'English',
    intake_months: ['October'],
    deadline_dates: [futureDeadline(5)],
    next_deadline: futureDeadline(5),
    requirements: { min_gpa: 3.0, min_language: { ielts: 6.5 }, documents: ['CV', 'Transcript'] },
    apply_link: 'https://www.tum.de/en/studies/application',
    portal_source: 'mock',
    university: {
      id: 'mock-uni-tum',
      name: 'Technical University of Munich',
      country: 'Almaniya',
      city: 'Münhen',
      world_ranking: 28,
      logo_url: null,
      housing_info: 'Tələbə yataqxanaları',
      funding_info: 'DAAD təqaüdləri',
    },
  },
  {
    id: 'mock-de-tum-ai',
    degree_level: 'MSc',
    name: 'Robotics, Cognition, Intelligence',
    field: 'artificial_intelligence',
    field_category: 'cs',
    duration_years: 2,
    tuition_fee: 0,
    scholarship_available: true,
    language: 'English',
    intake_months: ['October'],
    deadline_dates: [futureDeadline(5)],
    next_deadline: futureDeadline(5),
    requirements: { min_gpa: 3.2, min_language: { ielts: 6.5 }, documents: ['CV', 'Transcript'] },
    apply_link: 'https://www.tum.de/en/studies/application',
    portal_source: 'mock',
    university: {
      id: 'mock-uni-tum',
      name: 'Technical University of Munich',
      country: 'Almaniya',
      city: 'Münhen',
      world_ranking: 28,
      logo_url: null,
      housing_info: 'Tələbə yataqxanaları',
      funding_info: 'DAAD təqaüdləri',
    },
  },
  {
    id: 'mock-pl-warsaw-ds',
    degree_level: 'MSc',
    name: 'Data Science',
    field: 'data_science',
    field_category: 'cs',
    duration_years: 2,
    tuition_fee: 4500,
    scholarship_available: true,
    language: 'English',
    intake_months: ['October'],
    deadline_dates: [futureDeadline(4)],
    next_deadline: futureDeadline(4),
    requirements: { min_gpa: 3.1, min_language: { ielts: 6.5 }, documents: ['Transcript'] },
    apply_link: 'https://www.pw.edu.pl/engpw',
    portal_source: 'mock',
    university: {
      id: 'mock-uni-warsaw',
      name: 'Warsaw University of Technology',
      country: 'Polşa',
      city: 'Varşava',
      world_ranking: 501,
      logo_url: null,
      housing_info: 'Kampus yataqxanaları',
      funding_info: 'NAWA',
    },
  },
  {
    id: 'mock-tr-boun-se',
    degree_level: 'BSc',
    name: 'Computer Engineering',
    field: 'software_engineering',
    field_category: 'cs',
    duration_years: 4,
    tuition_fee: 12000,
    scholarship_available: true,
    language: 'English',
    intake_months: ['September'],
    deadline_dates: [futureDeadline(3)],
    next_deadline: futureDeadline(3),
    requirements: { min_gpa: 3.0, min_language: { toefl: 80 }, documents: ['Transcript'] },
    apply_link: 'https://www.boun.edu.tr/en',
    portal_source: 'mock',
    university: {
      id: 'mock-uni-boun',
      name: 'Boğaziçi University',
      country: 'Türkiyə',
      city: 'İstanbul',
      world_ranking: 404,
      logo_url: null,
      housing_info: 'Kampus yataqxanaları',
      funding_info: 'Universitet bursları',
    },
  },
  {
    id: 'mock-hu-elte-cyber',
    degree_level: 'MSc',
    name: 'Cybersecurity',
    field: 'cybersecurity',
    field_category: 'cs',
    duration_years: 2,
    tuition_fee: 3200,
    scholarship_available: true,
    language: 'English',
    intake_months: ['September'],
    deadline_dates: [futureDeadline(4)],
    next_deadline: futureDeadline(4),
    requirements: { min_gpa: 2.9, min_language: { ielts: 6.0 }, documents: ['CV'] },
    apply_link: 'https://www.elte.hu/en',
    portal_source: 'mock',
    university: {
      id: 'mock-uni-elte',
      name: 'Eötvös Loránd University',
      country: 'Macarıstan',
      city: 'Budapeşt',
      world_ranking: 601,
      logo_url: null,
      housing_info: 'ELTE yataqxanaları',
      funding_info: 'Stipendium Hungaricum',
    },
  },
  {
    id: 'mock-it-polimi-mgmt',
    degree_level: 'MSc',
    name: 'Management Engineering',
    field: 'business_administration',
    field_category: 'business',
    duration_years: 2,
    tuition_fee: 3893,
    scholarship_available: true,
    language: 'English',
    intake_months: ['September'],
    deadline_dates: [futureDeadline(2)],
    next_deadline: futureDeadline(2),
    requirements: { min_gpa: 3.1, min_language: { ielts: 6.5 }, documents: ['Motivation letter'], application_fee: 75 },
    apply_link: 'https://www.polimi.it/en',
    portal_source: 'mock',
    university: {
      id: 'mock-uni-polimi',
      name: 'Politecnico di Milano',
      country: 'İtaliya',
      city: 'Milan',
      world_ranking: 123,
      logo_url: null,
      housing_info: 'DSU yataqxana',
      funding_info: 'Invest Your Talent',
    },
  },
  {
    id: 'mock-de-heidelberg-bio',
    degree_level: 'PhD',
    name: 'Molecular Biology',
    field: 'biology',
    field_category: 'life_sciences',
    duration_years: 3,
    tuition_fee: 0,
    scholarship_available: true,
    language: 'English',
    intake_months: ['October'],
    deadline_dates: [futureDeadline(6)],
    next_deadline: futureDeadline(6),
    requirements: { min_gpa: 3.5, min_language: { ielts: 7.0 }, documents: ['Research proposal'] },
    apply_link: 'https://www.uni-heidelberg.de/en',
    portal_source: 'mock',
    university: {
      id: 'mock-uni-heidelberg',
      name: 'Heidelberg University',
      country: 'Almaniya',
      city: 'Heidelberg',
      world_ranking: 87,
      logo_url: null,
      housing_info: 'Studierendenwerk',
      funding_info: 'Deutschlandstipendium',
    },
  },
  {
    id: 'mock-pl-jagiellonian-fin',
    degree_level: 'MSc',
    name: 'International Finance',
    field: 'finance',
    field_category: 'business',
    duration_years: 2,
    tuition_fee: 2800,
    scholarship_available: true,
    language: 'English',
    intake_months: ['October'],
    deadline_dates: [futureDeadline(4)],
    next_deadline: futureDeadline(4),
    requirements: { min_gpa: 3.0, min_language: { ielts: 6.5 }, documents: ['Transcript'] },
    apply_link: 'https://en.uj.edu.pl',
    portal_source: 'mock',
    university: {
      id: 'mock-uni-jagiellonian',
      name: 'Jagiellonian University',
      country: 'Polşa',
      city: 'Krakow',
      world_ranking: 371,
      logo_url: null,
      housing_info: 'Tələbə yataqxanaları',
      funding_info: 'NAWA',
    },
  },
  {
    id: 'mock-tr-metu-ee',
    degree_level: 'BSc',
    name: 'Electrical and Electronics Engineering',
    field: 'electrical_engineering',
    field_category: 'engineering',
    duration_years: 4,
    tuition_fee: 8000,
    scholarship_available: false,
    language: 'English',
    intake_months: ['September'],
    deadline_dates: [futureDeadline(3)],
    next_deadline: futureDeadline(3),
    requirements: { min_gpa: 2.8, min_language: { toefl: 75 }, documents: ['Transcript'], application_fee: 50 },
    apply_link: 'https://www.metu.edu.tr',
    portal_source: 'mock',
    university: {
      id: 'mock-uni-metu',
      name: 'Middle East Technical University',
      country: 'Türkiyə',
      city: 'Ankara',
      world_ranking: 336,
      logo_url: null,
      housing_info: 'METU yataqxanaları',
      funding_info: 'TÜBİTAK',
    },
  },
  {
    id: 'mock-it-bologna-env',
    degree_level: 'MSc',
    name: 'Green Economy and Sustainability',
    field: 'environmental_science',
    field_category: 'life_sciences',
    duration_years: 2,
    tuition_fee: 3500,
    scholarship_available: true,
    language: 'English',
    intake_months: ['September'],
    deadline_dates: [futureDeadline(3)],
    next_deadline: futureDeadline(3),
    requirements: { min_gpa: 2.9, min_language: { ielts: 6.0 }, documents: ['CV'] },
    apply_link: 'https://www.unibo.it/en',
    portal_source: 'mock',
    university: {
      id: 'mock-uni-bologna',
      name: 'University of Bologna',
      country: 'İtaliya',
      city: 'Bologna',
      world_ranking: 154,
      logo_url: null,
      housing_info: 'ER.GO yataqxana',
      funding_info: 'Invest Your Talent',
    },
  },
  {
    id: 'mock-hu-bme-mech',
    degree_level: 'BSc',
    name: 'Mechanical Engineering',
    field: 'mechanical_engineering',
    field_category: 'engineering',
    duration_years: 3.5,
    tuition_fee: 6000,
    scholarship_available: true,
    language: 'English',
    intake_months: ['September'],
    deadline_dates: [futureDeadline(4)],
    next_deadline: futureDeadline(4),
    requirements: { min_gpa: 3.0, min_language: { ielts: 6.0 }, documents: ['Transcript'] },
    apply_link: 'https://www.bme.hu',
    portal_source: 'mock',
    university: {
      id: 'mock-uni-bme',
      name: 'Budapest University of Technology',
      country: 'Macarıstan',
      city: 'Budapeşt',
      world_ranking: 801,
      logo_url: null,
      housing_info: 'Kampus yataqxanaları',
      funding_info: 'Stipendium Hungaricum',
    },
  },
  {
    id: 'mock-de-rwth-chem',
    degree_level: 'MSc',
    name: 'Chemical Engineering',
    field: 'chemical_engineering',
    field_category: 'engineering',
    duration_years: 2,
    tuition_fee: 0,
    scholarship_available: true,
    language: 'English',
    intake_months: ['October'],
    deadline_dates: [futureDeadline(5)],
    next_deadline: futureDeadline(5),
    requirements: { min_gpa: 3.0, min_language: { ielts: 6.5 }, documents: ['Transcript'] },
    apply_link: 'https://www.rwth-aachen.de',
    portal_source: 'mock',
    university: {
      id: 'mock-uni-rwth',
      name: 'RWTH Aachen University',
      country: 'Almaniya',
      city: 'Aachen',
      world_ranking: 99,
      logo_url: null,
      housing_info: 'Studierendenwerk',
      funding_info: 'DAAD',
    },
  },
  {
    id: 'mock-de-heidelberg-chemistry',
    degree_level: 'MSc',
    name: 'Chemistry',
    field: 'chemistry',
    field_category: 'life_sciences',
    duration_years: 2,
    tuition_fee: 0,
    scholarship_available: true,
    language: 'English',
    intake_months: ['October'],
    deadline_dates: [futureDeadline(6)],
    next_deadline: futureDeadline(6),
    requirements: { min_gpa: 3.0, min_language: { ielts: 6.5 }, documents: ['Transcript', 'CV'] },
    apply_link: 'https://www.uni-heidelberg.de/en/study',
    portal_source: 'mock',
    university: {
      id: 'mock-uni-heidelberg',
      name: 'Heidelberg University',
      country: 'Almaniya',
      city: 'Heidelberg',
      world_ranking: 47,
      logo_url: null,
      housing_info: 'Studierendenwerk',
      funding_info: 'DAAD',
    },
  },
  {
    id: 'mock-pl-warsaw-chemistry',
    degree_level: 'MSc',
    name: 'Chemistry',
    field: 'chemistry',
    field_category: 'life_sciences',
    duration_years: 2,
    tuition_fee: 2500,
    scholarship_available: true,
    language: 'English',
    intake_months: ['October'],
    deadline_dates: [futureDeadline(5)],
    next_deadline: futureDeadline(5),
    requirements: { min_gpa: 3.0, min_language: { ielts: 6.0 }, documents: ['Transcript'] },
    apply_link: 'https://en.uw.edu.pl',
    portal_source: 'mock',
    university: {
      id: 'mock-uni-warsaw',
      name: 'University of Warsaw',
      country: 'Polşa',
      city: 'Varşova',
      world_ranking: 301,
      logo_url: null,
      housing_info: 'Tələbə yataqxanaları',
      funding_info: 'NAWA təqaüdləri',
    },
  },
  {
    id: 'mock-pl-jagiellonian-biochem',
    degree_level: 'MSc',
    name: 'Biochemistry',
    field: 'biochemistry',
    field_category: 'life_sciences',
    duration_years: 2,
    tuition_fee: 2200,
    scholarship_available: true,
    language: 'English',
    intake_months: ['October'],
    deadline_dates: [futureDeadline(5)],
    next_deadline: futureDeadline(5),
    requirements: { min_gpa: 3.0, min_language: { ielts: 6.0 }, documents: ['Transcript'] },
    apply_link: 'https://en.uj.edu.pl',
    portal_source: 'mock',
    university: {
      id: 'mock-uni-jagiellonian',
      name: 'Jagiellonian University',
      country: 'Polşa',
      city: 'Krakow',
      world_ranking: 327,
      logo_url: null,
      housing_info: 'Kampus yataqxanaları',
      funding_info: 'NAWA',
    },
  },
  {
    id: 'mock-it-bologna-chemistry',
    degree_level: 'BSc',
    name: 'Chemistry',
    field: 'chemistry',
    field_category: 'life_sciences',
    duration_years: 3,
    tuition_fee: 1800,
    scholarship_available: false,
    language: 'English',
    intake_months: ['September'],
    deadline_dates: [futureDeadline(4)],
    next_deadline: futureDeadline(4),
    requirements: { min_gpa: 2.8, min_language: { ielts: 5.5 }, documents: ['Transcript'] },
    apply_link: 'https://www.unibo.it/en',
    portal_source: 'mock',
    university: {
      id: 'mock-uni-bologna',
      name: 'University of Bologna',
      country: 'İtaliya',
      city: 'Bologna',
      world_ranking: 154,
      logo_url: null,
      housing_info: 'ER.GO yataqxanaları',
      funding_info: 'DSU təqaüdləri',
    },
  },
  {
    id: 'mock-tr-istanbul-chemistry',
    degree_level: 'BSc',
    name: 'Chemistry',
    field: 'chemistry',
    field_category: 'life_sciences',
    duration_years: 4,
    tuition_fee: 1200,
    scholarship_available: true,
    language: 'English',
    intake_months: ['September'],
    deadline_dates: [futureDeadline(3)],
    next_deadline: futureDeadline(3),
    requirements: { min_gpa: 2.5, min_language: { ielts: 5.5 }, documents: ['Transcript'] },
    apply_link: 'https://www.istanbul.edu.tr/en',
    portal_source: 'mock',
    university: {
      id: 'mock-uni-istanbul',
      name: 'Istanbul University',
      country: 'Türkiyə',
      city: 'İstanbul',
      world_ranking: 801,
      logo_url: null,
      housing_info: 'KYK yataqxanaları',
      funding_info: 'Türkiyə Bursları',
    },
  },
  {
    id: 'mock-hu-elte-chemistry',
    degree_level: 'MSc',
    name: 'Chemistry',
    field: 'chemistry',
    field_category: 'life_sciences',
    duration_years: 2,
    tuition_fee: 0,
    scholarship_available: true,
    language: 'English',
    intake_months: ['September'],
    deadline_dates: [futureDeadline(5)],
    next_deadline: futureDeadline(5),
    requirements: { min_gpa: 3.0, min_language: { ielts: 6.0 }, documents: ['Transcript'] },
    apply_link: 'https://www.elte.hu/en',
    portal_source: 'mock',
    university: {
      id: 'mock-uni-elte',
      name: 'Eötvös Loránd University',
      country: 'Macarıstan',
      city: 'Budapeşt',
      world_ranking: 601,
      logo_url: null,
      housing_info: 'Kampus yataqxanaları',
      funding_info: 'Stipendium Hungaricum',
    },
  },
  {
    id: 'mock-de-heidelberg-chemistry-phd',
    degree_level: 'PhD',
    name: 'Chemistry',
    field: 'chemistry',
    field_category: 'life_sciences',
    duration_years: 3,
    tuition_fee: 0,
    scholarship_available: true,
    language: 'English',
    intake_months: ['October'],
    deadline_dates: [futureDeadline(7)],
    next_deadline: futureDeadline(7),
    requirements: { min_gpa: 3.3, min_language: { ielts: 6.5 }, documents: ['Research proposal', 'Transcript'] },
    apply_link: 'https://www.uni-heidelberg.de/en/study',
    portal_source: 'mock',
    university: {
      id: 'mock-uni-heidelberg',
      name: 'Heidelberg University',
      country: 'Almaniya',
      city: 'Heidelberg',
      world_ranking: 47,
      logo_url: null,
      housing_info: 'Studierendenwerk',
      funding_info: 'DAAD',
    },
  },
  {
    id: 'mock-pl-warsaw-chemistry-phd',
    degree_level: 'PhD',
    name: 'Chemistry',
    field: 'chemistry',
    field_category: 'life_sciences',
    duration_years: 4,
    tuition_fee: 0,
    scholarship_available: true,
    language: 'English',
    intake_months: ['October'],
    deadline_dates: [futureDeadline(6)],
    next_deadline: futureDeadline(6),
    requirements: { min_gpa: 3.2, min_language: { ielts: 6.0 }, documents: ['Research proposal', 'Transcript'] },
    apply_link: 'https://en.uw.edu.pl',
    portal_source: 'mock',
    university: {
      id: 'mock-uni-warsaw',
      name: 'University of Warsaw',
      country: 'Polşa',
      city: 'Varşova',
      world_ranking: 301,
      logo_url: null,
      housing_info: 'Tələbə yataqxanaları',
      funding_info: 'NAWA təqaüdləri',
    },
  },
];

function textIncludes(haystack, needle) {
  return String(haystack || '').toLowerCase().includes(String(needle || '').toLowerCase());
}

function programMatchesField(program, fieldSlug) {
  if (!fieldSlug) return true;
  if (relatedFieldSlugs(fieldSlug).includes(program.field)) return true;
  const meta = fieldMeta(fieldSlug);
  const terms = fieldSearchTerms(fieldSlug);
  const blob = [
    program.field,
    program.field_category,
    program.name,
    program.university?.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (program.field === fieldSlug) return true;
  if (meta?.category && program.field_category === meta.category) {
    return terms.some((t) => textIncludes(blob, t));
  }
  return terms.some((t) => textIncludes(blob, t));
}

function filterMockPrograms(filters = {}, rawQuery = {}) {
  let rows = [...MOCK_PROGRAMS];
  const fieldSlugs = collectFieldSlugs(rawQuery, filters);
  const qResolvesToField = filters.q && resolveFieldFromText(filters.q);

  if (filters.degreeLevel) {
    rows = rows.filter((p) => programMatchesDegree(p, filters.degreeLevel));
  }
  if (fieldSlugs.length) {
    rows = rows.filter((p) => programMatchesAnyField(p, fieldSlugs));
  }
  if (filters.countries?.length) {
    rows = rows.filter((p) => filters.countries.includes(p.university?.country));
  }
  if (filters.scholarship === true) {
    rows = rows.filter((p) => p.scholarship_available);
  }
  if (filters.maxTuition != null) {
    rows = rows.filter((p) => p.tuition_fee == null || p.tuition_fee <= filters.maxTuition);
  }
  if (filters.minGpa != null) {
    rows = rows.filter((p) => {
      const min = Number(p.requirements?.min_gpa);
      return !Number.isFinite(min) || min <= filters.minGpa;
    });
  }
  if (filters.language) {
    const lang = String(filters.language).toLowerCase();
    rows = rows.filter((p) => !p.language || String(p.language).toLowerCase().includes(lang));
  }
  if (filters.noIelts === true) {
    rows = rows.filter((p) => {
      const req = Number(p.requirements?.min_language?.ielts);
      return !Number.isFinite(req) || req <= 0;
    });
  } else if (filters.userIelts != null) {
    rows = rows.filter((p) => programMatchesUserIelts(p, filters.userIelts));
  }
  if (filters.noMotivation === true) {
    rows = rows.filter((p) => {
      const docs = Array.isArray(p.requirements?.documents) ? p.requirements.documents : [];
      return !docs.some((d) => String(d).toLowerCase().includes('motivation'));
    });
  }
  if (filters.maxRanking != null) {
    rows = rows.filter((p) => {
      const rank = Number(p.university?.world_ranking);
      return !Number.isFinite(rank) || rank <= filters.maxRanking;
    });
  }
  if (filters.q && !qResolvesToField) {
    const q = filters.q.toLowerCase();
    rows = rows.filter(
      (p) =>
        textIncludes(p.name, q) ||
        textIncludes(p.university?.name, q) ||
        textIncludes(p.university?.city, q) ||
        textIncludes(p.university?.country, q) ||
        textIncludes(p.field, q),
    );
  }

  const sort = filters.sort || 'ranking';
  rows.sort((a, b) => {
    if (sort === 'tuition_asc') return (a.tuition_fee || 0) - (b.tuition_fee || 0);
    if (sort === 'tuition_desc') return (b.tuition_fee || 0) - (a.tuition_fee || 0);
    if (sort === 'deadline') return String(a.next_deadline).localeCompare(String(b.next_deadline));
    return (a.university?.world_ranking || 9999) - (b.university?.world_ranking || 9999);
  });

  const total = rows.length;
  const page = filters.page || 1;
  const limit = filters.limit || 24;
  const offset = filters.offset || (page - 1) * limit;
  const slice = rows.slice(offset, offset + limit);

  return { rows: slice, total };
}

function buildMockSearchResponse(filters) {
  const { rows, total } = filterMockPrograms(filters);
  const limit = filters.limit || 24;
  const page = filters.page || 1;
  const meta = {
    mvp_countries: ['Almaniya', 'Polşa', 'Türkiyə', 'Macarıstan', 'İtaliya'],
    fallback: true,
  };
  if (!total) {
    meta.empty = true;
    meta.empty_message = buildEmptyResultsMessage(filters);
    meta.suggest_degree_level = filters.degreeLevel === 'PhD' ? 'MSc' : null;
  }
  return {
    success: true,
    count: total,
    data: rows,
    programs: rows,
    source: 'mock',
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / limit)),
    },
    filters,
    meta,
    cached: false,
  };
}

module.exports = {
  MOCK_PROGRAMS,
  filterMockPrograms,
  buildMockSearchResponse,
  programMatchesField,
};
