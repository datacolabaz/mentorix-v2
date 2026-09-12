import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import InstructorAvatar from '../common/InstructorAvatar'
import { deliveryFormatBadges, showTopBadge, teacherRatingParts } from '../../lib/teacherMapCard'
import { instructorDisplaySubject } from '../../lib/instructorDisplay'
import { localizeNextSlotLabel } from '../../lib/marketplaceLocale'
import useActiveLocale from '../../hooks/useActiveLocale'
import { bakuMetroBySlug } from '@shared/bakuMetroStations.mjs'

export default function TeacherMapListCard({
  instructor: p,
  selected,
  highlighted,
  locationBadge,
  comfortable = false,
  cardRef,
  onFocus,
  onInquiry,
  onWhatsApp,
  whatsappBusy,
}) {
  const { t } = useTranslation()
  const locale = useActiveLocale()
  const subjectLine = instructorDisplaySubject(p, locale) || p.subject
  const rating = teacherRatingParts(p, t)
  const formats = deliveryFormatBadges(p, locale)
  const topBadge = showTopBadge(p)
  const districtLabel =
    p.region_user_set && (locationBadge || p.baku_district || p.region)
      ? locationBadge || p.baku_district || p.region
      : null
  const metroLabel = p.nearest_metro
    ? bakuMetroBySlug(p.nearest_metro)?.name_az || p.nearest_metro
    : null
  const slotLabel = p.next_available_slot ? localizeNextSlotLabel(p.next_available_slot, locale) : null
  const ratingLabel =
    rating && rating.count > 0
      ? t('marketplace.card.ratingLabel', { avg: rating.avg, count: rating.count })
      : rating?.label
  const hasHoverDetails = Boolean(
    rating || districtLabel || metroLabel || slotLabel || formats.length || p.teacher_place_address,
  )

  return (
    <div
      ref={cardRef}
      className={[
        'group relative w-full max-w-full rounded-2xl border bg-white shadow-sm flex flex-col gap-3 sm:flex-row sm:items-start transition-all duration-300',
        comfortable ? 'p-3.5 sm:p-4' : 'p-3',
        highlighted
          ? 'border-emerald-400 ring-2 ring-emerald-300/70 shadow-md'
          : selected
            ? 'border-primary/50 ring-1 ring-primary/25 shadow-md'
            : 'border-slate-200 hover:border-slate-300 hover:shadow-md',
      ].join(' ')}
    >
      <button type="button" onClick={() => onFocus?.(p)} className="flex gap-3 flex-1 min-w-0 text-left">
        <InstructorAvatar
          fullName={p.full_name}
          avatarUrl={p.avatar_url}
          size="sm"
          kind={p.map_profile_kind}
          className="mt-0.5 shrink-0"
          showPresence
          isOnline={p.is_online}
          lastActivityAt={p.last_activity_at}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0">
              {topBadge ? (
                <span className="mb-1 inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700">
                  {t('marketplace.card.topBadge')}
                </span>
              ) : p.is_featured_listing ? (
                <span className="mb-1 inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">
                  {t('marketplace.card.featured')}
                </span>
              ) : null}
              <h3
                className={`font-display font-bold text-slate-900 break-words [overflow-wrap:anywhere] sm:truncate ${comfortable ? 'text-base' : 'text-sm'}`}
              >
                {p.full_name}
              </h3>
              <p
                className={`mt-0.5 font-semibold text-slate-600 break-words [overflow-wrap:anywhere] sm:truncate ${comfortable ? 'text-sm' : 'text-xs'}`}
              >
                {subjectLine || t('marketplace.card.noSubject')}
              </p>
            </div>
            {p.discover_hourly_rate != null ? (
              <p className="shrink-0 text-left sm:text-right text-sm font-medium tabular-nums text-slate-700 leading-tight">
                {t('marketplace.card.ratePerHour', { rate: p.discover_hourly_rate })}
              </p>
            ) : null}
          </div>

          <Link
            to={`/teachers/${p.id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-block text-[12px] font-semibold text-emerald-700 hover:underline mt-2"
          >
            {t('marketplace.card.viewProfile')}
          </Link>
        </div>
      </button>

      <div className="grid grid-cols-2 gap-1.5 w-full sm:flex sm:flex-col sm:w-auto sm:shrink-0 sm:self-center sm:min-w-[7.5rem]">
        <button
          type="button"
          onClick={() => onInquiry?.(p)}
          className="text-[11px] font-bold px-2.5 py-2 rounded-lg bg-primary text-[#041018] hover:brightness-95 whitespace-nowrap"
        >
          {t('marketplace.card.trialLesson')}
        </button>
        <button
          type="button"
          disabled={whatsappBusy}
          onClick={() => onWhatsApp?.(p)}
          className="text-[11px] font-bold px-2.5 py-2 rounded-lg whitespace-nowrap disabled:opacity-50 border border-[#25D366]/50 bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20"
        >
          {t('marketplace.card.whatsapp')}
        </button>
      </div>

      {hasHoverDetails ? (
        <div
          className="pointer-events-none absolute left-3 right-3 bottom-full z-30 mb-1 hidden rounded-xl border border-slate-200 bg-white p-3 text-[11px] text-slate-600 shadow-lg group-hover:block"
          role="tooltip"
        >
          {rating ? (
            <p className="font-semibold text-slate-800">⭐ {ratingLabel}</p>
          ) : (
            <p>{t('marketplace.card.noReviews')}</p>
          )}
          {districtLabel ? <p className="mt-1 truncate">📍 {districtLabel}</p> : null}
          {metroLabel ? <p className="mt-1 truncate">🚇 {metroLabel}</p> : null}
          {p.teacher_place_address ? (
            <p className="mt-1 truncate">{p.teacher_place_address}</p>
          ) : null}
          {slotLabel ? <p className="mt-1 truncate">📅 {slotLabel}</p> : null}
          {formats.length ? <p className="mt-1 truncate">{formats.join(' · ')}</p> : null}
          <p className="mt-1.5 text-[10px] text-slate-400">{t('marketplace.card.viewProfile')}</p>
        </div>
      ) : null}
    </div>
  )
}
