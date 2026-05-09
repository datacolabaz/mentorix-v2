function fmtBytesShort(n) {
  const x = Number(n)
  if (!Number.isFinite(x) || x < 0) return '—'
  if (x < 1024) return `${Math.round(x)} B`
  if (x < 1024 * 1024) return `${Math.round(x / 102.4) / 10} KB`
  const mb = x / (1024 * 1024)
  return mb >= 10 ? `${Math.round(mb)} MB` : `${Math.round(mb * 10) / 10} MB`
}

function fmtLimit(v, unit) {
  if (v == null) return '∞'
  if (unit === 'mb') {
    const n = Number(v)
    if (!Number.isFinite(n)) return '—'
    const gb = n / 1024
    return gb >= 1 ? `${gb.toFixed(gb >= 10 ? 0 : 1)}GB` : `${Math.round(n)}MB`
  }
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return String(Math.round(n))
}

function fmtUsed(v, unit) {
  if (unit === 'mb') {
    const n = Number(v)
    if (!Number.isFinite(n)) return '—'
    const gb = n / 1024
    return gb >= 1 ? `${gb.toFixed(gb >= 10 ? 0 : 1)}GB` : `${Math.round(n)}MB`
  }
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return String(Math.round(n))
}

function Pill({ label, value }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-token-surfaceCard/40 px-3 py-1.5 text-[11px] text-token-textMain">
      <span className="text-token-textMuted">{label}:</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  )
}

export default function BillingUsagePills({ billing }) {
  if (!billing) return null
  const lim = billing.limits || {}
  const used = billing.usage || {}
  const byteCap = lim.storage_limit_bytes
  const storageLabel =
    byteCap != null && Number.isFinite(Number(byteCap))
      ? `${fmtBytesShort(used.storage_bytes)} / ${fmtBytesShort(byteCap)}`
      : `${fmtUsed(used.storage_mb, 'mb')} / ${fmtLimit(lim.storage_mb, 'mb')}`
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill label="Students" value={`${fmtUsed(used.students, 'n')} / ${fmtLimit(lim.students, 'n')}`} />
      <Pill label="Storage" value={storageLabel} />
      <Pill label="Monthly SMS usage" value={`${fmtUsed(used.sms_monthly, 'n')} / ${fmtLimit(lim.sms_monthly, 'n')}`} />
    </div>
  )
}

