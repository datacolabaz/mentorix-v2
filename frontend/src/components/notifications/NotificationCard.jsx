import StatusBadge from '../common/StatusBadge'
import {
  SMS_STATUS_UI,
  formatPhoneDisplay,
  formatSmsDateTime,
  smsMessageLength,
  smsPartCount,
  smsStatusLabel,
} from '../../lib/smsHistoryDisplay'

const TYPE_MAP = {
  payment: { icon: '💰', title: 'Ödəniş xatırlatması', tone: 'payment' },
  payment_reminder: { icon: '💰', title: 'Ödəniş xatırlatması', tone: 'payment' },
  otp: { icon: '🔐', title: 'PIN kod SMS-i', tone: 'otp' },
}

function resolveCardPresentation(item) {
  const status = String(item?.status || '').toLowerCase()
  const source = String(item?.source || '').toLowerCase()
  const sourceTitle = item?.source_title ? String(item.source_title) : null
  const sourceDetail = item?.source_detail ? String(item.source_detail) : null
  const isExamAuto = source === 'exam_placed' || source === 'exam_result' || source === 'exam_reminder'

  if (status === 'logged') {
    if (isExamAuto || source === 'exam_result') {
      return {
        icon: '📝',
        title: sourceTitle || 'Avtomatik imtahan qeydi',
        subtitle: sourceDetail || 'SMS göndərilməyib · müəllim əl ilə göndərməyib',
        tone: 'note',
      }
    }
    if (/ödəniş təsdiqləndi|odenis tesdiqlendi/i.test(String(item?.message || ''))) {
      return {
        icon: '📝',
        title: 'Ödəniş qeydi',
        subtitle: 'SMS göndərilməyib · limitdən çıxılmır',
        tone: 'note',
      }
    }
    return { icon: '📝', title: 'Sistem qeydi', subtitle: 'SMS göndərilməyib · limitdən çıxılmır', tone: 'note' }
  }
  if (status === 'whatsapp') {
    return {
      icon: '💬',
      title: sourceTitle || 'WhatsApp mesajı',
      subtitle: sourceDetail || (isExamAuto ? 'İmtahan bildirişi · SMS limitindən çıxılmır' : 'SMS limitindən çıxılmır'),
      tone: 'whatsapp',
    }
  }
  const tp = TYPE_MAP[item?.type] || TYPE_MAP.payment
  if (status === 'sent' && isExamAuto) {
    return {
      icon: '🤖',
      title: sourceTitle || 'Avtomatik imtahan SMS-i',
      subtitle:
        sourceDetail ||
        'İmtahan yaradılanda sistem göndərib — Bildirişlər səhifəsindən əl ilə deyil.',
      tone: 'exam_auto',
    }
  }
  if (status === 'sent') {
    return {
      icon: '📱',
      title: tp.title === TYPE_MAP.payment.title ? 'SMS göndərildi' : tp.title,
      subtitle: item?.counts_toward_quota === false ? null : 'Paket limitinə daxildir',
      tone: 'system',
    }
  }
  if (status === 'scheduled') {
    return { icon: '📅', title: 'Planlaşdırılmış SMS', subtitle: 'Hələ göndərilməyib', tone: 'scheduled' }
  }
  if (status === 'pending') {
    return { icon: '🕒', title: 'Gözləyir', subtitle: 'Provayder təsdiqi gözlənilir', tone: 'pending' }
  }
  if (status === 'failed') {
    return { icon: '✕', title: 'SMS göndərilmədi', subtitle: item?.reason || null, tone: 'failed' }
  }
  return { ...tp, subtitle: null }
}

export default function NotificationCard({ item, onDetails }) {
  const statusKey = String(item?.status || 'logged').toLowerCase()
  const st = SMS_STATUS_UI[statusKey] || SMS_STATUS_UI.logged
  const tp = resolveCardPresentation(item)
  const pkgRaw = item.package_type ? String(item.package_type) : ''
  const pkg = pkgRaw === '8' ? '8 dərs' : pkgRaw === '12' ? '12 dərs' : pkgRaw === 'monthly' ? 'monthly' : null
  const phoneCount = Array.isArray(item.phones) ? item.phones.length : 0
  const primaryText = item.student_name
    ? String(item.student_name)
    : item.phone
      ? formatPhoneDisplay(item.phone)
      : phoneCount
        ? formatPhoneDisplay(item.phones[0])
        : '—'
  const createdAt = item.createdAt || item.created_at
  const phoneLine = item.phone ? formatPhoneDisplay(item.phone) : phoneCount ? formatPhoneDisplay(item.phones[0]) : null
  const msgLen = item.message_length ?? smsMessageLength(item.message)
  const parts = item.sms_parts ?? smsPartCount(item.message)
  const showSmsMeta = statusKey === 'sent' || statusKey === 'failed' || statusKey === 'pending'

  return (
    <div
      className={[
        'rounded-2xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/55',
        tp.tone === 'payment'
          ? 'shadow-[0_10px_30px_rgba(34,224,136,0.06)] hover:border-primary/25'
          : tp.tone === 'note'
            ? 'opacity-[0.98] hover:border-amber-500/20'
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
          {tp.subtitle ? <p className="text-[11px] text-amber-700/90 dark:text-amber-200/80 mt-1">{tp.subtitle}</p> : null}
        </div>
        <StatusBadge variant={st.badge}>{smsStatusLabel(statusKey)}</StatusBadge>
      </div>

      {showSmsMeta && phoneLine ? (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-token-textMuted">
          <span>
            Telefon: <span className="text-token-textMain font-medium tabular-nums">{phoneLine}</span>
          </span>
          <span>
            Uzunluq: <span className="text-token-textMain font-medium tabular-nums">{msgLen}</span> simvol
          </span>
          <span>
            Hissə: <span className="text-token-textMain font-medium tabular-nums">{parts || '—'}</span>
          </span>
        </div>
      ) : null}

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-token-textMain/90">
            {item.status === 'scheduled' ? `${formatSmsDateTime(createdAt)} (təxmini)` : formatSmsDateTime(createdAt)}
          </p>
          <p className="text-xs text-token-textMuted mt-2 line-clamp-2">{item.message || '—'}</p>
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
