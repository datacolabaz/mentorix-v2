const db = require('../utils/db');
const { flattenTeachingCategories } = require('../data/teachingCategories');
const { searchDiscoverInstructors } = require('./discoverMarketplaceService');
const { notifyMarketplaceSearchOpportunity } = require('./marketplaceSearchOpportunityService');

const WHATSAPP_URL = 'https://wa.me/994503066626';

const SUBJECT_ALIASES = [
  { keys: ['riyaziyyat', 'riyazi', 'mat', 'math', 'algebra', 'geometriya'], categoryId: 'math' },
  { keys: ['ingilis', 'english', 'ielts', 'toefl'], categoryId: 'eng-school' },
  { keys: ['fizika', 'physics'], categoryId: 'physics' },
  { keys: ['kimya', 'chemistry'], categoryId: 'chemistry' },
  { keys: ['biologiya', 'biology'], categoryId: 'biology' },
  { keys: ['azerbaycan', 'az dili', 'dilbilgisi'], categoryId: 'az-lang' },
  { keys: ['rus dili', 'rusca'], categoryId: 'rus-school' },
  { keys: ['informatika', 'proqram', 'kod'], categoryId: 'cs-school' },
  { keys: ['python', 'javascript', 'java', 'react', 'node'], categoryId: 'python' },
  { keys: ['tarix', 'history'], categoryId: 'history' },
  { keys: ['cografiya', 'coğrafiya', 'geografiya'], categoryId: 'geography' },
  { keys: ['abituriyent', 'buraxilis', 'buraxılış'], categoryId: 'abituriyent' },
  { keys: ['miq'], categoryId: 'miq' },
];

function foldAz(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g');
}

function parseGrade(text) {
  const folded = foldAz(text);
  const m = folded.match(/(\d{1,2})\s*-?\s*(ci|cu)?\s*sinif/);
  if (m) return `${m[1]}-ci sinif`;
  if (/mektebeqeder|mektebe qeder/.test(folded)) return 'məktəbəqədər';
  if (/magistr/.test(folded)) return 'magistratura';
  return null;
}

function parseStudentLevel(text) {
  const f = foldAz(text);
  if (/zeif|bacariqsiz|geri qalib|temel/.test(f)) return 'zəif';
  if (/guclu|yuksek|ileri/.test(f)) return 'güclü';
  if (/orta/.test(f)) return 'orta';
  if (/imtahan|hazirliq|hazırlıq|buraxilis/.test(f)) return 'imtahana hazırlıq';
  return null;
}

function detectSearcherRole(text, forChildFlag) {
  if (forChildFlag) return 'parent';
  const f = foldAz(text);
  if (/ovladi|usaq|usaqi|uşaq|qizim|oglum|valideyn|ata|ana/.test(f)) return 'parent';
  if (/menim ucun|ozum ucun|telebe/.test(f)) return 'student';
  return 'visitor';
}

async function loadServiceAreas() {
  const { rows } = await db.query(
    `SELECT id, slug, name_az, kind FROM service_areas ORDER BY sort_order ASC, name_az ASC`,
  );
  return rows;
}

function matchCategory(text) {
  const folded = foldAz(text);
  const flat = flattenTeachingCategories();

  for (const alias of SUBJECT_ALIASES) {
    if (alias.keys.some((k) => folded.includes(foldAz(k)))) {
      const cat = flat.find((c) => c.id === alias.categoryId);
      if (cat) return { id: cat.id, slug: cat.slug, name_az: cat.name_az };
    }
  }

  for (const cat of flat) {
    const name = foldAz(cat.name_az);
    if (name.length >= 4 && folded.includes(name)) {
      return { id: cat.id, slug: cat.slug, name_az: cat.name_az };
    }
  }
  return null;
}

function matchServiceArea(text, areas) {
  const folded = foldAz(text);
  for (const area of areas || []) {
    const name = foldAz(area.name_az);
    const slug = foldAz(area.slug || '');
    if (name.length >= 3 && (folded.includes(name) || (slug && folded.includes(slug.replace(/-/g, ' '))))) {
      return area;
    }
  }
  return null;
}

