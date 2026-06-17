import { MENTORIX_SEO_DESCRIPTION, MENTORIX_SEO_TITLE } from './mentorixPublicMarketing'
import { PLAN_TITLES_SEO_FALLBACK } from './subscriptionPlanGuards'

export const SITE_ORIGIN = 'https://mentorix.io'

/** Google sitelink və footer naviqasiyası üçün əsas bölmələr */
export const MENTORIX_SITE_NAV = [
  {
    name: 'Müəllim Tap',
    path: '/search',
    description: 'Xəritədə müəllim, təlimçi və repetitor axtarışı',
  },
  {
    name: 'İmtahanlar',
    path: '/imtahanlar',
    description: 'Onlayn imtahan və test sistemi — QR və linklə paylaşım',
  },
  {
    name: 'Tapşırıqlar',
    path: '/tapshiriqlar',
    description: 'Ev tapşırığı təyini, təslim və müəllim yoxlaması',
  },
  {
    name: 'Kurslar və Qruplar',
    path: '/kurslar-ve-qruplar',
    description: 'Tədris qrupları, paketlər və dərs cədvəli idarəetməsi',
  },
  {
    name: 'Qiymətlər',
    path: '/qiymetler',
    description: `${PLAN_TITLES_SEO_FALLBACK} paketlər`,
  },
  {
    name: 'Müəllimlər üçün',
    path: '/muellimler-ucun',
    description: 'Müəllim və kurs idarəetmə paneli',
  },
  {
    name: 'Tələbələr üçün',
    path: '/telebeler-ucun',
    description: 'Tələbə kabineti — imtahan, tapşırıq və cədvəl',
  },
  {
    name: 'Haqqımızda',
    path: '/haqqimizda',
    description: 'Mentorix təhsil idarəetmə platforması haqqında',
  },
  {
    name: 'Əlaqə',
    path: '/elaqe',
    description: 'Dəstək və əlaqə məlumatları',
  },
]

export function absoluteUrl(path) {
  const p = String(path || '/')
  if (p.startsWith('http')) return p
  return `${SITE_ORIGIN}${p.startsWith('/') ? p : `/${p}`}`
}

export function buildWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Mentorix',
    alternateName: 'Mentorix.io',
    url: `${SITE_ORIGIN}/`,
    description: MENTORIX_SEO_DESCRIPTION,
    inLanguage: 'az',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_ORIGIN}/search?category={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Mentorix',
    legalName: 'Mentorix.io',
    url: `${SITE_ORIGIN}/`,
    logo: `${SITE_ORIGIN}/favicon.png`,
    description: MENTORIX_SEO_DESCRIPTION,
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      telephone: '+994-50-306-66-26',
      url: 'https://wa.me/994553775770',
      availableLanguage: ['az'],
    },
  }
}

export function buildSiteNavigationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SiteNavigationElement',
    name: 'Mentorix əsas naviqasiya',
    hasPart: MENTORIX_SITE_NAV.map((item) => ({
      '@type': 'WebPage',
      name: item.name,
      url: absoluteUrl(item.path),
      description: item.description,
    })),
  }
}

export function buildSiteSectionsItemListSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Mentorix platforma bölmələri',
    description: MENTORIX_SEO_TITLE,
    itemListElement: MENTORIX_SITE_NAV.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  }
}

export function buildBreadcrumbSchema(items) {
  const list = Array.isArray(items) ? items.filter(Boolean) : []
  if (!list.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: list.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function buildDefaultStructuredData() {
  return [
    buildWebSiteSchema(),
    buildOrganizationSchema(),
    buildSiteNavigationSchema(),
    buildSiteSectionsItemListSchema(),
  ]
}
