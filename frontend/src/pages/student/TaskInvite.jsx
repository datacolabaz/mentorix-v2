import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import useAuthStore from '../../hooks/useAuth'
import Button from '../../components/common/Button'
import Card from '../../components/common/Card'
import { useToast } from '../../components/common/Toast'
import GoogleSignInButton from '../../components/auth/GoogleSignInButton'

const RETURN_KEY = 'mx_return_after_login'

export default function TaskInvite() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user, setSession } = useAuthStore()
  const id = useMemo(() => String(taskId || '').trim(), [taskId])
  const [info, setInfo] = useState(null)
  const [infoLoading, setInfoLoading] = useState(Boolean(id))
  const [infoError, setInfoError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [joinBusy, setJoinBusy] = useState(false)

  useEffect(() => {
    if (!id) { setInfoLoading(false); setInfoError('Tapşırıq linki düzgün deyil'); return }
    try { sessionStorage.setItem(RETURN_KEY, `/task/${encodeURIComponent(id)}`) } catch { /* ignore */ }
    let cancelled = false
    ;(async () => {
      setInfoLoading(true); setInfoError('')
      try {
        const d = await api.get(`/public/task-invite/${encodeURIComponent(id)}`)
        if (!cancelled) setInfo(d)
      } catch (err) {
        if (!cancelled) setInfoError(err?.message || 'Tapşırıq tapılmadı')
      } finally { if (!cancelled) setInfoLoading(false) }
    })()
    return () => { cancelled = true }
  }, [id])

  const acceptInvite = useCallback(async () => {
    if (!id || user?.role !== 'student') return
    setJoinBusy(true)
    try {
      const sub = await api.post(`/tasks/${encodeURIComponent(id)}/access-from-link`, {})
      toast(sub?.message || 'Tapşırıqa daxil ola bilərsiniz', 'success')
      navigate(`/student/tasks?task=${encodeURIComponent(id)}`, { replace: true })
    } catch (err) {
      toast(err?.message || 'Qoşulma alınmadı', 'error')
    } finally { setJoinBusy(false) }
  }, [id, user?.role, navigate, toast])

  useEffect(() => {
    if (user?.role === 'student' && id && info?.task && !infoLoading && !infoError) void acceptInvite()
  }, [user?.role, id, info, infoLoading, infoError, acceptInvite])

  const handleGoogleCredential = async (credential) => {
    setAuthBusy(true)
    try {
      let r = await api.post('/auth/google/login', { credential })
      if (r?.needs_role || r?.needs_phone_link) r = await api.post('/auth/google/complete', { credential, role: 'student' })
      if (r?.needs_phone_link) return toast('Bu Google hesabı başqa telefon hesabına bağlıdır.', 'error')
      if (!r?.token || !r?.user) return toast(r?.message || 'Google girişi tamamlanmadı', 'error')
      if (r.user.role && r.user.role !== 'student') return toast('Bu hesab tələbə deyil', 'error')
      setSession(r.token, { ...r.user, needs_phone_verification: false })
      toast('Daxil oldunuz', 'success')
    } catch (err) { toast(err?.message || 'Google girişi uğursuz', 'error') }
    finally { setAuthBusy(false) }
  }

  const loginHref = `/login?next=${encodeURIComponent(id ? `/task/${id}` : '/student')}`
  const task = info?.task

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto w-full min-h-[70vh]">
      <h1 className="font-display font-bold text-2xl text-token-textMain">Tapşırıqa qoşul</h1>
      <p className="text-sm text-token-textMuted mt-1 mb-6">Tapşırıqa başlamaq üçün Google ilə daxil olun. Telefon tələb olunmur.</p>
      {infoLoading && <p className="text-sm text-token-textMuted">Yüklənir…</p>}
      {infoError && <Card className="p-4 border border-red-500/30 text-red-300 text-sm mb-4">{infoError}</Card>}
      {task && (
        <Card className="p-4 mb-4 border border-[color:var(--border-subtle)]">
          <p className="text-xs uppercase tracking-wider text-token-textMuted mb-1">Tapşırıq</p>
          <p className="text-lg font-semibold text-token-textMain">{task.title}</p>
          <p className="text-sm text-token-textMuted mt-1">Müəllim: {task.instructor_name}</p>
        </Card>
      )}
      {!infoLoading && !infoError && task ? (
        <Card className="p-4 space-y-4">
          {user?.role === 'student' ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-emerald-300">Daxil: <span className="font-medium">{user.email || user.full_name}</span></p>
              <Button type="button" loading={joinBusy} onClick={() => void acceptInvite()}>Tapşırıqa başla</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <GoogleSignInButton onCredential={handleGoogleCredential} disabled={authBusy} />
              <Link to={loginHref} className="block text-center text-sm text-primary hover:underline font-medium">Email ilə giriş</Link>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  )
}