function buildCurriculumPlan({ subjectName, grade, level }) {
  const subject = subjectName || 'Fənn';
  const gradeLine = grade ? ` (${grade})` : '';
  const weak = level === 'zəif';

  if (foldAz(subject).includes('riyaziyyat') || foldAz(subject).includes('math')) {
    return {
      title: `${subject}${gradeLine} — 4 həftəlik diaqnostik plan`,
      weeks: [
        {
          week: 1,
          title: 'Diaqnostik test + əsas boşluqlar',
          topics: weak
            ? ['Kəsrlər və ondalıqlar', 'Sadə tənliklər', 'Faiz məsələləri']
            : ['Mövcud səviyyənin yoxlanması', 'Keçmiş mövzuların təkrarı'],
        },
        {
          week: 2,
          title: grade?.startsWith('8') ? '8-ci sinif mövzularına giriş' : 'Sinif proqramına uyğun mövzular',
          topics: grade?.startsWith('8')
            ? ['Kvadrat köklər', 'Cəbr ifadələri', 'Funksiyalara giriş']
            : ['Proqram üzrə əsas mövzular', 'Mətn məsələləri'],
        },
        {
          week: 3,
          title: 'Məsələ həlli intensivi',
          topics: ['Oxşar tipli məsələlər', 'Səhvlərin analizi', 'Ev tapşırığı ilə möhkəmləndirmə'],
        },
        {
          week: 4,
          title: 'İlk irəliləyiş qiymətləndirməsi',
          topics: ['Qısa diaqnostik test', 'Valideyn/müəllim görüşü', 'Növbəti ay planı'],
        },
      ],
    };
  }

  return {
    title: `${subject}${gradeLine} — 4 həftəlik fərdi plan`,
    weeks: [
      { week: 1, title: 'Diaqnostik və məqsəd təyini', topics: ['Səviyyə testi', 'Boşluqların müəyyən edilməsi'] },
      { week: 2, title: 'Əsas mövzular', topics: ['Sinif proqramına uyğun dərs', 'Praktiki tapşırıqlar'] },
      { week: 3, title: 'İntensiv məşq', topics: ['Məsələ həlli', 'Ev tapşırığı'] },
      { week: 4, title: 'Qiymətləndirmə', topics: ['Test', 'Nəticə hesabatı', 'Növbəti addım'] },
    ],
  };
}

function buildPricing(instructors) {
  const rates = (instructors || [])
    .map((i) => Number(i.discover_hourly_rate))
    .filter((n) => Number.isFinite(n) && n > 0);
  const min = rates.length ? Math.min(...rates) : 25;
  const max = rates.length ? Math.max(...rates) : 45;
  const mid = Math.round((min + max) / 2);

  return {
    per_lesson_azn_range: `${min}–${max}`,
    per_lesson_typical_azn: mid,
    packages: [
      { type: '8_lessons', label: '8 dərs paketi', total_azn: mid * 8 },
      { type: '12_lessons', label: '12 dərs paketi', total_azn: mid * 12 },
    ],
    mentorix_guarantee:
      'Müraciətlər Mentorix CRM-də qeydə alınır. Ödəniş və dərs cədvəli müəllimlə razılaşdırılır.',
    marketplace_note: 'Qiymətlər müəllimdən asılıdır; profildə göstərilən saatlıq tarifə əsaslanır.',
  };
}

function buildEmptyState({ area, subjectName, searcherRole }) {
  const locationPhrase = area?.name_az ? `${area.name_az} ərazisində` : 'Bu axtarış üzrə';

  if (searcherRole === 'parent') {
    return {
      title: 'AI filtrinə tam uyğun profil tapılmadı',
      message: `${locationPhrase} ${subjectName} üçün dəqiq uyğun profil yoxdur. Qiymət və dərs planı yalnız müəllim tapılanda göstərilir. Aşağıdakı xəritə və siyahıdan digər müəllimlərə baxa və birbaşa müraciət edə bilərsiniz.`,
      instructor_cta: null,
    };
  }

  return {
    title: 'Bu parametrlərlə müəllim tapılmadı',
    message: `${locationPhrase} ${subjectName} üzrə aktiv profil yoxdur.`,
    instructor_cta: {
      label: 'Müəllim kimi qeydiyyatdan keç',
      path: '/login?role=instructor',
    },
  };
}

async function fetchAiInstructorMatches({ categoryId, areaId, raw, lat, lng, limit }) {
  const base = {
    format: 'any',
    lat,
    lng,
    areaId: areaId || null,
    requireFormatReachability: false,
    limit: Math.max(limit, 6),
  };

  let instructors = await searchDiscoverInstructors({
    ...base,
    categoryId: categoryId || null,
    q: categoryId ? null : raw.slice(0, 80),
    kind: null,
    requireCoordinates: true,
  });

  let matchTier = instructors.length ? 'exact' : null;

  if (!instructors.length && categoryId) {
    instructors = await searchDiscoverInstructors({
      ...base,
      categoryId,
      areaId: null,
      q: null,
      kind: null,
      requireCoordinates: false,
    });
    if (instructors.length) matchTier = 'category_relaxed';
  }

  if (!instructors.length && categoryId) {
    instructors = await searchDiscoverInstructors({
      ...base,
      categoryId: null,
      areaId: null,
      q: raw.slice(0, 80),
      kind: null,
      requireCoordinates: false,
    });
    if (instructors.length) matchTier = 'text_relaxed';
  }

  return { instructors, matchTier: matchTier || (instructors.length ? 'exact' : 'none') };
}

