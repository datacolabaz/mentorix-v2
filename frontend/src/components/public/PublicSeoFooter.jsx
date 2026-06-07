import { Link } from 'react-router-dom'
import { panelLandings, searchLandings, footerLabelForLanding } from '../../lib/publicSeoLandings'

export default function PublicSeoFooter({ className = '' }) {
  const searchPages = searchLandings()
  const panelPages = panelLandings()

  return (
    <footer
      className={`border-t border-white/10 bg-[#080808] text-gray-500 ${className}`.trim()}
      aria-label="Mentorix ictimai səhifələr"
    >
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-10 space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Müəllim axtarışı</p>
            <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <Link to="/search" className="text-gray-300 hover:text-primary transition-colors">
                Xəritədə axtar
              </Link>
              {searchPages.map((l) => (
                <Link key={l.path} to={l.path} className="text-gray-400 hover:text-primary transition-colors">
                  {footerLabelForLanding(l)}
                </Link>
              ))}
            </nav>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Müəllim paneli</p>
            <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {panelPages.map((l) => (
                <Link key={l.path} to={l.path} className="text-gray-300 hover:text-primary transition-colors">
                  {footerLabelForLanding(l)}
                </Link>
              ))}
              <Link to="/login" className="text-gray-400 hover:text-primary transition-colors">
                Giriş / qeydiyyat
              </Link>
            </nav>
          </div>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          Mentorix.io — müəllim paneli, tələbə idarəetmə sistemi, imtahan platforması, onlayn test sistemi və ödəniş
          izləmə proqramı. Repetitor proqramı və kurs idarəetmə həlli.
        </p>
      </div>
    </footer>
  )
}
