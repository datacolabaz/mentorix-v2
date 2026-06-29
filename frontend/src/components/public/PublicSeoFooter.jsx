import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MENTORIX_SITE_NAV } from '../../lib/mentorixSeoSchema'
import { searchLandings } from '../../lib/publicSeoLandings'

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

function pathToKey(path) {
  return String(path || '').replace(/^\//, '') || 'root'
}

function footerNavLabel(item, t) {
  const key = pathToKey(item.path)
  return t(`publicFooter.links.${key}`, { defaultValue: item.name })
}

function footerSearchLabel(landing, t) {
  const key = pathToKey(landing.path)
  const fallback = String(landing.h1 || '').replace(' tap', '')
  return t(`publicFooter.searchLinks.${key}`, { defaultValue: fallback })
}

export default function PublicSeoFooter({ className = '' }) {
  const { t } = useTranslation()
  const searchPages = searchLandings()
  const platformNav = MENTORIX_SITE_NAV.filter((n) => n.path !== '/search')

  return (
    <footer
      className={`border-t border-white/10 bg-[#080808] text-gray-500 ${className}`.trim()}
      aria-label={t('publicFooter.ariaLabel')}
    >
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-10 space-y-8">
        <nav className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label={t('publicFooter.navAriaLabel')}>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              {t('publicFooter.findTeacher')}
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/search" className="text-gray-300 hover:text-primary transition-colors">
                  {t('publicFooter.mapSearch')}
                </Link>
              </li>
              <li>
                <Link to="/universities" className="text-gray-300 hover:text-primary transition-colors">
                  {t('publicFooter.universityPrograms')}
                </Link>
              </li>
              {searchPages.map((l) => (
                <li key={l.path}>
                  <Link to={l.path} className="text-gray-400 hover:text-primary transition-colors">
                    {footerSearchLabel(l, t)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              {t('publicFooter.platform')}
            </p>
            <ul className="space-y-2 text-sm">
              {platformNav.slice(0, 5).map((item) => (
                <li key={item.path}>
                  <Link to={item.path} className="text-gray-400 hover:text-primary transition-colors">
                    {footerNavLabel(item, t)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              {t('publicFooter.info')}
            </p>
            <ul className="space-y-2 text-sm">
              {platformNav.slice(5).map((item) => (
                <li key={item.path}>
                  <Link to={item.path} className="text-gray-400 hover:text-primary transition-colors">
                    {footerNavLabel(item, t)}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/login" className="text-gray-300 hover:text-primary transition-colors">
                  {t('publicFooter.loginRegister')}
                </Link>
              </li>
            </ul>
          </div>
        </nav>

        <p className="text-sm text-gray-400 font-medium leading-relaxed">{t('publicFooter.tagline')}</p>

        <div className="border-t border-white/10 pt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1 text-center sm:text-left">
            <p className="text-xs text-gray-400">{t('publicFooter.copyright')}</p>
            <p className="text-[11px] text-gray-600">
              <a
                href="https://datacolab.az"
                target="_blank"
                rel="noreferrer"
                className="hover:text-gray-400 transition-colors"
              >
                {t('publicFooter.byDatacolab')}
              </a>
            </p>
          </div>
          <div className="flex items-center justify-center sm:justify-end gap-2">
            {SOCIAL_LINKS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={item.label}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:border-primary/35 hover:bg-primary/10 hover:text-primary transition-colors"
              >
                {item.icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
