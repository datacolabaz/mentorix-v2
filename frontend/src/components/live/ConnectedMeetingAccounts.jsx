import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../common/Button'
import ConfirmDialog from '../common/ConfirmDialog'
import { useToast } from '../common/Toast'
import PlatformIcon from './PlatformIcon'
import OptionalBetaBadge from './OptionalBetaBadge'
import api from '../../lib/api'

const PROVIDERS = ['google_meet', 'zoom']
const RETURN_PATH = '/instructor/live-lessons'

/**
 * Optional: let Mentorix create the meeting link in the teacher's own Google/Zoom account.
 * Pasting a link by hand never needs this.
 */
export default function ConnectedMeetingAccounts() {
  const { t } = useTranslation()
  const toast = useToast()
  const [connections, setConnections] = useState(null)
  const [busy, setBusy] = useState('')
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/teacher-connections')
      setConnections(res.connections || {})
    } catch {
      setConnections({})
    }
  }, [])

  useEffect(() => {
    void load()
    const params = new URLSearchParams(window.location.search)
    let changed = false
    for (const [key, provider] of [
      ['meet', 'google_meet'],
      ['zoom', 'zoom'],
    ]) {
      if (params.get(`${key}_connected`) === '1') {
        toast(t('liveLessons.accounts.connected', { name: t(`liveLessons.platforms.${provider}`) }))
        params.delete(`${key}_connected`)
        changed = true
      } else if (params.get(`${key}_error`)) {
        const code = params.get(`${key}_error`)
        toast(code === 'GOOGLE_CALENDAR_SCOPE_MISSING' ? t('live.meetCalendarScopeRequired') : t('liveLessons.accounts.connectFailed'), 'error')
        params.delete(`${key}_error`)
        changed = true
      }
    }
    if (changed) {
      const qs = params.toString()
      window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`)
    }
  }, [load, t, toast])

  const connect = async (provider) => {
    setBusy(provider)
    try {
      const res = await api.post(`/teacher-connections/${provider}/start`, { returnPath: RETURN_PATH })
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl
        return
      }
      toast(t('liveLessons.accounts.connectFailed'), 'error')
    } catch (e) {
      toast(e?.message || t('liveLessons.accounts.connectFailed'), 'error')
    } finally {
      setBusy('')
    }
  }

  const disconnect = async () => {
    const provider = confirm
    setBusy(provider)
    try {
      await api.delete(`/teacher-connections/${provider}`)
      setConnections((prev) => ({ ...(prev || {}), [provider]: { provider, connected: false } }))
      toast(t('liveLessons.accounts.disconnected'))
      setConfirm(null)
    } catch (e) {
      toast(e?.message || t('liveLessons.saveFailed'), 'error')
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="rounded-2xl border border-[color:var(--border-subtle)] bg-token-surfaceMain p-4 sm:p-5" aria-labelledby="ll-accounts-title">
      <h2 id="ll-accounts-title" className="text-sm font-semibold text-token-textMain">
        {t('liveLessons.accounts.title')}
        <OptionalBetaBadge />
      </h2>
      <p className="mt-1 text-xs text-token-textMuted">{t('liveLessons.accounts.hint')}</p>
      <ul className="mt-3 space-y-2">
        {PROVIDERS.map((p) => {
          const c = connections?.[p]
          return (
            <li key={p} className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm text-token-textMain">
                <PlatformIcon platform={p} className="h-7 w-7" />
                <span className="truncate">
                  {t(`liveLessons.platforms.${p}`)}
                  {c?.connected ? (
                    <span className="text-token-textMuted"> · {c.account_email || t('liveLessons.accounts.connectedShort')}</span>
                  ) : null}
                </span>
              </span>
              {connections == null ? null : c?.connected ? (
                <Button type="button" size="sm" variant="ghost" disabled={busy === p} onClick={() => setConfirm(p)}>
                  {t('liveLessons.accounts.disconnect')}
                </Button>
              ) : (
                <Button type="button" size="sm" variant="secondary" loading={busy === p} onClick={() => void connect(p)}>
                  {t('liveLessons.accounts.connect')}
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => !busy && setConfirm(null)}
        onConfirm={() => void disconnect()}
        title={t('liveLessons.accounts.disconnectTitle')}
        message={t('liveLessons.accounts.disconnectText')}
        confirmLabel={t('liveLessons.accounts.disconnect')}
        cancelLabel={t('common.cancel')}
        loading={Boolean(busy)}
        danger
      />
    </section>
  )
}
