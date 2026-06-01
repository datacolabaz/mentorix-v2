import StatusBadge from '../common/StatusBadge'

const STATUS_MAP = {
  sent: { label: 'Göndərildi', badge: 'paid' },
  logged: { label: 'Yalnız qeyd', badge: 'due' },
  whatsapp: { label: 'WhatsApp', badge: 'due' },
  failed: { label: 'Alınmadı', badge: 'danger' },
  scheduled: { label: 'Planlaşdırılıb', badge: 'due' },
}

const TYPE_MAP = {
  payment: { icon: '💰', title: 'Ödəniş xatırlatma göndərildi', tone: 'payment' },
  payment_reminder: { icon: '💰', title: 'Ödəniş xatırlatma göndərildi', tone: 'payment' }, // backward compat
  otp: { icon: '🔐', title: 'PIN kod göndərildi', tone: 'otp' },
}

function fmtDateTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('az-AZ', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtDateOnly(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('az-AZ', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function resolveCardPresentation(item) {
  const status = String(item?.status || '').toLowerCase()
  if (status === 'logged') {
    if (/ödəniş təsdiqləndi|odenis tesdiqlendi/i.test(String(item?.message || ''))) {
      return { icon: '📝', title: 'Ödəniş qeydi (SMS göndərilməyib)', tone: 'note' }
    }
    return { icon: '📝', title: 'Sistem qeydi (SMS göndərilməyib)', tone: 'note' }
  }
  if (status === 'whatsapp') {
    return { icon: '💬', title: 'WhatsApp mesajı', tone: 'whatsapp' }
  }
  const tp = TYPE_MAP[item?.type] || TYPE_MAP.payment
  if (status === 'sent' && (item?.type === 'system' || /imtahan/i.test(String(item?.message || '')))) {
    return { icon: '📱', title: 'SMS göndərildi', tone: 'system' }
  }
  return tp
}

export default function NotificationCard({ item, onDetails }) {
  const st = STATUS_MAP[item.status] || STATUS_MAP.logged
  const tp = resolveCardPresentation(item)
  const pkgRaw = item.package_type ? String(item.package_type) : ''
  const pkg = pkgRaw === '8' ? '8 dərs' : pkgRaw === '12' ? '12 dərs' : null
  const phoneCount = Array.isArray(item.phones) ? item.phones.length : 0
  const primaryText = item.student_name
    ? String(item.student_name)
    : item.phone
      ? String(item.phone)
      : phoneCount
        ? String(item.phones[0])
        : '—'
  const createdAt = item.createdAt || item.created_at || item.created_at === null ? item.createdAt : item.created_at

  return (
    <div
      className={[
        'rounded-2xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/55',
        tp.tone === 'payment'
          ? 'shadow-[0_10px_30px_rgba(34,224,136,0.06)] hover:border-primary/25'
          : 'opacity-[0.96] hover:opacity-100 hover:border-slate-300/40 dark:hover:border-white/15',
        'shadow-[0_10px_30px_rgba(0,0,0,0.10)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.14)]',
        'transition-[transform,box-shadow,border-color,background-color] duration-200 hover:-translate-y-[1px]',
        'p-4 sm:p-5',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-token-textMain leading-snug flex items-center gap-2">
            <span className="text-base leading-none">{tp.icon}</span>
            <span className="truncate">{tp.title}</span>
          </p>
          <p className="text-xs text-token-textMuted mt-1 truncate">
            {primaryText}
            {phoneCount > 1 ? <span className="text-token-textMuted"> · +{phoneCount - 1} nömrə</span> : null}
            {pkg ? <span className="text-token-textMuted"> · {pkg}</span> : null}
          </p>
        </div>
        <StatusBadge variant={st.badge}>{st.label}</StatusBadge>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-token-textMuted">
            {item.status === 'scheduled' ? `${fmtDateOnly(createdAt)} (təxmini)` : fmtDateTime(createdAt)}
          </p>
          <p className="text-xs text-token-textMain/90 mt-2 truncate">{item.message || '—'}</p>
        </div>
        <button
          type="button"
          onClick={() => onDetails?.(item)}
          className={[
            'inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold',
            'border border-[color:var(--border-subtle)] bg-token-surfaceMain/40',
            'text-token-textMain hover:bg-token-surfaceMain/55 transition-colors',
            'whitespace-nowrap',
          ].join(' ')}
        >
          Ətraflı bax
        </button>
      </div>
    </div>
  )
}

