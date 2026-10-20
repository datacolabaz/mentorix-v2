import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { groupInvitationLink } from '../../../lib/joinInvite'
import useDialogFocus from '../../common/useDialogFocus'
import { useToast } from '../../common/Toast'
import { GroupTimedInvites } from '../GroupInvitesModal'
import { copyToClipboard } from './teachingUi'

const btn =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard px-3 text-sm font-semibold text-token-textMain hover:bg-token-surfaceCardHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-50'

/**
 * «Dəvət et»: code, permanent link, share, QR and timed links for exactly one group.
 * Every action reads `group` (the row that opened the panel); share and QR use the same link as «Kopyala».
 */
export default function InviteDrawer({ open, onClose, group, subjectName }) {
  const toast = useToast()
  const panelRef = useRef(null)
  const [copied, setCopied] = useState('')
  const [copyError, setCopyError] = useState('')
  const [showQr, setShowQr] = useState(false)
  useDialogFocus(open, panelRef, onClose)

  useEffect(() => {
    setCopied('')
    setCopyError('')
    setShowQr(false)
  }, [group?.id, open])

  useEffect(() => {
    if (!copied) return undefined
    const id = window.setTimeout(() => setCopied(''), 2000)
    return () => window.clearTimeout(id)
  }, [copied])

  if (!open || !group || typeof document === 'undefined') return null

  const link = groupInvitationLink(group)
  const code = group.join_code || group.invitation_code || ''
  const titleId = `invite-drawer-title-${group.id}`

  const doCopy = async (key, text) => {
    setCopyError('')
    try {
      await copyToClipboard(text)
      setCopied(key)
    } catch {
      setCopied('')
      setCopyError('Kopyalamaq alınmadı. Brauzer icazə vermədi — mətni əl ilə seçib kopyalayın.')
      toast('Kopyalanmadı', 'error')
    }
  }

  const share = async () => {
    if (!link) return
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Mentorix dəvəti', text: `${group.name} qrupuna qoşul`, url: link })
        return
      } catch (e) {
        if (e?.name === 'AbortError') return
      }
    }
    await doCopy('link', link)
  }

  return createPortal(
    <div className="fixed inset-0 z-[10040] flex items-end justify-end bg-black/40 sm:items-stretch" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid="invite-drawer"
        className="flex max-h-[88vh] w-full flex-col rounded-t-2xl border border-[color:var(--border-subtle)] bg-token-surfaceCard text-token-textMain shadow-2xl outline-none sm:max-h-none sm:h-full sm:max-w-md sm:rounded-none sm:rounded-l-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--border-subtle)] px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-xs text-token-textMuted">{subjectName || 'Sahə'}</p>
            <h2 id={titleId} className="break-words font-display text-lg font-bold">
              Dəvət et — {group.name}
            </h2>
          </div>
          <button type="button" onClick={onClose} className={`${btn} w-10 shrink-0 px-0`} aria-label="Bağla">
            <span aria-hidden>✕</span>
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5">
          <section aria-labelledby={`${titleId}-perm`} className="space-y-3">
            <h3 id={`${titleId}-perm`} className="text-sm font-semibold">
              Daimi dəvət
            </h3>
            {!group.invite_ready ? (
              <p className="rounded-xl bg-warning-subtle px-3 py-2 text-xs text-warning">
                Qrupun paketi təyin edilməyib. Qoşulan tələbə paket şərtlərini görmür — əvvəlcə «Paket və cədvəl»i doldurun.
              </p>
            ) : null}
            {code ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-canvas-subtle px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[11px] text-token-textMuted">Dəvət kodu</p>
                  <p className="font-mono text-base font-semibold tracking-wide">{code}</p>
                </div>
                <button type="button" className={btn} onClick={() => void doCopy('code', code)}>
                  {copied === 'code' ? '✓ Kopyalandı' : 'Kopyala'}
                </button>
              </div>
            ) : null}
            {link ? (
              <div className="space-y-2 rounded-xl bg-canvas-subtle px-3 py-2.5">
                <p className="text-[11px] text-token-textMuted">Dəvət linki</p>
                <p className="break-all font-mono text-xs" data-testid="invite-link">
                  {link}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btn} onClick={() => void doCopy('link', link)}>
                    {copied === 'link' ? '✓ Kopyalandı' : 'Linki kopyala'}
                  </button>
                  <button type="button" className={btn} onClick={() => void share()}>
                    Paylaş
                  </button>
                  <button type="button" className={btn} aria-expanded={showQr} onClick={() => setShowQr((v) => !v)}>
                    {showQr ? 'QR-ı gizlət' : 'QR göstər'}
                  </button>
                </div>
                {showQr ? (
                  <div className="flex justify-center pt-2" data-testid="invite-qr">
                    <div className="rounded-2xl bg-white p-3">
                      <QRCodeCanvas value={link} size={196} includeMargin aria-label={`${group.name} qrupu üçün QR kod`} />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-token-textMuted">Bu qrup üçün daimi dəvət linki yoxdur.</p>
            )}
            <p role="status" aria-live="polite" className="min-h-[1rem] text-xs text-error">
              {copyError}
            </p>
          </section>

          <section aria-labelledby={`${titleId}-timed`} className="space-y-3 border-t border-[color:var(--border-subtle)] pt-5">
            <h3 id={`${titleId}-timed`} className="text-sm font-semibold">
              Müddətli linklər
            </h3>
            <GroupTimedInvites active={open} group={group} compactIntro />
          </section>
        </div>
      </div>
    </div>,
    document.body,
  )
}
