import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import GoogleSignInButton from './GoogleSignInButton'
import { useToast } from '../common/Toast'
import useAuthStore from '../../hooks/useAuth'
import { googleAuthWithAutoRole, googlePortalLogin } from '../../lib/googleAuth'
import { postAuthNavigate } from '../../lib/postAuth'
import { authLoggedInToastKey, authLoginErrorMessage } from '../../lib/authWelcomeToast'

/**
 * Landing / axtarış — mövcud Google hesabı ilə giriş.
 * With `portal`, the portal screen owns the outcome: onSuccess(result) / onError(err) (return true when handled).
 */
export default function PublicGoogleSignIn({ className = '', label, context = 'signin', portal = null, onSuccess, onError }) {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const { setSession } = useAuthStore()
  const [busy, setBusy] = useState(false)

  const handleCredential = async (credential) => {
    setBusy(true)
    try {
      if (portal) {
        const pr = await googlePortalLogin(credential, portal)
        if (!pr?.token || !pr?.user) throw new Error(pr?.message || t('auth.errors.googleIncomplete'))
        await onSuccess?.(pr)
        return
      }
      const r = await googleAuthWithAutoRole(credential, null)
      if (!r?.token || !r?.user) {
        toast(r?.message || t('auth.errors.googleIncomplete'), 'error')
        return
      }
      const u = {
        ...r.user,
        needs_phone_verification: false,
        needs_instructor_phone: false,
      }
      setSession(r.token, u)
      // Do not claim "logged in as student" before purpose is chosen.
      if (!(r?.needs_onboarding || r?.needs_role)) {
        toast(t(authLoggedInToastKey(u)), 'success')
      }
      postAuthNavigate(u, navigate)
    } catch (err) {
      if (portal && onError?.(err)) return
      toast(authLoginErrorMessage(err, t) || err?.message || t('auth.toasts.googleFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={className}>
      <GoogleSignInButton
        onCredential={handleCredential}
        disabled={busy}
        label={label || t('auth.googleLogin')}
        context={context}
      />
    </div>
  )
}
