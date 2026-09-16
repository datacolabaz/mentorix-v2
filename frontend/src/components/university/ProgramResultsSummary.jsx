import { useTranslation } from 'react-i18next'
import useActiveLocale from '../../hooks/useActiveLocale'
import { countryFlag } from '../../lib/universitySearch'
import { countryDisplayName } from '../../lib/universityCountryI18n'
import useUiStore from '../../hooks/useUi'

export default function ProgramResultsSummary({
  total,
  selectedCountries = [],
  countryCounts = {},
  coverageMessage,
  countriesWithResults = [],
}) {
  const { t } = useTranslation()
  const locale = useActiveLocale()
  const theme = useUiStore((s) => s.theme)
  const light = theme !== 'dark'

  if (!selectedCountries.length) return null

  return (
    <div className={['rounded-2xl border p-4 space-y-3', light ? 'border-slate-200 bg-white shadow-sm' : 'border-white/10 bg-white/[0.03]'].join(' ')}>
      {coverageMessage ? (
        <p className={['text-sm', light ? 'text-slate-600' : 'text-gray-300'].join(' ')}>{coverageMessage}</p>
      ) : null}

      <div className="space-y-2">
        <p className={['text-[10px] font-bold uppercase tracking-wide', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>
          {t('universitySearch.results.selectedCountries')}
        </p>
        <div className="flex flex-wrap gap-2">
          {selectedCountries.map((country) => {
            const count = countryCounts[country] || 0
            const hasResults = count > 0
            return (
              <span
                key={country}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs border',
                  hasResults
                    ? light
                      ? 'border-primary/40 bg-primary/10 text-slate-900'
                      : 'border-primary/40 bg-primary/10 text-white'
                    : light
                      ? 'border-slate-200 bg-slate-100 text-slate-600'
                      : 'border-white/10 bg-black/20 text-gray-400',
                ].join(' ')}
              >
                <span aria-hidden>{countryFlag(country)}</span>
                <span>{countryDisplayName(country, locale)}</span>
                <span className={hasResults ? 'text-primary font-semibold' : light ? 'text-slate-500' : 'text-gray-500'}>({count})</span>
              </span>
            )
          })}
        </div>
      </div>

      {countriesWithResults.length ? (
        <div className="space-y-1">
          <p className={['text-[10px] font-bold uppercase tracking-wide', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>
            {t('universitySearch.results.countriesWithResults')}
          </p>
          <p className={['text-sm', light ? 'text-slate-600' : 'text-gray-300'].join(' ')}>
            {countriesWithResults
              .map((country) => `${countryFlag(country)} ${countryDisplayName(country, locale)}`)
              .join(' · ')}
          </p>
        </div>
      ) : null}

      {total > 0 ? (
        <p className={['text-xs', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>{t('universitySearch.results.filterPartialNote')}</p>
      ) : null}
    </div>
  )
}
