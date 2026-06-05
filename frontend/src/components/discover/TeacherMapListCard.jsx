import { Link } from 'react-router-dom'
import InstructorAvatar from '../common/InstructorAvatar'
import { formatDistanceKm } from '../../lib/geo'
import { deliveryFormatBadges, ratingStarsLine } from '../../lib/teacherMapCard'

export default function TeacherMapListCard({
  instructor: p,
  rank,
  selected,
  highlighted,
  isNearest,
  distanceOrigin,
  cardRef,
  onFocus,
  onInquiry,
}) {
  const subjectLine =
    p.display_subject ||
    (Array.isArray(p.category_names) && p.category_names.length ? p.category_names.join(', ') : null) ||
    p.subject
  const ratingLine = ratingStarsLine(p)
  const formats = deliveryFormatBadges(p)

  return (
    <div
      ref={cardRef}
      className={[
        'w-full rounded-xl border p-3 flex gap-3 items-start transition-all duration-500',
        highlighted
          ? 'border-emerald-400/70 bg-emerald-500/10 ring-2 ring-emerald-400/50 shadow-[0_0_18px_rgba(52,211,153,0.35)]'
          : selected
            ? 'border-primary/60 bg-primary/10 ring-1 ring-primary/30'
            : isNearest
              ? 'border-amber-500/40 bg-amber-500/5'
              : 'border-white/10 bg-[#121212]/90',
      ].join(' ')}
    >
      <button type="button" onClick={() => onFocus?.(p)} className="flex gap-3 flex-1 min-w-0 text-left">
        <span className="mt-1 w-6 shrink-0 text-center text-sm font-bold text-gray-500">{rank}.</span>
        <InstructorAvatar
          fullName={p.full_name}
          avatarUrl={p.avatar_url}
          size="sm"
          kind={p.map_profile_kind}
          className="mt-0.5 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1 mb-1">
            {p.is_top_listing ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-300">
                🔥 TOP
              </span>
            ) : null}
            {isNearest ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400">
                ⭐ Ən yaxın
              </span>
            ) : null}
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold text-white text-sm truncate">{p.full_name}</span>
            <span className="text-xs font-bold text-primary shrink-0 text-right">
              {formatDistanceKm(p.distanceKm ?? p.distance_km)}
            </span>
          </div>

          <div className="text-xs text-gray-400 mt-0.5 truncate">{subjectLine || 'Fənn göstərilməyib'}</div>

          {ratingLine ? (
            <div className="text-[11px] text-amber-200/90 mt-1 font-medium">{ratingLine}</div>
          ) : null}

          {formats.length ? (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {formats.slice(0, 3).map((lab) => (
                <span
                  key={lab}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10"
                >
                  {lab}
                </span>
              ))}
            </div>
          ) : null}

          {p.discover_hourly_rate != null ? (
            <div className="text-[11px] text-emerald-400/90 mt-1">{p.discover_hourly_rate} AZN/saat</div>
          ) : null}

          {p.next_available_slot ? (
            <div className="text-[10px] text-gray-500 mt-1 truncate">📅 {p.next_available_slot}</div>
          ) : null}

          <Link
            to={`/teachers/${p.id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-block text-[11px] font-semibold text-primary hover:underline mt-1.5"
          >
            Profilə bax →
          </Link>
        </div>
      </button>
      <div className="flex flex-col gap-1.5 shrink-0 self-center">
        <button
          type="button"
          onClick={() => onInquiry?.(p)}
          className="text-[10px] font-bold px-2.5 py-2 rounded-lg bg-primary/90 text-black hover:brightness-110 whitespace-nowrap"
        >
          ⚡ Müraciət
        </button>
      </div>
    </div>
  )
}
