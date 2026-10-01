import { useTranslation } from 'react-i18next'
import { BAR_CLASSES, SUBTLE_BG, TONE_CLASSES, TONE_TEXT, initials, progressTone } from '../../lib/engagementCopy'
import { isRecentActivity, relativeTimeParts, stackPeople } from '../../lib/activityCards'
import { formatDateTime, isoDateTime } from '../../lib/formatDateTime'

/** meta: { icon, tone, label } və ya { icon, tone, labelKey } (i18n). */
export function StatusBadge({ meta, className = '' }) {
  const { t } = useTranslation()
  if (!meta) return null
  const label = meta.labelKey ? t(meta.labelKey, meta.label || '') : meta.label
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold max-w-full ${TONE_CLASSES[meta.tone]} ${className}`}
    >
      <span aria-hidden="true">{meta.icon}</span>
      <span className="min-w-0 break-words">{label}</span>
    </span>
  )
}

export function ProgressBar({ pct, label }) {
  const value = Math.max(0, Math.min(100, Number(pct) || 0))
  return (
    <div
      className={`h-1.5 w-full rounded-full ${SUBTLE_BG} overflow-hidden`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={`h-full rounded-full ${BAR_CLASSES[progressTone(value)]}`} style={{ width: `${value}%` }} />
    </div>
  )
}

const AVATAR_COLORS = ['bg-sky-600', 'bg-emerald-600', 'bg-violet-600', 'bg-amber-600', 'bg-rose-600', 'bg-teal-600']

function colorFor(id) {
  const s = String(id || '')
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function Avatar({ id, name, size = 'sm' }) {
  const dim = size === 'md' ? 'h-8 w-8 text-xs' : 'h-6 w-6 text-[10px]'
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 ${dim} items-center justify-center rounded-full font-bold text-white ring-2 ring-token-surfaceCard ${colorFor(id)}`}
    >
      {initials(name)}
    </span>
  )
}

/** Ən çox 4 baş hərf + «+N». Ekran oxuyucusu üçün adlar siyahı kimi oxunur. */
export function AvatarStack({ people = [], more = 0, label }) {
  const { t } = useTranslation()
  const { shown, more: rest } = stackPeople(people, more)
  if (!shown.length) return null
  const names = shown.map((p) => p.full_name).filter(Boolean).join(', ')
  return (
    <span className="flex items-center -space-x-1.5" role="img" aria-label={[label, names, rest ? t('activity.common.more', { count: rest }) : ''].filter(Boolean).join(': ')}>
      {shown.map((p) => (
        <Avatar key={p.student_id} id={p.student_id} name={p.full_name} />
      ))}
      {rest > 0 ? (
        <span className="inline-flex h-6 min-w-6 px-1 items-center justify-center rounded-full bg-slate-500/20 text-[10px] font-bold text-token-textMain ring-2 ring-token-surfaceCard">
          +{rest}
        </span>
      ) : null}
    </span>
  )
}

