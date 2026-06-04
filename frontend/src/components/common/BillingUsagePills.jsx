import { useEffect, useId, useState } from 'react'
import { smsUsageDisplay, storageUsageFromBilling } from '../../lib/billingUsageDisplay'

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

function fmtStudentsLine(billing) {
  const used = Math.max(0, Number(billing?.usage?.students) || 0)
  const lim = billing?.limits?.students
  if (lim == null || lim === '') return `${used} / ∞ istifadə olunur`
  const cap = Math.max(0, Number(lim) || 0)
  return `${used} / ${cap} istifadə olunur`
}

function fmtSmsRemainingLine(billing) {
  const sms = smsUsageDisplay(billing)
  const used = Math.max(0, Number(billing?.usage?.sms_monthly) || 0)
  const effective = sms.effective
  if (effective == null || effective === '') return `${used} / ∞ qalıb`
  const remaining = Math.max(0, Math.round(effective - used))
  const cap = Math.max(0, Math.round(effective))
  return `${remaining} / ${cap} qalıb`
}

function compactSummary(billing) {
  const students = Math.max(0, Number(billing?.usage?.students) || 0)
  const storage = fmtStorageMbPair(billing).split(' / ')[0]
  const sms = fmtSmsRemainingLine(billing).split(' / ')[0]
  return `👥 ${students} · 💾 ${storage} · 📱 ${sms}`
}

function UsageRow({ icon, label, value, warn }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-token-textMuted leading-snug">
        {icon} {label}
      </p>
      <p
        className={[
          'text-sm font-semibold tabular-nums mt-0.5 leading-snug',
          warn ? 'text-amber-200' : 'text-token-textMain',
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  )
}

const STORAGE_KEY = 'mx_billing_pills_expanded_v1'

export default function BillingUsagePills({ billing, planTitle = '', collapsible = true }) {
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

  const planLabel = String(planTitle || '').trim() || 'Paket'
  const summary = compactSummary(billing)

  const header = (
    <>
      <span className="text-sm font-bold text-token-textMain leading-snug truncate">📦 {planLabel} Paket</span>
      {collapsible ? (
        <span
          aria-hidden
          className={[
            'shrink-0 text-token-textMuted text-xs transition-transform duration-200',
            expanded ? 'rotate-180' : 'rotate-0',
          ].join(' ')}
        >
          ▾
        </span>
      ) : null}
    </>
  )

  return (
    <div className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/40 overflow-hidden">
      {collapsible ? (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-white/[0.03] transition-colors"
        >
          {header}
        </button>
      ) : (
        <div className="p-3 pb-0">{header}</div>
      )}

      {!collapsible || expanded ? (
        <div id={panelId} className={collapsible ? 'px-3 pb-3 pt-0 space-y-2.5 border-t border-white/5' : 'p-3 pt-0 space-y-2.5'}>
          <UsageRow icon="👥" label="Tələbələr" value={fmtStudentsLine(billing)} warn={studentsWarn} />
          <UsageRow icon="💾" label="Sənəd yaddaşı" value={fmtStorageMbPair(billing)} warn={storageWarn} />
          <UsageRow icon="📱" label="SMS" value={fmtSmsRemainingLine(billing)} warn={smsWarn} />
        </div>
      ) : (
        <p className="px-3 pb-2.5 text-[10px] text-token-textMuted leading-snug truncate">{summary}</p>
      )}
    </div>
  )
}
