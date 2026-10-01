import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { searchLandings } from '../../lib/publicSeoLandings'
import { MENTORIX_CONTACT } from '../../lib/mentorixPublicMarketing'
import { FEATURE_FLAGS, filterNavItemsByFlags, useFeatureFlags } from '../../lib/featureFlags'
import { BRAND } from '../../lib/brand'

const SOCIAL_LINKS = [
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/profile.php?id=61590561083510',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/mentorix.io/',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
]

const PRODUCT_LINKS = [
  { to: '/muellimler-ucun', key: 'publicFooter.links.muellimler-ucun' },
  { to: '/imtahanlar', key: 'publicFooter.links.imtahanlar' },
  { to: '/tapshiriqlar', key: 'publicFooter.links.tapshiriqlar' },
  { to: '/kurslar-ve-qruplar', key: 'publicFooter.links.kurslar-ve-qruplar' },
  { to: '/telebeler-ucun', key: 'publicFooter.links.telebeler-ucun' },
  { to: '/sertifikatli-imtahanlar', key: 'home.footer.certifiedExams' },
  { to: '/mentorship', key: 'landing.nav.mentorship' },
  { to: '/qiymetler', key: 'publicFooter.links.qiymetler' },
]

const COMPANY_LINKS = [
  { to: '/haqqimizda', key: 'publicFooter.links.haqqimizda' },
  { to: '/elaqe', key: 'publicFooter.links.elaqe' },
  { to: '/partner', key: 'publicFooter.partnerProgram' },
  { to: '/login', key: 'publicFooter.loginRegister' },
]

const LEGAL_LINKS = [
  { to: '/privacy', key: 'publicFooter.privacy' },
  { to: '/terms', key: 'publicFooter.terms' },
]

const LINK =
  'rounded-sm text-body-sm text-fg-secondary underline-offset-4 hover:text-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus'

function pathToKey(path) {
  return String(path || '').replace(/^\//, '') || 'root'
}

function footerSearchLabel(landing, t) {
  const fallback = String(landing.h1 || '').replace(' tap', '')
  return t(`publicFooter.searchLinks.${pathToKey(landing.path)}`, { defaultValue: fallback })
}

function FooterColumn({ id, title, children }) {
  return (
    <div>
      <h2 id={id} className="mb-3 text-caption font-semibold uppercase tracking-wider text-fg-muted">
        {title}
      </h2>
      <ul className="space-y-2.5" aria-labelledby={id}>
        {children}
      </ul>
    </div>
  )
}

export default function PublicSeoFooter({ className = '' }) {
  const { t } = useTranslation()
  const { flags } = useFeatureFlags()
  const productLinks = filterNavItemsByFlags(PRODUCT_LINKS, flags)
  const marketplaceOn = flags?.[FEATURE_FLAGS.MARKETPLACE] === true
  const universitiesOn = flags?.[FEATURE_FLAGS.UNIVERSITY_SEARCH] === true
  const discoverLinks = [
    ...(marketplaceOn ? [{ to: '/search', label: t('publicFooter.mapSearch') }] : []),
    ...(universitiesOn ? [{ to: '/universities', label: t('publicFooter.universityPrograms') }] : []),
    ...(marketplaceOn ? searchLandings().map((l) => ({ to: l.path, label: footerSearchLabel(l, t) })) : []),
  ]
  const year = new Date().getFullYear()

  return (
    <footer className={`border-t border-line bg-surface text-fg-secondary ${className}`.trim()}>
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          <div className="max-w-sm space-y-4">
            <p className="text-body-sm leading-relaxed">{t('home.footer.tagline', { brand: BRAND.name })}</p>
            <div className="flex items-center gap-2">
              {SOCIAL_LINKS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={item.label}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line text-fg-secondary transition-colors hover:bg-canvas-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {item.icon}
                </a>
              ))}
            </div>
          </div>

          <nav
            aria-label={t('publicFooter.navAriaLabel')}
            className="grid grid-cols-2 gap-8 sm:grid-cols-4"
          >
            <FooterColumn id="mx-footer-product" title={t('home.footer.product')}>
              {productLinks.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className={LINK}>
                    {t(item.key)}
                  </Link>
                </li>
              ))}
            </FooterColumn>
            <FooterColumn id="mx-footer-company" title={t('home.footer.company')}>
              {COMPANY_LINKS.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className={LINK}>
                    {t(item.key)}
                  </Link>
                </li>
              ))}
            </FooterColumn>
            <FooterColumn id="mx-footer-legal" title={t('home.footer.legal')}>
              {LEGAL_LINKS.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className={LINK}>
                    {t(item.key)}
                  </Link>
                </li>
              ))}
            </FooterColumn>
            <FooterColumn id="mx-footer-contact" title={t('home.footer.contact')}>
              {MENTORIX_CONTACT.whatsappUrl ? (
                <li>
                  <a href={MENTORIX_CONTACT.whatsappUrl} target="_blank" rel="noreferrer noopener" className={LINK}>
                    {t('home.footer.whatsapp')}
                  </a>
                </li>
              ) : null}
              {MENTORIX_CONTACT.email ? (
                <li>
                  <a href={`mailto:${MENTORIX_CONTACT.email}`} className={`${LINK} break-all`}>
                    {MENTORIX_CONTACT.email}
                  </a>
                </li>
              ) : null}
            </FooterColumn>
            {discoverLinks.length ? (
              <FooterColumn id="mx-footer-discover" title={t('home.footer.discover')}>
                {discoverLinks.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className={LINK}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </FooterColumn>
            ) : null}
          </nav>
        </div>

        <div className="border-t border-line pt-6 text-caption text-fg-muted">
          <p>{t('home.footer.copyright', { year, brand: BRAND.name })}</p>
        </div>
      </div>
    </footer>
  )
}
