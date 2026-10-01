import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DateTimeText, RelativeTime, StatusBadge } from '../engagement/EngagementParts'
import { HOVER_BG, SUBTLE_BG, TONE_CLASSES, TONE_TEXT } from '../../lib/engagementCopy'
import {
  ACTIVITY_BUCKET_ICONS,
  ITEM_ICONS,
  JOIN_STATUS,
  attentionCount,
  fetchDashboardSummary,
  itemDetail,
  itemStatus,
} from '../../lib/dashboardSummary'

const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1'
const REFRESH_MS = 60_000

/** Bir sorğu, 60 saniyədən bir yenilənir; qrup dəyişəndə köhnə cavab yazılmır. */
export function useDashboardSummary({ enrollmentId = '', fetcher = fetchDashboardSummary } = {}) {
  const [state, setState] = useState({ loading: true, error: false, summary: null })
  const seq = useRef(0)

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      const mine = ++seq.current
      if (!quiet) setState((s) => ({ ...s, loading: true, error: false }))
      try {
        const res = await fetcher(enrollmentId)
        if (mine !== seq.current) return
        setState({ loading: false, error: false, summary: res?.summary || null })
      } catch {
        if (mine !== seq.current) return
        setState((s) => ({ loading: false, error: !s.summary || !quiet, summary: quiet ? s.summary : null }))
      }
    },
    [enrollmentId, fetcher],
  )

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load({ quiet: true }), REFRESH_MS)
    return () => {
      seq.current += 1
      window.clearInterval(timer)
    }
  }, [load])

  return { ...state, reload: load }
}

/** «… {{date}} …» mətnində tarixi <time> ilə yazır. */
function TextWithDate({ text, iso }) {
  const [before, after = ''] = text.split('\u0000')
  return (
    <>
      {before}
      <DateTimeText iso={iso} />
      {after}
    </>
  )
}

