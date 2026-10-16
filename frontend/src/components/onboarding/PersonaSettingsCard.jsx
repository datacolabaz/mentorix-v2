import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Card from '../common/Card'
import Button from '../common/Button'
import NavIcon from '../common/NavIcon'
import { useToast } from '../common/Toast'
import useAuthStore from '../../hooks/useAuth'
import api from '../../lib/api'
import {
  dashboardPathForUser,
  consumeReturnAfterLogin,
  isInviteResumePath,
  peekReturnAfterLogin,
} from '../../lib/postAuth'
import {
  PERSONAS,
  PERSONA_UI,
  pickerPersonaIds,
  resolveUserPersona,
} from '../../constants/personas'

export default function PersonaSettingsCard({ className = '' }) {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const { user, setSession, mergeUser } = useAuthStore()
  const current = resolveUserPersona(user)
  const [picked, setPicked] = useState(current)
  const [busy, setBusy] = useState(false)

  const changed = picked && picked !== current
  const currentTitle = useMemo(
    () => (current ? t(PERSONA_UI[current]?.titleKey || '') : t('personaSettings.noneSelected')),
    [current, t],
  )

  const goPrimaryHome = (nextUser) => {
    const nextPath = dashboardPathForUser(nextUser)
    if (!nextPath) return
    const here = String(window.location.pathname || '').replace(/\/+$/, '') || '/'
    if (here !== nextPath) navigate(nextPath, { replace: true })
  }

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
      // Partner already selected but user may still be stuck in role shell — land on cabinet.
      if (picked === PERSONAS.PARTNER) {
        goPrimaryHome(user)
        toast(t('personaSettings.alreadySaved'), 'success')
        return
      }
      toast(t('personaSettings.alreadySaved'), 'success')
      return
    }
    setBusy(true)
    try {
      const existing = user?.persona_profile?.[picked] || {}
      const r = await api.patch('/auth/persona', { persona: picked, profile: existing })
      if (r?.pending_approval) {
        // Teacher / education-centre access is granted by an admin or organization — not by this switch.
        if (r.user) mergeUser(r.user)
        setPicked(current)
        toast(r.message || t('personaSettings.approvalPending', { defaultValue: 'Müəllim icazəsi sorğunuz göndərildi.' }), 'success')
        return
      }
      if (!r?.token || !r?.user) throw new Error(r?.message || t('auth.errors.invalidServer'))
      setSession(r.token, r.user)
      toast(t('personaSettings.saved'), 'success')
      const invite = peekReturnAfterLogin()
      if (isInviteResumePath(invite)) {
        consumeReturnAfterLogin()
        navigate(invite, { replace: true })
        return
      }
      goPrimaryHome(r.user)
    } catch (e) {
      toast(e?.message || t('personaSettings.failed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className={`w-full p-5 border border-token-border space-y-4 ${className}`.trim()}>
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-token-textMuted">
          {t('personaSettings.title')}
        </h2>
        <p className="text-sm text-token-textMuted mt-1">{t('personaSettings.subtitle', { current: currentTitle })}</p>
        <p className="text-xs text-token-textMuted mt-1">{t('personaSettings.keepNote')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {pickerPersonaIds(current).map((id) => {
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
                  ? 'border-primary bg-primary/15 text-token-textMain'
                  : 'border-token-border bg-token-bg/50 text-token-textMain hover:border-primary/40 hover:bg-token-bg',
              ].join(' ')}
            >
              <span className="flex items-center gap-2">
                <NavIcon name={meta.icon} className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-semibold text-token-textMain">{t(meta.titleKey)}</span>
              </span>
            </button>
          )
        })}
      </div>
      {user?.teacher_request?.status === 'pending' ? (
        <p className="text-xs rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-300">
          {t('personaSettings.teacherPending', {
            defaultValue: 'Müəllim icazəsi sorğunuz admin və ya təşkilat təsdiqini gözləyir.',
          })}
        </p>
      ) : null}
      {user?.teacher_request?.status === 'rejected' ? (
        <p className="text-xs rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-600 dark:text-red-300">
          {t('personaSettings.teacherRejected', { defaultValue: 'Müəllim icazəsi sorğunuz rədd edildi.' })}
          {user.teacher_request.review_reason ? ` ${user.teacher_request.review_reason}` : ''}
        </p>
      ) : null}
      <Button disabled={!picked} loading={busy} onClick={() => void save()}>
        {t('personaSettings.save')}
      </Button>
    </Card>
  )
}
