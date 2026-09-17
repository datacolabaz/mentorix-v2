import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { smsUsageDisplay, storageUsageFromBilling } from '../../lib/billingUsageDisplay'
import { basicTrialCountdownText } from '../../lib/basicTrialCopy'

function fmtStorageMbPair(billing) {
  const lim = billing?.limits || {}
  const used = billing?.usage || {}
  const byteCap = lim.storage_limit_bytes
  if (byteCap != null && Number.isFinite(Number(byteCap)) && Number(byteCap) > 0) {
    const cap = Number(byteCap)
    const u = Math.max(0, Number(used.storage_bytes) || 0)
    const toMb = (b) => {
      const mb = b / (1024 * 1024)
      if (mb >= 1024) return `${Math.round((mb / 1024) * 10) / 10} GB`
      return `${Math.round(mb)} MB`
    }
    return `${toMb(u)} / ${toMb(cap)}`
  }
  const usedMb = Math.max(0, Number(used.storage_mb) || 0)
  const limMb = lim.storage_mb
  if (limMb == null || limMb === '') return `${Math.round(usedMb)} MB / ∞`
  return `${Math.round(usedMb)} MB / ${Math.round(Number(limMb))} MB`
}

function fmtStudentsLine(billing, t) {
  const used = Math.max(0, Number(billing?.usage?.students) || 0)
  const lim = billing?.limits?.students
  if (lim == null || lim === '') return t('billing.usage.usedUnlimited', { used })
  const cap = Math.max(0, Number(lim) || 0)
  return t('billing.usage.usedOf', { used, limit: cap })
}

function fmtSmsRemainingLine(billing, t) {
  const sms = smsUsageDisplay(billing)
  const used = Math.max(0, Number(billing?.usage?.sms_monthly) || 0)
  const effective = sms.effective
  if (effective == null || effective === '') return t('billing.usage.smsUnlimited', { used })
  const remaining = Math.max(0, Math.round(effective - used))
  const cap = Math.max(0, Math.round(effective))
  return t('billing.usage.smsLeft', { used: remaining, limit: cap })
}

function fmtAiLine(billing, kind, t) {
  const usedKey = kind === 'questions' ? 'ai_questions_used' : 'ai_gradings_used'
  const limKey = kind === 'questions' ? 'ai_questions_monthly' : 'ai_gradings_monthly'
  const used = Math.max(0, Number(billing?.usage?.[usedKey]) || 0)
  const lim = billing?.limits?.[limKey]
  if (lim == null || lim === '') return t('billing.usage.usedUnlimited', { used })
  return t('billing.usage.usedOf', { used, limit: Math.max(0, Number(lim) || 0) })
}

function aiWarn(billing, kind) {
  const usedKey = kind === 'questions' ? 'ai_questions_used' : 'ai_gradings_used'
  const limKey = kind === 'questions' ? 'ai_questions_monthly' : 'ai_gradings_monthly'
  const remKey = kind === 'questions' ? 'ai_questions' : 'ai_gradings'
  const lim = billing?.limits?.[limKey]
  if (lim == null || !Number.isFinite(Number(lim)) || Number(lim) <= 0) return false
  const rem = billing?.remaining?.[remKey]
  if (rem != null) return Number(rem) / Number(lim) <= 0.2
  const used = Math.max(0, Number(billing?.usage?.[usedKey]) || 0)
  return used / Number(lim) >= 0.8
}

function compactSummary(billing) {
  const students = Math.max(0, Number(billing?.usage?.students) || 0)
  const storage = fmtStorageMbPair(billing).split(' / ')[0]
  const sms = smsUsageDisplay(billing)
  const used = Math.max(0, Number(billing?.usage?.sms_monthly) || 0)
  const effective = sms.effective
  const smsLeft =
    effective == null || effective === '' ? used : Math.max(0, Math.round(effective - used))
  const aiQ = Math.max(0, Number(billing?.usage?.ai_questions_used) || 0)
  const aiQLim = billing?.limits?.ai_questions_monthly
  const aiPart =
    aiQLim == null || aiQLim === '' ? `AI ${aiQ}` : `AI ${aiQ}/${Math.max(0, Number(aiQLim) || 0)}`
  return `${students} · ${storage} · ${smsLeft} SMS · ${aiPart}`
}

function PlanIcon({ kind }) {
  const paths = {
    package: <path d="M3.5 7.25 12 3l8.5 4.25v9.5L12 21l-8.5-4.25v-9.5Zm8.5 4.25v9.1m0-9.1 8.5-4.25M12 11.5 3.5 7.25" />,
    users: <><path d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M2.75 19c.35-3.25 2.3-5 5.75-5s5.4 1.75 5.75 5M16 6.25a2.5 2.5 0 0 1 0 4.75M18 14c1.8.7 2.9 2.3 3.15 5" /></>,
    storage: <><rect x="4" y="3.5" width="16" height="17" rx="2" /><path d="M7.5 7.5h9M7.5 12h9M7.5 16.5h5" /></>,
    sms: <><rect x="7" y="2.75" width="10" height="18.5" rx="2" /><path d="M10 5.75h4M10.25 17.5h3.5" /></>,
    ai: <><path d="M12 2.75 13.5 8.5 19.25 10 13.5 11.5 12 17.25l-1.5-5.75L4.75 10l5.75-1.5L12 2.75Z" /><path d="m18 15 .7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7L18 15Z" /></>,
    grading: <><path d="M6 3.5h9l3 3v14H6v-17Z" /><path d="M15 3.5v3h3M9 11h6M9 15h4" /><path d="m8.5 7.5 1 1 2-2" /></>,
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[kind] || paths.package}
    </svg>
  )
}

