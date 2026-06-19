import Button from '../common/Button'
import { countryFlag, extractProgramIelts, formatDeadline, formatTuition, universityInitials } from '../../lib/universitySearch'

function InfoRow({ label, value, highlight = false }) {
  if (value == null || value === '' || value === '—') return null
  return (
    <div className="rounded-xl bg-black/20 px-3 py-2">
      <p className="text-gray-500">{label}</p>
      <p className={highlight ? 'text-primary font-medium' : 'text-white font-medium'}>{value}</p>
    </div>
  )
}

export default function ProgramCard({ program, onDetails, onApply, showCountryBadge = false }) {
  const uni = program.university || {}
  const ielts = extractProgramIelts(program.requirements)
  const appFee = program.requirements?.application_fee

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 flex flex-col gap-4 hover:border-white/20 transition-colors">
      {showCountryBadge && uni.country ? (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-gray-200">
          <span aria-hidden>{countryFlag(uni.country)}</span>
          <span>{uni.country}</span>
        </span>
      ) : null}
      <div className="flex items-start gap-3">
        {uni.logo_url ? (
          <img
            src={uni.logo_url}
            alt=""
            className="h-12 w-12 rounded-xl object-cover bg-white/10 shrink-0"
          />
        ) : (
          <div className="h-12 w-12 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-sm font-bold text-primary shrink-0">
            {universityInitials(uni.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-gray-500">
            {uni.country}
            {uni.city ? ` · ${uni.city}` : ''}
          </p>
          <h3 className="font-display font-bold text-white truncate">{uni.name}</h3>
          <p className="text-sm text-gray-300 mt-0.5 line-clamp-2">{program.name}</p>
        </div>
        {uni.world_ranking ? (
          <span className="shrink-0 rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-gray-300">
            #{uni.world_ranking}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <InfoRow label="Dərəcə" value={program.degree_level} />
        <InfoRow label="QS reytinqi" value={uni.world_ranking ? `#${uni.world_ranking}` : null} />
        <InfoRow label="İllik haqq" value={formatTuition(program.tuition_fee)} />
        <InfoRow
          label="Müraciət haqqı"
          value={appFee != null ? `€${Number(appFee).toLocaleString('en-US')}` : null}
        />
        <InfoRow label="Dil" value={program.language || '—'} />
        <InfoRow label="IELTS" value={ielts != null ? String(ielts) : 'Tələb yoxdur'} />
        <InfoRow label="Son tarix" value={formatDeadline(program.next_deadline)} />
        <InfoRow
          label="Təqaüd"
          value={program.scholarship_available ? 'Mövcuddur' : 'Yoxdur'}
          highlight={program.scholarship_available}
        />
      </div>

      {program.mentor?.display_name ? (
        <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-xs text-violet-200">
          Bu proqram üzrə mentor: <span className="font-semibold text-white">{program.mentor.display_name}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 mt-auto">
        <Button type="button" variant="secondary" className="text-xs" onClick={() => onDetails?.(program)}>
          Ətraflı
        </Button>
        <Button type="button" className="text-xs" onClick={() => onApply?.(program)}>
          Apply
        </Button>
      </div>
    </article>
  )
}
