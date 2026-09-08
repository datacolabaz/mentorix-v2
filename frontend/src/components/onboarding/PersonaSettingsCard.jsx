import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Card from '../common/Card'
import Button from '../common/Button'
import NavIcon from '../common/NavIcon'
import { useToast } from '../common/Toast'
import useAuthStore from '../../hooks/useAuth'
import api from '../../lib/api'
import { dashboardPathForUser, consumeReturnAfterLogin, isInviteResumePath, peekReturnAfterLogin } from '../../lib/postAuth'
import {
  PERSONA_ORDER,
  PERSONA_UI,
  resolveUserPersona,
} from '../../constants/personas'

export default function PersonaSettingsCard({ className = '' }) {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const { user, setSession } = useAuthStore()
  const current = resolveUserPersona(user)
  const [picked, setPicked] = useState(current)
  const [busy, setBusy] = useState(false)

  const changed = picked && picked !== current
  const currentTitle = useMemo(
    () => (current ? t(PERSONA_UI[current]?.titleKey || '') : t('personaSettings.noneSelected')),
    [current, t],
  )

  const save = async () => {
    if (!picked) return
    const pendingInvite = peekReturnAfterLogin()
    const resumeInvite = isInviteResumePath(pendingInvite)
    if (!changed) {
      if (resumeInvite) {
        consumeReturnAfterLogin()
        navigate(pendingInvite, { replace: true })
        return
      }
      toast(t('personaSettings.alreadySaved'), 'success')
      return
    }
    setBusy(true)
    try {
      const existing = user?.persona_profile?.[picked] || {}
      const r = await api.patch('/auth/persona', { persona: picked, profile: existing })
      if (!r?.token || !r?.user) throw new Error(r?.message || t('auth.errors.invalidServer'))
      setSession(r.token, r.user)
      toast(t('personaSettings.saved'), 'success')
      const invite = peekReturnAfterLogin()
      if (isInviteResumePath(invite)) {
        consumeReturnAfterLogin()
        navigate(invite, { replace: true })
        return
      }
      const nextPath = dashboardPathForUser(r.user)
      if (nextPath && nextPath !== window.location.pathname.replace(/\/settings$/, '')) {
        navigate(nextPath, { replace: true })
      }
    } catch (e) {
      toast(e?.message || t('personaSettings.failed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className={`w-full p-5 border border-indigo-500/20 space-y-4 ${className}`.trim()}>
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-200/90">
          {t('personaSettings.title')}
        </h2>
        <p className="text-sm text-token-textMuted mt-1">{t('personaSettings.subtitle', { current: currentTitle })}</p>
        <p className="text-xs text-token-textMuted mt-1">{t('personaSettings.keepNote')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PERSONA_ORDER.map((id) => {
          const meta = PERSONA_UI[id]
          const selected = picked === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPicked(id)}
              className={[
                'text-left rounded-xl border px-3 py-3 transition-colors',
                selected
                  ? 'border-primary bg-primary/10 text-white'
                  : 'border-white/10 bg-white/[0.03] text-gray-200 hover:border-white/20',
              ].join(' ')}
            >
              <span className="flex items-center gap-2">
                <NavIcon name={meta.icon} className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">{t(meta.titleKey)}</span>
              </span>
            </button>
          )
        })}
      </div>
      <Button disabled={!picked} loading={busy} onClick={() => void save()}>
        {t('personaSettings.save')}
      </Button>
    </Card>
  )
}
