import { useTranslation } from 'react-i18next'
import useActiveLocale from '../../hooks/useActiveLocale'
import Button from '../common/Button'
import { countryFlag, extractProgramIelts, formatDeadline, formatTuition, universityInitials } from '../../lib/universitySearch'
import { countryDisplayName } from '../../lib/universityCountryI18n'
import useUiStore from '../../hooks/useUi'

function InfoRow({ label, value, highlight = false, light }) {
  if (value == null || value === '' || value === '—') return null
  return (
    <div className={['rounded-xl px-3 py-2', light ? 'bg-slate-100' : 'bg-black/20'].join(' ')}>
      <p className={light ? 'text-slate-500' : 'text-gray-500'}>{label}</p>
      <p className={highlight ? 'text-primary font-medium' : light ? 'text-slate-900 font-medium' : 'text-white font-medium'}>{value}</p>
    </div>
  )
}

export default function ProgramCard({ program, onDetails, onApply, showCountryBadge = false }) {
  const { t } = useTranslation()
  const locale = useActiveLocale()
  const theme = useUiStore((s) => s.theme)
  const light = theme !== 'dark'
  const uni = program.university || {}
  const ielts = extractProgramIelts(program.requirements)
  const appFee = program.requirements?.application_fee

  return (
    <article className={['rounded-2xl border p-4 sm:p-5 flex flex-col gap-4 transition-colors', light ? 'border-slate-200 bg-white shadow-sm hover:border-slate-300' : 'border-white/10 bg-white/[0.03] hover:border-white/20'].join(' ')}>
      {showCountryBadge && uni.country ? (
        <span className={['inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]', light ? 'border-slate-200 bg-slate-100 text-slate-700' : 'border-white/10 bg-black/30 text-gray-200'].join(' ')}>
          <span aria-hidden>{countryFlag(uni.country)}</span>
          <span>{countryDisplayName(uni.country, locale)}</span>
        </span>
      ) : null}
      <div className="flex items-start gap-3">
        {uni.logo_url ? (
          <img
            src={uni.logo_url}
            alt=""
            className={['h-12 w-12 rounded-xl object-cover shrink-0', light ? 'bg-slate-100' : 'bg-white/10'].join(' ')}
          />
        ) : (
          <div className="h-12 w-12 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-sm font-bold text-primary shrink-0">
            {universityInitials(uni.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={['text-[10px] uppercase tracking-wide', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>
            {countryDisplayName(uni.country, locale)}
            {uni.city ? ` · ${uni.city}` : ''}
          </p>
          <h3 className={['font-display font-bold truncate', light ? 'text-slate-900' : 'text-white'].join(' ')}>{uni.name}</h3>
          <p className={['text-sm mt-0.5 line-clamp-2', light ? 'text-slate-600' : 'text-gray-300'].join(' ')}>{program.name}</p>
        </div>
        {uni.world_ranking ? (
          <span className={['shrink-0 rounded-lg border px-2 py-1 text-[10px]', light ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-gray-300'].join(' ')}>
            #{uni.world_ranking}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <InfoRow light={light} label={t('universitySearch.card.degree')} value={program.degree_level} />
        <InfoRow
          light={light}
          label={t('universitySearch.card.qsRanking')}
          value={uni.world_ranking ? `#${uni.world_ranking}` : null}
        />
        <InfoRow light={light} label={t('universitySearch.card.annualFee')} value={formatTuition(program.tuition_fee)} />
        <InfoRow
          light={light}
          label={t('universitySearch.card.applicationFee')}
          value={appFee != null ? `€${Number(appFee).toLocaleString('en-US')}` : null}
        />
        <InfoRow light={light} label={t('universitySearch.card.language')} value={program.language || '—'} />
        <InfoRow
          light={light}
          label={t('universitySearch.card.ielts')}
          value={ielts != null ? String(ielts) : t('universitySearch.card.ieltsNotRequired')}
        />
        <InfoRow light={light} label={t('universitySearch.card.deadline')} value={formatDeadline(program.next_deadline)} />
        <InfoRow
          light={light}
          label={t('universitySearch.card.scholarship')}
          value={
            program.scholarship_available
              ? t('universitySearch.card.scholarshipYes')
              : t('universitySearch.card.scholarshipNo')
          }
          highlight={program.scholarship_available}
        />
      </div>

      {program.mentor?.display_name ? (
        <div className={['rounded-xl border px-3 py-2 text-xs', light ? 'border-violet-200 bg-violet-50 text-violet-800' : 'border-violet-500/25 bg-violet-500/10 text-violet-200'].join(' ')}>
          {t('universitySearch.card.mentor', { name: program.mentor.display_name })}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 mt-auto">
        <Button type="button" variant="secondary" className="text-xs" onClick={() => onDetails?.(program)}>
          {t('universitySearch.actions.details')}
        </Button>
        <Button type="button" className="text-xs" onClick={() => onApply?.(program)}>
          {t('universitySearch.actions.apply')}
        </Button>
      </div>
    </article>
  )
}