function UsageRow({ kind, label, value, warn }) {
  const tone = warn
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : kind === 'ai'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : kind === 'sms'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-slate-50 text-slate-600 border-slate-200'
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border ${tone}`}>
        <PlanIcon kind={kind} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-none">
          {label}
        </p>
        <p
          className={[
            'text-xs font-semibold tabular-nums mt-0.5 leading-tight',
            warn ? 'text-amber-700 dark:text-amber-200' : 'text-slate-800 dark:text-slate-200',
          ].join(' ')}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

const STORAGE_KEY = 'mx_billing_pills_expanded_v1'

export default function BillingUsagePills({ billing, planTitle = '', collapsible = true }) {
  const { t } = useTranslation()
  const panelId = useId()
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!collapsible) {
      setExpanded(true)
      return
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === '1') setExpanded(true)
      else if (saved === '0') setExpanded(false)
      else setExpanded(false)
    } catch {
      setExpanded(false)
    }
  }, [collapsible])

  const toggle = () => {
    setExpanded((v) => {
      const next = !v
      if (collapsible) {
        try {
          localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
        } catch {
          /* ignore */
        }
      }
      return next
    })
  }

  if (!billing) return null

  const sms = smsUsageDisplay(billing)
  const storage = storageUsageFromBilling(billing)
  const studentsWarn =
    billing.limits?.students != null &&
    Number(billing.usage?.students) >= Number(billing.limits.students)
  const storageWarn = storage.limit != null && storage.pct >= 90
  const smsWarn = sms.overEffective
  const aiQWarn = aiWarn(billing, 'questions')
  const aiGWarn = aiWarn(billing, 'gradings')

  const planSlug = String(billing?.plan || '').toLowerCase()
  const planName = t(`billing.planName.${planSlug}`, {
    defaultValue: String(planTitle || '').trim() || 'Paket',
  })
  const planChip = t('billing.planChip', { plan: planName })
  const summary = compactSummary(billing)
  const trialLine = basicTrialCountdownText(billing, t)

  const header = (
    <>
      <span className="flex min-w-0 items-center gap-2 text-[15px] font-bold tracking-tight text-token-textMain leading-snug truncate">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700">
          <PlanIcon kind="package" />
        </span>
        <span className="truncate">{planChip}</span>
      </span>
      {collapsible ? (
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={[
            'h-4 w-4 shrink-0 text-token-textMuted transition-transform duration-200',
            expanded ? 'rotate-180' : 'rotate-0',
          ].join(' ')}
        >
          <path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </>
  )

  return (
    <div className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/55 overflow-hidden shadow-sm shadow-slate-950/[0.02]">
      {collapsible ? (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="w-full flex items-center justify-between gap-2 p-3 text-left transition-colors hover:bg-slate-500/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-inset"
        >
          {header}
        </button>
      ) : (
        <div className="p-3 pb-0">{header}</div>
      )}

      {!collapsible || expanded ? (
        <div id={panelId} className={collapsible ? 'px-3 pb-3 pt-2.5 space-y-3 border-t border-[color:var(--border-subtle)]' : 'p-3 pt-2.5 space-y-3'}>
          {trialLine ? (
            <p className="text-[11px] font-medium text-amber-600 dark:text-amber-200/90 leading-snug">{trialLine}</p>
          ) : null}
          <UsageRow kind="users" label={t('billing.usage.students')} value={fmtStudentsLine(billing, t)} warn={studentsWarn} />
          <UsageRow kind="storage" label={t('billing.usage.storage')} value={fmtStorageMbPair(billing)} warn={storageWarn} />
          <UsageRow kind="sms" label={t('billing.usage.sms')} value={fmtSmsRemainingLine(billing, t)} warn={smsWarn} />
          <UsageRow
            kind="ai"
            label={t('billing.usage.aiQuestions')}
            value={fmtAiLine(billing, 'questions', t)}
            warn={aiQWarn}
          />
          <UsageRow
            kind="grading"
            label={t('billing.usage.aiGradings')}
            value={fmtAiLine(billing, 'gradings', t)}
            warn={aiGWarn}
          />
        </div>
      ) : (
        <p className="px-3 pb-2.5 text-[11px] font-medium text-token-textMuted leading-snug truncate">
          {trialLine ? `${trialLine} · ${summary}` : summary}
        </p>
      )}
    </div>
  )
}
