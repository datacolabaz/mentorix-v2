import {
  MENTORIX_SEO_DESCRIPTION,
  MENTORIX_SEO_KEYWORDS,
  MENTORIX_SEO_TITLE,
} from './mentorixPublicMarketing'

/** İctimai SEO landing səhifələri — Google sitelink və axtarış sorğuları üçün */
export const PUBLIC_SEO_LANDINGS = [
  {
    kind: 'search',
    path: '/repetitor-baki',
    title: 'Repetitor Bakı — müəllim və təlimçi tap | Mentorix',
    description:
      'Bakıda repetitor, fərdi müəllim və təlimçi axtarırsınız? Mentorix xəritəsində yaxınlığınızdakı müəllimləri reytinq, format və məsafəyə görə müqayisə edin.',
    h1: 'Bakıda repetitor və müəllim tap',
    intro: [
      'Mentorix ictimai axtarışı Bakı və ətraf ərazilərdə fərdi müəllim, repetitor və təlimçiləri bir xəritədə göstərir.',
      'Onlayn və ya canlı format, fən seçimi və məsafəyə görə filtrləyib birbaşa müraciət edə bilərsiniz.',
    ],
    bullets: [
      'Xəritədə yaxınlığınızdakı müəllimlər və təlimçilər',
      'Riyaziyyat, ingilis dili, abituriyent və digər fənlər',
      'Reytinq və format (onlayn / evdə / müəllimin yanında)',
    ],
    searchCategorySlug: null,
    ctaHref: '/search',
    ctaLabel: 'Bakıda müəllim axtar',
    keywords: 'repetitor Bakı, müəllim tap, təlimçi, repetitor axtarışı, Mentorix',
  },
  {
    kind: 'search',
    path: '/riyaziyyat-repetitoru',
    title: 'Riyaziyyat repetitoru — Bakı və Azərbaycan | Mentorix',
    description:
      'Riyaziyyat repetitoru axtarırsınız? Mentorix-də riyaziyyat müəllimlərini xəritədə tapın — məktəb, abituriyent və universitet səviyyəsi.',
    h1: 'Riyaziyyat repetitoru tap',
    intro: [
      'Məktəb proqramı, DİM və abituriyent hazırlığı üçün riyaziyyat müəllimlərini Mentorix axtarışında filtrləyin.',
      'Yaxınlığınızdakı repetitoru seçin və müraciət göndərin.',
    ],
    bullets: [
      'Riyaziyyat üzrə ixtisaslaşmış müəllimlər',
      'Məsafə və reytinqə görə sıralama',
      'Onlayn və ya canlı dərslər',
    ],
    searchCategorySlug: 'riyaziyyat',
    ctaHref: null,
    ctaLabel: 'Riyaziyyat müəllimlərini gör',
    keywords: 'riyaziyyat repetitoru, riyaziyyat müəllimi, repetitor Bakı, Mentorix',
  },
  {
    kind: 'search',
    path: '/ingilis-dili-repetitoru',
    title: 'İngilis dili repetitoru — Bakı | Mentorix axtarış',
    description:
      'İngilis dili repetitoru və müəllimi tapın. Mentorix xəritəsində IELTS, məktəb proqramı və danışıq dərsləri üçün müəllim seçin.',
    h1: 'İngilis dili repetitoru tap',
    intro: [
      'Məktəb ingilis dili, IELTS/TOEFL hazırlığı və danışıq dərsləri üçün müəllimləri Mentorix-də axtarın.',
      'Format və məsafəyə görə filtrləyib yaxınlığınızdakı təlimçini seçin.',
    ],
    bullets: [
      'Məktəb və imtahan hazırlığı',
      'Onlayn və ya canlı format',
      'Bakı və digər şəhərlər üzrə axtarış',
    ],
    searchCategorySlug: 'ingilis-dili-mekteb',
    ctaHref: null,
    ctaLabel: 'İngilis dili müəllimlərini gör',
    keywords: 'ingilis dili repetitoru, ingilis dili müəllimi, IELTS, Mentorix Bakı',
  },
  {
    kind: 'panel',
    path: '/muellim-paneli',
    title: MENTORIX_SEO_TITLE,
    description: MENTORIX_SEO_DESCRIPTION,
    h1: 'Müəllim, təlimçi və kurslar üçün Mentorix.io',
    intro: [MENTORIX_SEO_DESCRIPTION],
    bullets: [],
    showPlatformFeatures: true,
    showPricingPlans: true,
    showBenefitsList: true,
    searchCategorySlug: null,
    ctaHref: '/login',
    ctaLabel: 'Pulsuz başla — 14 günlük sınaq',
    keywords: MENTORIX_SEO_KEYWORDS,
  },
]

export { MENTORIX_PLATFORM_FEATURES } from './mentorixPublicMarketing'

export function landingByPath(path) {
  const p = String(path || '').replace(/\/+$/, '') || '/'
  return PUBLIC_SEO_LANDINGS.find((l) => l.path === p) || null
}

export function searchLandings() {
  return PUBLIC_SEO_LANDINGS.filter((l) => l.kind === 'search')
}

export function panelLandings() {
  return PUBLIC_SEO_LANDINGS.filter((l) => l.kind === 'panel')
}

export function ctaHrefForLanding(landing) {
  if (landing?.ctaHref) return landing.ctaHref
  return searchHrefForLanding(landing)
}

export function searchHrefForLanding(landing) {
  if (!landing?.searchCategorySlug) return '/search'
  return `/search?category=${encodeURIComponent(landing.searchCategorySlug)}`
}

export function footerLabelForLanding(landing) {
  if (landing.kind === 'panel') return 'Müəllim paneli'
  return landing.h1.replace(' tap', '')
}
