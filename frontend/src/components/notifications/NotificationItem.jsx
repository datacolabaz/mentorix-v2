import { useTranslation } from 'react-i18next'
import NavIcon from '../common/NavIcon'
import { formatDateTime, isoDateTime } from '../../lib/formatDateTime'
import { categoryIconName, isHighPriority, notificationText } from '../../lib/notificationPresentation'

/**
 * One notification rendered as a single button (no nested interactive elements).
 * Secondary actions (mark read) must be rendered as siblings by the parent.
 */
export default function NotificationItem({ notification: n, onOpen, compact = false, busy = false }) {
  const { t, i18n } = useTranslation()
  const { title, body } = notificationText(n, t)
  const high = isHighPriority(n.priority)
  const categoryLabel = t(`notificationCenter.categories.${n.category}`, { defaultValue: n.category })
  const when = formatDateTime(n.created_at, i18n.language)

  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      disabled={busy}
      aria-busy={busy || undefined}
      className={[
        'group w-full text-left flex items-start gap-3 rounded-xl border transition-colors',
        compact ? 'p-3' : 'p-4',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--surface-card))]',
        n.is_read
          ? 'border-[color:var(--border-subtle)] bg-transparent hover:bg-token-surfaceCardHover/60'
          : 'border-primary/30 bg-primary/[0.06] hover:bg-primary/[0.1]',
        busy ? 'opacity-70 cursor-wait' : '',
      ].join(' ')}
    >
      <span
        className={[
          'mt-0.5 w-9 h-9 shrink-0 rounded-lg flex items-center justify-center border',
          high
            ? 'border-rose-500/40 bg-rose-500/10 text-rose-600 [.theme-dark_&]:text-rose-300'
            : 'border-[color:var(--border-subtle)] bg-token-surfaceMain/60 text-token-textMuted',
        ].join(' ')}
        aria-hidden
      >
        <NavIcon name={categoryIconName(n.category)} className="w-[18px] h-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`text-sm break-words text-token-textMain ${n.is_read ? 'font-medium' : 'font-semibold'}`}>
            {title || t('notificationCenter.untitled')}
          </span>
          {!n.is_read ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-token-textMain">
              <span className="w-2 h-2 rounded-full bg-primary" aria-hidden />
              {t('notificationCenter.unread')}
            </span>
          ) : null}
          {high ? (
            <span className="inline-flex items-center rounded-full border border-rose-500/40 px-2 py-0.5 text-[11px] font-semibold text-rose-700 [.theme-dark_&]:text-rose-300">
              {t(n.priority === 'CRITICAL' ? 'notificationCenter.priority.critical' : 'notificationCenter.priority.high')}
            </span>
          ) : null}
        </span>
        {body ? (
          <span
            className={[
              'block text-sm text-token-textMuted mt-1 break-words',
              compact ? 'line-clamp-2' : 'whitespace-pre-wrap',
            ].join(' ')}
          >
            {body}
          </span>
        ) : null}
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-token-textMuted">
          <span>{categoryLabel}</span>
          {when ? (
            <>
              <span aria-hidden>·</span>
              <time dateTime={isoDateTime(n.created_at)}>{when}</time>
            </>
          ) : null}
        </span>
      </span>
    </button>
  )
}
