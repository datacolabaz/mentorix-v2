import { Link } from 'react-router-dom'
import InstructorAvatar from '../common/InstructorAvatar'
import { formatDistanceKm } from '../../lib/geo'
import {
  deliveryFormatBadges,
  formatStudentCount,
  teacherRatingParts,
} from '../../lib/teacherMapCard'

function kindLabel(k) {
  if (k === 'trainer') return 'Təlimçi'
  return 'Müəllim'
}

export default function TeacherMapQuickCard({
  instructor: p,
  distanceOrigin,
  onInquiry,
  onWhatsApp,
  onFocusMap,
  whatsappBusy,
}) {
  if (!p) return null
  const subjectLine =
    p.display_subject ||
    (Array.isArray(p.category_names) && p.category_names.length ? p.category_names.join(', ') : null) ||
    p.subject
  const rating = teacherRatingParts(p)
  const studentLine = formatStudentCount(p.active_student_count)
  const formats = deliveryFormatBadges(p)

  return (
    <div className="rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-br from-emerald-500/10 via-[#121212] to-[#121212] p-4 shadow-[0_0_24px_rgba(52,211,153,0.12)]">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Tez baxış</p>
        <button
          type="button"
          onClick={() => onFocusMap?.(p)}
          className="text-[11px] font-semibold text-primary hover:underline"
        >
          Xəritədə göstər →
        </button>
      </div>

      <div className="flex gap-3">
        <InstructorAvatar
          fullName={p.full_name}
          avatarUrl={p.avatar_url}
          size="md"
          kind={p.map_profile_kind}
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-display font-bold text-base text-white truncate">{p.full_name}</h3>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{subjectLine || 'Fənn göstərilməyib'}</p>
              {rating ? (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="text-amber-400 text-sm leading-none" aria-hidden>
                    ⭐
                  </span>
                  <span className="text-sm font-bold text-amber-300 tabular-nums">{rating.label}</span>
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-gray-500">
                  <span className="text-amber-500/80">⭐</span> Hələ rəy yoxdur
                </p>
              )}
            </div>
            <span className="text-xs font-bold text-primary shrink-0 text-right">
              {formatDistanceKm(p.distanceKm ?? p.distance_km)}
              <span className="block text-[10px] font-normal text-gray-500">
                {distanceOrigin === 'user' ? 'sizdən' : 'təxmini'}
              </span>
            </span>
          </div>

          {p.discover_hourly_rate != null ? (
            <p className="text-sm font-semibold text-emerald-400 mt-2">{p.discover_hourly_rate} AZN/saat</p>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-1.5">
            {studentLine ? (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-white/5 text-gray-300 border border-white/10">
                👥 {studentLine}
              </span>
            ) : null}
            {p.discover_verified ? (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                Təsdiqlənmiş
              </span>
            ) : null}
          </div>

          {formats.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {formats.map((lab) => (
                <span
                  key={lab}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-200 border border-blue-500/20"
                >
                  {lab}
                </span>
              ))}
            </div>
          ) : null}

          {p.next_available_slot ? (
            <p className="text-[11px] text-gray-300 mt-2">
              📅 Növbəti boş vaxt:{' '}
              <span className="font-semibold text-white">{p.next_available_slot}</span>
            </p>
          ) : (
            <p className="text-[11px] text-gray-500 mt-2">📅 Boş vaxt üçün müraciət göndərin</p>
          )}

          {p.teacher_place_address_short ? (
            <p className="text-[11px] text-gray-400 mt-1 truncate">📍 {p.teacher_place_address_short}</p>
          ) : null}

          {p.latest_review_snippet ? (
            <blockquote className="mt-3 text-[11px] text-gray-400 border-l-2 border-white/15 pl-2 italic leading-relaxed line-clamp-2">
              “{p.latest_review_snippet}”
            </blockquote>
          ) : null}

          <p className="text-[10px] text-gray-600 mt-2">{kindLabel(p.map_profile_kind)}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onInquiry?.(p)}
          className="w-full rounded-xl bg-primary text-black font-bold text-sm py-2.5 hover:brightness-110 transition-all shadow-lg shadow-primary/20"
        >
          ⚡ Sınaq dərsi — müraciət
        </button>
        <button
          type="button"
          disabled={whatsappBusy}
          onClick={() => onWhatsApp?.(p)}
          className={[
            'w-full rounded-xl font-bold text-sm py-2.5 transition-all disabled:opacity-50',
            'border-2 border-[#25D366]/70 bg-[#075E54]/35 text-[#DCF8C6]',
            'hover:bg-[#128C7E]/45 hover:border-[#25D366] hover:shadow-[0_0_16px_rgba(37,211,102,0.25)]',
            'active:scale-[0.99]',
          ].join(' ')}
        >
          💬 WhatsApp-da yaz
        </button>
      </div>

      <Link
        to={`/teachers/${p.id}`}
        className="inline-block mt-3 text-[11px] font-semibold text-primary hover:underline"
      >
        Tam profilə bax →
      </Link>
    </div>
  )
}
