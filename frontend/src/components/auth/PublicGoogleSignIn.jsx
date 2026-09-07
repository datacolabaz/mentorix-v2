import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import GoogleSignInButton from './GoogleSignInButton'
import { useToast } from '../common/Toast'
import useAuthStore from '../../hooks/useAuth'
import { googleAuthWithAutoRole } from '../../lib/googleAuth'
import { postAuthNavigate } from '../../lib/postAuth'

/** Landing / axtarış — mövcud Google hesabı ilə giriş. */
export default function PublicGoogleSignIn({ className = '', label, context = 'signin' }) {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const { setSession } = useAuthStore()
  const [busy, setBusy] = useState(false)

  const handleCredential = async (credential) => {
    setBusy(true)
    try {
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
      toast(u.role === 'student' ? t('auth.toasts.loggedInStudent') : t('auth.toasts.loggedIn'), 'success')
      postAuthNavigate(u, navigate)
    } catch (err) {
      toast(err?.message || t('auth.toasts.googleFailed'), 'error')
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
