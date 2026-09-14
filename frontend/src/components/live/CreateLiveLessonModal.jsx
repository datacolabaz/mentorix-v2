/**
 * Platform picker + details for creating a live lesson (Mentorix Live / Google Meet).
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../common/Modal'
import Button from '../common/Button'
import { useToast } from '../common/Toast'
import api from '../../lib/api'

const PROVIDERS = [
  { id: 'google_meet', available: true },
  { id: 'mentorix_live', available: true },
  { id: 'zoom', available: false },
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

  const reset = useCallback(() => {
    setStep('pick')
    setProvider(null)
    setTitle('')
    setWhen('')
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
    if (open && step === 'details' && provider === 'google_meet') {
      void loadConnections()
    }
  }, [open, step, provider, loadConnections])

  const meetConn = connections?.google_meet
  const meetConnected = Boolean(meetConn?.connected)

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
          disabled={starting || connecting}
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
          ) : (
            <Button type="button" loading={starting} onClick={handleCreate}>
              {provider === 'google_meet' ? t('live.createMeetLesson') : t('live.createAndShare')}
            </Button>
          )}
        </div>
      </div>
    )

  return (
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
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                ) : p.id === 'mentorix_live' ? (
                  <span className="mt-0.5 block text-[11px] text-token-textMuted">
                    {t('live.providers.mentorix_liveHint')}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-token-textMuted">{t('live.byoHint')}</p>
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
                <span className="text-token-textMain">
                  {t('live.meetConnectedAs', { email: meetConn.account_email || 'Google' })}
                </span>
              ) : (
                <span className="text-token-textMuted">{t('live.meetNeedsConnect')}</span>
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
  )
}
