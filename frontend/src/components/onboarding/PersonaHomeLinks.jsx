import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import NavIcon from '../common/NavIcon'
import { PERSONA_HOME_LINKS, resolveUserPersona } from '../../constants/personas'
import useAuthStore from '../../hooks/useAuth'

export default function PersonaHomeLinks({ className = '' }) {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const persona = resolveUserPersona(user)
  const links = PERSONA_HOME_LINKS[persona] || []
  if (!links.length) return null

  return (
    <section className={className} aria-label={t('personaHome.title')}>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-token-textMuted mb-3">
        {t('personaHome.title')}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {links.map((item) => (
          <Link
            key={`${item.to}-${item.labelKey}`}
            to={item.to}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:border-primary/40 hover:bg-primary/5 transition-colors min-h-[92px]"
          >
            <span className="w-8 h-8 rounded-lg border border-primary/25 bg-primary/10 text-primary flex items-center justify-center mb-2">
              <NavIcon name={item.icon} className="w-4 h-4" />
            </span>
            <div className="text-sm font-semibold text-token-textMain leading-snug">{t(item.labelKey)}</div>
          </Link>
        ))}
      </div>
    </section>
  )
}
