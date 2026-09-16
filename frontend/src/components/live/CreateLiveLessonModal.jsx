/**
 * Platform picker + details for creating a live lesson.
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../common/Modal'
import Button from '../common/Button'
import ConfirmDialog from '../common/ConfirmDialog'
import { useToast } from '../common/Toast'
import api from '../../lib/api'

const PROVIDERS = [
  { id: 'google_meet', available: true },
  { id: 'zoom', available: true },
  { id: 'teams', available: false },
]

export default function CreateLiveLessonModal({
  open,
  onClose,
  onCreated,
  starting = false,
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [step, setStep] = useState('pick') // pick | details
  const [provider, setProvider] = useState(null)
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState('')
  const [connections, setConnections] = useState(null)
  const [loadingConn, setLoadingConn] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false)
  const [zoomDisconnectOpen, setZoomDisconnectOpen] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const reset = useCallback(() => {
    setStep('pick')
    setProvider(null)
    setTitle('')
    setWhen('')
    setDisconnectConfirmOpen(false)
    setZoomDisconnectOpen(false)
  }, [])

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  const loadConnections = useCallback(async () => {
    setLoadingConn(true)
    try {
      const res = await api.get('/teacher-connections')
      setConnections(res.connections || null)
    } catch {
      setConnections(null)
    } finally {
      setLoadingConn(false)
    }
  }, [])

  useEffect(() => {
    if (open && step === 'details' && (provider === 'google_meet' || provider === 'zoom')) {
      void loadConnections()
    }
  }, [open, step, provider, loadConnections])

  const meetConn = connections?.google_meet
  const meetConnected = Boolean(meetConn?.connected)
  const zoomConn = connections?.zoom
  const zoomConnected = Boolean(zoomConn?.connected)

  const pickProvider = (id, available) => {
    if (!available) return
    setProvider(id)
    setStep('details')
  }

  const connectGoogleMeet = async () => {
    if (connecting) return
    setConnecting(true)
    try {
      const res = await api.post('/teacher-connections/google_meet/start', {
        returnPath: '/instructor/live/history',
      })
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl
        return
      }
      toast(t('live.meetConnectFailed'), 'error')
    } catch (e) {
      toast(e?.message || t('live.meetConnectFailed'), 'error')
    } finally {
      setConnecting(false)
    }
  }

  const disconnectGoogleMeet = async () => {
    if (disconnecting) return
    setDisconnecting(true)
    try {
      await api.delete('/teacher-connections/google_meet')
      setConnections((prev) => ({
        ...(prev || {}),
        google_meet: { provider: 'google_meet', connected: false },
      }))
      setDisconnectConfirmOpen(false)
      toast(t('live.meetDisconnected'))
    } catch (e) {
      toast(e?.message || t('live.meetDisconnectFailed'), 'error')
    } finally {
      setDisconnecting(false)
    }
  }

  const connectZoom = async () => {
    if (connecting) return
    setConnecting(true)
    try {
      const res = await api.post('/teacher-connections/zoom/start', {
        returnPath: '/instructor/live/history',
      })
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl
        return
      }
      toast(t('live.zoomConnectFailed'), 'error')
    } catch (e) {
      toast(e?.message || t('live.zoomConnectFailed'), 'error')
    } finally {
      setConnecting(false)
    }
  }

  const disconnectZoom = async () => {
    if (disconnecting) return
    setDisconnecting(true)
    try {
      await api.delete('/teacher-connections/zoom')
      setConnections((prev) => ({
        ...(prev || {}),
        zoom: { provider: 'zoom', connected: false },
      }))
      setZoomDisconnectOpen(false)
      toast(t('live.zoomDisconnected'))
    } catch (e) {
      toast(e?.message || t('live.zoomDisconnectFailed'), 'error')
    } finally {
      setDisconnecting(false)
    }
  }

  const handleCreate = () => {
    if (!provider) return
    onCreated?.({
      provider,
      title: String(title || '').trim(),
      scheduledAtLocal: when,
    })
  }

  const footer =
    step === 'pick' ? (
      <div className="flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose} disabled={starting}>
          {t('common.cancel')}
        </Button>
      </div>
    ) : (
      <div className="flex flex-wrap justify-between gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setStep('pick')}
          disabled={starting || connecting || disconnecting}
        >
          {t('live.providerBack')}
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={starting}>
            {t('common.cancel')}
          </Button>
          {provider === 'google_meet' && !meetConnected ? (
            <Button type="button" loading={connecting || loadingConn} onClick={() => void connectGoogleMeet()}>
              {t('live.connectGoogleMeet')}
            </Button>
          ) : provider === 'zoom' && !zoomConnected ? (
            <Button type="button" loading={connecting || loadingConn} onClick={() => void connectZoom()}>
              {t('live.connectZoom')}
            </Button>
          ) : (
            <Button type="button" loading={starting} onClick={handleCreate}>
              {provider === 'google_meet'
                ? t('live.createMeetLesson')
                : provider === 'zoom'
                  ? t('live.createZoomLesson')
                  : t('live.createAndShare')}
            </Button>
          )}
        </div>
      </div>
    )

  return (
    <>
      <Modal
        open={open}
        onClose={() => !starting && onClose?.()}
        title={step === 'pick' ? t('live.createLessonTitle') : t('live.startOpenTitle')}
        size="sm"
        footer={footer}
      >
        {step === 'pick' ? (
          <div className="space-y-3">
            <p className="text-sm text-token-textMuted">{t('live.pickPlatform')}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={!p.available}
                  onClick={() => pickProvider(p.id, p.available)}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    p.available
                      ? 'border-[color:var(--border-subtle)] bg-token-surfaceMain hover:border-primary/40 text-token-textMain'
                      : 'border-[color:var(--border-subtle)] opacity-50 cursor-not-allowed text-token-textMuted'
                  }`}
                >
                  <span className="block text-sm font-semibold">
                    {t(`live.providers.${p.id}`)}
                  </span>
                  {!p.available ? (
                    <span className="mt-0.5 block text-[11px] text-token-textMuted">
                      {t('live.comingSoon')}
                    </span>
                  ) : p.id === 'google_meet' ? (
                    <span className="mt-0.5 block text-[11px] text-token-textMuted">
                      {t('live.providers.google_meetHint')}
                    </span>
                  ) : p.id === 'zoom' ? (
                    <span className="mt-0.5 block text-[11px] text-token-textMuted">
                      {t('live.providers.zoomHint')}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-token-textMuted">
              {t('live.selectedProvider', { name: t(`live.providers.${provider}`) })}
            </p>
            {provider === 'google_meet' && (
              <div className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceMain px-3 py-2.5 text-sm">
                {loadingConn ? (
                  <span className="text-token-textMuted">{t('live.loading')}</span>
                ) : meetConnected ? (
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-token-textMain">
                      {t('live.meetConnectedAs', { email: meetConn.account_email || 'Google' })}
                    </span>
                    <button
                      type="button"
                      disabled={disconnecting || starting}
                      onClick={() => setDisconnectConfirmOpen(true)}
                      className="text-[11px] text-token-textMuted hover:text-token-textMain hover:underline disabled:opacity-50"
                    >
                      {t('live.disconnectAccount')}
                    </button>
                  </div>
                ) : (
                  <span className="text-token-textMuted">{t('live.meetNeedsConnect')}</span>
                )}
              </div>
            )}
            {provider === 'zoom' && (
              <div className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceMain px-3 py-2.5 text-sm">
                {loadingConn ? (
                  <span className="text-token-textMuted">{t('live.loading')}</span>
                ) : zoomConnected ? (
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-token-textMain">
                      {t('live.zoomConnectedAs', { email: zoomConn.account_email || 'Zoom' })}
                    </span>
                    <button
                      type="button"
                      disabled={disconnecting || starting}
                      onClick={() => setZoomDisconnectOpen(true)}
                      className="text-[11px] text-token-textMuted hover:text-token-textMain hover:underline disabled:opacity-50"
                    >
                      {t('live.disconnectAccount')}
                    </button>
                  </div>
                ) : (
                  <span className="text-token-textMuted">{t('live.zoomNeedsConnect')}</span>
                )}
              </div>
            )}
            <label className="block space-y-1">
              <span className="text-xs font-medium text-token-textMuted">{t('live.lessonTitle')}</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('live.lessonTitlePlaceholder')}
                maxLength={120}
                className="w-full rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceMain px-3 py-2.5 text-sm text-token-textMain outline-none focus:border-primary/50"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-token-textMuted">{t('live.scheduleWhen')}</span>
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="w-full rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceMain px-3 py-2.5 text-sm text-token-textMain outline-none focus:border-primary/50"
              />
              <span className="text-[11px] text-token-textMuted">{t('live.scheduleWhenHint')}</span>
            </label>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={disconnectConfirmOpen}
        onClose={() => !disconnecting && setDisconnectConfirmOpen(false)}
        onConfirm={() => void disconnectGoogleMeet()}
        title={t('live.meetDisconnectConfirmTitle')}
        message={t('live.meetDisconnectConfirmMessage')}
        confirmLabel={t('live.disconnectAccount')}
        cancelLabel={t('common.cancel')}
        loading={disconnecting}
        danger
      />

      <ConfirmDialog
        open={zoomDisconnectOpen}
        onClose={() => !disconnecting && setZoomDisconnectOpen(false)}
        onConfirm={() => void disconnectZoom()}
        title={t('live.zoomDisconnectConfirmTitle')}
        message={t('live.zoomDisconnectConfirmMessage')}
        confirmLabel={t('live.disconnectAccount')}
        cancelLabel={t('common.cancel')}
        loading={disconnecting}
        danger
      />
    </>
  )
}
