import StatusBadge from '../common/StatusBadge'

const STATUS_MAP = {
  sent: { label: 'Göndərildi', badge: 'paid' },
  failed: { label: 'Alınmadı', badge: 'danger' },
  scheduled: { label: 'Planlaşdırılıb', badge: 'due' },
}

const TYPE_MAP = {
  payment_reminder: { icon: '💰', title: 'Ödəniş xatırlatma göndərildi', tone: 'payment' },
  otp: { icon: '🔐', title: 'PIN kod göndərildi', tone: 'otp' },
}

function fmtDateTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('az-AZ', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function NotificationCard({ item, onDetails }) {
  const st = STATUS_MAP[item.status] || STATUS_MAP.sent
  const tp = TYPE_MAP[item.type] || TYPE_MAP.payment_reminder
  const studentText =
    Array.isArray(item.students) && item.students.length
      ? item.students.length <= 2
        ? item.students.join(', ')
        : `${item.students[0]}, ${item.students[1]} +${item.students.length - 2}`
      : item.phone
        ? String(item.phone)
        : '—'

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
          <p className="text-xs text-token-textMuted mt-1 truncate">{studentText}</p>
        </div>
        <StatusBadge variant={st.badge}>{st.label}</StatusBadge>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-token-textMuted">{fmtDateTime(item.createdAt)}</p>
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