function publicInstructorCard(row) {
  return {
    id: row.id,
    full_name: row.full_name,
    subject: row.subject,
    category_names: row.category_names,
    discover_hourly_rate: row.discover_hourly_rate,
    discover_verified: row.discover_verified,
    distance_km: row.distance_km,
    latitude: row.latitude,
    longitude: row.longitude,
    avatar_url: row.avatar_url,
    map_profile_kind: row.map_profile_kind,
    is_featured_listing: row.is_featured_listing,
    plan: row.plan,
  };
}

/**
 * Təbii dildə sorğu → müəllimlər, qiymət, dərs planı, CTA
 */
async function runMarketplaceAiSearch({ query, forChild = false, lat = null, lng = null, limit = 3 }) {
  const raw = String(query || '').trim();
  if (raw.length < 6) {
    const err = new Error('Sorğu çox qısadır — ən azı 6 simvol yazın.');
    err.status = 400;
    throw err;
  }

  const areas = await loadServiceAreas();
  const category = matchCategory(raw);
  const area = matchServiceArea(raw, areas);
  const grade = parseGrade(raw);
  const studentLevel = parseStudentLevel(raw);
  const searcherRole = detectSearcherRole(raw, forChild);

  const { instructors, matchTier } = await fetchAiInstructorMatches({
    categoryId: category?.id || null,
    areaId: area?.id || null,
    raw,
    lat,
    lng,
    limit,
  });

  const top = instructors.slice(0, limit).map(publicInstructorCard);
  const subjectName = category?.name_az || 'Müəllim';
  const hasInstructors = top.length > 0;

  if (!hasInstructors) {
    setImmediate(() => {
      notifyMarketplaceSearchOpportunity({
        categoryId: category?.id || null,
        areaId: area?.id || null,
        searchQ: raw,
        kind: 'teacher',
        format: 'any',
      }).catch(() => {});
    });
  }

  const curriculum = buildCurriculumPlan({
    subjectName,
    grade,
    level: studentLevel,
  });

  return {
    extracted: {
      subject: subjectName,
      category_id: category?.id || null,
      category_slug: category?.slug || null,
      grade,
      location: area?.name_az || null,
      area_id: area?.id || null,
      student_level: studentLevel,
      searcher_role: searcherRole,
      for_child: searcherRole === 'parent',
      raw_query: raw,
    },
    step1_tutors: {
      count: instructors.length,
      matches: top,
      match_tier: matchTier,
      match_note:
        matchTier === 'category_relaxed'
          ? `${subjectName} üzrə tapılan müəllimlər — lokasiya filtrinə tam uyğun olmaya bilər.`
          : matchTier === 'text_relaxed'
            ? 'Axtarış mətninə uyğun profillər — fənn filtrinə tam uyğun olmaya bilər.'
            : null,
      filters_applied: {
        category_id: category?.id || null,
        area_id: area?.id || null,
        format: 'any',
      },
      empty_state: hasInstructors ? null : buildEmptyState({ area, subjectName, searcherRole }),
    },
    step2_pricing: hasInstructors
      ? { ...buildPricing(instructors), source: 'instructors' }
      : null,
    step3_curriculum: hasInstructors ? { ...curriculum, source: 'instructors' } : null,
    step4_cta: hasInstructors
      ? {
          trial_lesson: { action: 'inquiry', label: 'Sınaq dərsi təyin et' },
          message: { action: 'inquiry', label: 'Müəllimə mesaj yaz' },
          whatsapp: { action: 'whatsapp', label: 'WhatsApp ilə əlaqə' },
        }
      : {
          browse_map: {
            label: 'Aşağıdakı xəritə və siyahıdan müəllim seçin',
            hint: 'Uyğun müəllim tapdıqda profilindən WhatsApp və ya müraciət göndərə bilərsiniz.',
          },
          support_whatsapp: {
            action: 'whatsapp',
            url: WHATSAPP_URL,
            label: 'Mentorix dəstəyi (WhatsApp)',
          },
        },
  };
}

module.exports = { runMarketplaceAiSearch, foldAz, parseGrade, matchCategory };
