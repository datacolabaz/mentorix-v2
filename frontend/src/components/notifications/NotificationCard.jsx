import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import StatusBadge from '../common/StatusBadge'
import {
  SMS_STATUS_UI,
  formatPhoneDisplay,
  formatSmsDateTime,
  smsMessageLength,
  smsPartCount,
  smsStatusLabel,
} from '../../lib/smsHistoryDisplay'

function resolveCardPresentation(item) {
  const status = String(item?.status || '').toLowerCase()
  const source = String(item?.source || '').toLowerCase()
  const sourceTitle = item?.source_title ? String(item.source_title) : null
  const sourceDetail = item?.source_detail ? String(item.source_detail) : null
  const isExamAuto = source === 'exam_placed' || source === 'exam_result' || source === 'exam_reminder'
  const c = (key) => i18n.t(`notifications.card.${key}`)

  if (status === 'logged') {
    if (isExamAuto || source === 'exam_result') {
      return {
        icon: '📝',
        title: sourceTitle || c('examAutoLog'),
        subtitle: sourceDetail || c('loggedNoSms'),
        tone: 'note',
      }
    }
    if (/ödəniş təsdiqləndi|odenis tesdiqlendi/i.test(String(item?.message || ''))) {
      return {
        icon: '📝',
        title: c('paymentRecord'),
        subtitle: c('noQuota'),
        tone: 'note',
      }
    }
    return { icon: '📝', title: c('systemNote'), subtitle: c('noQuota'), tone: 'note' }
  }
  if (status === 'whatsapp') {
    return {
      icon: '💬',
      title: sourceTitle || c('whatsappMessage'),
      subtitle: sourceDetail || (isExamAuto ? c('examNotify') : c('noSmsQuota')),
      tone: 'whatsapp',
    }
  }
  const typeKey = item?.type === 'otp' ? 'otpPin' : 'paymentReminder'
  const typeTitle = c(typeKey)
  if (status === 'sent' && isExamAuto) {
    return {
      icon: '🤖',
      title: sourceTitle || c('examAutoSms'),
      subtitle: sourceDetail || c('examAutoSent'),
      tone: 'exam_auto',
    }
  }
  if (status === 'sent') {
    return {
      icon: '📱',
      title: item?.type === 'payment' || item?.type === 'payment_reminder' ? c('smsSent') : typeTitle,
      subtitle: item?.counts_toward_quota === false ? null : c('inPackage'),
      tone: 'system',
    }
  }
  if (status === 'scheduled') {
    return { icon: '📅', title: c('scheduledSms'), subtitle: c('notSentYet'), tone: 'scheduled' }
  }
  if (status === 'pending') {
    return { icon: '🕒', title: c('pending'), subtitle: c('providerPending'), tone: 'pending' }
  }
  if (status === 'failed') {
    return { icon: '✕', title: c('smsFailed'), subtitle: item?.reason || null, tone: 'failed' }
  }
  return { icon: '💰', title: typeTitle, subtitle: null, tone: 'payment' }
}

export default function NotificationCard({ item, onDetails }) {
  const { t } = useTranslation()
  const statusKey = String(item?.status || 'logged').toLowerCase()
  const st = SMS_STATUS_UI[statusKey] || SMS_STATUS_UI.logged
  const tp = resolveCardPresentation(item)
  const pkgRaw = item.package_type ? String(item.package_type) : ''
  const pkg =
    pkgRaw === '8'
      ? t('notifications.card.pack8')
      : pkgRaw === '12'
        ? t('notifications.card.pack12')
        : pkgRaw === 'monthly'
          ? 'monthly'
          : null
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
            {phoneCount > 1 ? (
              <span className="text-token-textMuted"> {t('notifications.card.morePhones', { count: phoneCount - 1 })}</span>
            ) : null}
            {pkg ? <span className="text-token-textMuted"> · {pkg}</span> : null}
          </p>
          {tp.subtitle ? <p className="text-[11px] text-amber-700/90 dark:text-amber-200/80 mt-1">{tp.subtitle}</p> : null}
        </div>
        <StatusBadge variant={st.badge}>{smsStatusLabel(statusKey)}</StatusBadge>
      </div>

      {showSmsMeta && phoneLine ? (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-token-textMuted">
          <span>
            {t('notifications.card.phone')}{' '}
            <span className="text-token-textMain font-medium tabular-nums">{phoneLine}</span>
          </span>
          <span>
            {t('notifications.card.length')}{' '}
            <span className="text-token-textMain font-medium tabular-nums">{msgLen}</span>{' '}
            {t('notifications.card.charsShort')}
          </span>
          <span>
            {t('notifications.card.parts')}{' '}
            <span className="text-token-textMain font-medium tabular-nums">{parts || '—'}</span>
          </span>
        </div>
      ) : null}

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-token-textMain/90">
            {item.status === 'scheduled'
              ? t('notifications.card.approxTime', { time: formatSmsDateTime(createdAt) })
              : formatSmsDateTime(createdAt)}
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
          {t('notifications.card.viewDetails')}
        </button>
      </div>
    </div>
  )
}
