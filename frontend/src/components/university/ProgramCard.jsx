import Button from '../common/Button'
import { formatDeadline, formatTuition, universityInitials } from '../../lib/universitySearch'

export default function ProgramCard({ program, onDetails, onApply }) {
  const uni = program.university || {}

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 flex flex-col gap-4 hover:border-white/20 transition-colors">
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
        <div className="rounded-xl bg-black/20 px-3 py-2">
          <p className="text-gray-500">Dərəcə</p>
          <p className="text-white font-medium">{program.degree_level}</p>
        </div>
        <div className="rounded-xl bg-black/20 px-3 py-2">
          <p className="text-gray-500">Ödəniş</p>
          <p className="text-white font-medium">{formatTuition(program.tuition_fee)}</p>
        </div>
        <div className="rounded-xl bg-black/20 px-3 py-2">
          <p className="text-gray-500">Son tarix</p>
          <p className="text-white font-medium">{formatDeadline(program.next_deadline)}</p>
        </div>
        <div className="rounded-xl bg-black/20 px-3 py-2">
          <p className="text-gray-500">Təqaüd</p>
          <p className={program.scholarship_available ? 'text-primary font-medium' : 'text-gray-400'}>
            {program.scholarship_available ? 'Var' : 'Yox'}
          </p>
        </div>
      </div>

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
