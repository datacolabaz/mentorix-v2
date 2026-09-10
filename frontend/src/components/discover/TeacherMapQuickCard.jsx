import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import InstructorAvatar from '../common/InstructorAvatar'
import { formatDistanceKm } from '../../lib/geo'
import { showTopBadge } from '../../lib/teacherMapCard'
import { instructorDisplaySubject } from '../../lib/instructorDisplay'
import useActiveLocale from '../../hooks/useActiveLocale'

export default function TeacherMapQuickCard({
  instructor: p,
  distanceOrigin,
  onInquiry,
  onWhatsApp,
  onFocusMap,
  onClose,
  whatsappBusy,
}) {
  const { t } = useTranslation()
  const locale = useActiveLocale()
  if (!p) return null
  const subjectLine = instructorDisplaySubject(p, locale) || p.subject
  const topBadge = showTopBadge(p)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-md">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
            {t('marketplace.card.quickView')}
          </p>
          {topBadge ? (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700">
              {t('marketplace.card.topBadge')}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onFocusMap?.(p)}
            className="text-[11px] font-semibold text-emerald-700 hover:underline"
          >
            {t('marketplace.card.showOnMap')}
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('marketplace.card.close')}
              className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 text-sm leading-none"
            >
              ×
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex gap-3">
        <InstructorAvatar
          fullName={p.full_name}
          avatarUrl={p.avatar_url}
          size="md"
          kind={p.map_profile_kind}
          className="shrink-0"
          showPresence
          isOnline={p.is_online}
          lastActivityAt={p.last_activity_at}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-display font-bold text-base text-slate-900 truncate">{p.full_name}</h3>
              <p className="text-sm font-semibold text-slate-600 mt-0.5 truncate">
                {subjectLine || t('marketplace.card.noSubject')}
              </p>
            </div>
            <div className="shrink-0 text-right">
              {p.discover_hourly_rate != null ? (
                <p className="text-sm font-medium tabular-nums text-slate-700">
                  {t('marketplace.card.ratePerHour', { rate: p.discover_hourly_rate })}
                </p>
              ) : null}
              {p.distanceKm != null || p.distance_km != null ? (
                <span className="block text-[10px] font-normal text-slate-400">
                  {formatDistanceKm(p.distanceKm ?? p.distance_km)}{' '}
                  {distanceOrigin === 'user' ? t('marketplace.card.fromYou') : t('marketplace.card.approximate')}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onInquiry?.(p)}
          className="w-full rounded-xl bg-primary text-[#041018] font-bold text-sm py-2.5 hover:brightness-95"
        >
          {t('marketplace.profile.trialCta')}
        </button>
        <button
          type="button"
          disabled={whatsappBusy}
          onClick={() => onWhatsApp?.(p)}
          className="w-full rounded-xl font-bold text-sm py-2.5 transition-all disabled:opacity-50 border border-[#25D366]/50 bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20"
        >
          {t('marketplace.card.whatsapp')}
        </button>
      </div>

      <Link to={`/teachers/${p.id}`} className="inline-block mt-3 text-[12px] font-semibold text-emerald-700 hover:underline">
        {t('marketplace.card.viewProfile')}
      </Link>
    </div>
  )
}
