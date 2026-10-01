import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Card from '../../components/common/Card'
import { DateTimeText, StatusBadge } from '../../components/engagement/EngagementParts'
import { TONE_CLASSES } from '../../lib/engagementCopy'
import { fetchAdminOperations } from '../../lib/dashboardSummary'
import { scheduleScrollToId } from '../../lib/scrollIntoAppView'

const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1'

function Section({ id, title, subtitle, unavailable, empty, count, children }) {
  const { t } = useTranslation()
  return (
    <Card id={id} role="region" className="p-4 sm:p-5 min-w-0 scroll-mt-4" aria-labelledby={`${id}-title`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="font-display text-base font-bold text-token-textMain break-words">
            {title}
          </h2>
          {subtitle ? <p className="mt-0.5 text-xs text-token-textMuted break-words">{subtitle}</p> : null}
        </div>
        {unavailable ? (
          <StatusBadge meta={{ icon: '?', tone: 'gray', label: t('dashboardSummary.status.unavailable') }} />
        ) : count ? (
          <StatusBadge meta={{ icon: '!', tone: 'red', label: t('adminOperations.failures', { count }) }} />
        ) : (
          <StatusBadge meta={{ icon: '✓', tone: 'green', label: t('adminOperations.noFailures') }} />
        )}
      </div>
      {unavailable ? (
        <p className="text-sm text-token-textMuted">{t('adminOperations.sectionUnavailable')}</p>
      ) : empty ? (
        <p className="text-sm text-token-textMuted">{t('adminOperations.empty')}</p>
      ) : (
        children
      )}
    </Card>
  )
}

function Table({ caption, head, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-token-textMuted">
            {head.map((h) => (
              <th key={h} scope="col" className="py-1.5 pr-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--border-subtle)]">{rows}</tbody>
      </table>
    </div>
  )
}

export default function AdminOperations() {
  const { t } = useTranslation()
  const location = useLocation()
  const [state, setState] = useState({ loading: true, error: false, ops: null })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: false }))
    try {
      const res = await fetchAdminOperations()
      setState({ loading: false, error: false, ops: res?.operations || null })
    } catch {
      setState({ loading: false, error: true, ops: null })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const hash = location.hash.replace('#', '')
  useEffect(() => {
    if (!hash || state.loading) return undefined
    return scheduleScrollToId(hash, { focus: false })
  }, [hash, state.loading])

  const { loading, error, ops } = state
  const security = ops?.security
  const email = ops?.email
  const jobs = ops?.jobs
  const authTotal = (security?.groups || []).reduce((s, g) => s + (Number(g.count) || 0), 0)

  return (
    <div className="p-4 sm:p-6 max-w-[1100px] mx-auto space-y-5" data-mentor-id="page:admin-operations">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-token-headingPrimary break-words">{t('adminOperations.title')}</h1>
          <p className="mt-1 text-sm text-token-textMuted break-words">{t('adminOperations.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin" className={`rounded-lg border border-[color:var(--border-subtle)] px-3 py-1.5 text-sm text-token-textMain ${FOCUS_RING}`}>
            {t('adminOperations.back')}
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className={`rounded-lg border border-primary/40 px-3 py-1.5 text-sm font-semibold text-emerald-700 [.theme-dark_&]:text-primary disabled:opacity-60 ${FOCUS_RING}`}
          >
            {t('adminOperations.refresh')}
          </button>
        </div>
      </div>

      {loading && !ops ? (
        <p role="status" className="py-12 text-center text-sm text-token-textMuted">
          {t('dashboardSummary.loading')}
        </p>
      ) : error ? (
        <div role="alert" className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm ${TONE_CLASSES.red}`}>
          <span>
            <span aria-hidden="true">! </span>
            {t('dashboardSummary.error')}
          </span>
          <button type="button" onClick={() => void load()} className={`rounded-lg border border-current px-2.5 py-1 text-xs font-semibold ${FOCUS_RING}`}>
            {t('dashboardSummary.retry')}
          </button>
        </div>
      ) : ops ? (
        <>
          <Section
            id="security"
            title={t('adminOperations.security.title')}
            subtitle={t('adminOperations.security.subtitle', { hours: security?.window_hours ?? 24 })}
            unavailable={!security}
            empty={!security?.groups?.length}
            count={authTotal}
          >
            <Table
              caption={t('adminOperations.security.title')}
              head={[t('adminOperations.cols.event'), t('adminOperations.cols.reason'), t('adminOperations.cols.count'), t('adminOperations.cols.last')]}
              rows={(security?.groups || []).map((g) => (
                <tr key={`${g.event}-${g.reason}`}>
                  <td className="py-1.5 pr-3 break-words">{t(`adminOperations.security.events.${g.event}`, { defaultValue: g.event })}</td>
                  <td className="py-1.5 pr-3 break-words text-token-textMuted">{g.reason}</td>
                  <td className="py-1.5 pr-3 font-semibold tabular-nums">{g.count}</td>
                  <td className="py-1.5 pr-3 text-token-textMuted"><DateTimeText iso={g.last_at} /></td>
                </tr>
              ))}
            />
            <p className="mt-2 text-[11px] text-token-textMuted">{t('adminOperations.security.privacy')}</p>
          </Section>

          <Section
            id="email"
            title={t('adminOperations.email.title')}
            subtitle={t('adminOperations.email.subtitle', { hours: email?.summary?.since_hours ?? 168 })}
            unavailable={!email}
            empty={!email?.recent?.length && !email?.summary?.total}
            count={email?.summary?.total ?? email?.recent?.length ?? 0}
          >
            {email?.summary?.groups?.length ? (
              <ul className="mb-3 flex flex-wrap gap-1.5">
                {email.summary.groups.map((g) => (
                  <li key={`${g.error_code}-${g.template}`} className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${TONE_CLASSES.red}`}>
                    {g.template || '—'} · {g.error_code} · {g.count}
                  </li>
                ))}
              </ul>
            ) : null}
            <Table
              caption={t('adminOperations.email.title')}
              head={[t('adminOperations.cols.template'), t('adminOperations.cols.error'), t('adminOperations.cols.retries'), t('adminOperations.cols.failedAt')]}
              rows={(email?.recent || []).map((r) => (
                <tr key={r.id}>
                  <td className="py-1.5 pr-3 break-words">{r.template_key || r.event_type || '—'}</td>
                  <td className="py-1.5 pr-3 break-words text-token-textMuted">{[r.error_code, r.error_message_safe].filter(Boolean).join(' — ') || '—'}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{r.retry_count}</td>
                  <td className="py-1.5 pr-3 text-token-textMuted"><DateTimeText iso={r.failed_at} /></td>
                </tr>
              ))}
            />
            <p className="mt-2 text-[11px] text-token-textMuted">{t('adminOperations.email.privacy')}</p>
          </Section>

          <Section
            id="jobs"
            title={t('adminOperations.jobs.title')}
            subtitle={t('adminOperations.jobs.subtitle', { days: jobs?.window_days ?? 7 })}
            unavailable={!jobs}
            empty={!jobs?.recent?.length}
            count={jobs?.recent?.length ?? 0}
          >
            <Table
              caption={t('adminOperations.jobs.title')}
              head={[t('adminOperations.cols.job'), t('adminOperations.cols.error'), t('adminOperations.cols.failedAt')]}
              rows={(jobs?.recent || []).map((j) => (
                <tr key={j.id}>
                  <td className="py-1.5 pr-3 break-words">{t('adminOperations.jobs.openGrading')}</td>
                  <td className="py-1.5 pr-3 break-words text-token-textMuted">{j.error || '—'}</td>
                  <td className="py-1.5 pr-3 text-token-textMuted"><DateTimeText iso={j.processed_at} /></td>
                </tr>
              ))}
            />
          </Section>

          {ops.omitted?.length ? (
            <Card className="p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-token-textMain">{t('adminOperations.omitted.title')}</h2>
              <ul className="mt-2 space-y-1 text-sm text-token-textMuted">
                {ops.omitted.map((o) => (
                  <li key={o.key} className="break-words">
                    <span aria-hidden="true">○ </span>
                    {t(`adminOperations.omitted.${o.key}`)}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