export function SummaryItemCard({ item }) {
  const { t } = useTranslation()
  const status = itemStatus(item)
  const detail = itemDetail(item)
  const label = t(`dashboardSummary.items.${item.key}`)
  const unavailable = status.key === 'unavailable'
  const statusText = t(`dashboardSummary.status.${status.key}`)
  const countText = unavailable ? '—' : String(item.count)
  const detailText = detail ? t(detail.key, { ...detail.values, date: '\u0000' }) : ''
  return (
    <li className="min-w-0">
      <Link
        to={item.href}
        aria-label={`${label}: ${countText}. ${statusText}`}
        className={`flex h-full min-w-0 items-start gap-3 rounded-2xl border border-[color:var(--border-subtle)] bg-token-surfaceCard p-3 sm:p-4 transition-colors ${HOVER_BG} ${FOCUS_RING}`}
      >
        <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg ${SUBTLE_BG}`}>
          {ITEM_ICONS[item.key] || '•'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0 break-words text-sm font-semibold leading-snug text-token-textMain">{label}</span>
            <span
              aria-hidden="true"
              className={`shrink-0 font-display text-2xl font-bold leading-none tabular-nums ${
                item.count ? TONE_TEXT[status.tone] : 'text-token-textMuted'
              }`}
            >
              {countText}
            </span>
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <StatusBadge meta={{ icon: status.icon, tone: status.tone, label: statusText }} />
            {detail ? (
              <span className="min-w-0 break-words text-[11px] leading-snug text-token-textMuted">
                {detail.dateIso ? <TextWithDate text={detailText} iso={detail.dateIso} /> : detailText}
              </span>
            ) : null}
          </span>
        </span>
      </Link>
    </li>
  )
}

function SkeletonGrid({ count = 6 }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex animate-pulse gap-3 rounded-2xl border border-[color:var(--border-subtle)] p-4">
          <span className={`h-9 w-9 rounded-xl ${SUBTLE_BG}`} />
          <span className="flex-1 space-y-2">
            <span className={`block h-3.5 w-2/3 rounded ${SUBTLE_BG}`} />
            <span className={`block h-3 w-1/3 rounded ${SUBTLE_BG}`} />
          </span>
        </li>
      ))}
    </ul>
  )
}

function RecentActivity({ activity }) {
  const { t } = useTranslation()
  if (!activity) return null
  const buckets = Object.entries(activity.counts || {}).filter(([, n]) => n > 0)
  return (
    <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-token-surfaceCard p-4 min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-token-textMain">{t('dashboardSummary.activity.title')}</h3>
        <Link to="/instructor/engagement" className={`rounded text-xs font-semibold text-emerald-700 [.theme-dark_&]:text-primary hover:underline ${FOCUS_RING}`}>
          {t('dashboardSummary.activity.open')}
        </Link>
      </div>
      {activity.total ? (
        <>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t('dashboardSummary.activity.countsLabel')}>
            {buckets.map(([k, n]) => (
              <li key={k} className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${TONE_CLASSES.blue}`}>
                <span aria-hidden="true">{ACTIVITY_BUCKET_ICONS[k]}</span>
                <span className="break-words">{t(`dashboardSummary.activity.buckets.${k}`, { count: n })}</span>
              </li>
            ))}
          </ul>
          {activity.capped ? <p className="mt-1 text-[11px] text-token-textMuted">{t('dashboardSummary.activity.capped')}</p> : null}
          {activity.latest?.length ? (
            <ul className="mt-3 divide-y divide-[color:var(--border-subtle)]">
              {activity.latest.map((e, i) => (
                <li key={`${e.entity_id}-${e.at}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5 text-[13px]">
                  <span className="min-w-0 break-words text-token-textMain">
                    <span className="font-semibold">{e.student_name || t('dashboardSummary.activity.student')}</span>{' '}
                    <span className="text-token-textMuted">{t(`dashboardSummary.activity.events.${e.event_type}`, { defaultValue: e.event_type })}</span>
                    {e.entity_title ? <span> · {e.entity_title}</span> : null}
                  </span>
                  <span className="shrink-0 text-[11px] text-token-textMuted">
                    <RelativeTime iso={e.at} />
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-xs text-token-textMuted">{t('dashboardSummary.activity.empty')}</p>
      )}
    </div>
  )
}

function GroupJoinStatus({ join }) {
  const { t } = useTranslation()
  if (!join || !join.requests?.length) return null
  return (
    <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-token-surfaceCard p-4 min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-token-textMain">{t('dashboardSummary.join.title')}</h3>
        <Link to={join.href || '/student/groups'} className={`rounded text-xs font-semibold text-emerald-700 [.theme-dark_&]:text-primary hover:underline ${FOCUS_RING}`}>
          {t('dashboardSummary.join.open')}
        </Link>
      </div>
      <ul className="mt-2 space-y-1.5">
        {join.requests.map((r, i) => {
          const meta = JOIN_STATUS[r.status] || JOIN_STATUS.pending
          return (
            <li key={`${r.group_name}-${r.at}-${i}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px]">
              <span className="min-w-0 break-words font-medium text-token-textMain">{r.group_name || t('dashboardSummary.join.group')}</span>
              <span className="flex flex-wrap items-center gap-2">
                <StatusBadge meta={{ ...meta, label: t(`dashboardSummary.join.status.${r.status}`) }} />
                <span className="text-[11px] text-token-textMuted">
                  <DateTimeText iso={r.at} />
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Dashboard xülasə bölməsi. role: 'admin' | 'teacher' | 'student'.
 * summary/loading/error kənardan verilə bilər (testlər), əks halda öz sorğusunu edir.
 */
export default function DashboardSummary({ role, enrollmentId = '', className = '', fetcher }) {
  const { t } = useTranslation()
  const { loading, error, summary, reload } = useDashboardSummary({ enrollmentId, fetcher })
  const items = summary?.items || []
  const attention = attentionCount(items)
  const headingId = `dash-summary-${role}`

  return (
    <section aria-labelledby={headingId} aria-busy={loading} className={`min-w-0 w-full ${className}`} data-testid="dashboard-summary">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 id={headingId} className="font-display text-base font-bold text-token-textMain break-words">
            {t(`dashboardSummary.title.${role}`)}
          </h2>
          <p className="mt-0.5 text-xs text-token-textMuted break-words">{t(`dashboardSummary.subtitle.${role}`)}</p>
        </div>
        {!loading && !error && summary ? (
          attention ? (
            <StatusBadge meta={{ icon: '!', tone: 'yellow', label: t('dashboardSummary.attention', { count: attention }) }} />
          ) : (
            <StatusBadge meta={{ icon: '✓', tone: 'green', label: t('dashboardSummary.allClear') }} />
          )
        ) : null}
      </div>

      {loading && !summary ? (
        <>
          <span className="sr-only" role="status">{t('dashboardSummary.loading')}</span>
          <SkeletonGrid count={role === 'admin' ? 5 : 6} />
        </>
      ) : error ? (
        <div role="alert" className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm ${TONE_CLASSES.red}`}>
          <span className="break-words">
            <span aria-hidden="true">! </span>
            {t('dashboardSummary.error')}
          </span>
          <button
            type="button"
            onClick={() => void reload()}
            className={`rounded-lg border border-current px-2.5 py-1 text-xs font-semibold ${FOCUS_RING}`}
          >
            {t('dashboardSummary.retry')}
          </button>
        </div>
      ) : summary ? (
        <div className="space-y-3">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
            {items.map((it) => (
              <SummaryItemCard key={it.key} item={it} />
            ))}
          </ul>
          {role === 'teacher' ? <RecentActivity activity={summary.recent_activity} /> : null}
          {role === 'student' ? <GroupJoinStatus join={summary.group_join} /> : null}
          {role === 'admin' ? (
            <p className="text-[11px] text-token-textMuted break-words">{t('dashboardSummary.admin.aggregateNote')}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
