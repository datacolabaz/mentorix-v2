import { Link } from 'react-router-dom'
import { MENTORIX_SITE_NAV } from '../../lib/mentorixSeoSchema'
import { MENTORIX_SEO_HOMEPAGE_LINE } from '../../lib/mentorixPublicMarketing'
import { searchLandings } from '../../lib/publicSeoLandings'

export default function PublicSeoFooter({ className = '' }) {
  const searchPages = searchLandings()
  const platformNav = MENTORIX_SITE_NAV.filter((n) => n.path !== '/search')

  return (
    <footer
      className={`border-t border-white/10 bg-[#080808] text-gray-500 ${className}`.trim()}
      aria-label="Mentorix ictimai səhifələr"
    >
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-10 space-y-8">
        <nav className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Platforma bölmələri">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Müəllim tap</p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/search" className="text-gray-300 hover:text-primary transition-colors">
                  Xəritədə axtar
                </Link>
              </li>
              {searchPages.map((l) => (
                <li key={l.path}>
                  <Link to={l.path} className="text-gray-400 hover:text-primary transition-colors">
                    {l.h1.replace(' tap', '')}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Platforma</p>
            <ul className="space-y-2 text-sm">
              {platformNav.slice(0, 5).map((item) => (
                <li key={item.path}>
                  <Link to={item.path} className="text-gray-400 hover:text-primary transition-colors">
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Məlumat</p>
            <ul className="space-y-2 text-sm">
              {platformNav.slice(5).map((item) => (
                <li key={item.path}>
                  <Link to={item.path} className="text-gray-400 hover:text-primary transition-colors">
                    {item.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/login" className="text-gray-300 hover:text-primary transition-colors">
                  Giriş / qeydiyyat
                </Link>
              </li>
            </ul>
          </div>
        </nav>
        <p className="text-xs text-gray-500 leading-relaxed">{MENTORIX_SEO_HOMEPAGE_LINE}</p>
      </div>
    </footer>
  )
}
