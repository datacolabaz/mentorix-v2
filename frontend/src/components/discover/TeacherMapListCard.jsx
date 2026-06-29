import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import InstructorAvatar from '../common/InstructorAvatar'
import { formatDistanceKm } from '../../lib/geo'
import {
  deliveryFormatBadges,
  showTopBadge,
  teacherRatingParts,
} from '../../lib/teacherMapCard'

export default function TeacherMapListCard({
  instructor: p,
  selected,
  highlighted,
  isNearest,
  distanceOrigin,
  comfortable = false,
  cardRef,
  onFocus,
  onInquiry,
  onWhatsApp,
  whatsappBusy,
}) {
  const { t } = useTranslation()
  const subjectLine =
    p.display_subject ||
    (Array.isArray(p.category_names) && p.category_names.length ? p.category_names.join(', ') : null) ||
    p.subject
  const rating = teacherRatingParts(p)
  const formats = deliveryFormatBadges(p)
  const topBadge = showTopBadge(p)

  const ratingLabel =
    rating && rating.count > 0
      ? t('marketplace.card.ratingLabel', { avg: rating.avg, count: rating.count })
      : rating?.label

  return (
    <div
      ref={cardRef}
      className={[
        'w-full rounded-xl border flex gap-2 md:gap-3 items-start transition-all duration-500',
        comfortable ? 'p-4' : 'p-3',
        highlighted
          ? 'border-emerald-400/70 bg-emerald-500/10 ring-2 ring-emerald-400/50 shadow-[0_0_18px_rgba(52,211,153,0.35)]'
          : selected
            ? 'border-primary/60 bg-primary/10 ring-1 ring-primary/30'
            : isNearest
              ? 'border-sky-500/35 bg-sky-500/5'
              : 'border-white/10 bg-[#121212]/90',
      ].join(' ')}
    >
      <button type="button" onClick={() => onFocus?.(p)} className="flex gap-2 flex-1 min-w-0 text-left">
        <InstructorAvatar
          fullName={p.full_name}
          avatarUrl={p.avatar_url}
          size="sm"
          kind={p.map_profile_kind}
          className="mt-0.5 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1 mb-1">
            {topBadge ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-300">
                {t('marketplace.card.topBadge')}
              </span>
            ) : null}
            {isNearest ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/25">
                {t('marketplace.card.nearest')}
              </span>
            ) : null}
            {p.is_featured_listing && !topBadge ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300">
                {t('marketplace.card.featured')}
              </span>
            ) : null}
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <span className={`font-semibold text-white truncate ${comfortable ? 'text-base' : 'text-sm'}`}>
              {p.full_name}
            </span>
            <span className="text-xs font-bold text-primary shrink-0 text-right tabular-nums">
              📍 {formatDistanceKm(p.distanceKm ?? p.distance_km)}
              <span className="block text-[10px] font-normal text-gray-500">
                {distanceOrigin === 'user' ? t('marketplace.card.fromYou') : t('marketplace.card.approximate')}
              </span>
            </span>
          </div>

          <div className={`text-gray-400 mt-0.5 truncate ${comfortable ? 'text-sm' : 'text-xs'}`}>
            {subjectLine || t('marketplace.card.noSubject')}
          </div>

          {rating ? (
            <div className="mt-1 flex items-center gap-1">
              <span className="text-amber-400 text-xs">⭐</span>
              <span className="text-[11px] text-amber-200/90 font-semibold tabular-nums">{ratingLabel}</span>
            </div>
          ) : (
            <p className="text-[11px] text-gray-500 mt-1">{t('marketplace.card.noReviews')}</p>
          )}

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
            <div className="text-[11px] text-emerald-400/90 mt-1">
              {t('marketplace.card.ratePerHour', { rate: p.discover_hourly_rate })}
            </div>
          ) : null}

          {p.next_available_slot ? (
            <div className="text-[10px] text-gray-500 mt-1 truncate">📅 {p.next_available_slot}</div>
          ) : null}

          <Link
            to={`/teachers/${p.id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-block text-[11px] font-semibold text-primary hover:underline mt-1.5"
          >
            {t('marketplace.card.viewProfile')}
          </Link>
        </div>
      </button>
      <div className="flex flex-col gap-1.5 shrink-0 self-center min-w-[6.5rem] sm:min-w-[7.5rem]">
        <button
          type="button"
          onClick={() => onInquiry?.(p)}
          className="text-[10px] font-bold px-2.5 py-2 rounded-lg bg-primary text-black hover:brightness-110 whitespace-nowrap"
        >
          {t('marketplace.card.trialLesson')}
        </button>
        <button
          type="button"
          disabled={whatsappBusy}
          onClick={() => onWhatsApp?.(p)}
          className={[
            'text-[10px] font-bold px-2.5 py-2 rounded-lg whitespace-nowrap disabled:opacity-50',
            'border border-[#25D366]/60 bg-[#075E54]/30 text-[#DCF8C6]',
            'hover:bg-[#128C7E]/40 hover:border-[#25D366]',
          ].join(' ')}
        >
          {t('marketplace.card.whatsapp')}
        </button>
      </div>
    </div>
  )
}
