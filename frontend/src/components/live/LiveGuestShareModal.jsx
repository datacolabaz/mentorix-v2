import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { QRCodeCanvas } from 'qrcode.react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import { useToast } from '../common/Toast'
import { absolutePublicUrl } from '../../lib/absolutePublicUrl'
import { fmtAzBakuYmdHm } from '../../lib/azDatetime'

export default function LiveGuestShareModal({
  open,
  session,
  onClose,
  onEnterLive,
  onRevoke,
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const qrWrapRef = useRef(null)
  const joinUrl = absolutePublicUrl(session?.joinUrl || '')
  const title = session?.title || t('live.historyTitle')
  const revoked = Boolean(session?.revoked)

  const copyLink = async () => {
    if (!joinUrl) return
    try {
      await navigator.clipboard.writeText(joinUrl)
      toast(t('live.linkCopied'), 'success')
    } catch {
      toast(t('live.copyFailed'), 'error')
    }
  }

  const shareLink = async () => {
    if (!joinUrl) return
    const text = `${title}\n${joinUrl}`
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: joinUrl })
        return
      } catch {
        /* fallback copy */
      }
    }
    await copyLink()
  }

  const downloadQr = () => {
    const canvas = qrWrapRef.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `mentorix-live-${session?.roomCode || 'ders'}.png`.replace(/[^\w.-]+/g, '_')
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('live.shareJoinTitle')}
      size="sm"
      zIndex={10056}
      footer={
        <div className="flex flex-wrap justify-center gap-2">
          {onRevoke ? (
            <Button type="button" variant="secondary" onClick={() => void onRevoke()} disabled={revoked}>
              {t('live.revokeLink')}
            </Button>
          ) : null}
          <Button type="button" onClick={onEnterLive} disabled={!session?.roomCode}>
            {t('live.enterLive')}
          </Button>
        </div>
      }
    >
      {session ? (
        <div className="space-y-4">
          <p className="text-sm text-token-textMuted text-center">{title}</p>
          {session.scheduledAt ? (
            <p className="text-center text-xs text-primary">
              {t('live.scheduledAt')} {fmtAzBakuYmdHm(session.scheduledAt)}
            </p>
          ) : null}
          {session.roomCode ? (
            <p className="text-center text-xs font-mono text-gray-400">{session.roomCode}</p>
          ) : null}
          {revoked ? (
            <p className="text-xs text-amber-400 text-center">{t('live.linkRevokedHint')}</p>
          ) : (
            <p className="text-xs text-token-textMuted text-center">{t('live.shareJoinHint')}</p>
          )}
          {!revoked && joinUrl ? (
            <div className="flex justify-center" ref={qrWrapRef}>
              <div className="bg-white rounded-2xl p-4">
                <QRCodeCanvas value={joinUrl} size={200} includeMargin />
              </div>
            </div>
          ) : null}
          <div className="rounded-xl border border-[color:var(--border-subtle)] p-3 bg-black/20">
            <p className="text-[11px] font-mono text-primary break-all">{joinUrl}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button className="w-full justify-center" variant="secondary" onClick={() => void copyLink()} disabled={revoked || !joinUrl}>
              {t('live.copyLink')}
            </Button>
            <Button className="w-full justify-center" variant="secondary" onClick={() => void shareLink()} disabled={revoked || !joinUrl}>
              {t('live.shareNative')}
            </Button>
            <Button className="w-full justify-center" variant="ghost" onClick={downloadQr} disabled={revoked || !joinUrl}>
              {t('live.downloadQr')}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
