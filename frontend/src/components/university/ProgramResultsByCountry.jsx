import ProgramCard from './ProgramCard'
import { useTranslation } from 'react-i18next'
import useActiveLocale from '../../hooks/useActiveLocale'
import { countryFlag } from '../../lib/universitySearch'
import { countryDisplayName } from '../../lib/universityCountryI18n'
import useUiStore from '../../hooks/useUi'

export default function ProgramResultsByCountry({ groups, onDetails, onApply }) {
  const locale = useActiveLocale()
  const theme = useUiStore((s) => s.theme)
  const light = theme !== 'dark'

  if (!groups?.length) return null

  return (
    <div className="space-y-8">
      {groups.map(({ country, programs }) => (
        <section key={country} className="space-y-3">
          <div className={['flex items-center gap-2 border-b pb-2', light ? 'border-slate-200' : 'border-white/10'].join(' ')}>
            <span className="text-lg" aria-hidden>
              {countryFlag(country)}
            </span>
            <h2 className={['text-xs font-bold uppercase tracking-widest', light ? 'text-slate-700' : 'text-gray-300'].join(' ')}>
              {countryDisplayName(country, locale)}
            </h2>
            <span className={['text-xs', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>({programs.length})</span>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {programs.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                onDetails={onDetails}
                onApply={onApply}
                showCountryBadge
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