export function CountChip({ tone, icon, children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[tone]}`}>
      <span aria-hidden="true">{icon}</span>
      {children}
    </span>
  )
}

/** Kart sətirləri: «17 tamamlayıb». Rəng + ikon + mətn birlikdə (rəng tək siqnal deyil). */
export function StatLines({ type, lines, columns = 2 }) {
  const { t } = useTranslation()
  return (
    <ul className={`grid gap-x-3 gap-y-1 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {lines.map((l) => (
        <li key={l.key} className="flex items-baseline gap-1.5 text-[13px] min-w-0">
          <span aria-hidden="true" className={`w-3.5 shrink-0 text-center text-[11px] ${TONE_TEXT[l.tone]}`}>
            {l.icon}
          </span>
          <span className={`font-bold tabular-nums ${l.count ? TONE_TEXT[l.tone] : 'text-token-textMuted'}`}>{l.count}</span>
          <span className={`min-w-0 break-words ${l.count ? 'text-token-textMain' : 'text-token-textMuted'}`}>
            {t(`activity.lines.${type}.${l.key}`)}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** «5 dəq əvvəl» / «dünən» / 7 gündən köhnə: `29.09.2026, 21:34`. Tam tarix həmişə title-da. */
export function RelativeTime({ iso, now }) {
  const { t, i18n } = useTranslation()
  const p = relativeTimeParts(iso, now || new Date())
  if (p.key === 'none') return <span>{t('activity.time.none')}</span>
  const full = formatDateTime(iso, i18n.language)
  const text = p.key === 'date' ? full : t(`activity.time.${p.key}`, { count: p.count })
  return (
    <time dateTime={isoDateTime(iso)} title={full}>
      {text}
    </time>
  )
}

export function LastActivity({ iso, className = '' }) {
  const { t } = useTranslation()
  const recent = isRecentActivity(iso)
  const [before, after = ''] = t('activity.common.lastActivity', { time: '\u0000' }).split('\u0000')
  return (
    <span
      className={`text-[11px] ${recent ? 'text-sky-700 [.theme-dark_&]:text-sky-300 font-semibold' : 'text-token-textMuted'} ${className}`}
    >
      {recent ? <span aria-hidden="true">● </span> : null}
      {before}
      <RelativeTime iso={iso} />
      {after}
    </span>
  )
}

/** Mütləq tarix: az `29.09.2026, 21:34`, en `Sep 29, 2026, 21:34`. */
export function DateTimeText({ iso, fallback = '—' }) {
  const { i18n } = useTranslation()
  const text = formatDateTime(iso, i18n.language)
  return text ? <time dateTime={isoDateTime(iso)}>{text}</time> : <span>{fallback}</span>
}

/** Popover/hesabat daxilində ad siyahısı (interaktiv element yoxdur). */
export function NameGroup({ title, icon, tone = 'gray', students, renderMeta, emptyText, limit = 5 }) {
  const { t } = useTranslation()
  if (!students.length && !emptyText) return null
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-token-textMuted mb-1">
        {icon ? (
          <span aria-hidden="true" className={TONE_TEXT[tone]}>
            {icon}{' '}
          </span>
        ) : null}
        {title} ({students.length})
      </p>
      {students.length ? (
        <ul className="space-y-1">
          {students.slice(0, limit).map((s) => (
            <li key={s.student_id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{s.full_name}</span>
              {renderMeta ? <span className="shrink-0 text-[11px] text-token-textMuted">{renderMeta(s)}</span> : null}
            </li>
          ))}
          {students.length > limit ? (
            <li className="text-[11px] text-token-textMuted">{t('activity.common.more', { count: students.length - limit })}</li>
          ) : null}
        </ul>
      ) : (
        <p className="text-xs text-token-textMuted">{emptyText}</p>
      )}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-[color:var(--border-subtle)] p-4 space-y-3 animate-pulse" aria-hidden="true">
      <div className="flex gap-3">
        <div className={`h-9 w-9 rounded-xl ${SUBTLE_BG}`} />
        <div className="flex-1 space-y-2">
          <div className={`h-3.5 w-2/3 rounded ${SUBTLE_BG}`} />
          <div className={`h-3 w-1/3 rounded ${SUBTLE_BG}`} />
        </div>
      </div>
      <div className={`h-1.5 rounded ${SUBTLE_BG}`} />
      <div className={`h-3 w-1/2 rounded ${SUBTLE_BG}`} />
    </div>
  )
}

/** Siyahı səhifələrindəki kart zolağı yüklənərkən. */
export function StripSkeleton() {
  return (
    <div className="space-y-2 animate-pulse" aria-hidden="true">
      <div className={`h-3 w-1/3 rounded ${SUBTLE_BG}`} />
      <div className={`h-1.5 rounded ${SUBTLE_BG}`} />
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-3 rounded ${SUBTLE_BG}`} />
        ))}
      </div>
    </div>
  )
}
