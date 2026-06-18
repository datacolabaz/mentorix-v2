import {
  MENTORIX_CONTACT,
  MENTORIX_SEO_DESCRIPTION,
  MENTORIX_SEO_KEYWORDS,
  MENTORIX_SEO_TITLE,
} from './mentorixPublicMarketing'
import { PLAN_TITLES_SEO_FALLBACK } from './subscriptionPlanGuards'

const FEATURE_KEYWORDS =
  'təhsil idarəetmə platforması, müəllim paneli, imtahan platforması, tapşırıq sistemi, Mentorix'

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
    kind: 'feature',
    path: '/imtahanlar',
    title: 'İmtahan və test sistemi — Mentorix',
    description:
      'Mentorix imtahan platforması: onlayn testlər hazırlayın, QR kod və ya linklə paylaşın, nəticələri avtomatik qiymətləndirin və analiz edin.',
    h1: 'İmtahan və onlayn test sistemi',
    intro: [
      'Müəllimlər və kurslar üçün tam funksional imtahan platforması — sual bankı, vaxt limiti, avtomatik yoxlama və nəticə analitikası.',
      'Tələbələr link və ya QR kod ilə qoşula bilər; qonaq iştirakı dəstəklənir.',
    ],
    bullets: [
      'Çoxseçimli, açıq cavab və fayl yükləmə sualları',
      'Avtomatik bal hesablanması və AI dəstəkli yoxlama',
      'Qrup və fərdi imtahan paylaşımı',
    ],
    ctaHref: '/muellimler-ucun',
    ctaLabel: 'Müəllim kimi başla',
    keywords: `${FEATURE_KEYWORDS}, imtahan platforması, onlayn test sistemi`,
  },
  {
    kind: 'feature',
    path: '/tapshiriqlar',
    title: 'Tapşırıq sistemi — Mentorix',
    description:
      'Ev tapşırıqları təyin edin, tələbələr onlayn təslim etsin, müəllim yoxlasın və rəy yazsın. Fayl, mətn və link paylaşımı.',
    h1: 'Tapşırıq və ev işi sistemi',
    intro: [
      'Tapşırıqları qruplara və ya fərdi tələbələrə təyin edin, son tarix qoyun və təslimləri bir paneldə izləyin.',
      'Link ilə qonaq tələbələr də qoşula bilər.',
    ],
    bullets: [
      'Tapşırıq faylı və təsvir paylaşımı',
      'Təslim, gecikmə və müəllim rəyi',
      'Valideyn kabinetində nəticə görünüşü',
    ],
    ctaHref: '/muellimler-ucun',
    ctaLabel: 'Tapşırıq yarat',
    keywords: `${FEATURE_KEYWORDS}, ev tapşırığı, tapşırıq sistemi`,
  },
  {
    kind: 'feature',
    path: '/kurslar-ve-qruplar',
    title: 'Sahələr və qruplar idarəetməsi — Mentorix',
    description:
      'Tədris qrupları, paketlər (8/12 dərs), dərs cədvəli və tələbə qoşulma linkləri — kurs və təlim mərkəzləri üçün idarəetmə.',
    h1: 'Kurslar və tədris qrupları',
    intro: [
      'Qrup yaradın, paket və qiymət təyin edin, dəvət linki ilə tələbələri qoşun.',
      'Hər qrup üçün ayrıca cədvəl, ödəniş və davamiyyət izləməsi.',
    ],
    bullets: [
      '8 və 12 dərs paketləri',
      'Join link və QR ilə tələbə qəbulu',
      'Qrup üzrə imtahan və tapşırıq təyini',
    ],
    ctaHref: '/muellimler-ucun',
    ctaLabel: 'Qrup yarat',
    keywords: `${FEATURE_KEYWORDS}, kurs idarəetmə proqramı, tədris qrupları`,
  },
  {
    kind: 'panel',
    path: '/qiymetler',
    title: 'Qiymətlər və paketlər — Mentorix',
    description:
      `Mentorix paketləri: ${PLAN_TITLES_SEO_FALLBACK}. Tələbə limiti, SMS balansı və xəritədə görünmə imkanları.`,
    h1: 'Qiymətlər və abunəlik paketləri',
    intro: [MENTORIX_SEO_DESCRIPTION],
    bullets: [],
    showPlatformFeatures: true,
    showPricingPlans: true,
    showBenefitsList: false,
    searchCategorySlug: null,
    ctaHref: '/login',
    ctaLabel: '14 günlük pulsuz sınaq',
    keywords: `${MENTORIX_SEO_KEYWORDS}, qiymətlər, abunəlik paketləri`,
  },
  {
    kind: 'panel',
    path: '/muellimler-ucun',
    title: MENTORIX_SEO_TITLE,
    description: MENTORIX_SEO_DESCRIPTION,
    h1: 'Müəllimlər, kurslar və təlim mərkəzləri üçün Mentorix',
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
  {
    kind: 'info',
    path: '/telebeler-ucun',
    title: 'Tələbələr üçün Mentorix — imtahan, tapşırıq, cədvəl',
    description:
      'Tələbə kabineti: imtahanlara qoşulun, tapşırıqları təslim edin, dərs cədvəlini və ödəniş tarixlərini izləyin. Müəlliminiz sizi dəvət edir.',
    h1: 'Tələbələr üçün Mentorix',
    intro: [
      'Müəlliminiz və ya kursunuz sizi Mentorix-ə dəvət edəndə imtahan, tapşırıq və cədvəl bir kabinetdə toplanır.',
      'Link və ya QR kod ilə imtahana və tapşırığa qoşula bilərsiniz.',
    ],
    bullets: [
      'İmtahan və tapşırıq təslimi',
      'Dərs cədvəli və bildirişlər',
      'Ödəniş tarixləri və nəticələr',
    ],
    ctaHref: '/login',
    ctaLabel: 'Tələbə girişi',
    keywords: 'tələbə kabineti, imtahan, tapşırıq, Mentorix tələbə',
  },
  {
    kind: 'info',
    path: '/haqqimizda',
    title: 'Haqqımızda — Mentorix təhsil idarəetmə platforması',
    description:
      'Mentorix Azərbaycanda müəllimlər, kurslar və təlim mərkəzləri üçün rəqəmsal tədris və idarəetmə platformasıdır. Tələbə CRM, imtahan, ödəniş və müəllim axtarışı bir yerdə.',
    h1: 'Mentorix haqqında',
    intro: [
      'Mentorix sadəcə repetitor paneli deyil — təhsil idarəetmə və müəllim marketplace platformasıdır.',
      'Müəllimlər tələbələrini idarə edir, imtahan və tapşırıq yaradır, ödənişləri izləyir; tələbələr isə xəritədən müəllim tapa bilir.',
    ],
    bullets: [
      'Tələbə idarəetməsi və analitika',
      'İmtahan, tapşırıq və davamiyyət',
      'Ödəniş izləmə və SMS bildirişləri',
      'İctimai müəllim axtarış xəritəsi',
    ],
    ctaHref: '/muellimler-ucun',
    ctaLabel: 'Platformanı kəşf et',
    keywords: MENTORIX_SEO_KEYWORDS,
  },
  {
    kind: 'info',
    path: '/elaqe',
    title: 'Əlaqə — Mentorix dəstək',
    description:
      `Mentorix ilə əlaqə: WhatsApp ${MENTORIX_CONTACT.phoneDisplay}, e-poçt ${MENTORIX_CONTACT.email}. Platforma, paketlər və qoşulma barədə suallarınız üçün yazın.`,
    h1: 'Bizimlə əlaqə',
    intro: [
      'Mentorix haqqında sualınız, texniki dəstək və ya paket seçimi üçün bizimlə əlaqə saxlayın.',
      'Komanda Azərbaycan dilində dəstək göstərir.',
    ],
    bullets: [
      `WhatsApp: ${MENTORIX_CONTACT.phoneDisplay}`,
      `E-poçt: ${MENTORIX_CONTACT.email}`,
      'Müəllim və kurs qoşulması üçün pulsuz 14 günlük sınaq',
    ],
    ctaHref: MENTORIX_CONTACT.whatsappUrl,
    ctaLabel: 'WhatsApp ilə yazın',
    ctaExternal: true,
    keywords: 'Mentorix əlaqə, dəstək, WhatsApp',
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

export function featureLandings() {
  return PUBLIC_SEO_LANDINGS.filter((l) => l.kind === 'feature')
}

export function infoLandings() {
  return PUBLIC_SEO_LANDINGS.filter((l) => l.kind === 'info')
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
  if (landing.kind === 'panel' && landing.path === '/muellimler-ucun') return 'Müəllimlər üçün'
  if (landing.kind === 'panel' && landing.path === '/qiymetler') return 'Qiymətlər'
  if (landing.kind === 'feature') return landing.h1.split(' ').slice(0, 2).join(' ')
  if (landing.kind === 'info') return landing.h1.replace(' üçün Mentorix', '').replace('Mentorix haqqında', 'Haqqımızda')
  return landing.h1.replace(' tap', '')
}
